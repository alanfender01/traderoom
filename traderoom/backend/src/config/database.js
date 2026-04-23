// =============================================
// TRADEROOM — Conexão com o Banco de Dados
// =============================================
// Este arquivo gerencia a conexão com o PostgreSQL
// Usamos o pacote 'pg' (node-postgres)

const { Pool } = require('pg')

// Pool = grupo de conexões reutilizáveis
// Em vez de abrir e fechar conexão a cada request,
// mantemos um "pool" de conexões prontas
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }  // necessário no Railway/Supabase
    : false
})

// Testa a conexão ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco:', err.message)
  } else {
    console.log('✅ Banco de dados conectado!')
    release()
  }
})

// Função helper para executar queries
// Uso: await db.query('SELECT * FROM usuarios WHERE id = $1', [id])
const db = {
  query: (text, params) => pool.query(text, params),
  pool
}

module.exports = db
