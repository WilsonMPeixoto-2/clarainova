-- Add status and error_reason columns to documents table
-- status: 'uploaded', 'processing', 'ready', 'failed'
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'uploaded';

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- Update existing documents to 'ready' status (they were already processed)
UPDATE public.documents SET status = 'ready' WHERE content_text IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.documents.status IS 'Document processing status: uploaded, processing, ready, failed';
COMMENT ON COLUMN public.documents.error_reason IS 'Error message when status is failed';