# 📋 Relatório Técnico Completo: Projeto CLARA

**Versão:** 2.0  
**Data:** 26 de Janeiro de 2026  
**Autor:** Gerado automaticamente pelo sistema  

> Nota (2026-02-15): este relatório é histórico e pode conter referências legadas ao Lovable.  
> O projeto atual foi desligado do Lovable e usa **Supabase (projeto próprio)**.  
> Para setup atual, veja `SUPABASE_SETUP.md`.

---

## 📌 Sumário Executivo

**CLARA** (Consultora de Legislação e Apoio a Rotinas Administrativas) é um assistente de IA especializado em sistemas eletrônicos de informação (SEI) e procedimentos administrativos. O projeto oferece orientações passo a passo com indicação de fontes documentais, funcionando como uma "colega sênior" experiente e pedagógica.

### Identidade da Marca
- **Nome completo:** Consultora de Legislação e Apoio a Rotinas Administrativas
- **Posicionamento:** LegalTech AI Assistant
- **Identidade visual:** Sofisticada e profissional, sem branding institucional/governamental
- **Tom de comunicação:** Empático, pedagógico, prático (nunca robótico)

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vite/TypeScript)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  /                    │  /chat              │  /admin                    │
│  Landing Page         │  Interface Chat     │  Gestão de Documentos      │
│  + ChatPanel (Sheet)  │  (redirect → /)     │  + Analytics + Reports     │
├───────────────────────┴─────────────────────┴────────────────────────────┤
│  /login               │  /privacidade       │  /termos                   │
│  Google OAuth         │  Política Privacid. │  Termos de Uso             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (Projeto Próprio)                        │
├────────────────┬────────────────┬────────────────┬───────────────────────┤
│   PostgreSQL   │    Storage     │ Edge Functions │   Authentication      │
│   + pgvector   │ (knowledge-    │                │   (Google OAuth)      │
│   (768 dims)   │    base)       │                │                       │
└────────────────┴────────────────┴────────────────┴───────────────────────┘
```

---

## 🛠️ Stack Tecnológica Detalhada

### Frontend

| Tecnologia | Versão | Uso | Arquivo Principal |
|------------|--------|-----|-------------------|
| React | 18.3.1 | Framework UI principal | `src/main.tsx` |
| Vite | Latest | Build tool & dev server | `vite.config.ts` |
| TypeScript | Strict | Tipagem estática | `tsconfig.json` |
| Tailwind CSS | 3.x | Estilização utilitária | `tailwind.config.ts` |
| shadcn/ui | Latest | Componentes base | `src/components/ui/` |
| React Router | 6.30.1 | Roteamento SPA | `src/App.tsx` |
| TanStack Query | 5.83.0 | Cache & state management | - |
| Framer Motion | 12.29.0 | Animações fluidas | Componentes diversos |
| Lucide React | 0.462.0 | Biblioteca de ícones | - |
| Sonner | 1.7.4 | Sistema de toasts | `src/components/ui/sonner.tsx` |
| jsPDF | 4.0.0 | Geração de PDFs | `src/components/chat/DownloadPdfButton.tsx` |

### Backend (Supabase)

| Componente | Tecnologia | Configuração |
|------------|------------|--------------|
| Database | PostgreSQL + pgvector | Busca vetorial 768d |
| Storage | Supabase Storage | Bucket `knowledge-base` (público) |
| Functions | Deno Edge Functions | 4 funções ativas |
| Auth | Supabase Auth | Google OAuth habilitado |

### IA/ML

| Modelo | Provider | Uso | Configuração |
|--------|----------|-----|--------------|
| `gemini-2.0-flash` | Google Gemini (API) | Chat modo "Direto" | temp: 0.3, max: 2048 tokens |
| `gemini-1.5-flash` | Google Gemini (API) | Chat modo "Didático" | temp: 0.3, max: 2048 tokens |
| `text-embedding-004` | Google (direto) | Geração de embeddings | 768 dimensões |
| `gemini-2.0-flash` | Google (direto) | Extração de texto PDF | Vision + OCR |

---

## 📁 Estrutura de Arquivos Completa

```
├── .env                              # Variáveis de ambiente (auto-gerado)
├── .lovable/
│   └── plan.md                       # Plano de desenvolvimento
├── DOCUMENTATION.md                  # Documentação técnica resumida
├── RELATORIO_TECNICO_COMPLETO.md     # Este arquivo
├── README.md                         # Instruções básicas
│
├── public/
│   ├── favicon.ico                   # Ícone do site
│   ├── google5e6d36403c46e03a.html   # Verificação Google Search Console
│   ├── llm.txt                       # Instruções para crawlers AI
│   ├── og-image.png                  # Imagem Open Graph
│   ├── placeholder.svg               # Placeholder padrão
│   ├── privacidade.html              # Página estática de privacidade
│   ├── robots.txt                    # Instruções para crawlers
│   ├── sitemap.xml                   # Mapa do site
│   ├── sobre.html                    # Página sobre
│   └── termos.html                   # Termos de uso estáticos
│
├── src/
│   ├── assets/
│   │   └── clara-hero.png            # Imagem hero da landing
│   │
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AnalyticsTab.tsx      # Aba de analytics (query_analytics)
│   │   │   ├── FeedbackDetailModal.tsx # Modal de detalhes do feedback
│   │   │   ├── ReportFormModal.tsx   # Modal criar/editar relatório
│   │   │   ├── ReportViewModal.tsx   # Modal visualizar relatório
│   │   │   ├── ReportsTab.tsx        # Aba de relatórios de desenvolvimento
│   │   │   └── StorageMonitor.tsx    # Monitor de uso do storage
│   │   │
│   │   ├── animations/
│   │   │   └── ScrollReveal.tsx      # Animação de reveal no scroll
│   │   │
│   │   ├── auth/
│   │   │   ├── GoogleLoginButton.tsx # Botão login Google OAuth
│   │   │   └── UserMenu.tsx          # Menu do usuário logado
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatHistory.tsx       # Lista de sessões salvas
│   │   │   ├── ChatInput.tsx         # Campo de entrada com seletor de modo
│   │   │   ├── ChatMessage.tsx       # Renderização de mensagens
│   │   │   ├── ChatPanel.tsx         # Painel principal (Sheet)
│   │   │   ├── CopyButton.tsx        # Botão copiar resposta
│   │   │   ├── DownloadPdfButton.tsx # Exportar conversa em PDF
│   │   │   ├── FeedbackButtons.tsx   # Botões thumbs up/down
│   │   │   ├── FeedbackModal.tsx     # Modal de feedback detalhado
│   │   │   ├── ResponseModeSelector.tsx # Seletor Rápido/Profundo
│   │   │   ├── SourceCitation.tsx    # Citação de fontes documentais
│   │   │   └── ThinkingIndicator.tsx # Indicador "pensando..."
│   │   │
│   │   ├── ui/                       # 50+ componentes shadcn/ui
│   │   │   └── [accordion, button, card, dialog, sheet, tabs, ...]
│   │   │
│   │   ├── AccessibleButton.tsx      # Botão com foco em acessibilidade
│   │   ├── ErrorBoundary.tsx         # Tratamento de erros React
│   │   ├── FeaturesSection.tsx       # Seção de features da landing
│   │   ├── Footer.tsx                # Rodapé com links
│   │   ├── Header.tsx                # Cabeçalho com navegação
│   │   ├── HeroSection.tsx           # Hero da landing page
│   │   ├── LoadingFallback.tsx       # Fallback para lazy loading
│   │   ├── NavLink.tsx               # Links de navegação
│   │   ├── OfflineIndicator.tsx      # Indicador de status offline
│   │   └── SEOHead.tsx               # Meta tags dinâmicas + Schema.org
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx           # Contexto de autenticação global
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx            # Detecção de dispositivo móvel
│   │   ├── use-toast.ts              # Hook do sistema de toasts
│   │   ├── useChat.ts                # Lógica principal do chat (337 linhas)
│   │   ├── useChatSessions.ts        # CRUD sessões no banco
│   │   ├── useFeedback.ts            # Envio de feedback
│   │   ├── useKeyboardShortcuts.ts   # Atalhos de teclado
│   │   ├── useLocalStorage.ts        # Persistência local
│   │   ├── useOnlineStatus.ts        # Detecção online/offline
│   │   ├── useQueryTracking.ts       # Tracking de queries
│   │   └── useScrollPosition.ts      # Posição de scroll
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts                 # Cliente Supabase (auto-gerado)
│   │   └── types.ts                  # Tipos do banco (auto-gerado)
│   │
│   ├── pages/
│   │   ├── Admin.tsx                 # Painel administrativo (849 linhas)
│   │   ├── Chat.tsx                  # Redirect para Index
│   │   ├── Index.tsx                 # Landing page principal
│   │   ├── Login.tsx                 # Página de login
│   │   ├── NotFound.tsx              # Página 404
│   │   ├── Privacidade.tsx           # Política de privacidade
│   │   └── Termos.tsx                # Termos de uso
│   │
│   ├── test/
│   │   ├── example.test.ts           # Teste de exemplo
│   │   └── setup.ts                  # Setup do Vitest
│   │
│   ├── utils/
│   │   └── generateReportPdf.ts      # Gerador de PDF para relatórios
│   │
│   ├── App.css                       # Estilos globais adicionais
│   ├── App.tsx                       # Componente raiz com rotas
│   ├── index.css                     # Design system (tokens CSS)
│   ├── lib/utils.ts                  # Utilitários (cn, etc.)
│   ├── main.tsx                      # Entry point
│   └── vite-env.d.ts                 # Tipos Vite
│
├── supabase/
│   ├── config.toml                   # Configuração do projeto
│   ├── migrations/                   # Migrações SQL (somente leitura)
│   └── functions/
│       ├── admin-auth/index.ts       # Validação de admin key
│       ├── admin_get_upload_url/index.ts # URL assinada para upload
│       ├── clara-chat/index.ts       # Chat RAG principal (779 linhas)
│       ├── documents/index.ts        # CRUD + processamento docs (532 linhas)
│       └── search/index.ts           # Busca híbrida isolada
│
├── tailwind.config.ts                # Configuração Tailwind
├── vite.config.ts                    # Configuração Vite
└── vitest.config.ts                  # Configuração testes
```

---

## 🗄️ Schema do Banco de Dados

### Tabelas Principais

#### `documents`
Armazena metadados dos documentos da base de conhecimento.

```sql
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT 'manual',
  content_text TEXT,                    -- Texto completo extraído
  file_path TEXT,                       -- Caminho no Storage
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Leitura pública, escrita apenas via service_role
```

#### `document_chunks`
Chunks vetorizados para busca semântica.

```sql
CREATE TABLE public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(768),                -- Embedding 768 dimensões
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca vetorial
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);
```

#### `query_analytics`
Histórico de consultas para análise.

```sql
CREATE TABLE public.query_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_query TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  sources_cited TEXT[] DEFAULT '{}',
  session_fingerprint TEXT,             -- Identificador de sessão anônima
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Qualquer um pode inserir, apenas admins podem ler
```

#### `response_feedback`
Feedback dos usuários sobre respostas.

```sql
CREATE TABLE public.response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID REFERENCES query_analytics(id),
  rating BOOLEAN NOT NULL,              -- true = positivo, false = negativo
  feedback_category TEXT,               -- Categoria do problema
  feedback_text TEXT,                   -- Detalhamento opcional
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `profiles`
Perfis de usuários autenticados.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,                  -- Mesmo ID do auth.users
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: Cria perfil automaticamente no signup
```

#### `chat_sessions`
Histórico de conversas para usuários logados.

```sql
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                -- FK para profiles
  title TEXT DEFAULT 'Nova conversa',
  messages JSONB DEFAULT '[]',          -- Array de mensagens
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Usuários só acessam próprias sessões
```

#### `user_roles`
Sistema de roles (admin/user).

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role DEFAULT 'user'          -- ENUM: 'admin' | 'user'
);
```

