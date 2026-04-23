// =============================================
// TRADEROOM — Middleware de Autenticação
// =============================================
// Middleware = função que roda ANTES de cada rota protegida
// Verifica se o token JWT é válido
// Se não for, bloqueia o acesso

const jwt = require('jsonwebtoken')
const db = require('../config/database')

// Middleware principal de autenticação
async function autenticar(req, res) {
  try {
    // Pega o token do header Authorization
    // O frontend envia: Authorization: Bearer eyJhbGc...
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send({
        erro: 'Token não fornecido',
        codigo: 'SEM_TOKEN'
      })
    }

    const token = authHeader.split(' ')[1]

    // Verifica e decodifica o token
    let payload
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      return res.status(401).send({
        erro: 'Token inválido ou expirado',
        codigo: 'TOKEN_INVALIDO'
      })
    }

    // Busca o usuário no banco para garantir que ainda existe
    const { rows } = await db.query(
      'SELECT id, trader_id, nome, email, plano, plano_ativo FROM usuarios WHERE id = $1',
      [payload.id]
    )

    if (!rows.length) {
      return res.status(401).send({
        erro: 'Usuário não encontrado',
        codigo: 'USUARIO_NAO_ENCONTRADO'
      })
    }

    // Adiciona o usuário na requisição para usar nas rotas
    req.usuario = rows[0]

  } catch (err) {
    console.error('Erro no middleware de auth:', err)
    return res.status(500).send({ erro: 'Erro interno de autenticação' })
  }
}

// Middleware para rotas que exigem assinatura do TraderCalc
async function exigirCalcIR(req, res) {
  // Primeiro verifica autenticação normal
  await autenticar(req, res)

  // Se já retornou erro, para aqui
  if (res.sent) return

  // Verifica se tem assinatura ativa
  if (!req.usuario.plano_ativo || req.usuario.plano !== 'calcir') {
    return res.status(403).send({
      erro: 'Esta funcionalidade requer o plano TraderCalc',
      codigo: 'PLANO_NECESSARIO',
      plano: 'calcir',
      preco: 10.00
    })
  }
}

module.exports = { autenticar, exigirCalcIR }
