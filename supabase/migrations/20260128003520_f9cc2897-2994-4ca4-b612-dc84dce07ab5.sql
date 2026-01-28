-- =============================================
-- PROCESSING METRICS TABLE FOR OBSERVABILITY
-- Track duration and success of each processing step
-- =============================================

-- Create processing_metrics table
CREATE TABLE IF NOT EXISTS public.processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  step TEXT NOT NULL, -- 'upload', 'extract', 'ocr', 'chunk', 'embed', 'db_insert'
  duration_ms INT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processing_metrics ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert (Edge Functions)
CREATE POLICY "Service role can insert processing metrics"
  ON public.processing_metrics FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only authenticated admins can read
CREATE POLICY "Admins can read processing metrics"
  ON public.processing_metrics FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND public.has_role(auth.uid(), 'admin')
  );

-- Indexes for efficient queries
CREATE INDEX idx_processing_metrics_document ON public.processing_metrics(document_id);
CREATE INDEX idx_processing_metrics_step ON public.processing_metrics(step);
CREATE INDEX idx_processing_metrics_created ON public.processing_metrics(created_at DESC);
CREATE INDEX idx_processing_metrics_success ON public.processing_metrics(success) WHERE NOT success;

-- Function to get aggregated processing stats
CREATE OR REPLACE FUNCTION public.get_processing_stats(p_days INT DEFAULT 7)
RETURNS TABLE (
  step TEXT,
  avg_duration_ms NUMERIC,
  min_duration_ms INT,
  max_duration_ms INT,
  success_rate NUMERIC,
  total_count BIGINT,
  failed_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.step,
    ROUND(AVG(pm.duration_ms)::NUMERIC, 2) as avg_duration_ms,
    MIN(pm.duration_ms) as min_duration_ms,
    MAX(pm.duration_ms) as max_duration_ms,
    ROUND((SUM(CASE WHEN pm.success THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) as success_rate,
    COUNT(*)::BIGINT as total_count,
    SUM(CASE WHEN NOT pm.success THEN 1 ELSE 0 END)::BIGINT as failed_count
  FROM public.processing_metrics pm
  WHERE pm.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pm.step
  ORDER BY total_count DESC;
END;
$$;

-- Function to get recent errors by category
CREATE OR REPLACE FUNCTION public.get_recent_processing_errors(p_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  step TEXT,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ,
  document_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    d.title as document_title
  FROM public.processing_metrics pm
  LEFT JOIN public.documents d ON pm.document_id = d.id
  WHERE NOT pm.success
  ORDER BY pm.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to get documents with pending/failed status for retry
CREATE OR REPLACE FUNCTION public.get_documents_for_retry()
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  error_reason TEXT,
  last_batch_index INT,
  total_batches INT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.status,
    d.error_reason,
    dj.last_batch_index,
    dj.total_batches,
    d.updated_at
  FROM public.documents d
  LEFT JOIN public.document_jobs dj ON d.id = dj.document_id
  WHERE d.status IN ('failed', 'ingesting', 'processing', 'chunks_ok_embed_pending')
  ORDER BY d.updated_at DESC;
END;
$$;