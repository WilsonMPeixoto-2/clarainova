-- Função para limpar sessões antigas de chat
CREATE OR REPLACE FUNCTION cleanup_old_chat_sessions(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_sessions
  WHERE updated_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Função para estimar o tamanho total do armazenamento de chat_sessions
CREATE OR REPLACE FUNCTION get_chat_storage_stats()
RETURNS TABLE(
  total_sessions BIGINT,
  total_size_bytes BIGINT,
  oldest_session TIMESTAMPTZ,
  newest_session TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_sessions,
    COALESCE(SUM(pg_column_size(messages))::BIGINT, 0) as total_size_bytes,
    MIN(created_at) as oldest_session,
    MAX(created_at) as newest_session
  FROM chat_sessions;
END;
$$;