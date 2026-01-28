-- =============================================
-- HNSW INDEX OPTIMIZATION MIGRATION
-- Recreate vector index with tuned parameters for better performance
-- =============================================

-- Drop existing index if exists
DROP INDEX IF EXISTS idx_document_chunks_embedding;

-- Recreate HNSW index with optimized parameters
-- m = 16 (connections per node, good balance for 768-dim vectors)
-- ef_construction = 64 (build-time accuracy, higher = better index quality)
CREATE INDEX idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add comment for documentation
COMMENT ON INDEX idx_document_chunks_embedding IS 'HNSW index for 768-dim embeddings with m=16, ef_construction=64. Use SET hnsw.ef_search = X at query time for accuracy tuning.';

-- Ensure GIN index for tsvector is present
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector
ON public.document_chunks 
USING gin (search_vector);

-- Add statistics table for search performance tracking
CREATE TABLE IF NOT EXISTS public.search_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  vector_search_ms INT,
  keyword_search_ms INT,
  total_chunks_scanned INT,
  results_returned INT,
  threshold_used NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on search_metrics
ALTER TABLE public.search_metrics ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert (Edge Functions)
CREATE POLICY "Service role can insert search metrics"
  ON public.search_metrics FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only admins can read
CREATE POLICY "Admins can read search metrics"
  ON public.search_metrics FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND public.has_role(auth.uid(), 'admin')
  );

-- Index for efficient queries
CREATE INDEX idx_search_metrics_created ON public.search_metrics(created_at DESC);

-- Function to get search performance stats
CREATE OR REPLACE FUNCTION public.get_search_performance_stats(p_days INT DEFAULT 7)
RETURNS TABLE (
  avg_vector_ms NUMERIC,
  avg_keyword_ms NUMERIC,
  avg_total_chunks INT,
  avg_results INT,
  total_searches BIGINT,
  p95_vector_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(vector_search_ms)::NUMERIC, 2) as avg_vector_ms,
    ROUND(AVG(keyword_search_ms)::NUMERIC, 2) as avg_keyword_ms,
    ROUND(AVG(total_chunks_scanned))::INT as avg_total_chunks,
    ROUND(AVG(results_returned))::INT as avg_results,
    COUNT(*)::BIGINT as total_searches,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY vector_search_ms)::NUMERIC as p95_vector_ms
  FROM public.search_metrics
  WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;