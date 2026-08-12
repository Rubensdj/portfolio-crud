const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');
let db = null;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const buffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      email TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      endereco TEXT DEFAULT '',
      categoria TEXT DEFAULT 'pessoa',
      observacoes TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migra tabelas antigas se faltarem colunas novas
  const cols = db.exec("PRAGMA table_info(clientes)")[0].values;
  const colNames = cols.map(c => c[1]);
  const novosCampos = [
    ['categoria', 'TEXT DEFAULT "pessoa"'],
    ['observacoes', 'TEXT DEFAULT ""'],
    ['avatar', 'TEXT DEFAULT ""']
  ];
  novosCampos.forEach(([col, def]) => {
    if (!colNames.includes(col)) {
      db.run(`ALTER TABLE clientes ADD COLUMN ${col} ${def}`);
    }
  });

  salvar();
  return db;
}

function salvar() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function prepare(sql) {
  return {
    run(...params) {
      db.run(sql, params);
      const res = db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid = res.length > 0 ? res[0].values[0][0] : 0;
      salvar();
      return { lastInsertRowid };
    },
    get(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      let row;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    }
  };
}

module.exports = { initDb, prepare, _getDb: () => db };
