// =============================================
// TRADEROOM — Hook de WebSocket (Frontend)
// =============================================
// Hook React que gerencia a conexão Socket.io
// Uso: const { socket, conectado } = useSocket()

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import Cookies from 'js-cookie'

export function useSocket() {
  const socketRef = useRef(null)
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    const token = Cookies.get('tr_token')
    if (!token) return

    // Cria a conexão com o servidor WebSocket
    socketRef.current = io(
      process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
      {
        auth: { token },           // envia o token para autenticação
        transports: ['websocket'], // prefere WebSocket puro
        reconnectionAttempts: 5,   // tenta reconectar 5 vezes
        reconnectionDelay: 1000    // espera 1s entre tentativas
      }
    )

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('🔌 WebSocket conectado')
      setConectado(true)
    })

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket desconectado')
      setConectado(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Erro WebSocket:', err.message)
    })

    // Limpa a conexão quando o componente é desmontado
    return () => {
      socket.disconnect()
    }
  }, [])

  return {
    socket: socketRef.current,
    conectado
  }
}

// ─────────────────────────────────────────────
// Hook específico para uma sala
// ─────────────────────────────────────────────
export function useSala(sala_id) {
  const { socket, conectado } = useSocket()
  const [sala, setSala] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [tradersOnline, setTradersOnline] = useState([])
  const [souCriador, setSouCriador] = useState(false)
  const [anotacoes, setAnotacoes] = useState([])
  const [timeframe, setTimeframe] = useState('1m')

  useEffect(() => {
    if (!socket || !conectado || !sala_id) return

    // Entra na sala
    socket.emit('entrar_sala', { sala_id })

    // Dados iniciais da sala
    socket.on('sala_carregada', ({ sala: dados, sou_criador }) => {
      setSala(dados)
      setSouCriador(sou_criador)
      setTradersOnline(dados.traders_online || [])
    })

    // Nova mensagem no chat
    socket.on('nova_mensagem', (msg) => {
      setMensagens(prev => [...prev, msg])
    })

    // Trader entrou
    socket.on('trader_entrou', ({ trader_id, total_online }) => {
      setTradersOnline(prev => {
        if (prev.find(t => t.trader_id === trader_id)) return prev
        return [...prev, { trader_id }]
      })
    })

    // Trader saiu
    socket.on('trader_saiu', ({ trader_id }) => {
      setTradersOnline(prev => prev.filter(t => t.trader_id !== trader_id))
    })

    // Anotação nova no gráfico
    socket.on('anotacao_nova', (anotacao) => {
      setAnotacoes(prev => [...prev, anotacao])
    })

    // Anotações limpas
    socket.on('anotacoes_limpas', () => {
      setAnotacoes([])
    })

    // Timeframe mudou
    socket.on('timeframe_mudou', ({ timeframe: tf }) => {
      setTimeframe(tf)
    })

    // Erro
    socket.on('erro', ({ mensagem }) => {
      console.error('Erro na sala:', mensagem)
    })

    return () => {
      socket.off('sala_carregada')
      socket.off('nova_mensagem')
      socket.off('trader_entrou')
      socket.off('trader_saiu')
      socket.off('anotacao_nova')
      socket.off('anotacoes_limpas')
      socket.off('timeframe_mudou')
      socket.off('erro')
    }
  }, [socket, conectado, sala_id])

  // ─────────────────────────────────────────
  // Funções de ação
  // ─────────────────────────────────────────

  const enviarMensagem = (conteudo) => {
    if (!socket || !conteudo.trim()) return
    socket.emit('enviar_mensagem', { sala_id, conteudo })
  }

  const enviarAnotacao = (tipo, dados) => {
    if (!socket || !souCriador) return
    socket.emit('anotacao', { sala_id, tipo, dados })
  }

  const mudarTimeframe = (tf) => {
    if (!socket || !souCriador) return
    socket.emit('mudar_timeframe', { sala_id, timeframe: tf })
    setTimeframe(tf) // atualiza local imediatamente
  }

  const limparAnotacoes = () => {
    if (!socket || !souCriador) return
    socket.emit('limpar_anotacoes', { sala_id })
  }

  return {
    sala,
    mensagens,
    tradersOnline,
    souCriador,
    anotacoes,
    timeframe,
    enviarMensagem,
    enviarAnotacao,
    mudarTimeframe,
    limparAnotacoes
  }
}
