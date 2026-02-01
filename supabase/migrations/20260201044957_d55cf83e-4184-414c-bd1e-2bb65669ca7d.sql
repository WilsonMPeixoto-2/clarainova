-- RPC para obter taxa de fallback por dia
-- Retorna estatísticas de fallback dos últimos N dias
CREATE OR REPLACE FUNCTION public.get_fallback_rate(p_days integer DEFAULT 7)
RETURNS TABLE(
  day date,
  total_requests bigint,
  fallback_requests bigint,
  fallback_rate numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    date_trunc('day', created_at)::date AS day,
    count(*) AS total_requests,
    sum(CASE WHEN fallback_triggered THEN 1 ELSE 0 END)::bigint AS fallback_requests,
    CASE 
      WHEN count(*) = 0 THEN 0 
      ELSE ROUND((sum(CASE WHEN fallback_triggered THEN 1 ELSE 0 END)::numeric / count(*)::numeric) * 100, 2) 
    END AS fallback_rate
  FROM public.chat_metrics
  WHERE created_at >= now() - (p_days || ' days')::interval
  GROUP BY 1
  ORDER BY 1 DESC;
$$;