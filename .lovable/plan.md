

# Plano: Criar Página Estática `/sobre.html` para Acessibilidade de IAs

## Objetivo
Criar uma página HTML estática completa que permita que outras ferramentas de IA (ChatGPT, Gemini, Manus, Claude, etc.) possam "ver" e entender o projeto CLARA sem depender de execução JavaScript.

---

## Arquivos a Criar

### 1. `public/sobre.html`
Página estática completa com toda a documentação do projeto.

**Estrutura:**
- **Header**: Nome, tagline, data de atualização
- **Seção 1 - Resumo Executivo**: O que é, público-alvo, propósito
- **Seção 2 - Funcionalidades**: Chat IA, busca semântica, citação de fontes
- **Seção 3 - Stack Tecnológica**: Frontend (React, Vite, Tailwind) + Backend (Lovable Cloud, PostgreSQL, pgvector)
- **Seção 4 - Arquitetura de IA**: Modelo de chat (Gemini 2.5 Flash via Lovable Gateway), embeddings, RAG
- **Seção 5 - Segurança**: RLS policies, OAuth 2.0, conformidade LGPD
- **Seção 6 - URLs e Recursos**: Links para todas as páginas do projeto
- **Footer**: Links de navegação

**Design:** Mesmo estilo visual de `privacidade.html` e `termos.html` (navy #0f172a, amber #f59e0b)

### 2. `public/llm.txt` (Bônus)
Arquivo de texto puro otimizado para parsing por LLMs - formato simplificado tipo robots.txt.

```text
# CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas
# Versão: 1.0
# Atualizado: 25/01/2026

## Descrição
Assistente virtual de IA especializada em orientações sobre SEI (Sistema Eletrônico de Informações), SDP (Sistema de Diárias e Passagens) e procedimentos administrativos da 4ª CRE (Coordenadoria Regional de Educação).

## Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Lovable Cloud (PostgreSQL + pgvector)
- IA: google/gemini-2.5-flash via Lovable AI Gateway
- Embeddings: text-embedding-004 (768 dimensões)

## Páginas
- /                 : Landing page com acesso ao chat
- /login            : Autenticação Google OAuth 2.0
- /admin            : Gestão de documentos (requer autenticação)
- /sobre.html       : Documentação completa do projeto
- /privacidade.html : Política de Privacidade
- /termos.html      : Termos de Serviço

## Contato
Email: wilsonmp2@gmail.com
```

---

## Arquivos a Modificar

### 1. `index.html`
Adicionar link para a página sobre:
```html
<link rel="about" href="/sobre.html" />
```

### 2. `public/sitemap.xml`
Adicionar nova entrada:
```xml
<url>
  <loc>https://clarainova.lovable.app/sobre.html</loc>
  <priority>0.9</priority>
</url>
```

### 3. `src/components/Footer.tsx`
Adicionar link "Sobre" na seção de links do footer.

---

## Conteúdo Detalhado do `/sobre.html`

### Seção 1: O que é CLARA
- Nome completo: Consultora de Legislação e Apoio a Rotinas Administrativas
- Desenvolvido para: Servidores da 4ª CRE (Porto Alegre/RS)
- Propósito: Orientações passo a passo sobre SEI, SDP e procedimentos administrativos
- Diferencial: Cita fontes documentais oficiais

### Seção 2: Funcionalidades Principais
- Chat com IA (streaming em tempo real)
- Busca semântica na base de conhecimento
- Citação de fontes documentais
- Login opcional via Google
- Interface responsiva (desktop e mobile)

### Seção 3: Tecnologias Utilizadas

```text
Frontend:
├── React 18.3.1
├── TypeScript
├── Vite (build tool)
├── Tailwind CSS
├── shadcn/ui (componentes)
├── Framer Motion (animações)
└── TanStack Query (estado)

Backend (Lovable Cloud):
├── PostgreSQL + pgvector
├── Edge Functions (Deno)
├── Storage (base de conhecimento)
└── Auth (Google OAuth 2.0)

Inteligência Artificial:
├── google/gemini-2.5-flash (chat)
├── text-embedding-004 (embeddings)
└── RAG (Retrieval Augmented Generation)
```

### Seção 4: Arquitetura

```text
┌─────────────────────────────────────────┐
│           FRONTEND (React SPA)          │
│  • Landing Page com Chat Panel          │
│  • Login Google OAuth                   │
│  • Painel Admin                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│      LOVABLE CLOUD (Backend)            │
│  • PostgreSQL + pgvector                │
│  • Edge Functions (clara-chat, etc)     │
│  • Storage (documentos PDF)             │
│  • Auth (OAuth 2.0)                     │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│      LOVABLE AI GATEWAY                 │
│  • google/gemini-2.5-flash              │
│  • Streaming SSE                        │
│  • Rate limiting                        │
└─────────────────────────────────────────┘
```

### Seção 5: Segurança Implementada
- 15+ políticas RLS (Row Level Security)
- Autenticação OAuth 2.0 via Google
- Rate limiting (15 req/min)
- Conformidade LGPD
- Dados criptografados em trânsito e repouso

### Seção 6: Links do Projeto
- URL principal: https://clarainova.lovable.app
- Política de Privacidade: /privacidade.html
- Termos de Serviço: /termos.html
- Sitemap: /sitemap.xml
- Contato: wilsonmp2@gmail.com

---

## Resultado Esperado

Após implementação, outras IAs poderão acessar:
- `https://clarainova.lovable.app/sobre.html` - Documentação completa renderizada
- `https://clarainova.lovable.app/llm.txt` - Resumo estruturado para parsing

Isso permitirá que ChatGPT, Gemini, Claude, Manus e outras ferramentas entendam completamente o projeto sem precisar executar JavaScript.

---

## Resumo de Alterações

| Tipo | Arquivo | Ação |
|------|---------|------|
| Criar | `public/sobre.html` | Página de documentação completa |
| Criar | `public/llm.txt` | Resumo estruturado para LLMs |
| Modificar | `index.html` | Adicionar `<link rel="about">` |
| Modificar | `public/sitemap.xml` | Adicionar URL /sobre.html |
| Modificar | `src/components/Footer.tsx` | Adicionar link "Sobre" |

