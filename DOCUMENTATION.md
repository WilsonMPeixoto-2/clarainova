# 📋 Relatório Técnico: Projeto CLARA

## 🎯 Visão Geral

**CLARA** - Consultora de Legislação e Apoio a Rotinas Administrativas  
Assistente de IA especializada em sistemas eletrônicos de informação (SEI) e procedimentos administrativos.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Vite)                     │
├─────────────────────────────────────────────────────────────────┤
│  /              │  /chat           │  /admin                    │
│  Landing Page   │  Chat Interface  │  Document Management       │
└────────┬────────┴────────┬─────────┴────────┬───────────────────┘
         │                 │                   │
         ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Projeto Próprio)                   │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   Database   │   Storage    │ Edge Functions│     Auth          │
│  (PostgreSQL │ (knowledge-  │              │   (Disabled)       │
│  + pgvector) │   base)      │              │                    │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

---

## 🛠️ Stack Tecnológica

### Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 18.3.1 | Framework UI |
| Vite | - | Build tool |
| TypeScript | - | Tipagem estática |
| Tailwind CSS | - | Estilização |
| shadcn/ui | - | Componentes UI |
| React Router | 6.30.1 | Roteamento |
| TanStack Query | 5.83.0 | State management |
| Lucide React | 0.462.0 | Ícones |
| Sonner | 1.7.4 | Toasts/Notificações |

### Backend (Supabase)

| Componente | Tecnologia | Uso |
|------------|------------|-----|
| Database | PostgreSQL + pgvector | Armazenamento + busca vetorial |
| Storage | Supabase Storage | Bucket `knowledge-base` |
| Functions | Deno Edge Functions | Lógica serverless |
| Embeddings | 768 dimensões (text-embedding-004) | Busca semântica |

### IA/ML

| Modelo | Provider | Uso |
|--------|----------|-----|
| gemini-2.5-pro-preview | Google | Chat principal |
| text-embedding-004 | Google | Geração de embeddings |
| gemini-2.0-flash | Google | Extração de texto (PDF) |

---

## 📁 Estrutura de Arquivos

```
├── src/
│   ├── assets/
│   │   └── clara-hero.png          # Imagem hero
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInput.tsx       # Input do chat
│   │   │   ├── ChatMessage.tsx     # Mensagens renderizadas
│   │   │   ├── SourceCitation.tsx  # Citações de fontes
│   │   │   └── ThinkingIndicator.tsx # Indicador de "pensando"
│   │   ├── ui/                     # shadcn components
│   │   ├── FeaturesSection.tsx     # Seção de features
│   │   ├── Footer.tsx              # Rodapé
│   │   ├── Header.tsx              # Cabeçalho
│   │   ├── HeroSection.tsx         # Hero da landing
│   │   └── NavLink.tsx             # Links de navegação
│   ├── hooks/
│   │   ├── useChat.ts              # Lógica do chat (streaming)
│   │   ├── useLocalStorage.ts      # Persistência local
│   │   └── use-mobile.tsx          # Detecção mobile
│   ├── pages/
│   │   ├── Index.tsx               # Landing page
│   │   ├── Chat.tsx                # Página do chat
│   │   ├── Admin.tsx               # Gestão de documentos
│   │   └── NotFound.tsx            # 404
│   ├── integrations/supabase/
│   │   ├── client.ts               # Cliente Supabase (auto-gerado)
│   │   └── types.ts                # Tipos do DB (auto-gerado)
│   └── index.css                   # Design tokens
├── supabase/
│   ├── functions/
│   │   ├── clara-chat/index.ts     # Chat RAG + Streaming
│   │   ├── documents/index.ts      # CRUD documentos
│   │   ├── search/index.ts         # Busca híbrida
│   │   └── admin-auth/index.ts     # Autenticação admin
│   └── config.toml                 # Config Supabase
└── public/
    └── favicon.ico, robots.txt
```

---

## 🗄️ Schema do Banco de Dados

### Tabela: `documents`

