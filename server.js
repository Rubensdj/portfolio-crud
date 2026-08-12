const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const { initDb, prepare } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Nao autorizado' });
  }
  req.userId = sessions.get(token);
  next();
}

// === AUTH ===

app.post('/api/register', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatorios' });

  const exists = prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email ja cadastrado' });

  const hash = bcrypt.hashSync(senha, 10);
  const result = prepare('INSERT INTO users (email, senha) VALUES (?, ?)').run(email, hash);
  res.json({ id: result.lastInsertRowid, email });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatorios' });

  const user = prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Credenciais invalidas' });

  if (!bcrypt.compareSync(senha, user.senha)) {
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }

  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessions.set(token, user.id);
  res.json({ token, email: user.email });
});

// === CRUD CLIENTES ===

app.get('/api/clientes', authMiddleware, (req, res) => {
  const clientes = prepare('SELECT * FROM clientes WHERE user_id = ? ORDER BY id DESC').all(req.userId);
  res.json(clientes);
});

app.post('/api/clientes', authMiddleware, (req, res) => {
  const { nome, email, telefone, endereco } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatorio' });

  const result = prepare(
    'INSERT INTO clientes (user_id, nome, email, telefone, endereco) VALUES (?, ?, ?, ?, ?)'
  ).run(req.userId, nome, email || '', telefone || '', endereco || '');

  res.json({ id: result.lastInsertRowid, nome, email, telefone, endereco });
});

app.put('/api/clientes/:id', authMiddleware, (req, res) => {
  const { nome, email, telefone, endereco } = req.body;
  const cliente = prepare('SELECT * FROM clientes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado' });

  prepare(
    'UPDATE clientes SET nome = ?, email = ?, telefone = ?, endereco = ? WHERE id = ?'
  ).run(nome || cliente.nome, email ?? cliente.email, telefone ?? cliente.telefone, endereco ?? cliente.endereco, req.params.id);

  res.json({ id: Number(req.params.id), nome, email, telefone, endereco });
});

app.delete('/api/clientes/:id', authMiddleware, (req, res) => {
  const cliente = prepare('SELECT * FROM clientes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado' });

  prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializa DB e sobe o server
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Servidor rodando em http://localhost:' + PORT);
  });
}).catch(err => {
  console.error('Erro ao iniciar DB:', err);
  process.exit(1);
});
