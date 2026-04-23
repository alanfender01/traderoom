# =============================================
# TRADEROOM — GUIA DE INSTALAÇÃO PASSO A PASSO
# =============================================
# Siga exatamente nesta ordem. 
# Cada passo tem verificação para confirmar que funcionou.

## ─────────────────────────────────────────────
## PASSO 1 — Instalar as ferramentas
## ─────────────────────────────────────────────

### 1.1 Node.js
- Acesse: https://nodejs.org
- Baixe a versão LTS (esquerda)
- Instale com todas as opções padrão

Verificar (abra o CMD e digite):
  node --version    → deve mostrar v18.x.x ou v20.x.x
  npm --version     → deve mostrar 9.x.x ou 10.x.x

### 1.2 Git
- Acesse: https://git-scm.com
- Baixe e instale com opções padrão

Verificar:
  git --version     → deve mostrar git version 2.x.x

### 1.3 VS Code (já instalado ✅)


## ─────────────────────────────────────────────
## PASSO 2 — Criar conta no Supabase (banco de dados)
## ─────────────────────────────────────────────

1. Acesse: https://supabase.com
2. Clique em "Start your project"
3. Crie uma conta com GitHub ou email
4. Clique em "New Project"
5. Preencha:
   - Name: traderoom
   - Database Password: (anote esta senha!)
   - Region: South America (São Paulo)
6. Aguarde ~2 minutos para criar

Pegar as credenciais:
- Vá em Settings → Database → Connection string → URI
- Copie a string que começa com postgresql://...
- Vá em Settings → API
- Copie o Project URL e o anon key


## ─────────────────────────────────────────────
## PASSO 3 — Criar o banco de dados
## ─────────────────────────────────────────────

1. No Supabase, clique em "SQL Editor"
2. Clique em "New Query"
3. Abra o arquivo: backend/src/config/schema.sql
4. Copie TODO o conteúdo e cole no editor
5. Clique em "Run" (ou Ctrl+Enter)
6. Deve aparecer "Success" em verde


## ─────────────────────────────────────────────
## PASSO 4 — Configurar o projeto
## ─────────────────────────────────────────────

### 4.1 Backend
Abra o CMD na pasta backend/ e execute:

  # Instala as dependências
  npm install

  # Copia o arquivo de configuração
  copy .env.example .env

Abra o arquivo backend/.env no VS Code e preencha:
  DATABASE_URL=postgresql://... (copiado do Supabase)
  JWT_SECRET=qualquer_texto_longo_e_aleatorio_aqui_123456
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_ANON_KEY=eyJ...

### 4.2 Frontend
Abra o CMD na pasta frontend/ e execute:

  npm install
  copy .env.example .env.local


## ─────────────────────────────────────────────
## PASSO 5 — Rodar o projeto
## ─────────────────────────────────────────────

Você vai precisar de DOIS terminais abertos ao mesmo tempo.

### Terminal 1 — Backend
  cd backend
  npm run dev

Deve aparecer:
  ╔════════════════════════════════════╗
  ║     TRADEROOM — SERVIDOR ATIVO     ║
  ╚════════════════════════════════════╝

### Terminal 2 — Frontend
  cd frontend
  npm run dev

Deve aparecer:
  ▲ Next.js 14.x.x
  - Local: http://localhost:3000

Abra o navegador em: http://localhost:3000


## ─────────────────────────────────────────────
## PROBLEMAS COMUNS
## ─────────────────────────────────────────────

❌ "npm não é reconhecido"
   → Node.js não foi instalado corretamente
   → Reinstale e reinicie o CMD

❌ "Erro ao conectar ao banco"
   → Verifique se o DATABASE_URL no .env está correto
   → Confirme que o projeto no Supabase está ativo

❌ "Porta 3001 já em uso"
   → Mude PORT=3002 no .env do backend

❌ "Cannot find module"
   → Execute npm install novamente na pasta com erro
