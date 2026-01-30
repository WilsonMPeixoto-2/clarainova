-- Tabela para métricas de chat (observabilidade)
CREATE TABLE IF NOT EXISTS chat_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Identificação
  session_fingerprint TEXT,
  request_id UUID,
  
  -- Performance (ms)
  embedding_latency_ms INTEGER,
  search_latency_ms INTEGER,
  llm_first_token_ms INTEGER,
  llm_total_ms INTEGER,
  
  -- Operacionais
  provider TEXT,
  model TEXT,
  mode TEXT,
  web_search_used BOOLEAN DEFAULT FALSE,
  local_chunks_found INTEGER DEFAULT 0,
  web_sources_count INTEGER DEFAULT 0,
  
  -- Qualidade
  fallback_triggered BOOLEAN DEFAULT FALSE,
  rate_limit_hit BOOLEAN DEFAULT FALSE,
  error_type TEXT
);

-- Índices para dashboard de observabilidade
CREATE INDEX idx_chat_metrics_created ON chat_metrics(created_at DESC);
CREATE INDEX idx_chat_metrics_provider ON chat_metrics(provider, created_at DESC);
CREATE INDEX idx_chat_metrics_errors ON chat_metrics(error_type) WHERE error_type IS NOT NULL;

-- Tabela para erros do frontend (error boundary)
CREATE TABLE IF NOT EXISTS frontend_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  error_message TEXT,
  component_stack TEXT,
  url TEXT,
  user_agent TEXT
);

-- Índice para busca de erros recentes
CREATE INDEX idx_frontend_errors_created ON frontend_errors(created_at DESC);

-- RLS: Sem políticas restritivas (dados operacionais, não sensíveis)
-- Admins podem ler, edge functions podem inserir
ALTER TABLE chat_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_errors ENABLE ROW LEVEL SECURITY;

-- Políticas para chat_metrics
CREATE POLICY "Admins can read chat metrics" ON chat_metrics
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert chat metrics" ON chat_metrics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Políticas para frontend_errors
CREATE POLICY "Admins can read frontend errors" ON frontend_errors
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert frontend errors" ON frontend_errors
  FOR INSERT WITH CHECK (true);