```sql
id          UUID PRIMARY KEY
title       TEXT NOT NULL
category    TEXT DEFAULT 'geral'
content_text TEXT
file_path   TEXT
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### Tabela: `document_chunks`

```sql
id          UUID PRIMARY KEY
document_id UUID REFERENCES documents(id)
content     TEXT NOT NULL
chunk_index INTEGER NOT NULL
metadata    JSONB
embedding   VECTOR(768)
created_at  TIMESTAMPTZ
```

### Função: `search_document_chunks`

```sql
-- Busca semântica via cosine distance
search_document_chunks(
  query_embedding VECTOR,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
) RETURNS TABLE(id, document_id, content, similarity)
```

---

## ⚡ Edge Functions

### 1. `clara-chat` (Principal)

- **Método**: POST
- **Payload**: `{ message: string, history?: array }`
- **Resposta**: SSE Stream
- **Features**:
  - Busca híbrida (semântica + keywords)
  - Reciprocal Rank Fusion (RRF)
  - Google Search Grounding
  - Streaming character-by-character

### 2. `documents` (Admin)

- **GET**: Lista documentos com contagem de chunks
- **POST**: Processa novo documento (Upload-then-Process)
- **DELETE**: Remove documento e chunks
- **Auth**: Header `x-admin-key`

### 3. `search` (Busca isolada)

- **Método**: POST
- **Payload**: `{ query: string, limit?: number }`
- **Features**: Expansão por sinônimos, scoring híbrido

### 4. `admin-auth` (Validação)

- **Método**: POST
- **Payload**: `{ key: string }`
- **Retorno**: `{ valid: boolean }`

---

## 🎨 Design System

### Cores (HSL)

```css
--background: 222 47% 11%      /* Deep navy #0A1628 */
--foreground: 36 33% 80%       /* Light amber */
--primary: 30 45% 65%          /* Amber #D4A574 */
--secondary: 25 100% 63%       /* Orange #FF8C42 */
--accent: 30 45% 65%           /* Amber accent */
--muted: 222 30% 18%           /* Muted navy */
--card: 222 40% 14%            /* Card background */
```

### Componentes Customizados

- `.btn-clara-primary` - Botão principal com gradiente
- `.search-input-clara` - Input estilizado
- `.glassmorphism` - Efeito vidro fosco
- Animações: `fade-in`, `slide-up`

---

## 🔐 Secrets Configurados

| Secret | Uso |
|--------|-----|
| `GEMINI_API_KEY` | API Google Generative AI |
| `ADMIN_KEYS` (`ADMIN_KEY` fallback) | Autenticação /admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations |
| `SUPABASE_URL` | Endpoint Supabase |
| `SUPABASE_ANON_KEY` | Cliente público |
| `FIRECRAWL_API_KEY` | (Opcional) Web search via Firecrawl |

---

## 🔄 Fluxo de Dados

### Upload de Documento

```
Admin UI → Supabase Storage (bucket) → Edge Function (filePath)
                                              ↓
                                       Download do Storage
                                              ↓
                                       Extração (Gemini 2.0)
                                              ↓
                                       Chunking (4000 chars)
                                              ↓
                                       Embeddings (768d)
                                              ↓
                                       Insert DB
```

### Chat RAG

```
User Query → Edge Function → Embedding da Query
                                   ↓
                    ┌──────────────┴──────────────┐
                    ↓                              ↓
            Busca Semântica              Busca por Keywords
            (pgvector cosine)            (scoring + sinônimos)
                    ↓                              ↓
                    └──────────────┬──────────────┘
                                   ↓
                         Reciprocal Rank Fusion
                                   ↓
                         Top N chunks → Contexto
                                   ↓
                         Gemini 2.5 Pro + Grounding
                                   ↓
                         SSE Stream → Frontend
```

---

## 🐛 Problemas Conhecidos

| Issue | Status | Descrição |
|-------|--------|-----------|
| PDF Upload | 🟡 Em análise | Extração via Gemini funciona, mas pdfjs-dist seria mais estável |
| RLS Policies | ⚠️ Pendente | Tabelas públicas (sem auth implementado) |
| OCR | ✅ Funcional | Gemini suporta PDFs escaneados |

---

## 📊 Métricas de Configuração

- **Chunk Size**: 4000 caracteres
- **Chunk Overlap**: 200 caracteres
- **Embedding Dimensions**: 768
- **Search Threshold**: 0.3 (semântico)
- **RRF K**: 60

---

## 🔗 URLs

- **Preview**: (defina seu ambiente de preview)
- **Produção**: (defina seu domínio de produção)
- **Supabase Project ID**: (seu project ref)

---

## 📝 Histórico de Decisões Técnicas

1. **Escolha do Gemini para extração de PDF**: Suporta OCR nativo e é compatível com Deno runtime
2. **Arquitetura Upload-then-Process**: Bypass do limite de 6MB das Edge Functions
3. **Busca Híbrida com RRF**: Combina precisão semântica com recall de keywords
4. **Streaming SSE**: UX responsiva com feedback em tempo real

---

## 🚀 Política de Release

### Ambientes

| Ambiente | Descrição | Acesso |
|----------|-----------|--------|
| **Preview** | Builds automáticos por commit (desenvolvimento) | Equipe interna |
| **Production** | Publish manual após validação | Usuários finais |

### Processo de Release

1. **Implementar feature** no Preview
2. **Executar REGRESSION_CHECKLIST.md** completo
3. **Se todos os testes ✅** → Publicar para Production
4. **Atualizar CHANGELOG.md** com a nova versão
5. **Se falha crítica** → Rollback imediato

### Rollback

- Git mantém histórico de versões
- Em caso de falha crítica: reverter para commit anterior via interface
- Documentar incidente no CHANGELOG.md (seção "Corrigido")
- Comunicar equipe sobre ações tomadas

### Critérios para Publicação

- [ ] Todos os itens do REGRESSION_CHECKLIST.md validados
- [ ] Nenhum erro crítico no console
- [ ] Performance aceitável (FCP < 1.5s, LCP < 2.5s)
- [ ] Funcionalidades core operacionais (chat, admin, feedback)

---

*Relatório atualizado em 30/01/2026*
