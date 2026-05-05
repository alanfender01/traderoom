-- =============================================
-- TRADEROOM — SCHEMA DO BANCO DE DADOS
-- =============================================
-- Execute este arquivo no Supabase SQL Editor
-- supabase.com → seu projeto → SQL Editor → New Query

-- ─────────────────────────────────────────────
-- TABELA: usuarios
-- Guarda todos os traders cadastrados
-- ─────────────────────────────────────────────
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id     VARCHAR(30) UNIQUE NOT NULL,   -- ex: scalp_rx, day_z9
  nome          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  telefone      VARCHAR(20),
  senha_hash    VARCHAR(255) NOT NULL,
  plano         VARCHAR(20) DEFAULT 'gratuito', -- gratuito | calcir
  plano_ativo   BOOLEAN DEFAULT false,
  plano_expira  TIMESTAMP,
  criado_em     TIMESTAMP DEFAULT NOW(),
  ultimo_login  TIMESTAMP
);

-- ─────────────────────────────────────────────
-- TABELA: salas
-- Cada sala criada por um trader
-- ─────────────────────────────────────────────
CREATE TABLE salas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            VARCHAR(100) NOT NULL,
  mercado         VARCHAR(10) NOT NULL,         -- b3 | forex | cripto
  ativos          TEXT[] NOT NULL,              -- ['WIN','WDO'] ou ['EUR/USD']
  criador_id      UUID REFERENCES usuarios(id),
  status          VARCHAR(20) DEFAULT 'aberta', -- aberta | encerrada
  limite_traders  INT DEFAULT 10,
  total_sessoes   INT DEFAULT 0,
  criada_em       TIMESTAMP DEFAULT NOW(),
  encerrada_em    TIMESTAMP
);

-- ─────────────────────────────────────────────
-- TABELA: membros_sala
-- Vínculos entre traders e salas (turma fixa)
-- ─────────────────────────────────────────────
CREATE TABLE membros_sala (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id     UUID REFERENCES salas(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  pinado      BOOLEAN DEFAULT false,            -- turma fixa = true
  total_sessoes_nesta_sala INT DEFAULT 0,
  entrou_em   TIMESTAMP DEFAULT NOW(),
  UNIQUE(sala_id, usuario_id)
);

-- ─────────────────────────────────────────────
-- TABELA: sessoes
-- Cada vez que uma sala é aberta no pregão
-- ─────────────────────────────────────────────
CREATE TABLE sessoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id       UUID REFERENCES salas(id) ON DELETE CASCADE,
  iniciada_em   TIMESTAMP DEFAULT NOW(),
  encerrada_em  TIMESTAMP,
  total_traders INT DEFAULT 0,
  total_msgs    INT DEFAULT 0
);

-- ─────────────────────────────────────────────
-- TABELA: mensagens
-- Histórico de chat de cada sessão
-- ─────────────────────────────────────────────
CREATE TABLE mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id   UUID REFERENCES sessoes(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES usuarios(id),
  conteudo    TEXT NOT NULL,
  tipo        VARCHAR(20) DEFAULT 'chat',       -- chat | sistema | anotacao
  criada_em   TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABELA: assinaturas
-- Controle de pagamentos do TraderCalc
-- ─────────────────────────────────────────────
CREATE TABLE assinaturas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          UUID REFERENCES usuarios(id),
  plano               VARCHAR(20) DEFAULT 'calcir',
  status              VARCHAR(20) DEFAULT 'pendente', -- pendente | ativo | cancelado
  valor               DECIMAL(10,2) DEFAULT 10.00,
  mp_subscription_id  VARCHAR(100),             -- ID do Mercado Pago
  mp_payment_id       VARCHAR(100),
  iniciada_em         TIMESTAMP DEFAULT NOW(),
  proxima_cobranca    TIMESTAMP,
  cancelada_em        TIMESTAMP
);

-- ─────────────────────────────────────────────
-- TABELA: notificacoes
-- Notificações para os traders
-- ─────────────────────────────────────────────
CREATE TABLE notificacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES usuarios(id),
  tipo        VARCHAR(30) NOT NULL,   -- turma_online | darf_vencendo | vinculo | sala_nova
  titulo      VARCHAR(100),
  mensagem    TEXT,
  lida        BOOLEAN DEFAULT false,
  criada_em   TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ÍNDICES para performance
-- ─────────────────────────────────────────────
CREATE INDEX idx_salas_mercado ON salas(mercado);
CREATE INDEX idx_salas_status ON salas(status);
CREATE INDEX idx_membros_sala_id ON membros_sala(sala_id);
CREATE INDEX idx_membros_usuario_id ON membros_sala(usuario_id);
CREATE INDEX idx_membros_pinado ON membros_sala(pinado);
CREATE INDEX idx_mensagens_sessao ON mensagens(sessao_id);
CREATE INDEX idx_notificacoes_usuario ON notificacoes(usuario_id, lida);
CREATE INDEX idx_assinaturas_usuario ON assinaturas(usuario_id, status);

-- ─────────────────────────────────────────────
-- VIEWS úteis
-- ─────────────────────────────────────────────

-- Salas com info do criador
CREATE VIEW salas_completas AS
SELECT
  s.*,
  u.trader_id AS criador_trader_id,
  u.nome AS criador_nome,
  COUNT(DISTINCT ms.usuario_id) AS total_membros_fixos
FROM salas s
LEFT JOIN usuarios u ON s.criador_id = u.id
LEFT JOIN membros_sala ms ON s.id = ms.sala_id AND ms.pinado = true
GROUP BY s.id, u.trader_id, u.nome;

-- Traders com estatísticas
CREATE VIEW traders_stats AS
SELECT
  u.id,
  u.trader_id,
  u.nome,
  u.plano,
  u.plano_ativo,
  u.criado_em,
  COUNT(DISTINCT ms.sala_id) AS total_salas,
  SUM(ms.total_sessoes_nesta_sala) AS total_sessoes_geral
FROM usuarios u
LEFT JOIN membros_sala ms ON u.id = ms.usuario_id
GROUP BY u.id;
