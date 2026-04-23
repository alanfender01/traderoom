// =============================================
// TRADEROOM — Rotas da API
// =============================================
// Aqui definimos todos os endpoints da API
// Cada rota aponta para um controller

const authController = require('../controllers/authController')
const salasController = require('../controllers/salasController')
const { autenticar } = require('../middlewares/auth')

async function rotas(fastify) {

  // ─────────────────────────────────────────
  // ROTAS DE AUTENTICAÇÃO (públicas)
  // ─────────────────────────────────────────
  fastify.post('/api/auth/cadastro', authController.cadastro)
  fastify.post('/api/auth/login', authController.login)
  fastify.get('/api/auth/verificar-id/:trader_id', authController.verificarId)

  // ─────────────────────────────────────────
  // ROTAS DE AUTENTICAÇÃO (protegidas)
  // ─────────────────────────────────────────
  fastify.get('/api/auth/perfil',
    { preHandler: autenticar },
    authController.perfil
  )

  // ─────────────────────────────────────────
  // ROTAS DE SALAS (protegidas)
  // ─────────────────────────────────────────
  fastify.post('/api/salas',
    { preHandler: autenticar },
    salasController.criarSala
  )

  fastify.get('/api/salas',
    { preHandler: autenticar },
    salasController.listarSalas
  )

  fastify.get('/api/salas/:id',
    { preHandler: autenticar },
    salasController.detalhesSala
  )

  fastify.delete('/api/salas/:id',
    { preHandler: autenticar },
    salasController.encerrarSala
  )

  fastify.get('/api/salas/:id/membros',
    { preHandler: autenticar },
    salasController.listarMembros
  )

  fastify.put('/api/salas/:id/membros/:usuario_id/pin',
    { preHandler: autenticar },
    salasController.togglePin
  )

  // ─────────────────────────────────────────
  // ROTA DE SAÚDE (para verificar se o servidor está rodando)
  // ─────────────────────────────────────────
  fastify.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    versao: '1.0.0'
  }))
}

module.exports = rotas
