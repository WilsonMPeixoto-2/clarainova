# CLARA (clarainova)

Frontend em React/Vite + backend em Supabase Edge Functions (chat + RAG com Gemini).

## Stack

- React 18 + Vite 5
- Tailwind CSS 3 (com `@tailwindcss/typography` e `tailwindcss-animate`)
- Supabase (Auth, Storage, Postgres + Edge Functions em Deno)

## Rodar Localmente

Requisitos:

- Node.js 20+ (recomendado; 18+ deve funcionar)
- `pnpm` 10.x

Instalar dependencias:

```bash
pnpm install
```

Crie um `.env.local` com:

```bash
VITE_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="SUA_ANON_KEY"
```

Rodar em dev:

```bash
pnpm dev
```

## Deploy (Vercel)

O deploy esta configurado em `vercel.json`:

- `buildCommand`: `pnpm build`
- `outputDirectory`: `dist`
- rewrite SPA para suportar rotas do `react-router-dom` (ex: `/chat`, `/admin`)

## Backend (Supabase)

Edge functions em `supabase/functions/`:

- `clara-chat`: chat principal (resposta via SSE `text/event-stream`)
- `re-embed-chunks`: reprocessa embeddings (protegida por `ADMIN_KEY`)
- `submit-feedback`: recebe feedback do usuario (thumbs up/down) e grava no banco
- `log-frontend-error`: coleta erros do frontend (best-effort) para observabilidade

Deploy (via Supabase CLI):

```bash
npx supabase login
npx supabase link --project-ref <SEU_PROJECT_REF>
npx supabase functions deploy clara-chat
npx supabase functions deploy re-embed-chunks
npx supabase functions deploy submit-feedback
npx supabase functions deploy log-frontend-error
```

### Secrets Necessarios (Supabase)

- `GOOGLE_GENERATIVE_AI_API_KEY` (ou `GEMINI_API_KEY`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_KEY` (somente para `re-embed-chunks`)

## Checklist Rapido (Quando o Chat Nao Responde)

1. Variaveis na Vercel (Production): `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
2. Projeto Supabase ativo (URL/ref valido)
3. Edge Function `clara-chat` retornando SSE (`Content-Type: text/event-stream`)
