-- Create RPC function to aggregate chat metrics for the observability dashboard
CREATE OR REPLACE FUNCTION get_chat_metrics_summary(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  total_requests INTEGER,
  avg_embedding_ms NUMERIC,
  avg_search_ms NUMERIC,
  avg_llm_first_token_ms NUMERIC,
  avg_llm_total_ms NUMERIC,
  fallback_count INTEGER,
  rate_limit_hits INTEGER,
  gemini_count INTEGER,
  lovable_count INTEGER,
  web_search_count INTEGER,
  error_count INTEGER
) AS $$
  SELECT 
    DATE(created_at) as date,
    COUNT(*)::INTEGER as total_requests,
    ROUND(AVG(embedding_latency_ms), 0) as avg_embedding_ms,
    ROUND(AVG(search_latency_ms), 0) as avg_search_ms,
    ROUND(AVG(llm_first_token_ms), 0) as avg_llm_first_token_ms,
    ROUND(AVG(llm_total_ms), 0) as avg_llm_total_ms,
    COUNT(*) FILTER (WHERE fallback_triggered = true)::INTEGER as fallback_count,
    COUNT(*) FILTER (WHERE rate_limit_hit = true)::INTEGER as rate_limit_hits,
    COUNT(*) FILTER (WHERE provider = 'gemini')::INTEGER as gemini_count,
    COUNT(*) FILTER (WHERE provider = 'lovable')::INTEGER as lovable_count,
    COUNT(*) FILTER (WHERE web_search_used = true)::INTEGER as web_search_count,
    COUNT(*) FILTER (WHERE error_type IS NOT NULL)::INTEGER as error_count
  FROM chat_metrics
  WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Create RPC to get frontend errors summary
CREATE OR REPLACE FUNCTION get_frontend_errors_summary(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  total_errors INTEGER,
  unique_messages INTEGER,
  chrome_count INTEGER,
  firefox_count INTEGER,
  safari_count INTEGER,
  edge_count INTEGER,
  mobile_count INTEGER,
  other_count INTEGER
) AS $$
  SELECT 
    DATE(created_at) as date,
    COUNT(*)::INTEGER as total_errors,
    COUNT(DISTINCT error_message)::INTEGER as unique_messages,
    COUNT(*) FILTER (WHERE user_agent ILIKE '%Chrome%')::INTEGER as chrome_count,
    COUNT(*) FILTER (WHERE user_agent ILIKE '%Firefox%')::INTEGER as firefox_count,
    COUNT(*) FILTER (WHERE user_agent ILIKE '%Safari%' AND user_agent NOT ILIKE '%Chrome%')::INTEGER as safari_count,
    COUNT(*) FILTER (WHERE user_agent ILIKE '%Edge%' OR user_agent ILIKE '%Edg/%')::INTEGER as edge_count,
    COUNT(*) FILTER (WHERE user_agent ILIKE '%Mobile%' OR user_agent ILIKE '%Android%' OR user_agent ILIKE '%iPhone%')::INTEGER as mobile_count,
    COUNT(*) FILTER (WHERE user_agent = 'Other' OR user_agent IS NULL)::INTEGER as other_count
  FROM frontend_errors
  WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Grant execute permissions to authenticated and anon (admin checks via x-admin-key)
GRANT EXECUTE ON FUNCTION get_chat_metrics_summary TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_frontend_errors_summary TO authenticated, anon;