-- =============================================
-- 5. MELHORAR FILA DE JOBS (adicionar campos de retry e observabilidade)
-- =============================================

-- Adicionar campos para controle de retry e observabilidade
ALTER TABLE public.document_jobs 
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Índice para buscar jobs pendentes rapidamente
CREATE INDEX IF NOT EXISTS idx_document_jobs_status_created 
ON public.document_jobs(status, created_at) 
WHERE status IN ('pending', 'processing');

-- =============================================
-- 6. SEGURANÇA DO STORAGE (Bucket privado + signed URLs + auditoria)
-- =============================================

-- Tornar bucket privado (bloquear acesso público)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'knowledge-base';

-- Remover políticas permissivas antigas
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read knowledge-base" ON storage.objects;
DROP POLICY IF EXISTS "Public can read knowledge-base" ON storage.objects;

-- Política: Apenas service_role e admins autenticados podem ler
CREATE POLICY "Authenticated admins can read knowledge-base" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'knowledge-base' 
  AND (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated' 
      AND EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  )
);

-- Política: Apenas service_role pode inserir (via edge functions)
CREATE POLICY "Service role can insert knowledge-base" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'knowledge-base' 
  AND auth.role() = 'service_role'
);

-- Política: Apenas service_role pode deletar
CREATE POLICY "Service role can delete knowledge-base" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'knowledge-base' 
  AND auth.role() = 'service_role'
);

-- =============================================
-- 7. TABELA DE AUDITORIA PARA DOWNLOADS
-- =============================================

CREATE TABLE IF NOT EXISTS public.document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  accessed_by UUID, -- NULL para acesso anônimo via signed URL
  access_type TEXT NOT NULL DEFAULT 'download', -- 'download', 'view', 'search'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries de auditoria
CREATE INDEX IF NOT EXISTS idx_document_access_log_document 
ON public.document_access_log(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_access_log_user 
ON public.document_access_log(accessed_by, created_at DESC) 
WHERE accessed_by IS NOT NULL;

-- RLS para tabela de auditoria
ALTER TABLE public.document_access_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler logs de auditoria
CREATE POLICY "Admins can read access logs" 
ON public.document_access_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Service role pode inserir logs
CREATE POLICY "Service role can insert access logs" 
ON public.document_access_log 
FOR INSERT 
WITH CHECK (true);

-- Ninguém pode deletar ou atualizar logs (imutabilidade)
-- (sem política = acesso negado)

-- =============================================
-- 8. FUNÇÃO PARA GERAR SIGNED URL COM AUDITORIA
-- =============================================

CREATE OR REPLACE FUNCTION public.log_document_access(
  p_document_id UUID,
  p_accessed_by UUID DEFAULT NULL,
  p_access_type TEXT DEFAULT 'download',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.document_access_log (
    document_id, accessed_by, access_type, ip_address, user_agent
  ) VALUES (
    p_document_id, p_accessed_by, p_access_type, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- =============================================
-- 9. LIMPAR POLÍTICAS REDUNDANTES/CONFLITANTES
-- =============================================

-- Remover políticas duplicadas de documents
DROP POLICY IF EXISTS "Documents are publicly readable" ON public.documents;

-- Remover políticas duplicadas de document_chunks
DROP POLICY IF EXISTS "Document chunks are publicly readable" ON public.document_chunks;