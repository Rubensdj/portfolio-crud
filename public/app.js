let token = localStorage.getItem('token');
let userEmail = localStorage.getItem('userEmail');
let paginaAtual = 1;
let totalPages = 1;
let buscaTimeout = null;

if (token) mostrarDashboard();

// === TOAST ===
function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + tipo + ' show';
  setTimeout(() => el.classList.remove('show'), 3000);
}

// === LOADING ===
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('.btn-text').style.display = loading ? 'none' : '';
  btn.querySelector('.btn-spinner').style.display = loading ? 'inline' : 'none';
}

// === AUTH ===
function mostrarLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('errorMsg').textContent = '';
}

function mostrarRegistro() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('errorMsg').textContent = '';
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function fazerLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const errEl = document.getElementById('errorMsg');

  if (!email || !senha) { errEl.textContent = 'Preencha email e senha'; return; }
  if (!validarEmail(email)) { errEl.textContent = 'Email invalido'; return; }

  setLoading('btnLogin', true);
  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await resp.json();
    if (!resp.ok) { errEl.textContent = data.error; return; }

    token = data.token;
    userEmail = data.email;
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', userEmail);
    mostrarDashboard();
    toast('Bem-vindo!', 'success');
  } catch { errEl.textContent = 'Erro de conexao'; }
  finally { setLoading('btnLogin', false); }
}

async function registrar() {
  const email = document.getElementById('regEmail').value.trim();
  const senha = document.getElementById('regSenha').value;
  const errEl = document.getElementById('errorMsg');

  if (!email || !senha) { errEl.textContent = 'Preencha email e senha'; return; }
  if (!validarEmail(email)) { errEl.textContent = 'Email invalido'; return; }
  if (senha.length < 6) { errEl.textContent = 'Senha minima de 6 caracteres'; return; }

  setLoading('btnRegister', true);
  try {
    const resp = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await resp.json();
    if (!resp.ok) { errEl.textContent = data.error; return; }

    token = data.token;
    userEmail = email;
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', userEmail);
    mostrarDashboard();
    toast('Conta criada!', 'success');
  } catch { errEl.textContent = 'Erro de conexao'; }
  finally { setLoading('btnRegister', false); }
}

function logout() {
  token = null;
  localStorage.removeItem('token');
  localStorage.removeItem('userEmail');
  document.getElementById('dashboard').classList.remove('active');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginSenha').value = '';
  mostrarLogin();
}

function mostrarDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  document.getElementById('userEmail').textContent = userEmail;
  carregarClientes();
  carregarStats();
}

// === STATS + CHART ===
async function carregarStats() {
  try {
    const resp = await fetch('/api/stats', { headers: { 'Authorization': 'Bearer ' + token } });
    if (resp.status === 401) { logout(); return; }
    const stats = await resp.json();

    document.getElementById('totalClientes').textContent = stats.total;
    document.getElementById('totalEmails').textContent = stats.comEmail;
    document.getElementById('totalTelefones').textContent = stats.comTelefone;

    renderChart(stats.porMes);
  } catch {}
}

function renderChart(porMes) {
  const container = document.getElementById('chartBars');
  if (!porMes || porMes.length === 0) {
    container.innerHTML = '<div class="chart-empty">Sem dados suficientes ainda</div>';
    return;
  }

  const maxVal = Math.max(...porMes.map(p => p.count), 1);
  container.innerHTML = porMes.map(p => {
    const altura = (p.count / maxVal) * 100;
    const [, mesNum] = p.mes.split('-');
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const label = meses[parseInt(mesNum) - 1] || p.mes;
    return `
      <div class="chart-bar-group">
        <div class="chart-bar-value">${p.count}</div>
        <div class="chart-bar" style="height: ${altura}%"></div>
        <div class="chart-bar-label">${label}</div>
      </div>`;
  }).join('');
}

// === CRUD ===
async function carregarClientes() {
  const search = document.getElementById('searchInput').value.trim();
  const categoria = document.getElementById('filterCategoria').value;
  try {
    const params = new URLSearchParams({ page: paginaAtual, limit: 50 });
    if (search) params.set('search', search);
    if (categoria) params.set('categoria', categoria);

    const resp = await fetch('/api/clientes?' + params, { headers: { 'Authorization': 'Bearer ' + token } });
    if (resp.status === 401) { logout(); return; }
    const data = await resp.json();

    renderizarTabela(data.clientes);
    renderPaginacao(data.paginacao);
  } catch { toast('Erro ao carregar', 'error'); }
}

