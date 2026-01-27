-- Create document_jobs table for incremental PDF processing
CREATE TABLE public.document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  next_page INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER,
  pages_per_batch INTEGER NOT NULL DEFAULT 10,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_document_jobs_status ON public.document_jobs(status);
CREATE INDEX idx_document_jobs_document_id ON public.document_jobs(document_id);

-- Enable RLS
ALTER TABLE public.document_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view document jobs"
  ON public.document_jobs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert document jobs"
  ON public.document_jobs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update document jobs"
  ON public.document_jobs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete document jobs"
  ON public.document_jobs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role policy for edge functions
CREATE POLICY "Service role can manage document jobs"
  ON public.document_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_document_jobs_updated_at
  BEFORE UPDATE ON public.document_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();