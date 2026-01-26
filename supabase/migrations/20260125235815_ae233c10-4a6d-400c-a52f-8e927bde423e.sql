-- Adicionar coluna de fingerprint para agrupar queries por sessão
ALTER TABLE query_analytics
ADD COLUMN session_fingerprint TEXT;

-- Criar índice para busca rápida por fingerprint
CREATE INDEX idx_query_analytics_session_fingerprint
ON query_analytics(session_fingerprint);

-- Comentário explicativo
COMMENT ON COLUMN query_analytics.session_fingerprint IS 'Identificador único da sessão de navegação do usuário para agrupar queries relacionadas';