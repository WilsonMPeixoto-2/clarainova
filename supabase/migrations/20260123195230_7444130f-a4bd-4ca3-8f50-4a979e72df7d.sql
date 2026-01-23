-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table for storing document metadata
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'manual',
  file_path TEXT,
  content_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document_chunks table for RAG with vector embeddings
CREATE TABLE public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search (HNSW for fast approximate search)
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Create index for document_id lookups
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);

-- Create index for chunk ordering
CREATE INDEX idx_document_chunks_order ON public.document_chunks(document_id, chunk_index);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read access (no auth required for reading)
CREATE POLICY "Documents are publicly readable" 
ON public.documents 
FOR SELECT 
USING (true);

CREATE POLICY "Document chunks are publicly readable" 
ON public.document_chunks 
FOR SELECT 
USING (true);

-- RLS Policies: Insert/Update/Delete require service role (admin operations via edge functions)
-- These operations will be done via edge functions using service role key

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates on documents
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', true);

-- Storage policies for knowledge-base bucket
CREATE POLICY "Knowledge base files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'knowledge-base');

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  chunk_index INTEGER,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;