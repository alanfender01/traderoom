// =============================================
// TRADEROOM — Utilitário de API (Frontend)
// =============================================
// Centraliza todas as chamadas HTTP para o backend
// Usa axios com interceptors para token automático

import axios from 'axios'
import Cookies from 'js-cookie'

// Cria instância do axios apontando para o backend
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000, // 10 segundos
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor de REQUEST
// Adiciona o token JWT automaticamente em toda requisição
api.interceptors.request.use((config) => {
  const token = Cookies.get('tr_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de RESPONSE
// Trata erros globalmente
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const mensagem = error.response?.data?.erro || 'Erro inesperado'

    // Token expirado — redireciona para login
    if (status === 401) {
      Cookies.remove('tr_token')
      Cookies.remove('tr_usuario')
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    return Promise.reject({ status, mensagem, dados: error.response?.data })
  }
)

// ─────────────────────────────────────────────
// FUNÇÕES DE AUTENTICAÇÃO
// ─────────────────────────────────────────────
export const authAPI = {

  cadastro: (dados) => api.post('/api/auth/cadastro', dados),

  login: async (dados) => {
    const resposta = await api.post('/api/auth/login', dados)
    // Salva token e dados do usuário em cookies
    Cookies.set('tr_token', resposta.token, { expires: 7 })
    Cookies.set('tr_usuario', JSON.stringify(resposta.usuario), { expires: 7 })
    return resposta
  },

  logout: () => {
    Cookies.remove('tr_token')
    Cookies.remove('tr_usuario')
  },

  perfil: () => api.get('/api/auth/perfil'),

  verificarId: (trader_id) => api.get(`/api/auth/verificar-id/${trader_id}`),

  getUsuarioLocal: () => {
    const dados = Cookies.get('tr_usuario')
    return dados ? JSON.parse(dados) : null
  },

  estaLogado: () => !!Cookies.get('tr_token')
}

// ─────────────────────────────────────────────
// FUNÇÕES DE SALAS
// ─────────────────────────────────────────────
export const salasAPI = {

  listar: (mercado) => api.get('/api/salas', {
    params: mercado ? { mercado } : {}
  }),

  criar: (dados) => api.post('/api/salas', dados),

  detalhes: (id) => api.get(`/api/salas/${id}`),

  encerrar: (id) => api.delete(`/api/salas/${id}`),

  listarMembros: (id) => api.get(`/api/salas/${id}/membros`),

  togglePin: (sala_id, usuario_id) =>
    api.put(`/api/salas/${sala_id}/membros/${usuario_id}/pin`)
}

export default api
