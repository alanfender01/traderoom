# TradeRoom — Guia Completo do Projeto

## O que é este projeto
Plataforma de análise coletiva para day traders brasileiros.
Salas de trading em tempo real com gráficos, chat, áudio e vínculos sociais.
Inclui o TraderCalc — calculadora de IR integrada por R$10/mês.

## Estrutura de pastas

```
traderoom/
├── backend/          ← Servidor Node.js (API + WebSocket)
│   └── src/
│       ├── config/       ← Configurações (banco, env)
│       ├── controllers/  ← Lógica de cada rota
│       ├── middlewares/  ← Autenticação, validações
│       ├── models/       ← Estrutura do banco de dados
│       ├── routes/       ← Definição das rotas da API
│       └── services/     ← Regras de negócio
├── frontend/         ← Interface Next.js
│   └── src/
│       ├── components/   ← Componentes reutilizáveis
│       ├── pages/        ← Telas da aplicação
│       ├── styles/       ← CSS global
│       ├── hooks/        ← Lógica reutilizável React
│       └── utils/        ← Funções auxiliares
└── docs/             ← Documentação e diagramas
```

## Tecnologias utilizadas

| Camada        | Tecnologia       | Para que serve                          |
|---------------|------------------|-----------------------------------------|
| Frontend      | Next.js 14       | Interface web                           |
| Estilização   | TailwindCSS      | Visual dark, responsivo                 |
| Gráfico       | TradingView      | Candlesticks WIN/WDO/Forex/Cripto       |
| Backend       | Node.js + Fastify| Servidor e API REST                     |
| Tempo real    | Socket.io        | Salas, chat, sincronização do gráfico   |
| Áudio         | Agora.io         | Voz nas salas                           |
| Banco         | PostgreSQL       | Dados persistentes                      |
| Banco cache   | Redis            | Salas ativas, sessões online            |
| Auth          | Supabase         | Login, cadastro, JWT                    |
| Hospedagem FE | Vercel           | Deploy do frontend                      |
| Hospedagem BE | Railway          | Deploy do backend                       |
| Pagamento     | Mercado Pago     | Assinatura TraderCalc R$10/mês          |

## Como instalar (passo a passo)

### 1. Instalar ferramentas necessárias
- Node.js LTS: https://nodejs.org
- Git: https://git-scm.com
- VS Code: https://code.visualstudio.com

### 2. Clonar e instalar dependências
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configurar variáveis de ambiente
Renomear os arquivos `.env.example` para `.env` e preencher as chaves.

### 4. Rodar em desenvolvimento
```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Frontend abre em: http://localhost:3000
Backend roda em: http://localhost:3001
