// =============================================
// TRADEROOM — Servidor Principal
// =============================================
// Este é o ponto de entrada do backend
// Configura o Fastify, Socket.io e inicia o servidor

require('dotenv').config() // carrega as variáveis do .env

const Fastify = require('fastify')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('@fastify/cors')

const rotas = require('./routes/index')
const { iniciarSocketIO } = require('./services/socketService')

// ─────────────────────────────────────────────
// Cria o servidor Fastify
// ─────────────────────────────────────────────
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'error' : 'info'
  }
})

// ─────────────────────────────────────────────
// Configura CORS
// Permite que o frontend (localhost:3000) acesse o backend
// ─────────────────────────────────────────────
fastify.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://traderoom.com.br' // domínio em produção
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
})

// ─────────────────────────────────────────────
// Registra todas as rotas
// ─────────────────────────────────────────────
fastify.register(rotas)

// ─────────────────────────────────────────────
// Configura Socket.io junto ao servidor HTTP
// ─────────────────────────────────────────────
const httpServer = createServer(fastify.server)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Inicia os eventos de tempo real
iniciarSocketIO(io)

// ─────────────────────────────────────────────
// Inicia o servidor
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001

const iniciar = async () => {
  try {
    await fastify.ready()

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('')
      console.log('╔════════════════════════════════════╗')
      console.log('║     TRADEROOM — SERVIDOR ATIVO     ║')
      console.log('╠════════════════════════════════════╣')
      console.log(`║  API:    http://localhost:${PORT}     ║`)
      console.log(`║  WS:     ws://localhost:${PORT}       ║`)
      console.log(`║  Modo:   ${process.env.NODE_ENV || 'development'}              ║`)
      console.log('╚════════════════════════════════════╝')
      console.log('')
    })

  } catch (err) {
    console.error('❌ Erro ao iniciar o servidor:', err)
    process.exit(1)
  }
}

iniciar()