#### `rate_limits`
Controle de rate limiting.

```sql
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `development_reports`
Relatórios de desenvolvimento (admin).

```sql
CREATE TABLE public.development_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,                -- Markdown
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Funções do Banco

#### `search_document_chunks`
Busca semântica via cosine distance.

```sql
CREATE FUNCTION search_document_chunks(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
) RETURNS TABLE(id, document_id, content, chunk_index, metadata, similarity)
```

#### `check_rate_limit`
Verifica e incrementa contador de rate limit.

```sql
CREATE FUNCTION check_rate_limit(
  p_client_key TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, reset_in INTEGER)
```

#### `has_role`
Verifica se usuário tem determinada role.

```sql
CREATE FUNCTION has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN
```

---

## ⚡ Edge Functions - Detalhamento

### 1. `clara-chat` (Principal - 779 linhas)

**Endpoint:** `POST /functions/v1/clara-chat`

**Payload:**
```json
{
  "message": "Como criar um processo no SEI?",
  "history": [{ "role": "user", "content": "..." }],
  "mode": "fast" | "deep"
}
```

**Fluxo de Execução:**

1. **Rate Limiting** (15 req/min por IP)
2. **Validação de Input**
   - Mensagem: máx 10.000 caracteres
   - Histórico: máx 50 mensagens
   - Modo: "fast" ou "deep"
