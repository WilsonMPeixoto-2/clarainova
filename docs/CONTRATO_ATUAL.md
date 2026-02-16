# Contrato Atual (Frontend <-> Supabase)

Gerado em: 2026-02-16  
Branch/commit: `prod` / `3ed983a`

## A) Endpoints `/functions/v1/*` chamados pelo frontend

| Endpoint | Metodo(s) observado(s) | Chamadores no frontend |
|---|---|---|
| `/functions/v1/clara-chat` | `POST` | `src/hooks/useChat.ts` |
| `/functions/v1/log-frontend-error` | `POST` | `src/components/ErrorBoundary.tsx` |
| `/functions/v1/admin-auth` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/admin_get_upload_url` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/documents` | `GET`, `DELETE`, `POST` | `src/pages/Admin.tsx` (`supabase.functions.invoke('documents')` e `fetch`) |
| `/functions/v1/documents/process-job` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/documents/process` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/documents/ingest-start` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/documents/ingest-batch` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/documents/ingest-finish` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/documents/ingest-text` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/documents/ocr-batch` | `POST` | `src/pages/Admin.tsx` |
| `/functions/v1/admin-analytics/analytics` | `GET` | `src/components/admin/AnalyticsTab.tsx` |
| `/functions/v1/admin-analytics/feedback` | `GET` | `src/components/admin/FeedbackTab.tsx` |
| `/functions/v1/admin-analytics/queries-by-fingerprint` | `GET` | `src/components/admin/FeedbackDetailModal.tsx` |

## B) Variaveis de ambiente `VITE_*` usadas

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback de compatibilidade)

Arquivos principais: `src/integrations/supabase/client.ts`, `src/pages/Admin.tsx`, `src/hooks/useChat.ts`, `src/components/ErrorBoundary.tsx`, `src/components/admin/*.tsx`.

## C) Tabelas e RPCs usadas por `supabase/functions/clara-chat/index.ts`

### RPCs

- `check_rate_limit`
- `hybrid_search_chunks`

### Tabelas (via `supabase.from(...)`)

- `chat_metrics` (insert de hits de rate limit e metricas de execucao)
- `query_analytics` (insert de pergunta/resposta/fontes + `select id`)
- `search_metrics` (insert de metricas de busca)

## D) Bucket de Storage referenciado

- `knowledge-base`

Referencias:

- Frontend: `src/pages/Admin.tsx` (`supabase.storage.from('knowledge-base')`)
- Edge Functions: `supabase/functions/documents/index.ts` e `supabase/functions/admin_get_upload_url/index.ts`

## Observacao de contrato

Para manter compatibilidade do frontend atual, o backend novo precisa preservar:

- os endpoints listados na secao A
- as variaveis da secao B
- as RPCs e tabelas da secao C
- o bucket `knowledge-base` da secao D
