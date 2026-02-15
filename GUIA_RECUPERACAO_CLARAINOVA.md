# 🚨 Guia de Recuperação – ClaraInova

## PARTE 1: Reverter Danos no GitHub

### 1.1 Identificar commits problemáticos

```bash
git log --oneline -20
```

Procure por commits do Lovable que contenham:
- Deleção de `patches/wouter@3.7.1.patch`
- Deleção de `pnpm-lock.yaml`
- Modificações em `src/main.tsx` (render vazio)
- Criação de `server/_core/index.ts` (stub)
- Modificações em `pull_request/13.yml`

### 1.2 Reverter para commit funcional

```bash
# Liste os commits e identifique o último commit BOM (antes das alterações do Lovable)
git log --oneline --all

# Opção A: Revert dos commits ruins (preserva histórico)
git revert <hash_commit_ruim_1> <hash_commit_ruim_2> ...

# Opção B: Reset hard para o último commit bom (reescreve histórico)
git reset --hard <hash_ultimo_commit_bom>
git push --force origin main
```

### 1.3 Verificar que src/main.tsx está correto

O `src/main.tsx` DEVE conter:

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
```

> ⚠️ Se tiver `createRoot(rootEl).render();` sem `<App />`, isso causa tela branca!

---

## PARTE 2: Configurar Vercel Corretamente

### 2.1 Variáveis de Ambiente no Vercel

Vá em **Vercel Dashboard → clarainova → Settings → Environment Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://mebucurgtfrrjejuched.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnVjdXJndGZycmplanVjaGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjY1ODAsImV4cCI6MjA4NjAwMjU4MH0.xWNNmNFdTRYUGRTfaKOsHdQb0-PStWZy5V-1KgaQnQI` |
| `VITE_SUPABASE_PROJECT_ID` | `mebucurgtfrrjejuched` |

### 2.2 Build Settings no Vercel

| Campo | Valor |
|-------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` ou `vite build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | 18.x |

> ⚠️ **IMPORTANTE**: Se o `package.json` tiver `"packageManager": "pnpm@..."`, REMOVA essa linha antes de buildar, ou o Vercel vai tentar usar pnpm e falhar.

### 2.3 Limpar projetos duplicados no Vercel

Você tem 3 projetos Vercel (clarainova, clarainova2, clarainova-rluc). Recomendo:
1. Manter apenas **um** projeto ativo
2. Deletar ou desativar os outros para evitar confusão

### 2.4 Forçar redeploy no Vercel

```bash
# Após corrigir o código no GitHub:
# Vá em Vercel Dashboard → clarainova → Deployments → Redeploy (último deploy)
```

---

## PARTE 3: DDL Completo do Banco de Dados

Caso precise recriar o banco em outro Supabase, execute estes comandos SQL:

### 3.1 Extensões necessárias

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3.2 Tabelas

```sql
-- Profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user'
);

-- Documents
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  tags text[] DEFAULT '{}',
  extraction_metadata jsonb DEFAULT '{}'
);

-- Document Chunks (com embeddings vetoriais)
CREATE TABLE public.document_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id),
  content text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  content_hash text,
  search_vector tsvector
);

-- Document Jobs
CREATE TABLE public.document_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  batch_hashes jsonb DEFAULT '[]'
);

-- Document Access Log
CREATE TABLE public.document_access_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id),
  accessed_by uuid,
  access_type text NOT NULL DEFAULT 'download',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat Sessions
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL DEFAULT 'Nova conversa',
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chat Metrics
CREATE TABLE public.chat_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Query Analytics
CREATE TABLE public.query_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_query text NOT NULL,
  assistant_response text NOT NULL,
  sources_cited text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  session_fingerprint text
);

-- Response Feedback
CREATE TABLE public.response_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id uuid NOT NULL REFERENCES public.query_analytics(id),
  rating boolean NOT NULL,
  feedback_text text,
  feedback_category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- API Usage Stats
CREATE TABLE public.api_usage_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  model text NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Search Metrics
CREATE TABLE public.search_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash text NOT NULL,
  vector_search_ms integer,
  keyword_search_ms integer,
  results_returned integer,
  total_chunks_scanned integer,
  threshold_used numeric,
  created_at timestamptz DEFAULT now()
);

-- Rate Limits
CREATE TABLE public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_key text NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trusted Domains
CREATE TABLE public.trusted_domains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL,
  category text NOT NULL,
  description text,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Web Search Cache
CREATE TABLE public.web_search_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash text NOT NULL,
  query_text text NOT NULL,
  mode text NOT NULL,
  serp_results jsonb,
  fetched_pages jsonb,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Frontend Errors
CREATE TABLE public.frontend_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  error_message text,
  component_stack text,
  url text,
  user_agent text
);

-- Processing Metrics
CREATE TABLE public.processing_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id),
  step text NOT NULL,
  duration_ms integer NOT NULL,
  success boolean NOT NULL,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Development Reports
CREATE TABLE public.development_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Report Tags
CREATE TABLE public.report_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Report Tag Relations
CREATE TABLE public.report_tag_relations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.development_reports(id),
  tag_id uuid NOT NULL REFERENCES public.report_tags(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.3 Funções RPC Principais

```sql
-- Check Rate Limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_client_key text,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, current_count integer, reset_in integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;
  
  SELECT COUNT(*)::integer INTO v_count
  FROM public.rate_limits
  WHERE client_key = p_client_key
    AND endpoint = p_endpoint
    AND window_start > v_window_start;
  
  IF v_count < p_max_requests THEN
    INSERT INTO public.rate_limits (client_key, endpoint, window_start)
    VALUES (p_client_key, p_endpoint, now());
    
    RETURN QUERY SELECT true, v_count + 1, 0;
  ELSE
    RETURN QUERY SELECT false, v_count, 
      EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::interval - now()))::integer;
  END IF;
