# ClientHub - Sistema de Gestao de Clientes

Sistema web completo de cadastro de clientes com autenticacao, CRUD avancado, dashboard e interface premium.

## Features

### Autenticacao
- Registro e login de usuarios
- Senhas com bcrypt (hash seguro)
- Sessao via JWT (7 dias de validade)
- Rate limiting no login (max 5 tentativas / 15min)

### Gestao de Clientes (CRUD)
- Cadastrar, editar, listar e excluir clientes
- Campos: nome, email, telefone, endereco, categoria, observacoes
- Categorias: Pessoa Fisica / Empresa
- Upload de foto/avatar (JPG, PNG, WEBP ate 2MB)
- Busca em tempo real por nome, email ou telefone
- Filtro por categoria
- Paginacao (50 por pagina)
- Exportar clientes para CSV

### Dashboard
- Total de clientes, com email e com telefone
- Grafico de novos clientes por mes (ultimos 6 meses)
- Stats atualizam em tempo real

### UX
- Interface dark premium glassmorphism
- Toast de feedback (salvar, editar, excluir)
- Loading states nos botoes (evita duplo click)
- Validacao de email no front e back
- Totalmente responsivo (mobile e desktop)

## Stack
- **Backend**: Node.js + Express + SQLite (sql.js / WASM)
- **Auth**: bcryptjs + jsonwebtoken
- **Upload**: multer
- **Frontend**: HTML5 + CSS3 + vanilla JS
- **Deploy**: Railway / Render / qualquer host Node

## Como rodar

```bash
npm install
npm start
```

Acesse http://localhost:3000

## Deploy

1. Suba para o GitHub
2. Conecte no Railway.app ou Render.com
3. Deploy automatico

## Portfolio

Desenvolvido por **Rubens Pereira Fernandes**
GitHub: [Rubensdj](https://github.com/Rubensdj)
