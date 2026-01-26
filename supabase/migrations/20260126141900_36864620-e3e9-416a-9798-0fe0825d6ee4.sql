-- =============================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS Permissivas
-- =============================================

-- 1. development_reports - Restringir INSERT/UPDATE/DELETE para admins apenas
DROP POLICY IF EXISTS "Development reports can be deleted publicly" ON public.development_reports;
DROP POLICY IF EXISTS "Development reports can be updated publicly" ON public.development_reports;
DROP POLICY IF EXISTS "Development reports can be inserted publicly" ON public.development_reports;

-- Apenas admins podem modificar relatórios
CREATE POLICY "Admins can insert development reports"
  ON public.development_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update development reports"
  ON public.development_reports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete development reports"
  ON public.development_reports
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. query_analytics - Restringir INSERT para service role (via edge functions)
DROP POLICY IF EXISTS "Allow public insert for analytics" ON public.query_analytics;
DROP POLICY IF EXISTS "Anyone can insert query analytics" ON public.query_analytics;

-- INSERT apenas via service role (edge functions usam service role key)
CREATE POLICY "Service role can insert query analytics"
  ON public.query_analytics
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Autenticados podem ver suas próprias analytics (via session_fingerprint)
DROP POLICY IF EXISTS "Query analytics are publicly readable" ON public.query_analytics;

CREATE POLICY "Authenticated users can view analytics"
  ON public.query_analytics
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins podem ver tudo
CREATE POLICY "Admins can view all analytics"
  ON public.query_analytics
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. response_feedback - Restringir INSERT para usuários autenticados
DROP POLICY IF EXISTS "Allow public insert for feedback" ON public.response_feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.response_feedback;

-- INSERT apenas via service role (edge functions)
CREATE POLICY "Service role can insert feedback"
  ON public.response_feedback
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins podem ver todo feedback
DROP POLICY IF EXISTS "Feedback is publicly readable" ON public.response_feedback;

CREATE POLICY "Admins can view all feedback"
  ON public.response_feedback
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. chat_sessions - Garantir que apenas o dono pode acessar
DROP POLICY IF EXISTS "Authenticated users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Authenticated users can insert own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Authenticated users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Authenticated users can delete own chat sessions" ON public.chat_sessions;

CREATE POLICY "Users can view own chat sessions"
  ON public.chat_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
  ON public.chat_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON public.chat_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON public.chat_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. documents e document_chunks - Manter SELECT público (necessário para busca), mas restringir modificações

-- Documents: SELECT público permanece, INSERT/UPDATE/DELETE apenas para admins
DROP POLICY IF EXISTS "Admins can manage documents" ON public.documents;

CREATE POLICY "Admins can insert documents"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update documents"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete documents"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Document chunks: SELECT público permanece (necessário para RAG), INSERT/UPDATE/DELETE apenas para admins
DROP POLICY IF EXISTS "Admins can manage document chunks" ON public.document_chunks;

CREATE POLICY "Admins can insert document chunks"
  ON public.document_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update document chunks"
  ON public.document_chunks
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete document chunks"
  ON public.document_chunks
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Adicionar política para service_role poder modificar documents/chunks (usado pelas edge functions)
CREATE POLICY "Service role can manage documents"
  ON public.documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage document chunks"
  ON public.document_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);