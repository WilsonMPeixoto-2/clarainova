-- =============================================
-- 1. IDEMPOTÊNCIA: content_hash para evitar duplicação
-- =============================================

-- Adicionar content_hash na tabela documents
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Adicionar content_hash na tabela document_chunks
ALTER TABLE public.document_chunks 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Criar índice único composto para idempotência de chunks
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_chunks_idempotent 
ON public.document_chunks(document_id, chunk_index);

-- Criar índice para busca por hash
CREATE INDEX IF NOT EXISTS idx_documents_content_hash 
ON public.documents(content_hash) 
WHERE content_hash IS NOT NULL;

-- =============================================
-- 2. BUSCA HÍBRIDA: ts_vector para BM25/keyword search
-- =============================================

-- Adicionar coluna ts_vector para busca textual
ALTER TABLE public.document_chunks 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Criar índice GIN para busca textual rápida
CREATE INDEX IF NOT EXISTS idx_document_chunks_search 
ON public.document_chunks USING GIN(search_vector);

-- Função para atualizar search_vector automaticamente
CREATE OR REPLACE FUNCTION public.update_chunk_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para manter search_vector atualizado
DROP TRIGGER IF EXISTS trigger_update_chunk_search_vector ON public.document_chunks;
CREATE TRIGGER trigger_update_chunk_search_vector
BEFORE INSERT OR UPDATE OF content ON public.document_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_chunk_search_vector();

-- Atualizar chunks existentes (se houver)
UPDATE public.document_chunks 
SET search_vector = to_tsvector('portuguese', COALESCE(content, ''))
WHERE search_vector IS NULL;

-- =============================================
-- 3. FUNÇÃO DE BUSCA HÍBRIDA (vetor + texto)
-- =============================================

CREATE OR REPLACE FUNCTION public.hybrid_search_chunks(
  query_text TEXT,
  query_embedding vector,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 15,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE(
  id UUID,
  document_id UUID,
  content TEXT,
  chunk_index INT,
  metadata JSONB,
  similarity FLOAT,
  text_rank FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  -- Criar tsquery a partir do texto
  ts_query := plainto_tsquery('portuguese', query_text);
  
  RETURN QUERY
  WITH vector_results AS (
    SELECT 
      dc.id,
      dc.document_id,
      dc.content,
      dc.chunk_index,
      dc.metadata,
      (1 - (dc.embedding <=> query_embedding))::FLOAT AS vector_sim,
      ts_rank_cd(dc.search_vector, ts_query)::FLOAT AS txt_rank,
      ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding) AS vector_rank
    FROM public.document_chunks dc
    WHERE dc.embedding IS NOT NULL
      AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
  ),
  text_results AS (
    SELECT 
      dc.id,
      ts_rank_cd(dc.search_vector, ts_query)::FLOAT AS txt_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.search_vector, ts_query) DESC) AS text_rank
    FROM public.document_chunks dc
    WHERE dc.search_vector @@ ts_query
  ),
  combined AS (
    SELECT 
      vr.id,
      vr.document_id,
      vr.content,
      vr.chunk_index,
      vr.metadata,
      vr.vector_sim AS similarity,
      COALESCE(tr.txt_rank, 0) AS text_rank,
      -- RRF-style combination with weights
      (
        (vector_weight * (1.0 / (60 + vr.vector_rank))) +
        (keyword_weight * (1.0 / (60 + COALESCE(tr.text_rank, 1000))))
      )::FLOAT AS combined_score
    FROM vector_results vr
    LEFT JOIN text_results tr ON vr.id = tr.id
  )
  SELECT 
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.metadata,
    c.similarity,
    c.text_rank,
    c.combined_score
  FROM combined c
  ORDER BY c.combined_score DESC
  LIMIT match_count;
END;
$$;

-- =============================================
-- 4. METADADOS ADICIONAIS PARA DOCUMENTOS
-- =============================================

-- Adicionar colunas de metadados para auditoria
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS chunk_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- Adicionar source_file_path para rastreabilidade
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS source_file_name TEXT;

-- =============================================
-- 5. MELHORAR POLÍTICAS RLS
-- =============================================

-- Política para documents - leitura pública
DROP POLICY IF EXISTS "Documents are readable by everyone" ON public.documents;
CREATE POLICY "Documents are readable by everyone" 
ON public.documents 
FOR SELECT 
USING (true);

-- Política para document_chunks - leitura pública
DROP POLICY IF EXISTS "Chunks are readable by everyone" ON public.document_chunks;
CREATE POLICY "Chunks are readable by everyone" 
ON public.document_chunks 
FOR SELECT 
USING (true);

-- Habilitar RLS se ainda não estiver
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. FUNÇÃO PARA UPSERT IDEMPOTENTE DE CHUNKS
-- =============================================

CREATE OR REPLACE FUNCTION public.upsert_document_chunks(
  p_document_id UUID,
  p_chunks JSONB -- Array of {content, chunk_index, embedding, metadata, content_hash}
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_chunk JSONB;
BEGIN
  -- Delete existing chunks for this document
  DELETE FROM public.document_chunks WHERE document_id = p_document_id;
  
  -- Insert new chunks
  FOR v_chunk IN SELECT * FROM jsonb_array_elements(p_chunks)
  LOOP
    INSERT INTO public.document_chunks (
      document_id,
      content,
      chunk_index,
      embedding,
      metadata,
      content_hash
    ) VALUES (
      p_document_id,
      v_chunk->>'content',
      (v_chunk->>'chunk_index')::INT,
      (v_chunk->>'embedding')::vector,
      v_chunk->'metadata',
      v_chunk->>'content_hash'
    );
    v_count := v_count + 1;
  END LOOP;
  
  -- Update document chunk_count
  UPDATE public.documents 
  SET chunk_count = v_count, 
      processed_at = NOW(),
      version = COALESCE(version, 0) + 1
  WHERE id = p_document_id;
  
  RETURN v_count;
END;
$$;