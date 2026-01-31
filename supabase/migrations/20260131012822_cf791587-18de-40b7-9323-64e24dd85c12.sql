-- Add versioning and tagging columns to documents table
-- Sprint 4: Knowledge Base Enhancements

-- Version label (human-readable version identifier)
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS version_label TEXT;

-- Effective date (when the document version became effective)
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS effective_date DATE;

-- Reference to superseded document (for version chains)
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS supersedes_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

-- Tags array for categorization
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add index for tags (GIN index for array containment queries)
CREATE INDEX IF NOT EXISTS idx_documents_tags ON public.documents USING GIN(tags);

-- Add index for effective_date
CREATE INDEX IF NOT EXISTS idx_documents_effective_date ON public.documents(effective_date);

-- Add index for supersedes_document_id
CREATE INDEX IF NOT EXISTS idx_documents_supersedes ON public.documents(supersedes_document_id);

-- Comment on columns for documentation
COMMENT ON COLUMN public.documents.version_label IS 'Human-readable version identifier (e.g., v3.2, 2024.1)';
COMMENT ON COLUMN public.documents.effective_date IS 'Date when this document version became effective';
COMMENT ON COLUMN public.documents.supersedes_document_id IS 'Reference to the previous version of this document';
COMMENT ON COLUMN public.documents.tags IS 'Array of tags for categorization and filtering';