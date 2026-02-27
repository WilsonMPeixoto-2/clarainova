-- =============================================
-- SECURITY HARDENING: Restrict sensitive RPCs to service_role only
-- =============================================

-- Chat and frontend observability RPCs
REVOKE EXECUTE ON FUNCTION public.get_chat_metrics_summary(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_frontend_errors_summary(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_metrics_summary(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_frontend_errors_summary(INTEGER) TO service_role;

-- API usage RPCs
REVOKE EXECUTE ON FUNCTION public.get_api_usage_summary(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_api_usage_stats(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_api_usage_summary(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_api_usage_stats(INTEGER) TO service_role;

-- Processing observability RPCs
REVOKE EXECUTE ON FUNCTION public.get_processing_stats(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_recent_processing_errors(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_documents_for_retry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_processing_stats(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_processing_errors(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_documents_for_retry() TO service_role;

-- Chat storage admin RPCs
REVOKE EXECUTE ON FUNCTION public.get_chat_storage_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_chat_sessions(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_storage_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_chat_sessions(INTEGER) TO service_role;
