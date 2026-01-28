-- =============================================
-- RLS HARDENING MIGRATION
-- Remove overly permissive policies and create service_role-only policies
-- =============================================

-- 1. Drop overly permissive policy on document_jobs
DROP POLICY IF EXISTS "Service role can manage document jobs" ON public.document_jobs;

-- 2. Create specific service_role policy for document_jobs
-- Note: Edge Functions with service_role bypass RLS, but this documents intent
CREATE POLICY "Edge functions manage document jobs via service_role"
  ON public.document_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Drop and recreate document_access_log policies to be stricter
DROP POLICY IF EXISTS "Admins can read access logs" ON public.document_access_log;
DROP POLICY IF EXISTS "Service role can insert access logs" ON public.document_access_log;

-- Only service_role can insert (Edge Functions)
CREATE POLICY "Service role can insert access logs"
  ON public.document_access_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only authenticated admins can read
CREATE POLICY "Authenticated admins can read access logs"
  ON public.document_access_log FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND public.has_role(auth.uid(), 'admin')
  );

-- 4. Add index for document_access_log performance
CREATE INDEX IF NOT EXISTS idx_document_access_log_document_id 
ON public.document_access_log(document_id);

CREATE INDEX IF NOT EXISTS idx_document_access_log_created_at 
ON public.document_access_log(created_at DESC);

-- 5. Create function to generate signed download URLs (called from Edge Functions)
CREATE OR REPLACE FUNCTION public.get_document_file_path(p_document_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_file_path TEXT;
BEGIN
  SELECT file_path INTO v_file_path
  FROM public.documents
  WHERE id = p_document_id;
  
  RETURN v_file_path;
END;
$$;