3. **Classificação de Intenção** (9 categorias)
4. **Expansão de Query** com mapa de sinônimos (30+ termos)
5. **Busca Híbrida:**
   - Semântica: pgvector cosine distance (threshold 0.3)
   - Keywords: scoring com boost SEI-específico
   - Fusão: Reciprocal Rank Fusion (k=60)
6. **Montagem de Contexto** (top 12 chunks)
7. **Geração via Google Gemini API** (streaming SSE)
8. **Eventos SSE:** `thinking`, `delta`, `sources`, `done`, `error`

**System Prompt:** 279 linhas incluindo:
- Empatia cognitiva com frases de acolhimento
- Inteligência terminológica (sinônimos SEI)
- Tom anti-robô
- Formatação visual padronizada
- Escopo de atuação estrito
- Política de zero dados pessoais
- Protocolo de citação de fontes
- Disclaimer para busca web

### 2. `documents` (Processamento - 532 linhas)

**Endpoints:**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/documents` | Lista documentos com chunk_count |
| POST | `/documents` | Processa novo documento |
| DELETE | `/documents/:id` | Remove documento e chunks |

**Processamento de Upload:**
1. Rate limit: 5 tentativas / 5 minutos
2. Download do arquivo do Storage
3. Extração de texto:
   - TXT: direto
   - DOCX: mammoth.js
   - PDF: Gemini 2.0 Flash (OCR incluso)
4. Chunking: 4000 chars com 500 overlap
5. Embedding: text-embedding-004 (768d)
6. Insert em batches de 50

### 3. `admin-auth` (Autenticação)

**Endpoint:** `POST /functions/v1/admin-auth`

**Função:** Valida `x-admin-key` header contra `ADMIN_KEY` secret.

**Rate Limit:** 5 tentativas / 5 minutos (smart lock)

### 4. `admin_get_upload_url`

**Endpoint:** `POST /functions/v1/admin_get_upload_url`

**Função:** Gera URL assinada para upload direto ao Storage.

**Payload:**
```json
{
  "filename": "documento.pdf",
  "contentType": "application/pdf"
}
```

---

## 🎨 Design System

### Tokens CSS (index.css)

```css
:root {
  /* Cores principais */
  --background: 216 45% 7%;         /* Navy profundo */
  --foreground: 210 40% 98%;        /* Quase branco */
  --primary: 30 45% 64%;            /* Amber CLARA */
  --accent: 24 100% 63%;            /* Orange vibrante */
  --muted: 216 30% 15%;             /* Navy suave */
  
  /* Tokens personalizados */
  --clara-deep: 216 45% 7%;
  --clara-navy: 216 40% 16%;
  --clara-amber: 30 45% 64%;
  --clara-amber-bright: 24 100% 63%;
  --clara-glass: 216 40% 12%;
  
  --radius: 0.75rem;
}
```

### Classes Utilitárias

| Classe | Uso |
|--------|-----|
| `.glass-card` | Cards com glassmorphism |
| `.hero-overlay` | Gradiente desktop (90deg) |
| `.hero-overlay-mobile` | Gradiente mobile (180deg) |
| `.amber-glow` | Text-shadow amber |
| `.btn-clara-primary` | Botão principal com hover |
| `.btn-clara-secondary` | Botão secundário outline |
| `.search-input-clara` | Input estilizado |
| `.feature-card` | Cards de features |
| `.badge-chip` | Badges/chips |

### Animações

- `fadeIn` / `slideUp`: Entrada de elementos
- `pulseSoft`: Loading states
- `blink`: Cursor de digitação
- Suporte a `prefers-reduced-motion`

---

## 🔐 Segurança

### Rate Limiting

| Endpoint | Limite | Janela | Bloqueio |
|----------|--------|--------|----------|
| `clara-chat` | 15 req | 60s | Soft |
| `admin-auth` | 5 tentativas | 300s | Smart lock |
| `documents` | 5 operações | 300s | Smart lock |

### Validação de Input

- Chat: máx 10.000 caracteres
- Histórico: máx 50 mensagens
- Busca: máx 500 caracteres (search function)

### RLS Policies

Todas as tabelas possuem Row Level Security:

- `documents`: Leitura pública, escrita via service_role
- `chat_sessions`: Usuários acessam apenas próprias sessões
- `profiles`: Usuários acessam/editam apenas próprio perfil
- `query_analytics`: Qualquer um insere, apenas admins leem
- `response_feedback`: Qualquer um insere, apenas admins leem
- `user_roles`: Usuários veem próprias roles, não podem modificar

### Autenticação Admin

- Chave armazenada em secret `ADMIN_KEY`
- Validação via Edge Function `admin-auth`
- Sessão armazenada em `sessionStorage` (não persiste entre abas)
- Toggle de visibilidade de senha implementado

---

## 🔄 Fluxos de Dados

### Upload de Documento (Upload-then-Process)

```
┌─────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  Admin UI   │───▶│ admin_get_upload_url │───▶│ Signed URL      │
└─────────────┘    └──────────────────────┘    └────────┬────────┘
                                                        │
