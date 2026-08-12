let token = localStorage.getItem('token');
let userEmail = localStorage.getItem('userEmail');

// Verifica se ja ta logado ao carregar
if (token) {
  mostrarDashboard();
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

async function fazerLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const errEl = document.getElementById('errorMsg');

  if (!email || !senha) {
    errEl.textContent = 'Preencha email e senha';
    return;
  }

  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await resp.json();

    if (!resp.ok) {
      errEl.textContent = data.error || 'Erro ao logar';
      return;
    }

    token = data.token;
    userEmail = data.email;
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', userEmail);
    mostrarDashboard();
  } catch (e) {
    errEl.textContent = 'Erro de conexao';
  }
}

async function registrar() {
  const email = document.getElementById('regEmail').value.trim();
  const senha = document.getElementById('regSenha').value;
  const errEl = document.getElementById('errorMsg');

  if (!email || !senha) {
    errEl.textContent = 'Preencha email e senha';
    return;
  }
  if (senha.length < 6) {
    errEl.textContent = 'Senha precisa ter no minimo 6 caracteres';
    return;
  }

  try {
    const resp = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await resp.json();

    if (!resp.ok) {
      errEl.textContent = data.error || 'Erro ao cadastrar';
      return;
    }

    // Auto-login apos registro
    errEl.textContent = '';
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginSenha').value = senha;
    fazerLogin();
  } catch (e) {
    errEl.textContent = 'Erro de conexao';
  }
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
}

// === CRUD CLIENTES ===

async function carregarClientes() {
  try {
    const resp = await fetch('/api/clientes', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (resp.status === 401) {
      logout();
      return;
    }

    const clientes = await resp.json();
    renderizarTabela(clientes);
    atualizarStats(clientes);
  } catch (e) {
    console.error('Erro ao carregar clientes:', e);
  }
}

function renderizarTabela(clientes) {
  const tbody = document.getElementById('clientesTable');
  const empty = document.getElementById('emptyState');

  tbody.innerHTML = '';

  if (clientes.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  clientes.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapar(c.nome)}</td>
      <td class="hide-mobile">${escapar(c.email) || '-'}</td>
      <td class="hide-mobile">${escapar(c.telefone) || '-'}</td>
      <td class="hide-mobile">${escapar(c.endereco) || '-'}</td>
      <td>
        <div class="actions">
          <button class="btn-icon edit" onclick="editarCliente(${c.id})">Editar</button>
          <button class="btn-icon delete" onclick="deletarCliente(${c.id})">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function atualizarStats(clientes) {
  document.getElementById('totalClientes').textContent = clientes.length;
  document.getElementById('totalEmails').textContent = clientes.filter(c => c.email).length;
  document.getElementById('totalTelefones').textContent = clientes.filter(c => c.telefone).length;
}

function abrirFormNovo() {
  document.getElementById('formTitle').textContent = 'Novo Cliente';
  document.getElementById('editId').value = '';
  document.getElementById('cliNome').value = '';
  document.getElementById('cliEmail').value = '';
  document.getElementById('cliTelefone').value = '';
  document.getElementById('cliEndereco').value = '';
  document.getElementById('formCard').classList.add('active');
}

function editarCliente(id) {
  fetch('/api/clientes', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(r => r.json())
    .then(clientes => {
      const c = clientes.find(x => x.id === id);
      if (!c) return;
      document.getElementById('formTitle').textContent = 'Editar Cliente';
      document.getElementById('editId').value = c.id;
      document.getElementById('cliNome').value = c.nome;
      document.getElementById('cliEmail').value = c.email;
      document.getElementById('cliTelefone').value = c.telefone;
      document.getElementById('cliEndereco').value = c.endereco;
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

  if (!nome) {
    alert('Nome e obrigatorio');
    return;
  }

  const body = { nome, email, telefone, endereco };
  const method = id ? 'PUT' : 'POST';
  const url = id ? '/api/clientes/' + id : '/api/clientes';

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const data = await resp.json();
      alert(data.error || 'Erro ao salvar');
      return;
    }

    fecharForm();
    carregarClientes();
  } catch (e) {
    alert('Erro de conexao');
  }
}

async function deletarCliente(id) {
  if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

  try {
    const resp = await fetch('/api/clientes/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!resp.ok) {
      alert('Erro ao excluir');
      return;
    }
    carregarClientes();
  } catch (e) {
    alert('Erro de conexao');
  }
}

// Utilitario contra XSS
function escapar(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Enter faz login
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') {
    if (document.getElementById('registerForm').style.display === 'block') {
      registrar();
    } else {
      fazerLogin();
    }
  }
});
