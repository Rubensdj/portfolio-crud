# ClientHub - Sistema de Gestao de Clientes

Sistema web completo de cadastro de clientes com autenticacao, CRUD avancado, dashboard e interface premium.

## Demo

Apos configurar o deploy (veja instrucoes abaixo), acesse a URL publica gerada pelo Render.

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

### UX
- Interface dark premium glassmorphism
- Toast de feedback (salvar, editar, excluir)
- Loading states nos botoes
- Validacao de email no front e back
- Totalmente responsivo (mobile e desktop)

## Stack
- Backend: Node.js + Express + SQLite (sql.js / WASM)
- Auth: bcryptjs + jsonwebtoken
- Upload: multer
- Frontend: HTML5 + CSS3 + vanilla JS

## Como rodar localmente

```bash
npm install
npm start
```

Acesse http://localhost:3000

## Deploy automatico via GitHub Actions + Render

O projeto esta configurado para deploy automatico. A cada push na main,
o GitHub Actions testa o codigo e dispara o deploy no Render.

### Setup (fazer uma so vez):

1. **Criar conta no Render** (gratis): https://render.com
   - Sign up com GitHub

2. **Criar o servico a partir do render.yaml**:
   - Acesse https://dashboard.render.com
   - Clique em "New" > "Blueprint"
   - Selecione o repositorio `Rubensdj/portfolio-crud`
   - O Render le o `render.yaml` e cria tudo automatico
   - Anote o **Service ID** que aparece na URL do dashboard
     (ex: srv-abc123, na URL https://dashboard.render.com/web/srv-abc123)

3. **Criar API Key do Render**:
   - Acesse https://dashboard.render.com/account/api-keys
   - Clique em "Create API key"
   - Copie a chave

4. **Configurar Secrets no GitHub**:
   - Acesse https://github.com/Rubensdj/portfolio-crud/settings/secrets/actions
   - Clique em "New repository secret" e adicione:
     - Nome: `RENDER_API_KEY`
     - Valor: (sua API key do passo 3)
   - Adicione outro secret:
     - Nome: `RENDER_SERVICE_ID`
     - Valor: (seu Service ID do passo 2, ex: srv-abc123)

5. **Pronto!** A cada push na main:
   - GitHub Actions roda testes
   - Dispara deploy automatico no Render
   - Sua app fica disponivel na URL do Render (ex: portfolio-crud.onrender.com)

## Portfolio

Desenvolvido por **Rubens Pereira Fernandes**
GitHub: [Rubensdj](https://github.com/Rubensdj)