END;
$$;

-- Hybrid Search Chunks
CREATE OR REPLACE FUNCTION public.hybrid_search_chunks(
  query_embedding text,
  query_text text,
  match_threshold float DEFAULT 0.5,
  match_count integer DEFAULT 10,
  vector_weight float DEFAULT 0.7,
  keyword_weight float DEFAULT 0.3
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  metadata jsonb,
  similarity float,
  text_rank float,
  combined_score float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    COALESCE(1 - (dc.embedding <=> query_embedding::vector), 0)::float AS similarity,
    COALESCE(ts_rank(dc.search_vector, plainto_tsquery('portuguese', query_text)), 0)::float AS text_rank,
    (
      vector_weight * COALESCE(1 - (dc.embedding <=> query_embedding::vector), 0) +
      keyword_weight * COALESCE(ts_rank(dc.search_vector, plainto_tsquery('portuguese', query_text)), 0)
    )::float AS combined_score
  FROM public.document_chunks dc
  WHERE dc.embedding IS NOT NULL
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Search Document Chunks (vector only)
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  query_embedding text,
  match_threshold float DEFAULT 0.5,
  match_count integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    (1 - (dc.embedding <=> query_embedding::vector))::float AS similarity
  FROM public.document_chunks dc
  WHERE dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding::vector)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Handle New User (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cleanup functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_web_cache()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.web_search_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '1 hour';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_chat_sessions(days_old integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.chat_sessions WHERE updated_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

### 3.4 RLS (Row Level Security)

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles: usuários veem/editam apenas o próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Chat Sessions: usuários veem/editam apenas suas sessões
CREATE POLICY "Users can manage own sessions" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);

-- Documents: leitura pública (base de conhecimento)
CREATE POLICY "Documents are publicly readable" ON public.documents FOR SELECT USING (true);

-- Document Chunks: leitura pública (busca)
CREATE POLICY "Chunks are publicly readable" ON public.document_chunks FOR SELECT USING (true);

-- Tabelas de métricas: sem RLS (inserção via service_role nas Edge Functions)
-- api_usage_stats, chat_metrics, search_metrics, processing_metrics, frontend_errors,
-- query_analytics, response_feedback, rate_limits, web_search_cache, trusted_domains
```

---

## PARTE 4: Edge Functions

### 4.1 Lista de Edge Functions

| Nome | Descrição |
|------|-----------|
| `clara-chat` | Chat principal com RAG + LLM (Gemini) |
| `re-embed-chunks` | Re-gera embeddings dos chunks |
| `submit-feedback` | Recebe feedback (thumbs) e grava em `response_feedback` |
| `log-frontend-error` | Coleta erros do frontend (best-effort) em `frontend_errors` |

### 4.2 Secrets necessárias nas Edge Functions

| Secret | Descrição |
|--------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase (automática) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (automática) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | API Key do Google Gemini |
| `GEMINI_API_KEY` | API Key alternativa do Gemini |
| `ADMIN_KEY` | Chave de admin para operações privilegiadas |
| `FINGERPRINT_SALT` | Salt para fingerprint de sessão |
| `RATELIMIT_SALT` | Salt para rate limiting |

### 4.3 Nota sobre a Edge Function `clara-chat`

✅ **Atualização (2026-02-15)**: o repositório já contém uma implementação funcional da Edge Function `supabase/functions/clara-chat/index.ts`, alinhada com o frontend atual (SSE streaming).

Para aplicar em produção, faça o deploy via Supabase CLI:

1. `npx supabase link --project-ref <SEU_PROJECT_REF>`
2. `npx supabase functions deploy clara-chat`

Resumo do contrato:

1. Request: `{ message, history, mode, webSearchMode, continuation }` (também aceita `conversationHistory` por compatibilidade).
2. Response: SSE (`text/event-stream`) com eventos `request_id`, `thinking`, `api_provider`, `sources`, `delta`, `done`, `error`.
3. Se o client não pedir SSE, a function pode responder JSON (fallback).

---

## PARTE 5: Checklist Final

### No GitHub:
- [ ] Reverter commits problemáticos
- [ ] Verificar que `src/main.tsx` renderiza `<App />`
- [ ] Garantir que `pnpm-lock.yaml` está alinhado com `package.json` (instalação com `pnpm install --frozen-lockfile`)
- [ ] Confirmar que não há lockfiles conflitantes (ex: `package-lock.json`)

### No Vercel:
- [ ] Configurar variáveis de ambiente (Production): `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Build Command: `vite build`
- [ ] Output Directory: `dist`
- [ ] Node.js 20.x (recomendado)
- [ ] Deletar projetos duplicados (manter apenas 1)
- [ ] Forçar redeploy

### Backend (Supabase):
- [ ] Confirmar que o projeto Supabase está ativo e com URL/ref válidos
- [ ] As Edge Functions estão deployadas e respondendo
- [ ] Verificar secrets: `SUPABASE_SERVICE_ROLE_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` (ou `GEMINI_API_KEY`)

---

## PARTE 6: Se quiser criar um Supabase próprio

1. Crie conta em [supabase.com](https://supabase.com)
2. Crie novo projeto
3. Execute o DDL da Parte 3 no SQL Editor
4. Vá em **Settings → API** e copie:
   - `Project URL` → use como `VITE_SUPABASE_URL`
   - `anon public key` → use como `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Vá em **Settings → API → Service Role Key** e configure nas Edge Functions
6. Configure os secrets listados na Parte 4.2
7. Deploy as Edge Functions via Supabase CLI:
   ```bash
   npx supabase functions deploy clara-chat
   npx supabase functions deploy re-embed-chunks
   ```

---

*Documento gerado em 2026-02-10*
