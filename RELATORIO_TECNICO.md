# Relatorio Tecnico do Projeto CLARA (clarainova)

**Data:** 2026-02-15  
**Repositorio:** WilsonMPeixoto-2/clarainova

---

## 1. Hosting e Deploy

- **Frontend:** Vercel (SPA React/Vite)
- **Backend:** Supabase (Postgres + Edge Functions)
- **Build:** `pnpm build` (output: `dist/`)
- **Runtime recomendado:** Node.js 20+ e pnpm 10.x

---

## 2. Stack

### 2.1 Frontend

- React 18 + Vite 5
- Tailwind CSS 3 + Radix UI/shadcn
- React Router DOM 6
- TanStack React Query 5
- Framer Motion
- Vitest + Testing Library (unit tests)

### 2.2 Backend (Supabase)

- Postgres (inclui busca hibrida via RPC e embeddings; ver `supabase/migrations/`)
- Edge Functions (Deno):
  - `supabase/functions/clara-chat` (chat; resposta via SSE `text/event-stream`)
  - `supabase/functions/re-embed-chunks` (regera embeddings; protegida por `ADMIN_KEY`)
  - `supabase/functions/submit-feedback` (feedback do usuario)
  - `supabase/functions/log-frontend-error` (observabilidade de erros do frontend)

---

## 3. Fluxo do Chat (alto nivel)

1. O frontend envia `message` + historico para `.../functions/v1/clara-chat` com `Accept: text/event-stream`.
2. A Edge Function calcula embedding da pergunta, busca contexto (vector + keyword) e chama o LLM.
3. A Edge Function envia a resposta em streaming (SSE), com eventos de progresso, fontes e deltas de texto.
4. O frontend renderiza o streaming e salva analytics de forma assicrona.

### 3.1 Contrato SSE (eventos)

- `request_id`: id de rastreio do request
- `thinking`: etapa atual (transparencia)
- `api_provider`: provedor/modelo usado
- `sources`: fontes locais/web e flags (ex: quorum)
- `delta`: incrementos de texto
- `done`: finalizacao
- `error`: erro estruturado

---

## 4. Variaveis e Secrets

### 4.1 Vercel (Frontend)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)

### 4.2 Supabase (Edge Functions)

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (necessarios para operacoes server-side)
- `GOOGLE_GENERATIVE_AI_API_KEY` (ou `GEMINI_API_KEY`)
- `ADMIN_KEY` (apenas para operacoes privilegiadas, ex: `re-embed-chunks`)

---

## 5. Observabilidade e Qualidade

Tabelas e funcoes relacionadas a observabilidade/seguranca podem ser encontradas em `supabase/migrations/`.
Exemplos de artefatos:

- `query_analytics` (pergunta/resposta + fontes)
- funcoes RPC: `hybrid_search_chunks`, `search_document_chunks`
- funcoes de resumo: `get_chat_metrics_summary`, `get_frontend_errors_summary`

---

## 6. Rotas e Assets

- Rotas legais:
  - `/privacidade`
  - `/termos`
  - `/sobre`
- PWA:
  - `public/manifest.json`
  - `public/sw.js` (intencionalmente sem cache runtime para evitar assets obsoletos)

---

## 7. Desenvolvimento Local

Consulte `README.md` para requisitos, variaveis de ambiente e comandos.
