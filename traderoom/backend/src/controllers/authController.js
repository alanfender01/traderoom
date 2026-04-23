// =============================================
// TRADEROOM — Controller de Autenticação
// =============================================
// Controllers = funções que processam cada rota
// Este arquivo cuida de: cadastro, login, perfil

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuid } = require('uuid')
const db = require('../config/database')

// ─────────────────────────────────────────────
// CADASTRO
// POST /api/auth/cadastro
// Body: { nome, email, telefone, senha, trader_id }
// ─────────────────────────────────────────────
async function cadastro(req, res) {
  const { nome, email, telefone, senha, trader_id } = req.body

  // Validações básicas
  if (!nome || !email || !senha || !trader_id) {
    return res.status(400).send({ erro: 'Preencha todos os campos obrigatórios' })
  }

  if (senha.length < 8) {
    return res.status(400).send({ erro: 'A senha deve ter no mínimo 8 caracteres' })
  }

  // Verifica se email ou trader_id já existem
  const { rows: existe } = await db.query(
    'SELECT id FROM usuarios WHERE email = $1 OR trader_id = $2',
    [email.toLowerCase(), trader_id.toLowerCase()]
  )

  if (existe.length > 0) {
    return res.status(409).send({
      erro: 'Email ou ID já cadastrado. Tente outro.'
    })
  }

  // Criptografa a senha (nunca salvamos senha em texto puro!)
  // bcrypt transforma "minhasenha123" em "$2b$10$xyz..." de forma irreversível
  const senha_hash = await bcrypt.hash(senha, 10)

  // Insere no banco
  const { rows } = await db.query(
    `INSERT INTO usuarios (nome, email, telefone, senha_hash, trader_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, trader_id, nome, email, plano, plano_ativo, criado_em`,
    [nome, email.toLowerCase(), telefone, senha_hash, trader_id.toLowerCase()]
  )

  const usuario = rows[0]

  // Gera o token JWT
  const token = gerarToken(usuario)

  return res.status(201).send({
    mensagem: 'Conta criada com sucesso!',
    token,
    usuario: {
      id: usuario.id,
      trader_id: usuario.trader_id,
      nome: usuario.nome,
      email: usuario.email,
      plano: usuario.plano,
      plano_ativo: usuario.plano_ativo
    }
  })
}

// ─────────────────────────────────────────────
// LOGIN
// POST /api/auth/login
// Body: { email, senha }
// ─────────────────────────────────────────────
async function login(req, res) {
  const { email, senha } = req.body

  if (!email || !senha) {
    return res.status(400).send({ erro: 'Email e senha são obrigatórios' })
  }

  // Busca o usuário pelo email
  const { rows } = await db.query(
    'SELECT * FROM usuarios WHERE email = $1',
    [email.toLowerCase()]
  )

  if (!rows.length) {
    // Mensagem genérica por segurança (não revelar se email existe)
    return res.status(401).send({ erro: 'Email ou senha incorretos' })
  }

  const usuario = rows[0]

  // Compara a senha com o hash salvo
  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash)

  if (!senhaCorreta) {
    return res.status(401).send({ erro: 'Email ou senha incorretos' })
  }

  // Atualiza último login
  await db.query(
    'UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1',
    [usuario.id]
  )

  const token = gerarToken(usuario)

  return res.send({
    token,
    usuario: {
      id: usuario.id,
      trader_id: usuario.trader_id,
      nome: usuario.nome,
      email: usuario.email,
      plano: usuario.plano,
      plano_ativo: usuario.plano_ativo
    }
  })
}

// ─────────────────────────────────────────────
// PERFIL
// GET /api/auth/perfil (rota protegida)
// ─────────────────────────────────────────────
async function perfil(req, res) {
  // req.usuario foi preenchido pelo middleware de autenticação
  const { rows } = await db.query(
    `SELECT
      u.id, u.trader_id, u.nome, u.email, u.telefone,
      u.plano, u.plano_ativo, u.plano_expira, u.criado_em,
      COUNT(DISTINCT ms.sala_id) AS total_salas,
      SUM(ms.total_sessoes_nesta_sala) AS total_sessoes
     FROM usuarios u
     LEFT JOIN membros_sala ms ON u.id = ms.usuario_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [req.usuario.id]
  )

  return res.send(rows[0])
}

// ─────────────────────────────────────────────
// VERIFICAR ID DISPONÍVEL
// GET /api/auth/verificar-id/:trader_id
// ─────────────────────────────────────────────
async function verificarId(req, res) {
  const { trader_id } = req.params

  const { rows } = await db.query(
    'SELECT id FROM usuarios WHERE trader_id = $1',
    [trader_id.toLowerCase()]
  )

  return res.send({ disponivel: rows.length === 0 })
}

// ─────────────────────────────────────────────
// Função auxiliar — gera JWT
// ─────────────────────────────────────────────
function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      trader_id: usuario.trader_id,
      email: usuario.email
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

module.exports = { cadastro, login, perfil, verificarId }
