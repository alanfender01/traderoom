CREATE TABLE enquetes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta    TEXT NOT NULL,
  votos_sim   INT  NOT NULL DEFAULT 0,
  votos_nao   INT  NOT NULL DEFAULT 0,
  encerra_em  TIMESTAMP NOT NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE enquete_votos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquete_id  UUID NOT NULL REFERENCES enquetes(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  voto        BOOLEAN NOT NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (enquete_id, usuario_id)
);

CREATE INDEX idx_enquete_votos_enquete ON enquete_votos(enquete_id);
CREATE INDEX idx_enquete_votos_usuario ON enquete_votos(usuario_id);

ALTER TABLE enquetes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquete_votos  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica enquetes"
  ON enquetes FOR SELECT USING (true);

CREATE POLICY "leitura publica votos"
  ON enquete_votos FOR SELECT USING (true);

CREATE POLICY "usuario insere proprio voto"
  ON enquete_votos FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- Permissões explícitas para os roles do Supabase
GRANT SELECT ON enquetes      TO anon, authenticated;
GRANT SELECT ON enquete_votos TO anon, authenticated;
GRANT INSERT ON enquete_votos TO authenticated;

CREATE OR REPLACE FUNCTION votar_enquete(
  p_enquete_id UUID,
  p_usuario_id UUID,
  p_voto       BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_enquete enquetes%ROWTYPE;
BEGIN
  SELECT * INTO v_enquete FROM enquetes WHERE id = p_enquete_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Enquete não encontrada');
  END IF;
  IF v_enquete.encerra_em < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Enquete encerrada');
  END IF;

  INSERT INTO enquete_votos (enquete_id, usuario_id, voto)
  VALUES (p_enquete_id, p_usuario_id, p_voto);

  IF p_voto THEN
    UPDATE enquetes SET votos_sim = votos_sim + 1 WHERE id = p_enquete_id;
  ELSE
    UPDATE enquetes SET votos_nao = votos_nao + 1 WHERE id = p_enquete_id;
  END IF;

  SELECT * INTO v_enquete FROM enquetes WHERE id = p_enquete_id;
  RETURN jsonb_build_object(
    'ok',        true,
    'votos_sim', v_enquete.votos_sim,
    'votos_nao', v_enquete.votos_nao
  );

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'erro', 'Você já votou nesta enquete');
END;
$$;

-- Enquete de teste
INSERT INTO enquetes (pergunta, encerra_em)
VALUES ('O IBOVESPA vai fechar ACIMA de 130.000 pontos hoje?', NOW() + INTERVAL '8 hours');
