// =============================================
// TRADEROOM — Serviço de Tempo Real (Socket.io)
// =============================================
// Socket.io permite comunicação bidirecional em tempo real
// O servidor "escuta" eventos do cliente e vice-versa
//
// EVENTOS DO CLIENTE → SERVIDOR:
//   entrar_sala       - trader entra na sala
//   sair_sala         - trader sai da sala
//   enviar_mensagem   - nova mensagem no chat
//   anotacao          - criador desenhou algo no gráfico
//   mudar_timeframe   - criador mudou o timeframe
//
// EVENTOS DO SERVIDOR → CLIENTE:
//   sala_atualizada   - lista de traders online mudou
//   nova_mensagem     - nova mensagem recebida
//   anotacao_nova     - nova anotação no gráfico
//   timeframe_mudou   - timeframe foi alterado pelo criador
//   trader_entrou     - notifica quando alguém entra
//   trader_saiu       - notifica quando alguém sai

const jwt = require('jsonwebtoken')
const redis = require('../config/redis')
const db = require('../config/database')

function iniciarSocketIO(io) {

  // Middleware de autenticação do Socket.io
  // Verifica o token JWT antes de aceitar conexão
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error('Token não fornecido'))
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET)
      socket.usuario = payload
      next()

    } catch (err) {
      next(new Error('Token inválido'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`🔌 Trader conectado: ${socket.usuario.trader_id}`)

    // ─────────────────────────────────────────
    // ENTRAR NA SALA
    // ─────────────────────────────────────────
    socket.on('entrar_sala', async ({ sala_id }) => {
      try {
        // Pega dados da sala no Redis
        const sala = await redis.getSalaAtiva(sala_id)

        if (!sala) {
          socket.emit('erro', { mensagem: 'Sala não encontrada ou encerrada' })
          return
        }

        // Verifica limite de traders
        if (sala.traders_online.length >= sala.limite_traders) {
          socket.emit('erro', { mensagem: 'Sala lotada! Limite atingido.' })
          return
        }

        // Entra no "room" do Socket.io
        // Isso permite enviar mensagens só para quem está nessa sala
        socket.join(sala_id)
        socket.sala_id = sala_id

        // Atualiza lista de traders online
        const jaEsta = sala.traders_online.find(t => t.id === socket.usuario.id)
        if (!jaEsta) {
          sala.traders_online.push({
            id: socket.usuario.id,
            trader_id: socket.usuario.trader_id,
            socket_id: socket.id,
            entrou_em: new Date().toISOString()
          })
          sala.total_online = sala.traders_online.length

          await redis.setSalaAtiva(sala_id, sala)
        }

        // Registra no banco se é membro novo
        await db.query(
          `INSERT INTO membros_sala (sala_id, usuario_id)
           VALUES ($1, $2)
           ON CONFLICT (sala_id, usuario_id)
           DO UPDATE SET total_sessoes_nesta_sala = membros_sala.total_sessoes_nesta_sala + 1`,
          [sala_id, socket.usuario.id]
        )

        // Envia dados da sala para o trader que entrou
        socket.emit('sala_carregada', {
          sala,
          sou_criador: sala.criador_id === socket.usuario.id
        })

        // Avisa todos na sala que alguém entrou
        io.to(sala_id).emit('trader_entrou', {
          trader_id: socket.usuario.trader_id,
          total_online: sala.total_online
        })

        console.log(`👤 ${socket.usuario.trader_id} entrou em "${sala.nome}"`)

      } catch (err) {
        console.error('Erro ao entrar na sala:', err)
        socket.emit('erro', { mensagem: 'Erro ao entrar na sala' })
      }
    })

    // ─────────────────────────────────────────
    // ENVIAR MENSAGEM NO CHAT
    // ─────────────────────────────────────────
    socket.on('enviar_mensagem', async ({ sala_id, conteudo, tipo = 'chat' }) => {
      if (!conteudo?.trim()) return

      try {
        const sala = await redis.getSalaAtiva(sala_id)
        if (!sala) return

        // Salva no banco
        const { rows } = await db.query(
          `INSERT INTO mensagens (sessao_id, usuario_id, conteudo, tipo)
           VALUES ($1, $2, $3, $4)
           RETURNING id, criada_em`,
          [sala.sessao_id, socket.usuario.id, conteudo, tipo]
        )

        const mensagem = {
          id: rows[0].id,
          trader_id: socket.usuario.trader_id,
          conteudo,
          tipo,
          criada_em: rows[0].criada_em
        }

        // Envia para todos na sala (incluindo quem enviou)
        io.to(sala_id).emit('nova_mensagem', mensagem)

      } catch (err) {
        console.error('Erro ao enviar mensagem:', err)
      }
    })

    // ─────────────────────────────────────────
    // ANOTAÇÃO NO GRÁFICO (somente criador)
    // ─────────────────────────────────────────
    socket.on('anotacao', async ({ sala_id, tipo, dados }) => {
      try {
        const sala = await redis.getSalaAtiva(sala_id)
        if (!sala) return

        // Só o criador pode anotar
        if (sala.criador_id !== socket.usuario.id) {
          socket.emit('erro', { mensagem: 'Somente o criador pode fazer anotações' })
          return
        }

        // Envia para TODOS na sala (espelhamento)
        io.to(sala_id).emit('anotacao_nova', {
          tipo,    // 'suporte' | 'resistencia' | 'linha' | 'fibonacci'
          dados,   // coordenadas, cores, etc
          trader_id: socket.usuario.trader_id,
          criada_em: new Date().toISOString()
        })

        // Registra no chat como mensagem de sistema
        io.to(sala_id).emit('nova_mensagem', {
          trader_id: 'SISTEMA',
          conteudo: `${socket.usuario.trader_id} marcou ${tipo} no gráfico`,
          tipo: 'sistema',
          criada_em: new Date().toISOString()
        })

      } catch (err) {
        console.error('Erro ao enviar anotação:', err)
      }
    })

    // ─────────────────────────────────────────
    // MUDAR TIMEFRAME (somente criador)
    // ─────────────────────────────────────────
    socket.on('mudar_timeframe', async ({ sala_id, timeframe }) => {
      try {
        const sala = await redis.getSalaAtiva(sala_id)
        if (!sala || sala.criador_id !== socket.usuario.id) return

        // Envia para todos na sala
        io.to(sala_id).emit('timeframe_mudou', {
          timeframe,
          trader_id: socket.usuario.trader_id
        })

      } catch (err) {
        console.error('Erro ao mudar timeframe:', err)
      }
    })

    // ─────────────────────────────────────────
    // LIMPAR ANOTAÇÕES (somente criador)
    // ─────────────────────────────────────────
    socket.on('limpar_anotacoes', async ({ sala_id }) => {
      try {
        const sala = await redis.getSalaAtiva(sala_id)
        if (!sala || sala.criador_id !== socket.usuario.id) return

        io.to(sala_id).emit('anotacoes_limpas')

      } catch (err) {
        console.error('Erro ao limpar anotações:', err)
      }
    })

    // ─────────────────────────────────────────
    // DESCONEXÃO
    // ─────────────────────────────────────────
    socket.on('disconnect', async () => {
      try {
        const sala_id = socket.sala_id
        if (!sala_id) return

        const sala = await redis.getSalaAtiva(sala_id)
        if (!sala) return

        // Remove da lista de online
        sala.traders_online = sala.traders_online.filter(
          t => t.socket_id !== socket.id
        )
        sala.total_online = sala.traders_online.length

        await redis.setSalaAtiva(sala_id, sala)

        // Avisa a sala
        io.to(sala_id).emit('trader_saiu', {
          trader_id: socket.usuario.trader_id,
          total_online: sala.total_online
        })

        console.log(`👋 ${socket.usuario.trader_id} saiu da sala`)

      } catch (err) {
        console.error('Erro ao desconectar:', err)
      }
    })
  })
}

module.exports = { iniciarSocketIO }