┌─────────────┐                                         ▼
│  PUT direto │◀────────────────────────────────────────┘
│  ao Storage │
└──────┬──────┘
       │
       ▼
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│ documents POST  │───▶│ Download Storage │───▶│ Extração texto │
└─────────────────┘    └──────────────────┘    └───────┬────────┘
                                                       │
       ┌───────────────────────────────────────────────┘
       ▼
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│ Chunking 4000c  │───▶│ Embeddings 768d  │───▶│ Insert DB      │
└─────────────────┘    └──────────────────┘    └────────────────┘
```

### Chat RAG com Streaming

```
┌─────────────┐    ┌───────────────────┐
│ User Query  │───▶│ clara-chat        │
└─────────────┘    │ (Edge Function)   │
                   └────────┬──────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌─────────────┐    ┌───────────────┐    ┌──────────────┐
│ Rate Limit  │    │ Classify      │    │ Expand       │
│ Check       │    │ Intent        │    │ Synonyms     │
└─────────────┘    └───────────────┘    └──────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌─────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Generate       │ │ Semantic       │ │ Keyword        │
│ Query Embedding│ │ Search         │ │ Scoring        │
│ (768d)         │ │ (pgvector)     │ │                │
└─────────────────┘ └───────┬────────┘ └───────┬────────┘
                            │                   │
                            └─────────┬─────────┘
                                      ▼
                           ┌──────────────────┐
                           │ Reciprocal Rank  │
                           │ Fusion (k=60)    │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ Top 12 Chunks    │
                           │ + Doc Titles     │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ Google Gemini    │
                           │ Gateway          │
                           │ (Gemini 3 Flash/ │
                           │  Pro streaming)  │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ SSE Stream       │
                           │ (delta, sources, │
                           │  done events)    │
                           └──────────────────┘
