const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { initDb, prepare, _getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clienthub-secret-change-in-prod';

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Pasta de uploads
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// === MIDDLEWARES ===

// Erro global (wraps async)
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// JWT auth
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nao autorizado' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
}

// Rate limiting no login (5 tentativas por IP a cada 15min)
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 min
  const maxAttempts = 5;

  if (!loginAttempts.has(ip)) loginAttempts.set(ip, []);

  const attempts = loginAttempts.get(ip).filter(t => now - t < windowMs);
  if (attempts.length >= maxAttempts) {
    const oldest = attempts[0];
    const retryIn = Math.ceil((windowMs - (now - oldest)) / 60000);
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em ' + retryIn + ' min' });
  }

  req.recordFailedLogin = () => {
    attempts.push(Date.now());
    loginAttempts.set(ip, attempts);
  };
  next();
}

// Upload de avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'avatar_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Formato invalido. Use JPG, PNG ou WEBP'), ok);
  }
});

// === VALIDACAO ===

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// === AUTH ===

app.post('/api/register', asyncHandler(async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatorios' });
  if (!validarEmail(email)) return res.status(400).json({ error: 'Email invalido' });
  if (senha.length < 6) return res.status(400).json({ error: 'Senha precisa ter no minimo 6 caracteres' });

  const exists = prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email ja cadastrado' });

  const hash = bcrypt.hashSync(senha, 10);
  const result = prepare('INSERT INTO users (email, senha) VALUES (?, ?)').run(email, hash);
  const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, email, id: result.lastInsertRowid });
}));

app.post('/api/login', rateLimitLogin, asyncHandler((req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatorios' });

  const user = prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    req.recordFailedLogin();
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, email: user.email });
}));

// === CRUD CLIENTES ===

app.get('/api/clientes', authMiddleware, asyncHandler((req, res) => {
  const { page = 1, limit = 50, search = '', categoria = '' } = req.query;
  const offset = (page - 1) * limit;
  const db = _getDb();
  
  let sql = 'SELECT * FROM clientes WHERE user_id = ?';
  let countSql = 'SELECT COUNT(*) as total FROM clientes WHERE user_id = ?';
  const params = [req.userId];
  
  if (search) {
    sql += ' AND (nome LIKE ? OR email LIKE ? OR telefone LIKE ?)';
    countSql += ' AND (nome LIKE ? OR email LIKE ? OR telefone LIKE ?)';
    const s = '%' + search + '%';
    params.push(s, s, s);
  }
  if (categoria) {
    sql += ' AND categoria = ?';
    countSql += ' AND categoria = ?';
    params.push(categoria);
  }
  
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  
  const stmt = db.prepare(sql);
  stmt.bind([...params, Number(limit), Number(offset)]);
  const clientes = [];
  while (stmt.step()) clientes.push(stmt.getAsObject());
  stmt.free();
  
  // Conta total
  const countStmt = db.prepare(countSql);
  countStmt.bind(params);
  let total = 0;
  if (countStmt.step()) total = countStmt.getAsObject().total;
  countStmt.free();
  
  res.json({
    clientes,
    paginacao: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

app.post('/api/clientes', authMiddleware, asyncHandler((req, res) => {
  const { nome, email, telefone, endereco, categoria, observacoes } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatorio' });
  if (email && !validarEmail(email)) return res.status(400).json({ error: 'Email invalido' });

  const result = prepare(
    'INSERT INTO clientes (user_id, nome, email, telefone, endereco, categoria, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId, nome.trim(), email || '', telefone || '', endereco || '', categoria || 'pessoa', observacoes || '');

  res.json({ id: result.lastInsertRowid, nome, email, telefone, endereco, categoria, observacoes });
}));

app.put('/api/clientes/:id', authMiddleware, asyncHandler((req, res) => {
  const { nome, email, telefone, endereco, categoria, observacoes } = req.body;
  const cliente = prepare('SELECT * FROM clientes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado' });
  if (email && !validarEmail(email)) return res.status(400).json({ error: 'Email invalido' });

  prepare(
    'UPDATE clientes SET nome = ?, email = ?, telefone = ?, endereco = ?, categoria = ?, observacoes = ? WHERE id = ?'
  ).run(
    nome || cliente.nome,
    email ?? cliente.email,
    telefone ?? cliente.telefone,
    endereco ?? cliente.endereco,
    categoria ?? cliente.categoria,
    observacoes ?? cliente.observacoes,
    req.params.id
  );

  res.json({ id: Number(req.params.id), success: true });
}));

app.delete('/api/clientes/:id', authMiddleware, asyncHandler((req, res) => {
  const cliente = prepare('SELECT * FROM clientes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado' });

  // Deleta avatar se existir
  if (cliente.avatar) {
    const filePath = path.join(UPLOAD_DIR, path.basename(cliente.avatar));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// Upload de avatar
app.post('/api/clientes/:id/avatar', authMiddleware, upload.single('avatar'), asyncHandler((req, res) => {
  const cliente = prepare('SELECT * FROM clientes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado' });

  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  // Deleta avatar antigo
  if (cliente.avatar) {
    const oldPath = path.join(UPLOAD_DIR, path.basename(cliente.avatar));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const avatarUrl = '/uploads/' + req.file.filename;
  prepare('UPDATE clientes SET avatar = ? WHERE id = ?').run(avatarUrl, req.params.id);

  res.json({ avatar: avatarUrl });
}));

// Stats do dashboard
app.get('/api/stats', authMiddleware, asyncHandler((req, res) => {
  const db = _getDb();
  
  // Total
  const total = prepare('SELECT COUNT(*) as count FROM clientes WHERE user_id = ?').get(req.userId).count;
  
  // Com email
  const comEmail = prepare("SELECT COUNT(*) as count FROM clientes WHERE user_id = ? AND email != ''").get(req.userId).count;
  
  // Com telefone
  const comTelefone = prepare("SELECT COUNT(*) as count FROM clientes WHERE user_id = ? AND telefone != ''").get(req.userId).count;
  
  // Por categoria
  const stmtCategorias = db.prepare("SELECT categoria, COUNT(*) as count FROM clientes WHERE user_id = ? GROUP BY categoria");
  stmtCategorias.bind([req.userId]);
  const categorias = [];
  while (stmtCategorias.step()) categorias.push(stmtCategorias.getAsObject());
  stmtCategorias.free();
  
  // Novos clientes por mes (ultimos 6 meses)
  const stmtMes = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mes, COUNT(*) as count 
    FROM clientes WHERE user_id = ? AND created_at >= date('now', '-6 months')
    GROUP BY mes ORDER BY mes
  `);
  stmtMes.bind([req.userId]);
  const porMes = [];
  while (stmtMes.step()) porMes.push(stmtMes.getAsObject());
  stmtMes.free();
  
  res.json({ total, comEmail, comTelefone, categorias, porMes });
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Erro global
app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Erro no upload: ' + err.message });
  }
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Servidor rodando em http://localhost:' + PORT);
  });
}).catch(err => {
  console.error('Erro ao iniciar DB:', err);
  process.exit(1);
});
