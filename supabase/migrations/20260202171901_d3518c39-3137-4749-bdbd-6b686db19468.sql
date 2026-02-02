-- Add extraction_metadata column to documents table
-- This stores detailed information about how text was extracted from PDFs

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}';

-- Add comment describing the column
COMMENT ON COLUMN documents.extraction_metadata IS 'Metadata about text extraction: method used, quality scores, issues detected, PDF origin info';

-- Create index for querying by extraction method
CREATE INDEX IF NOT EXISTS idx_documents_extraction_method 
ON documents ((extraction_metadata->>'method'));

-- Create index for querying by quality score
CREATE INDEX IF NOT EXISTS idx_documents_extraction_quality 
ON documents ((extraction_metadata->>'quality_score'));