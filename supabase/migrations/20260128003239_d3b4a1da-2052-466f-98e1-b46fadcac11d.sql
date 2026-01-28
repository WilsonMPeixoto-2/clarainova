-- =============================================
-- BATCH TRACKING MIGRATION
-- Add fields for granular batch tracking to support idempotent & resumable ingestion
-- =============================================

-- Add batch tracking columns to document_jobs
ALTER TABLE public.document_jobs
ADD COLUMN IF NOT EXISTS last_batch_index INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_batches INT,
ADD COLUMN IF NOT EXISTS batch_hashes JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.document_jobs.last_batch_index IS 'Index of the last successfully processed batch (0-based)';
COMMENT ON COLUMN public.document_jobs.total_batches IS 'Total number of batches expected for this document';
COMMENT ON COLUMN public.document_jobs.batch_hashes IS 'Array of content hashes for each processed batch, enabling idempotency checks';

-- Create function to check and record batch processing (idempotent)
CREATE OR REPLACE FUNCTION public.record_batch_processed(
  p_document_id UUID,
  p_batch_index INT,
  p_batch_hash TEXT
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  existing_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_job document_jobs%ROWTYPE;
  v_existing_hash TEXT;
BEGIN
  -- Get or create job record
  SELECT * INTO v_job
  FROM public.document_jobs
  WHERE document_id = p_document_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Create new job record if doesn't exist
    INSERT INTO public.document_jobs (document_id, status, last_batch_index, batch_hashes)
    VALUES (p_document_id, 'processing', p_batch_index, jsonb_build_array(p_batch_hash))
    RETURNING * INTO v_job;
    
    RETURN QUERY SELECT false, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if batch already processed
  v_existing_hash := v_job.batch_hashes->p_batch_index->>0;
  
  IF v_existing_hash IS NOT NULL THEN
    -- Batch already exists, check if same content
    IF v_existing_hash = p_batch_hash THEN
      -- Same content, skip (idempotent)
      RETURN QUERY SELECT true, v_existing_hash;
      RETURN;
    ELSE
      -- Different content, will be replaced (update hash)
      UPDATE public.document_jobs
      SET batch_hashes = jsonb_set(
        COALESCE(batch_hashes, '[]'::jsonb),
        ARRAY[p_batch_index::text],
        to_jsonb(p_batch_hash)
      ),
      last_batch_index = GREATEST(last_batch_index, p_batch_index),
      updated_at = NOW()
      WHERE id = v_job.id;
      
      RETURN QUERY SELECT false, v_existing_hash;
      RETURN;
    END IF;
  END IF;
  
  -- New batch, record it
  UPDATE public.document_jobs
  SET batch_hashes = CASE
    WHEN batch_hashes IS NULL OR batch_hashes = '[]'::jsonb 
    THEN jsonb_build_array(p_batch_hash)
    ELSE batch_hashes || to_jsonb(p_batch_hash)
  END,
  last_batch_index = p_batch_index,
  updated_at = NOW()
  WHERE id = v_job.id;
  
  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$;

-- Create function to get resume point for a document
CREATE OR REPLACE FUNCTION public.get_ingestion_resume_point(p_document_id UUID)
RETURNS TABLE (
  resume_from_batch INT,
  total_batches_recorded INT,
  last_hash TEXT,
  job_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_job document_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job
  FROM public.document_jobs
  WHERE document_id = p_document_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, NULL::TEXT, 'not_started'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    COALESCE(v_job.last_batch_index, -1) + 1,
    jsonb_array_length(COALESCE(v_job.batch_hashes, '[]'::jsonb)),
    v_job.batch_hashes->-1->>0,  -- Last hash in array
    v_job.status;
END;
$$;