function renderizarTabela(clientes) {
  const tbody = document.getElementById('clientesTable');
  const empty = document.getElementById('emptyState');

  tbody.innerHTML = '';
  if (!clientes || clientes.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  clientes.forEach(c => {
    const inicial = c.nome.charAt(0).toUpperCase();
    const avatar = c.avatar
      ? `<img class="client-avatar" src="${c.avatar}" alt="">`
      : `<div class="client-avatar-placeholder">${inicial}</div>`;

    const dataFormatada = c.created_at
      ? new Date(c.created_at + 'Z').toLocaleDateString('pt-BR')
      : '-';

    const catLabel = c.categoria === 'empresa' ? 'Empresa' : 'Pessoa';
    const catBadge = `<span class="badge ${c.categoria}">${catLabel}</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${avatar}</td>
      <td>${escapar(c.nome)}</td>
      <td class="hide-mobile">${escapar(c.email) || '-'}</td>
      <td class="hide-mobile">${escapar(c.telefone) || '-'}</td>
      <td class="hide-mobile">${catBadge}</td>
      <td class="hide-mobile">${dataFormatada}</td>
      <td>
        <div class="actions">
          <button class="btn-icon edit" onclick="editarCliente(${c.id})">Editar</button>
          <button class="btn-icon delete" onclick="deletarCliente(${c.id})">Excluir</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderPaginacao(pag) {
  const div = document.getElementById('paginacao');
  totalPages = pag.totalPages;
  if (totalPages <= 1) { div.style.display = 'none'; return; }

  div.style.display = 'flex';
  document.getElementById('btnPrev').disabled = pag.page <= 1;
  document.getElementById('btnNext').disabled = pag.page >= totalPages;
  document.getElementById('pageInfo').textContent = `${pag.page} / ${pag.totalPages}`;
}

function mudarPagina(delta) {
  paginaAtual = Math.max(1, Math.min(totalPages, paginaAtual + delta));
  carregarClientes();
}

function buscarClientes() {
  clearTimeout(buscaTimeout);
  buscaTimeout = setTimeout(() => { paginaAtual = 1; carregarClientes(); }, 300);
}

function abrirFormNovo() {
  document.getElementById('formTitle').textContent = 'Novo Cliente';
  document.getElementById('editId').value = '';
  document.getElementById('cliNome').value = '';
  document.getElementById('cliEmail').value = '';
  document.getElementById('cliTelefone').value = '';
  document.getElementById('cliEndereco').value = '';
  document.getElementById('cliCategoria').value = 'pessoa';
  document.getElementById('cliObs').value = '';
  document.getElementById('avatarSection').style.display = 'none';
  document.getElementById('formCard').classList.add('active');
}

function editarCliente(id) {
  fetch('/api/clientes?page=1&limit=999', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.json())
    .then(data => {
      const c = data.clientes.find(x => x.id === id);
      if (!c) return;
      document.getElementById('formTitle').textContent = 'Editar Cliente';
      document.getElementById('editId').value = c.id;
      document.getElementById('cliNome').value = c.nome;
      document.getElementById('cliEmail').value = c.email;
      document.getElementById('cliTelefone').value = c.telefone;
      document.getElementById('cliEndereco').value = c.endereco || '';
      document.getElementById('cliCategoria').value = c.categoria || 'pessoa';
      document.getElementById('cliObs').value = c.observacoes || '';

      // Avatar preview
      const avSection = document.getElementById('avatarSection');
      const avImg = document.getElementById('avatarImg');
      if (c.avatar) {
        avImg.src = c.avatar;
        avImg.style.display = 'block';
        avSection.style.display = 'flex';
      } else {
        avSection.style.display = 'none';
      }

      document.getElementById('formCard').classList.add('active');
    });
}

function fecharForm() {
  document.getElementById('formCard').classList.remove('active');
}

async function salvarCliente() {
  const id = document.getElementById('editId').value;
  const nome = document.getElementById('cliNome').value.trim();
  const email = document.getElementById('cliEmail').value.trim();
  const telefone = document.getElementById('cliTelefone').value.trim();
  const endereco = document.getElementById('cliEndereco').value.trim();
  const categoria = document.getElementById('cliCategoria').value;
  const observacoes = document.getElementById('cliObs').value.trim();

  if (!nome) { toast('Nome obrigatorio', 'error'); return; }
  if (email && !validarEmail(email)) { toast('Email invalido', 'error'); return; }

  setLoading('btnSalvar', true);
  const method = id ? 'PUT' : 'POST';
  const url = id ? '/api/clientes/' + id : '/api/clientes';
  try {
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ nome, email, telefone, endereco, categoria, observacoes })
    });
    if (!resp.ok) {
      const data = await resp.json();
      toast(data.error || 'Erro ao salvar', 'error');
      return;
    }
    fecharForm();
    carregarClientes();
    carregarStats();
    toast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!', 'success');
  } catch { toast('Erro de conexao', 'error'); }
  finally { setLoading('btnSalvar', false); }
}

async function deletarCliente(id) {
  if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
  try {
    const resp = await fetch('/api/clientes/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) { toast('Erro ao excluir', 'error'); return; }
    carregarClientes();
    carregarStats();
    toast('Cliente excluido!', 'success');
  } catch { toast('Erro de conexao', 'error'); }
}

// === AVATAR UPLOAD ===
async function uploadAvatar(input) {
  const id = document.getElementById('editId').value;
  if (!id || !input.files[0]) return;

  const formData = new FormData();
  formData.append('avatar', input.files[0]);

  try {
    const resp = await fetch('/api/clientes/' + id + '/avatar', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });
    const data = await resp.json();
    if (!resp.ok) { toast(data.error || 'Erro no upload', 'error'); return; }
    document.getElementById('avatarImg').src = data.avatar + '?t=' + Date.now();
    toast('Foto atualizada!', 'success');
    carregarClientes();
  } catch { toast('Erro de conexao', 'error'); }
}

// === CSV EXPORT ===
function exportarCSV() {
  fetch('/api/clientes?page=1&limit=9999', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.json())
    .then(data => {
      if (!data.clientes || data.clientes.length === 0) {
        toast('Nenhum cliente para exportar', 'error');
        return;
      }

      const cabecalho = ['Nome', 'Email', 'Telefone', 'Endereco', 'Categoria', 'Observacoes', 'Cadastro'];
      const linhas = data.clientes.map(c => [
        c.nome, c.email, c.telefone, c.endereco || '',
        c.categoria === 'empresa' ? 'Empresa' : 'Pessoa Fisica',
        c.observacoes || '', c.created_at
      ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));

      const csv = [cabecalho.join(','), ...linhas].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clientes_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV exportado!', 'success');
    });
}

// Util
function escapar(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Enter faz login
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') {
    if (document.getElementById('registerForm').style.display === 'block') registrar();
    else fazerLogin();
  }
});
