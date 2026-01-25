-- Tabela para armazenar todas as consultas (análise de tópicos)
CREATE TABLE public.query_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_query TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  sources_cited TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para armazenar feedbacks (positivos e negativos)
CREATE TABLE public.response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.query_analytics(id) ON DELETE CASCADE,
  rating BOOLEAN NOT NULL, -- true = positivo, false = negativo
  feedback_category TEXT, -- apenas para negativos
  feedback_text TEXT, -- comentário livre opcional
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_query_analytics_created_at ON public.query_analytics(created_at DESC);
CREATE INDEX idx_response_feedback_created_at ON public.response_feedback(created_at DESC);
CREATE INDEX idx_response_feedback_rating ON public.response_feedback(rating);
CREATE INDEX idx_response_feedback_query_id ON public.response_feedback(query_id);

-- Habilitar RLS
ALTER TABLE public.query_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para query_analytics

-- Qualquer pessoa pode inserir (anônimos e autenticados)
CREATE POLICY "Anyone can insert query analytics"
ON public.query_analytics
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Apenas admins podem ler
CREATE POLICY "Admins can read query analytics"
ON public.query_analytics
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Ninguém pode atualizar
CREATE POLICY "No updates on query analytics"
ON public.query_analytics
FOR UPDATE
TO authenticated
USING (false);

-- Ninguém pode deletar
CREATE POLICY "No deletes on query analytics"
ON public.query_analytics
FOR DELETE
TO authenticated
USING (false);

-- Políticas RLS para response_feedback

-- Qualquer pessoa pode inserir feedback
CREATE POLICY "Anyone can insert feedback"
ON public.response_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Apenas admins podem ler
CREATE POLICY "Admins can read feedback"
ON public.response_feedback
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Ninguém pode atualizar
CREATE POLICY "No updates on feedback"
ON public.response_feedback
FOR UPDATE
TO authenticated
USING (false);

-- Ninguém pode deletar
CREATE POLICY "No deletes on feedback"
ON public.response_feedback
FOR DELETE
TO authenticated
USING (false);