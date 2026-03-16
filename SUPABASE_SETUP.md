# Setup Supabase (Novo Projeto)

## 1) Frontend (Vite / Vercel)

Variaveis de ambiente (ver `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (recomendado)
  - Alternativa suportada: `VITE_SUPABASE_PUBLISHABLE_KEY`

## 2) Banco (Migrations)

Este repo possui migrations completas em `supabase/migrations/` (schema + RPCs como `check_rate_limit` e `hybrid_search_chunks`).

Via Supabase CLI (recomendado):

```bash
supabase link --project-ref <SEU_PROJECT_REF>
supabase db push
```

Observacao: o `supabase db push` vai pedir a senha do banco (a mesma do projeto no Supabase).

## 3) Edge Functions (Deploy)

As functions usadas pelo app estao em `supabase/functions/`.

Deploy (CLI):

```bash
supabase functions deploy clara-chat
supabase functions deploy log-frontend-error
supabase functions deploy admin-auth
supabase functions deploy admin-analytics
supabase functions deploy admin_get_upload_url
supabase functions deploy documents
supabase functions deploy search
supabase functions deploy web-search
```

Se quiser, voce pode deployar tudo manualmente (uma por vez) e validar antes de seguir.

## 4) Secrets (Edge Functions)

Secrets necessarios (setar via CLI):

```bash
supabase secrets set GEMINI_API_KEY=... ADMIN_KEYS=... RATELIMIT_SALT=... FIRECRAWL_API_KEY=...
```

Template local para desenvolvimento das functions:

- `supabase/functions/.env.example`
- copie para `supabase/functions/.env` apenas no ambiente local
- esse arquivo nao deve ir para o Git

Notas:

- `ADMIN_KEYS` aceita multiplas chaves separadas por virgula. Alternativa: `ADMIN_KEY` (apenas uma).
- `RATELIMIT_SALT` e usado para rate limit de logs do frontend (hash de IP). Se nao setar, o rate limit fica mais agressivo (degradado).
- `FIRECRAWL_API_KEY` e opcional, mas necessario para a Edge Function `web-search` retornar fontes web (sem ele, a busca web tende a retornar zero resultados).
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` normalmente ja existem no ambiente das Edge Functions quando deployadas no proprio Supabase.

## 5) Config de Auth/Verificacao

O arquivo `supabase/config.toml` ja deixa `verify_jwt = false` para as functions chamadas diretamente do browser (elas usam `apikey` + `x-admin-key` quando aplicavel).

Ao criar o projeto novo:

- confirme buckets/policies (bucket `knowledge-base` e usado pelo Admin)
- confirme que as migrations criaram as tabelas/funcs (ex.: `documents`, `document_chunks`, `check_rate_limit`, `hybrid_search_chunks`)
