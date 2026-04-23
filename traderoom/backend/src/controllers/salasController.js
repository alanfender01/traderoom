// =============================================
// TRADEROOM — Controller de Salas
// =============================================

const db = require('../config/database')
const redis = require('../config/redis')

// ─────────────────────────────────────────────
// CRIAR SALA
// POST /api/salas
// Body: { nome, mercado, ativos, limite_traders }
// ─────────────────────────────────────────────
async function criarSala(req, res) {
  const { nome, mercado, ativos, limite_traders = 10 } = req.body
  const criador_id = req.usuario.id

  if (!nome || !mercado || !ativos?.length) {
    return res.status(400).send({ erro: 'Nome, mercado e ativos são obrigatórios' })
  }

  const mercadosValidos = ['b3', 'forex', 'cripto']
  if (!mercadosValidos.includes(mercado)) {
    return res.status(400).send({ erro: 'Mercado inválido. Use: b3, forex ou cripto' })
  }

  // Cria a sala no banco
  const { rows } = await db.query(
    `INSERT INTO salas (nome, mercado, ativos, criador_id, limite_traders)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [nome, mercado, ativos, criador_id, limite_traders]
  )

  const sala = rows[0]

  // Adiciona o criador como membro fixo automaticamente
  await db.query(
    `INSERT INTO membros_sala (sala_id, usuario_id, pinado)
     VALUES ($1, $2, true)`,
    [sala.id, criador_id]
  )

  // Cria uma nova sessão
  const { rows: sessao } = await db.query(
    `INSERT INTO sessoes (sala_id) VALUES ($1) RETURNING id`,
    [sala.id]
  )

  // Marca a sala como ativa no Redis
  await redis.setSalaAtiva(sala.id, {
    id: sala.id,
    nome: sala.nome,
    mercado: sala.mercado,
    ativos: sala.ativos,
    criador_id,
    criador_trader_id: req.usuario.trader_id,
    sessao_id: sessao[0].id,
    traders_online: [],
    total_online: 0,
    iniciada_em: new Date().toISOString()
  })

  return res.status(201).send({
    mensagem: 'Sala criada com sucesso!',
    sala: {
      ...sala,
      sessao_id: sessao[0].id
    }
  })
}

// ─────────────────────────────────────────────
// LISTAR SALAS POR MERCADO
// GET /api/salas?mercado=b3
// ─────────────────────────────────────────────
async function listarSalas(req, res) {
  const { mercado } = req.query
  const usuario_id = req.usuario.id

  let query = `
    SELECT
      s.id, s.nome, s.mercado, s.ativos, s.limite_traders,
      s.total_sessoes, s.criada_em, s.status,
      u.trader_id AS criador_trader_id,
      COUNT(DISTINCT ms.usuario_id) AS total_membros,
      EXISTS(
        SELECT 1 FROM membros_sala
        WHERE sala_id = s.id AND usuario_id = $1 AND pinado = true
      ) AS sou_membro_fixo,
      EXISTS(
        SELECT 1 FROM salas
        WHERE id = s.id AND criador_id = $1
      ) AS sou_criador
    FROM salas s
    LEFT JOIN usuarios u ON s.criador_id = u.id
    LEFT JOIN membros_sala ms ON s.id = ms.sala_id
    WHERE s.status = 'aberta'
  `

  const params = [usuario_id]

  if (mercado) {
    params.push(mercado)
    query += ` AND s.mercado = $${params.length}`
  }

  query += `
    GROUP BY s.id, u.trader_id
    ORDER BY sou_criador DESC, sou_membro_fixo DESC, s.total_sessoes DESC
  `

  const { rows } = await db.query(query, params)

  // Enriquece com dados ao vivo do Redis
  const salasComOnline = await Promise.all(
    rows.map(async (sala) => {
      const ativa = await redis.getSalaAtiva(sala.id)
      return {
        ...sala,
        ao_vivo: !!ativa,
        traders_online: ativa?.total_online || 0
      }
    })
  )

  return res.send(salasComOnline)
}

// ─────────────────────────────────────────────
// DETALHES DA SALA
// GET /api/salas/:id
// ─────────────────────────────────────────────
async function detalhesSala(req, res) {
  const { id } = req.params

  const { rows } = await db.query(
    `SELECT s.*, u.trader_id AS criador_trader_id, u.nome AS criador_nome
     FROM salas s
     LEFT JOIN usuarios u ON s.criador_id = u.id
     WHERE s.id = $1`,
    [id]
  )

  if (!rows.length) {
    return res.status(404).send({ erro: 'Sala não encontrada' })
  }

  const sala = rows[0]
  const ativa = await redis.getSalaAtiva(id)

  return res.send({
    ...sala,
    ao_vivo: !!ativa,
    traders_online: ativa?.total_online || 0
  })
}

// ─────────────────────────────────────────────
// ENCERRAR SALA (somente o criador)
// DELETE /api/salas/:id
// ─────────────────────────────────────────────
async function encerrarSala(req, res) {
  const { id } = req.params
  const usuario_id = req.usuario.id

  // Verifica se é o criador
  const { rows } = await db.query(
    'SELECT criador_id FROM salas WHERE id = $1',
    [id]
  )

  if (!rows.length) {
    return res.status(404).send({ erro: 'Sala não encontrada' })
  }

  if (rows[0].criador_id !== usuario_id) {
    return res.status(403).send({ erro: 'Somente o criador pode encerrar a sala' })
  }

  // Encerra no banco
  await db.query(
    `UPDATE salas SET status = 'encerrada', encerrada_em = NOW() WHERE id = $1`,
    [id]
  )

  // Encerra sessão ativa
  await db.query(
    `UPDATE sessoes SET encerrada_em = NOW()
     WHERE sala_id = $1 AND encerrada_em IS NULL`,
    [id]
  )

  // Remove do Redis
  await redis.removeSala(id)

  return res.send({ mensagem: 'Sala encerrada com sucesso' })
}

// ─────────────────────────────────────────────
// PINAR / DESPINAR MEMBRO
// PUT /api/salas/:id/membros/:usuario_id/pin
// ─────────────────────────────────────────────
async function togglePin(req, res) {
  const { id: sala_id, usuario_id: membro_id } = req.params
  const criador_id = req.usuario.id

  // Verifica se é o criador
  const { rows: sala } = await db.query(
    'SELECT criador_id FROM salas WHERE id = $1',
    [sala_id]
  )

  if (!sala.length || sala[0].criador_id !== criador_id) {
    return res.status(403).send({ erro: 'Somente o criador pode pinar membros' })
  }

  // Alterna o pin
  const { rows } = await db.query(
    `UPDATE membros_sala
     SET pinado = NOT pinado
     WHERE sala_id = $1 AND usuario_id = $2
     RETURNING pinado`,
    [sala_id, membro_id]
  )

  if (!rows.length) {
    return res.status(404).send({ erro: 'Membro não encontrado nesta sala' })
  }

  return res.send({
    mensagem: rows[0].pinado ? 'Membro adicionado à turma!' : 'Membro removido da turma',
    pinado: rows[0].pinado
  })
}

// ─────────────────────────────────────────────
// LISTAR MEMBROS DA SALA
// GET /api/salas/:id/membros
// ─────────────────────────────────────────────
async function listarMembros(req, res) {
  const { id } = req.params

  const { rows } = await db.query(
    `SELECT
      ms.usuario_id, ms.pinado, ms.total_sessoes_nesta_sala, ms.entrou_em,
      u.trader_id, u.nome
     FROM membros_sala ms
     JOIN usuarios u ON ms.usuario_id = u.id
     WHERE ms.sala_id = $1
     ORDER BY ms.pinado DESC, ms.total_sessoes_nesta_sala DESC`,
    [id]
  )

  return res.send(rows)
}

module.exports = {
  criarSala,
  listarSalas,
  detalhesSala,
  encerrarSala,
  togglePin,
  listarMembros
}
