-- =============================================
-- BUGFIX: Correct upsert conflict target in web search cache
-- =============================================

CREATE OR REPLACE FUNCTION public.save_web_search_cache(
  p_query_hash TEXT,
  p_query_text TEXT,
  p_mode TEXT,
  p_serp_results JSONB,
  p_fetched_pages JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.web_search_cache (
    query_hash, query_text, mode, serp_results, fetched_pages
  ) VALUES (
    p_query_hash, p_query_text, p_mode, p_serp_results, p_fetched_pages
  )
  ON CONFLICT (query_hash, mode)
  DO UPDATE SET
    serp_results = EXCLUDED.serp_results,
    fetched_pages = EXCLUDED.fetched_pages,
    expires_at = now() + INTERVAL '24 hours',
    hit_count = web_search_cache.hit_count + 1
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
