-- Base schema for CLARA (clarainova).
--
-- Evidence: the repository previously contained only "patch" migrations (RLS/function fixes),
-- but no CREATE TABLE / check_rate_limit definitions inside supabase/migrations.
-- This init migration makes a brand new Supabase project bootable from git.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Enum used by RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END
$$;

-- Generic updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Profiles (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- Roles (no FK by design; app policies use auth.uid())
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user'::public.app_role
);

-- Documents
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'manual',
  file_path text,
  content_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'uploaded',
  error_reason text,
  content_hash text,
  processed_at timestamptz,
  chunk_count integer DEFAULT 0,
  version integer DEFAULT 1,
  source_file_name text,
  version_label text,
  effective_date date,
  supersedes_document_id uuid REFERENCES public.documents(id),
  tags text[] DEFAULT '{}'::text[],
  extraction_metadata jsonb DEFAULT '{}'::jsonb
);

DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Document chunks (vector embeddings + full text)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id),
  content text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(768),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  content_hash text,
  search_vector tsvector
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector ON public.document_chunks USING gin (search_vector);

CREATE OR REPLACE FUNCTION public.document_chunks_set_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector = to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_chunks_search_vector_trigger ON public.document_chunks;
CREATE TRIGGER document_chunks_search_vector_trigger
BEFORE INSERT OR UPDATE OF content ON public.document_chunks
FOR EACH ROW EXECUTE FUNCTION public.document_chunks_set_search_vector();

-- Document jobs (batch ingestion state)
CREATE TABLE IF NOT EXISTS public.document_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id),
  status text NOT NULL DEFAULT 'pending',
  next_page integer NOT NULL DEFAULT 1,
  total_pages integer,
  pages_per_batch integer NOT NULL DEFAULT 10,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  last_error_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_batch_index integer DEFAULT 0,
  total_batches integer,
  batch_hashes jsonb DEFAULT '[]'::jsonb
);

DROP TRIGGER IF EXISTS set_document_jobs_updated_at ON public.document_jobs;
CREATE TRIGGER set_document_jobs_updated_at
BEFORE UPDATE ON public.document_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit log: document access
CREATE TABLE IF NOT EXISTS public.document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id),
  accessed_by uuid,
  access_type text NOT NULL DEFAULT 'download',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat sessions (optional, for persistence)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL DEFAULT 'Nova conversa',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER set_chat_sessions_updated_at
BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chat metrics (observability)
CREATE TABLE IF NOT EXISTS public.chat_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  session_fingerprint text,
  request_id uuid,
  embedding_latency_ms integer,
  search_latency_ms integer,
  llm_first_token_ms integer,
  llm_total_ms integer,
  provider text,
  model text,
  mode text,
  web_search_used boolean DEFAULT false,
  local_chunks_found integer DEFAULT 0,
  web_sources_count integer DEFAULT 0,
  fallback_triggered boolean DEFAULT false,
  rate_limit_hit boolean DEFAULT false,
  error_type text
);

-- Query analytics (for feedback)
CREATE TABLE IF NOT EXISTS public.query_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_query text NOT NULL,
  assistant_response text NOT NULL,
  sources_cited text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  session_fingerprint text
);

CREATE TABLE IF NOT EXISTS public.response_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES public.query_analytics(id),
  rating boolean NOT NULL,
  feedback_text text,
  feedback_category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Provider usage stats (optional)
CREATE TABLE IF NOT EXISTS public.api_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Search metrics (optional)
CREATE TABLE IF NOT EXISTS public.search_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text NOT NULL,
  vector_search_ms integer,
  keyword_search_ms integer,
  results_returned integer,
  total_chunks_scanned integer,
  threshold_used numeric,
  created_at timestamptz DEFAULT now()
);

-- Rate limiting state (used by public.check_rate_limit)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
ON public.rate_limits (client_key, endpoint, window_start);

-- Trusted domains + web cache (optional; used by future web fallback work)
CREATE TABLE IF NOT EXISTS public.trusted_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  category text NOT NULL,
  description text,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.web_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text NOT NULL,
  query_text text NOT NULL,
  mode text NOT NULL,
  serp_results jsonb,
  fetched_pages jsonb,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Frontend error collection (best-effort)
CREATE TABLE IF NOT EXISTS public.frontend_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  error_message text,
  component_stack text,
  url text,
  user_agent text
);

-- Processing metrics (admin/ingestion observability)
CREATE TABLE IF NOT EXISTS public.processing_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id),
  step text NOT NULL,
  duration_ms integer NOT NULL,
  success boolean NOT NULL,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Reports (admin)
CREATE TABLE IF NOT EXISTS public.development_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_development_reports_updated_at ON public.development_reports;
CREATE TRIGGER set_development_reports_updated_at
BEFORE UPDATE ON public.development_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.report_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_tag_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.development_reports(id),
  tag_id uuid NOT NULL REFERENCES public.report_tags(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RPC: rate limiting (required by Edge Functions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_client_key text,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, current_count integer, reset_in integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
  v_oldest timestamptz;
  v_reset_in integer;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;

  SELECT COUNT(*)::integer, MIN(window_start)
    INTO v_count, v_oldest
  FROM public.rate_limits
  WHERE client_key = p_client_key
    AND endpoint = p_endpoint
    AND window_start > v_window_start;

  IF v_count < p_max_requests THEN
    INSERT INTO public.rate_limits (client_key, endpoint, window_start)
    VALUES (p_client_key, p_endpoint, now());

    RETURN QUERY SELECT true, v_count + 1, 0;
  END IF;

  v_reset_in :=
    CASE
      WHEN v_oldest IS NULL THEN p_window_seconds
      ELSE GREATEST(
        0,
        CEIL(EXTRACT(EPOCH FROM (v_oldest + (p_window_seconds || ' seconds')::interval - now())))
      )::integer
    END;

  RETURN QUERY SELECT false, v_count, v_reset_in;
END;
$$;

-- ============================================================
-- Auth trigger: create profile row for new users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Optional cleanup helpers (safe to leave unused)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_web_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.web_search_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '1 hour';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_chat_sessions(days_old integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.chat_sessions WHERE updated_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- Enable RLS (policies are created/adjusted by later migrations)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frontend_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_tag_relations ENABLE ROW LEVEL SECURITY;
