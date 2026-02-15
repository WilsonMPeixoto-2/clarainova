-- ============================================================
-- Admin RPCs + Constraints (Lovable-independent bootstrap)
-- ============================================================

-- document_jobs: required for upsert({ onConflict: "document_id" })
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'document_jobs'
      AND c.conname = 'document_jobs_document_id_key'
  ) THEN
    ALTER TABLE public.document_jobs
      ADD CONSTRAINT document_jobs_document_id_key UNIQUE (document_id);
  END IF;
END $$;

-- Helpful indexes for admin dashboards (best-effort)
CREATE INDEX IF NOT EXISTS idx_query_analytics_created_at ON public.query_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_response_feedback_created_at ON public.response_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_created_at ON public.processing_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON public.chat_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_report_tag_relations_report_id ON public.report_tag_relations(report_id);
CREATE INDEX IF NOT EXISTS idx_report_tag_relations_tag_id ON public.report_tag_relations(tag_id);

-- ============================================================
-- RPC: Storage stats (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_chat_storage_stats()
RETURNS TABLE (
  total_sessions integer,
  total_size_bytes bigint,
  oldest_session timestamptz,
  newest_session timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::int AS total_sessions,
    COALESCE(SUM(pg_column_size(cs.messages)), 0)::bigint AS total_size_bytes,
    MIN(cs.updated_at) AS oldest_session,
    MAX(cs.updated_at) AS newest_session
  FROM public.chat_sessions cs;
END;
$$;

-- ============================================================
-- RPC: Processing stats (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_processing_stats(p_days integer DEFAULT 7)
RETURNS TABLE (
  step text,
  avg_duration_ms integer,
  min_duration_ms integer,
  max_duration_ms integer,
  success_rate integer,
  total_count integer,
  failed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.step,
    ROUND(AVG(pm.duration_ms))::int AS avg_duration_ms,
    MIN(pm.duration_ms)::int AS min_duration_ms,
    MAX(pm.duration_ms)::int AS max_duration_ms,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(100.0 * (COUNT(*) FILTER (WHERE pm.success)) / COUNT(*))::int
    END AS success_rate,
    COUNT(*)::int AS total_count,
    (COUNT(*) FILTER (WHERE NOT pm.success))::int AS failed_count
  FROM public.processing_metrics pm
  WHERE pm.created_at >= now() - (p_days || ' days')::interval
  GROUP BY pm.step
  ORDER BY pm.step;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recent_processing_errors(p_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  step text,
  error_message text,
  duration_ms integer,
  created_at timestamptz,
  document_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id,
    pm.document_id,
    pm.step,
    pm.error_message,
    pm.duration_ms,
    pm.created_at,
    d.title AS document_title
  FROM public.processing_metrics pm
  LEFT JOIN public.documents d ON d.id = pm.document_id
  WHERE pm.success = false
    AND pm.error_message IS NOT NULL
  ORDER BY pm.created_at DESC
  LIMIT GREATEST(p_limit, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_documents_for_retry()
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  error_reason text,
  last_batch_index integer,
  total_batches integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.status,
    d.error_reason,
    j.last_batch_index,
    j.total_batches,
    d.updated_at
  FROM public.documents d
  LEFT JOIN public.document_jobs j ON j.document_id = d.id
  WHERE d.status IN ('failed', 'processing', 'ingesting', 'chunks_ok_embed_pending', 'uploaded')
  ORDER BY d.updated_at DESC
  LIMIT 200;
END;
$$;

-- ============================================================
-- RPC: API usage (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_api_usage_summary(p_days integer DEFAULT 7)
RETURNS TABLE (
  provider text,
  total_count integer,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT
      CASE
        WHEN cm.provider ILIKE '%gemini%' THEN 'gemini'
        WHEN cm.provider ILIKE '%lovable%' THEN 'lovable'
        ELSE NULL
      END AS provider
    FROM public.chat_metrics cm
    WHERE cm.created_at >= now() - (p_days || ' days')::interval
  ),
  counts AS (
    SELECT provider, COUNT(*)::int AS total_count
    FROM filtered
    WHERE provider IS NOT NULL
    GROUP BY provider
  ),
  totals AS (
    SELECT COALESCE(SUM(total_count), 0)::numeric AS all_count
    FROM counts
  )
  SELECT
    c.provider,
    c.total_count,
    CASE
      WHEN t.all_count = 0 THEN 0
      ELSE ROUND((c.total_count::numeric / t.all_count) * 100, 1)
    END AS percentage
  FROM counts c
  CROSS JOIN totals t
  ORDER BY c.total_count DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_api_usage_stats(p_days integer DEFAULT 7)
RETURNS TABLE (
  provider text,
  model text,
  mode text,
  total_count integer,
  date text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN cm.provider ILIKE '%gemini%' THEN 'gemini'
      WHEN cm.provider ILIKE '%lovable%' THEN 'lovable'
      ELSE cm.provider
    END AS provider,
    COALESCE(cm.model, '') AS model,
    COALESCE(cm.mode, '') AS mode,
    COUNT(*)::int AS total_count,
    to_char(cm.created_at::date, 'YYYY-MM-DD') AS date
  FROM public.chat_metrics cm
  WHERE cm.created_at >= now() - (p_days || ' days')::interval
    AND (cm.provider ILIKE '%gemini%' OR cm.provider ILIKE '%lovable%')
  GROUP BY 1, 2, 3, 5
  ORDER BY date DESC, provider, model, mode;
END;
$$;

-- Only Edge Functions (service role) should execute these RPCs.
REVOKE EXECUTE ON FUNCTION public.get_chat_storage_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_processing_stats(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_recent_processing_errors(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_documents_for_retry() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_api_usage_summary(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_api_usage_stats(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_chat_storage_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_processing_stats(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_processing_errors(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_documents_for_retry() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_api_usage_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_api_usage_stats(integer) TO service_role;

