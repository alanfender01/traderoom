// =============================================
// TRADEROOM — Conexão com o Redis
// =============================================
// Redis é um banco de dados em memória (RAM)
// Usamos para guardar dados temporários e rápidos:
// - Quais salas estão ativas agora
// - Quem está online em cada sala
// - Tokens de sessão temporários

const { createClient } = require('redis')

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

redis.on('error', (err) => {
  console.error('❌ Erro no Redis:', err.message)
})

redis.on('connect', () => {
  console.log('✅ Redis conectado!')
})

// Conecta ao iniciar
redis.connect()

// Funções helpers para facilitar o uso

// Salva um valor por X segundos
// Ex: await setEx('sala:abc123:online', 30, JSON.stringify(dados))
redis.setEx = async (key, seconds, value) => {
  await redis.set(key, value, { EX: seconds })
}

// Salva dados de uma sala ativa
redis.setSalaAtiva = async (salaId, dados) => {
  await redis.set(
    `sala:${salaId}`,
    JSON.stringify(dados),
    { EX: 60 * 60 * 12 } // expira em 12 horas
  )
}

// Busca dados de uma sala ativa
redis.getSalaAtiva = async (salaId) => {
  const data = await redis.get(`sala:${salaId}`)
  return data ? JSON.parse(data) : null
}

// Remove sala quando encerrada
redis.removeSala = async (salaId) => {
  await redis.del(`sala:${salaId}`)
}

// Lista todas as salas ativas
redis.getSalasAtivas = async () => {
  const keys = await redis.keys('sala:*')
  if (!keys.length) return []
  const values = await redis.mGet(keys)
  return values.map(v => v ? JSON.parse(v) : null).filter(Boolean)
}

module.exports = redis