```

---

## 📊 Funcionalidades por Módulo

### Landing Page (Index.tsx)

- **HeroSection:** Imagem de fundo com gradiente, campo de busca integrado, sugestões de perguntas
- **FeaturesSection:** Cards de recursos com ícones
- **ChatPanel:** Sheet lateral (450px desktop, fullscreen mobile)
- **SEOHead:** Meta tags dinâmicas, Schema.org WebApplication

### Chat (ChatPanel.tsx + useChat.ts)

- Streaming SSE com indicador de "pensando"
- Dois modos: Rápido (Flash) e Análise Completa (Pro)
- Histórico local (localStorage) para visitantes
- Sessões persistentes no banco para usuários logados
- Exportação de resposta em PDF com branding
- Feedback thumbs up/down com modal detalhado
- Atalhos de teclado (Ctrl+N, /, Ctrl+Shift+L)
- Citação de fontes documentais

### Admin Panel (Admin.tsx)

**Aba Documentos:**
- Upload com drag & drop
- Suporte PDF, DOCX, TXT (máx 50MB, 10MB mobile)
- Progress bar de upload/processamento
- Lista de documentos com chunk_count
- Delete com confirmação

**Aba Analytics:**
- Métricas de queries e feedback
- Visualização de conversas
- Detalhamento de feedback negativo

**Aba Relatórios:**
- CRUD de relatórios de desenvolvimento
- Editor Markdown
- Exportação PDF com branding CLARA

**StorageMonitor:**
- Uso de storage em tempo real
- Limpeza de sessões antigas

### Autenticação

- Google OAuth via Supabase Auth
- Auto-confirm de emails habilitado
- Criação automática de profile no signup
- Atribuição automática de role 'user'
- Menu de usuário com logout

---

## 📈 Principais Melhorias Implementadas

### Fase 1: Fundação (Início)
- [x] Setup inicial React + Vite + TypeScript
- [x] Integração Supabase (projeto próprio)
- [x] Landing page com design system
- [x] Sistema de chat básico

### Fase 2: RAG e IA
- [x] Implementação busca vetorial (pgvector)
- [x] Edge Function clara-chat com streaming SSE
- [x] System prompt CLARA (279 linhas)
- [x] Mapa de sinônimos administrativos
- [x] Classificador de intenção
- [x] Busca híbrida (semântica + keywords)
- [x] Reciprocal Rank Fusion

### Fase 3: Admin e Processamento
- [x] Painel administrativo protegido
- [x] Upload de documentos (PDF, DOCX, TXT)
- [x] Extração de texto via Gemini 2.0 Flash
- [x] Chunking com overlap inteligente
- [x] Geração de embeddings 768d

### Fase 4: Segurança
- [x] Rate limiting em todos os endpoints
- [x] Smart lock para tentativas de admin
- [x] Validação de input rigorosa
- [x] RLS policies em todas as tabelas
- [x] Autenticação Google OAuth
- [x] Toggle de visibilidade de senha

### Fase 5: UX/DX
- [x] Modos Rápido/Profundo
- [x] Exportação PDF de respostas
- [x] Sistema de feedback
- [x] Atalhos de teclado
- [x] Sessões persistentes para usuários logados
- [x] StorageMonitor
- [x] Sistema de relatórios de desenvolvimento
- [x] Otimizações mobile

### Fase 6: SEO e Compliance
- [x] Meta tags dinâmicas
- [x] Schema.org markup
- [x] Open Graph
- [x] robots.txt e sitemap.xml
- [x] Páginas de Privacidade e Termos
- [x] Google Search Console verification

---

## 🔮 Próximas Ações Sugeridas

### Alta Prioridade

1. **Migração Gemini 3 Flash/Pro**
   - Modelos já configurados no código
   - Monitorar performance e custos
   - Ajustar temperaturas conforme feedback

2. **Web Search Grounding**
   - Implementar fallback para perguntas sem contexto local
   - Adicionar disclaimer obrigatório
   - Validar fontes (.gov.br, prefeitura.rio, etc.)

3. **Testes Automatizados**
   - Expandir cobertura do Vitest
   - Testes de integração para Edge Functions
   - Testes E2E com Playwright

### Média Prioridade

4. **Analytics Avançado**
   - Dashboard de métricas
   - Análise de queries sem resposta
   - Heatmap de tópicos mais consultados

5. **Melhoria do RAG**
   - Re-ranking com cross-encoder
   - Query rewriting
   - Citação inline com highlight

6. **Mobile PWA**
   - Service Worker
   - Manifest.json
   - Offline fallback

### Baixa Prioridade

7. **Internacionalização**
   - Suporte a múltiplos idiomas
   - Detecção automática de idioma

8. **Integração WhatsApp/Telegram**
   - Bot para atendimento
   - Webhook de mensagens

9. **API Pública**
   - Documentação OpenAPI
   - Rate limiting por API key
   - Dashboard de uso

---

## 📝 Secrets Configurados

| Secret | Descrição | Uso |
|--------|-----------|-----|
| `SUPABASE_URL` | URL do projeto Supabase | Edge Functions |
| `SUPABASE_ANON_KEY` | Chave pública | Cliente frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave admin | Edge Functions |
| `SUPABASE_PUBLISHABLE_KEY` | Alias da anon key | Cliente |
| `SUPABASE_DB_URL` | Connection string | Migrações |
| `GEMINI_API_KEY` | Google AI Studio | Embeddings, PDF extraction |
| `FIRECRAWL_API_KEY` | (Opcional) Web search via Firecrawl | Edge Function web-search |
| `ADMIN_KEY` | Chave admin panel | Autenticação /admin |

---

## 🔗 URLs do Projeto

- **Preview:** (defina seu ambiente de preview)
- **Produção:** (defina seu domínio de produção)
- **GitHub:** https://github.com/WilsonMPeixoto-2/clarainova
- **Supabase Project ID:** (seu project ref)

---

## 📊 Métricas de Código

| Arquivo | Linhas | Complexidade |
|---------|--------|--------------|
| `clara-chat/index.ts` | 779 | Alta |
| `Admin.tsx` | 849 | Alta |
| `documents/index.ts` | 532 | Média |
| `useChat.ts` | 337 | Média |
| `ChatPanel.tsx` | 363 | Média |
| `index.css` | 297 | Baixa |
| `DOCUMENTATION.md` | 298 | - |

**Total de arquivos TypeScript:** ~80+  
**Componentes React:** ~50+  
**Edge Functions:** 5

---

*Relatório gerado em 26/01/2026 às 04:20 (horário local)*
