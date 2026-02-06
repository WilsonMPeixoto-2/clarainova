
-- ============================================================
-- SECURITY HARDENING: Restrict anonymous access across all tables
-- ============================================================

-- 1. api_usage_stats - Currently has NO policies
CREATE POLICY "Service role can insert api_usage_stats"
ON public.api_usage_stats FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Admins can read api_usage_stats"
ON public.api_usage_stats FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. documents - CRITICAL: Remove public read, restrict to authenticated
DROP POLICY IF EXISTS "Documents are readable by everyone" ON public.documents;
CREATE POLICY "Documents are readable by authenticated users"
ON public.documents FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
CREATE POLICY "Admins can insert documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
CREATE POLICY "Admins can update documents"
ON public.documents FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
CREATE POLICY "Admins can delete documents"
ON public.documents FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. document_chunks - CRITICAL: Remove public read
DROP POLICY IF EXISTS "Chunks are readable by everyone" ON public.document_chunks;
CREATE POLICY "Chunks are readable by authenticated users"
ON public.document_chunks FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert document chunks" ON public.document_chunks;
CREATE POLICY "Admins can insert document chunks"
ON public.document_chunks FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update document chunks" ON public.document_chunks;
CREATE POLICY "Admins can update document chunks"
ON public.document_chunks FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete document chunks" ON public.document_chunks;
CREATE POLICY "Admins can delete document chunks"
ON public.document_chunks FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. development_reports - CRITICAL: Restrict to admin only
DROP POLICY IF EXISTS "Development reports are publicly readable" ON public.development_reports;
CREATE POLICY "Admins can read development reports"
ON public.development_reports FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert development reports" ON public.development_reports;
CREATE POLICY "Admins can insert development reports"
ON public.development_reports FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update development reports" ON public.development_reports;
CREATE POLICY "Admins can update development reports"
ON public.development_reports FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete development reports" ON public.development_reports;
CREATE POLICY "Admins can delete development reports"
ON public.development_reports FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. trusted_domains - Restrict to authenticated
DROP POLICY IF EXISTS "Public can read trusted_domains" ON public.trusted_domains;
CREATE POLICY "Authenticated users can read trusted_domains"
ON public.trusted_domains FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can modify trusted_domains" ON public.trusted_domains;
CREATE POLICY "Admins can modify trusted_domains"
ON public.trusted_domains FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. report_tags - Restrict to authenticated
DROP POLICY IF EXISTS "Tags are publicly readable" ON public.report_tags;
CREATE POLICY "Tags are readable by authenticated users"
ON public.report_tags FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert tags" ON public.report_tags;
CREATE POLICY "Admins can insert tags"
ON public.report_tags FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update tags" ON public.report_tags;
CREATE POLICY "Admins can update tags"
ON public.report_tags FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete tags" ON public.report_tags;
CREATE POLICY "Admins can delete tags"
ON public.report_tags FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. report_tag_relations - Restrict to authenticated
DROP POLICY IF EXISTS "Tag relations are publicly readable" ON public.report_tag_relations;
CREATE POLICY "Tag relations are readable by authenticated users"
ON public.report_tag_relations FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert tag relations" ON public.report_tag_relations;
CREATE POLICY "Admins can insert tag relations"
ON public.report_tag_relations FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete tag relations" ON public.report_tag_relations;
CREATE POLICY "Admins can delete tag relations"
ON public.report_tag_relations FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. chat_sessions - Add TO authenticated
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can view own chat sessions"
ON public.chat_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can insert own chat sessions"
ON public.chat_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can update own chat sessions"
ON public.chat_sessions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can delete own chat sessions"
ON public.chat_sessions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 9. chat_metrics - Add TO authenticated
DROP POLICY IF EXISTS "Admins can read chat metrics" ON public.chat_metrics;
CREATE POLICY "Admins can read chat metrics"
ON public.chat_metrics FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. document_access_log - Add TO authenticated
DROP POLICY IF EXISTS "Authenticated admins can read access logs" ON public.document_access_log;
CREATE POLICY "Authenticated admins can read access logs"
ON public.document_access_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 11. document_jobs - Add TO authenticated
DROP POLICY IF EXISTS "Admins can view document jobs" ON public.document_jobs;
CREATE POLICY "Admins can view document jobs"
ON public.document_jobs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert document jobs" ON public.document_jobs;
CREATE POLICY "Admins can insert document jobs"
ON public.document_jobs FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update document jobs" ON public.document_jobs;
CREATE POLICY "Admins can update document jobs"
ON public.document_jobs FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete document jobs" ON public.document_jobs;
CREATE POLICY "Admins can delete document jobs"
ON public.document_jobs FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 12. frontend_errors - Add TO authenticated
DROP POLICY IF EXISTS "Admins can read frontend errors" ON public.frontend_errors;
CREATE POLICY "Admins can read frontend errors"
ON public.frontend_errors FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 13. processing_metrics - Add TO authenticated
DROP POLICY IF EXISTS "Admins can read processing metrics" ON public.processing_metrics;
CREATE POLICY "Admins can read processing metrics"
ON public.processing_metrics FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 14. query_analytics - Add TO authenticated
DROP POLICY IF EXISTS "Admins can read query analytics" ON public.query_analytics;
CREATE POLICY "Admins can read query analytics"
ON public.query_analytics FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "No updates on query analytics" ON public.query_analytics;
CREATE POLICY "No updates on query analytics"
ON public.query_analytics FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS "No deletes on query analytics" ON public.query_analytics;
CREATE POLICY "No deletes on query analytics"
ON public.query_analytics FOR DELETE TO authenticated
USING (false);

-- 15. response_feedback - Add TO authenticated
DROP POLICY IF EXISTS "Admins can read feedback" ON public.response_feedback;
CREATE POLICY "Admins can read feedback"
ON public.response_feedback FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "No updates on feedback" ON public.response_feedback;
CREATE POLICY "No updates on feedback"
ON public.response_feedback FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS "No deletes on feedback" ON public.response_feedback;
CREATE POLICY "No deletes on feedback"
ON public.response_feedback FOR DELETE TO authenticated
USING (false);

-- 16. search_metrics - Add TO authenticated
DROP POLICY IF EXISTS "Admins can read search metrics" ON public.search_metrics;
CREATE POLICY "Admins can read search metrics"
ON public.search_metrics FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 17. user_roles - Add TO authenticated
DROP POLICY IF EXISTS "Authenticated users can view own roles" ON public.user_roles;
CREATE POLICY "Authenticated users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Deny user insert to roles" ON public.user_roles;
CREATE POLICY "Deny user insert to roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny user updates to roles" ON public.user_roles;
CREATE POLICY "Deny user updates to roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS "Deny user deletes to roles" ON public.user_roles;
CREATE POLICY "Deny user deletes to roles"
ON public.user_roles FOR DELETE TO authenticated
USING (false);
