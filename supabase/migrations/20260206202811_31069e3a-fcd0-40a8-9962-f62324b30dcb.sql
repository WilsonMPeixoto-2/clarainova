
-- Drop and recreate with correct search_path
DROP FUNCTION IF EXISTS public.get_chat_metrics_summary(integer);
DROP FUNCTION IF EXISTS public.get_frontend_errors_summary(integer);

CREATE FUNCTION public.get_chat_metrics_summary(p_days integer DEFAULT 7)
RETURNS TABLE (
  date text,
  total_requests bigint,
  lovable_count bigint,
  gemini_count bigint,
  error_count bigint,
  fallback_count bigint,
  web_search_count bigint,
  rate_limit_hits bigint,
  avg_embedding_ms numeric,
  avg_search_ms numeric,
  avg_llm_first_token_ms numeric,
  avg_llm_total_ms numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(cm.created_at::date, 'YYYY-MM-DD'),
    count(*)::bigint,
    count(*) FILTER (WHERE cm.provider = 'lovable-ai')::bigint,
    count(*) FILTER (WHERE cm.provider = 'gemini-direct')::bigint,
    count(*) FILTER (WHERE cm.error_type IS NOT NULL)::bigint,
    count(*) FILTER (WHERE cm.fallback_triggered = true)::bigint,
    count(*) FILTER (WHERE cm.web_search_used = true)::bigint,
    count(*) FILTER (WHERE cm.rate_limit_hit = true)::bigint,
    round(avg(cm.embedding_latency_ms)::numeric, 0),
    round(avg(cm.search_latency_ms)::numeric, 0),
    round(avg(cm.llm_first_token_ms)::numeric, 0),
    round(avg(cm.llm_total_ms)::numeric, 0)
  FROM chat_metrics cm
  WHERE cm.created_at >= now() - (p_days || ' days')::interval
  GROUP BY cm.created_at::date
  ORDER BY cm.created_at::date DESC;
END;
$$;

CREATE FUNCTION public.get_frontend_errors_summary(p_days integer DEFAULT 7)
RETURNS TABLE (
  date text,
  total_errors bigint,
  unique_messages bigint,
  chrome_count bigint,
  firefox_count bigint,
  safari_count bigint,
  edge_count bigint,
  mobile_count bigint,
  other_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(fe.created_at::date, 'YYYY-MM-DD'),
    count(*)::bigint,
    count(DISTINCT fe.error_message)::bigint,
    count(*) FILTER (WHERE fe.user_agent ILIKE '%chrome%' AND fe.user_agent NOT ILIKE '%edg%')::bigint,
    count(*) FILTER (WHERE fe.user_agent ILIKE '%firefox%')::bigint,
    count(*) FILTER (WHERE fe.user_agent ILIKE '%safari%' AND fe.user_agent NOT ILIKE '%chrome%')::bigint,
    count(*) FILTER (WHERE fe.user_agent ILIKE '%edg%')::bigint,
    count(*) FILTER (WHERE fe.user_agent ILIKE '%mobile%')::bigint,
    count(*) FILTER (WHERE fe.user_agent NOT ILIKE '%chrome%' AND fe.user_agent NOT ILIKE '%firefox%' AND fe.user_agent NOT ILIKE '%safari%' AND fe.user_agent NOT ILIKE '%edg%')::bigint
  FROM frontend_errors fe
  WHERE fe.created_at >= now() - (p_days || ' days')::interval
  GROUP BY fe.created_at::date
  ORDER BY fe.created_at::date DESC;
END;
$$;
