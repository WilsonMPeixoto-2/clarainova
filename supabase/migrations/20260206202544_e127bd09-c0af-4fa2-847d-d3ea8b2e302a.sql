
-- ============================================================
-- PROBLEMA 3 & 4: Segurança - Corrigir RLS e search_path
-- ============================================================

-- Remover políticas redundantes/inseguras em query_analytics
DROP POLICY IF EXISTS "Authenticated users can view analytics" ON public.query_analytics;
DROP POLICY IF EXISTS "Admins can view all analytics" ON public.query_analytics;

-- Remover políticas redundantes em response_feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.response_feedback;

-- ============================================================
-- PROBLEMA 4: Recriar funções com SET search_path = public
-- ============================================================

-- Recriar hybrid_search_chunks com search_path
CREATE OR REPLACE FUNCTION public.hybrid_search_chunks(
  query_embedding text,
  query_text text,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10,
  vector_weight float DEFAULT 0.6,
  keyword_weight float DEFAULT 0.4
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  chunk_index int,
  similarity float,
  text_rank float,
  combined_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      dc.chunk_index,
      1 - (dc.embedding <=> query_embedding::vector) AS similarity
    FROM document_chunks dc
    WHERE dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> query_embedding::vector) > match_threshold
    ORDER BY dc.embedding <=> query_embedding::vector
    LIMIT match_count * 2
  ),
  keyword_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      dc.chunk_index,
      ts_rank_cd(dc.search_vector, plainto_tsquery('portuguese', query_text)) AS text_rank
    FROM document_chunks dc
    WHERE dc.search_vector @@ plainto_tsquery('portuguese', query_text)
    ORDER BY text_rank DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.document_id, k.document_id) AS document_id,
      COALESCE(v.content, k.content) AS content,
      COALESCE(v.metadata, k.metadata) AS metadata,
      COALESCE(v.chunk_index, k.chunk_index) AS chunk_index,
      COALESCE(v.similarity, 0.0)::float AS similarity,
      COALESCE(k.text_rank, 0.0)::float AS text_rank,
      (COALESCE(v.similarity, 0.0) * vector_weight + COALESCE(k.text_rank, 0.0) * keyword_weight)::float AS combined_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  )
  SELECT
    combined.id,
    combined.document_id,
    combined.content,
    combined.metadata,
    combined.chunk_index,
    combined.similarity,
    combined.text_rank,
    combined.combined_score
  FROM combined
  ORDER BY combined.combined_score DESC
  LIMIT match_count;
END;
$$;

-- Recriar search_document_chunks com search_path
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  query_embedding text,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    dc.chunk_index,
    (1 - (dc.embedding <=> query_embedding::vector))::float AS similarity
  FROM document_chunks dc
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding::vector) > match_threshold
  ORDER BY dc.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;

-- Recriar has_role com search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
