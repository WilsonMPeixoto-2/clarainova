
# Plano de Implementação: Busca Web Robusta — "Consulta com Evidência"

## Resumo Executivo

Implementar um sistema de busca web robusto que:
1. **Fetch nativo como default** + **Firecrawl como fallback** para JS pesado/PDF/extração fraca
2. **Modo Combinado**: automático por padrão com override opcional pelo usuário
3. Cache de resultados por 24h
4. Classificação de domínios confiáveis
5. Quórum de fontes para queries normativas
6. UI premium com evidências citáveis

---

## Parte 1: Infraestrutura de Banco de Dados

### 1.1 Nova Migração SQL

Criar tabelas para cache e domínios confiáveis:

**Tabela `web_search_cache`:**
- `id` (UUID PK)
- `query_hash` (TEXT) — SHA256 da query normalizada
- `query_text` (TEXT) — Query original
- `mode` (TEXT) — 'quick' ou 'deep'
- `serp_results` (JSONB) — Resultados brutos da SERP
- `fetched_pages` (JSONB) — Conteúdo extraído das páginas
- `created_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ) — 24h após criação
- `hit_count` (INTEGER) — Contador de reutilização

**Tabela `trusted_domains`:**
- `id` (UUID PK)
- `domain` (TEXT UNIQUE)
- `category` (TEXT) — 'primary', 'official_mirror', 'aggregator'
- `priority` (INTEGER) — 100 = máxima, 1 = mínima
- `description` (TEXT)
- `created_at` (TIMESTAMPTZ)

**Seed inicial de domínios:**
| Domínio | Categoria | Prioridade | Descrição |
|---------|-----------|------------|-----------|
| doweb.rio.rj.gov.br | primary | 100 | Diário Oficial do Município (espelho oficial) |
| prefeitura.rio | primary | 95 | Portal oficial Prefeitura Rio |
| rio.rj.gov.br | primary | 95 | Domínio oficial governo Rio |
| gov.br | primary | 90 | Portais federais/estaduais |
| tcm.rj.gov.br | primary | 85 | Tribunal de Contas do Município |
| camara.rj.gov.br | primary | 80 | Câmara Municipal |
| leismunicipais.com.br | aggregator | 60 | Consolidador - útil mas secundário |
| jusbrasil.com.br | aggregator | 40 | Referência mas preferir fontes oficiais |

---

## Parte 2: Edge Function de Web Search

### 2.1 Nova Função: `supabase/functions/web-search/index.ts`

**Responsabilidades:**
1. Verificar cache antes de buscar (por query_hash)
2. Usar Firecrawl `/search` para busca SERP com scrape
3. Fallback para fetch nativo se Firecrawl falhar
4. Extrair texto de HTML (remover scripts, styles, nav, footer)
5. Classificar fontes por domínio confiável
6. Calcular confiança baseada em:
   - Categoria do domínio (primary > aggregator)
   - Quórum de fontes (2+ fontes independentes = alta confiança)
7. Extrair excerpts citáveis (2-6 linhas relevantes)
8. Salvar no cache com expiração de 24h

**Parâmetros de entrada:**
```typescript
interface WebSearchRequest {
  query: string;
  mode: 'quick' | 'deep' | 'auto';  // auto = baseado em detecção normativa
}
```

**Estrutura de resposta:**
```typescript
interface WebSearchResult {
  query: string;
  mode: 'quick' | 'deep';
  cached: boolean;
  sources: WebSource[];
  quorum_met: boolean;
  context_for_llm: string;
}

interface WebSource {
  url: string;
  title: string;
  domain: string;
  domain_category: 'primary' | 'official_mirror' | 'aggregator';
  priority: number;
  excerpt_used: string;
  confidence: 'high' | 'medium' | 'low';
  retrieved_at: string;
  extraction_method: 'firecrawl' | 'native_fetch';
}
```

### 2.2 Lógica de Modo Quick vs Deep

| Modo | Resultados SERP | Páginas Fetch | Cross-check | Uso |
|------|-----------------|---------------|-------------|-----|
| `quick` | 5 | 3 | Não | Dúvidas simples |
| `deep` | 10 | 6 | Sim (2+ fontes) | Prazos, artigos, obrigações |
| `auto` | Detecta | - | - | Baseado em padrões normativos |

### 2.3 Detector de Query Normativa

```typescript
function isNormativeQuery(query: string): boolean {
  const patterns = [
    /prazo|dias úteis|dias corridos/i,
    /decreto|lei|resolução|portaria|instrução normativa/i,
    /artigo|art\.|§|parágrafo/i,
    /obrigação|vedado|proibido|permitido/i,
    /penalidade|multa|sanção/i,
    /competência|atribuição/i
  ];
  return patterns.some(p => p.test(query));
}
```

### 2.4 Lógica de Fallback (Firecrawl → Native Fetch)

```
1. Tentar Firecrawl /search com scrapeOptions
   ↓
   Se falhar OU extração fraca (content < 200 chars):
   ↓
2. Native fetch + extractTextFromHtml()
   ↓
   Se site for SPA ou JS pesado (content < 100 chars):
   ↓
3. Usar snippet da SERP + marcar como low_confidence
```

---

## Parte 3: Integração no clara-chat

### 3.1 Modificações em `clara-chat/index.ts`

1. **Importar web-search**: Chamar a nova função quando `needsWebSearch = true`
2. **Adicionar modo de busca ao request**: Aceitar `webSearchMode: 'auto' | 'quick' | 'deep'`
3. **Integrar resposta web no contexto**:
   - Adicionar `context_for_llm` ao prompt
   - Passar `sources` estruturadas para o frontend
4. **Emitir notice com detalhes de confiança**

### 3.2 Novo Formato de Sources no SSE

Atualizar evento `sources` para incluir metadados ricos:

```typescript
// Antes
{ local: ["Manual SEI"], web: ["https://..."] }

// Depois
{
  local: ["Manual SEI 4.0"],
  web: [
    {
      url: "https://doweb.rio.rj.gov.br/...",
      title: "Decreto 51.628/2022",
      domain_category: "primary",
      confidence: "high",
      excerpt_used: "O prazo para recurso é de 10 (dez) dias úteis...",
      retrieved_at: "2026-01-29T12:00:00Z"
    }
  ],
  quorum_met: true
}
```

### 3.3 Prompt Atualizado com Regras de Citação Web

Adicionar ao `CLARA_SYSTEM_PROMPT`:

```
## Regras de Citação Web (OBRIGATÓRIO quando usar fontes externas)

1. **Cite com trecho:** Para afirmações normativas, COPIE o trecho exato:
   > "O prazo para recurso é de 10 (dez) dias úteis..." - [Decreto nº X, doweb.rio.rj.gov.br]

2. **Indique confiança visualmente:**
   - Alta (2+ fontes oficiais): afirme com segurança
   - Média (1 fonte oficial): "Segundo [fonte]..."
   - Baixa (apenas agregadores): "Encontrei referência em [fonte], mas recomendo confirmar..."

3. **Quórum normativo:** Para prazos/artigos/obrigações, busque 2 fontes independentes.

4. **Não infira:** Se a fonte não disser explicitamente, use o template de lacuna.
```

---

## Parte 4: UI de Fontes Premium

### 4.1 Novo Componente: `SourceChipWeb.tsx`

Substituir os chips simples por chips premium com:
- Badge de categoria (Oficial / Espelho / Agregador)
- Indicador de confiança (cor)
- Tooltip expandível com excerpt usado
- Data de recuperação

```tsx
interface WebSourceChipProps {
  source: {
    url: string;
    title: string;
    domain_category: 'primary' | 'official_mirror' | 'aggregator';
    confidence: 'high' | 'medium' | 'low';
    excerpt_used: string;
    retrieved_at: string;
  };
}
```

### 4.2 Atualizar `ChatMessage.tsx`

1. Modificar `SourcesSection` para renderizar `SourceChipWeb` quando houver fontes web estruturadas
2. Manter retrocompatibilidade com fontes web simples (apenas URL)

### 4.3 Atualizar `useChat.ts`

Expandir tipos de `sources` para suportar novo formato:

```typescript
interface ChatMessage {
  sources?: {
    local: string[];
    web?: WebSource[] | string[];  // Suportar ambos formatos
    quorum_met?: boolean;
  };
}
```

---

## Parte 5: Toggle de Modo no Chat (Override Opcional)

### 5.1 Novo Componente: `WebSearchModeSelector.tsx`

Um seletor discreto que aparece apenas quando:
- Usuário está digitando query potencialmente normativa, OU
- Última resposta usou web search

Opções:
- **Auto** (default): CLARA decide
- **Deep**: Forçar busca profunda com quórum

### 5.2 Integração no `ChatInput.tsx`

Adicionar o seletor como opcional, colapsado por padrão.

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/xxx_web_search_infrastructure.sql` | Tabelas de cache e domínios |
| `supabase/functions/web-search/index.ts` | Engine de busca com Firecrawl + fallback |
| `src/components/chat/SourceChipWeb.tsx` | Chip premium com evidência |
| `src/components/chat/WebSearchModeSelector.tsx` | Toggle opcional de modo |

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/clara-chat/index.ts` | Integrar web-search, novo formato de sources |
| `src/hooks/useChat.ts` | Tipos expandidos para WebSource |
| `src/components/chat/ChatMessage.tsx` | Renderizar SourceChipWeb |
| `src/components/chat/ChatInput.tsx` | Integrar WebSearchModeSelector |

---

## Ordem de Execução

1. Criar migração SQL (tabelas + seed de domínios)
2. Criar `web-search/index.ts` com Firecrawl + fallback
3. Criar `SourceChipWeb.tsx` (UI de fontes premium)
4. Atualizar `useChat.ts` (tipos expandidos)
5. Atualizar `ChatMessage.tsx` (usar novo componente)
6. Atualizar `clara-chat/index.ts` (integrar web-search)
7. Criar `WebSearchModeSelector.tsx` (toggle opcional)
8. Atualizar `ChatInput.tsx` (integrar toggle)

---

## Resultado Esperado

1. **Busca web com evidência:** Cada afirmação normativa terá trecho citável
2. **Quórum de fontes:** 2+ fontes para prazos e obrigações
3. **Classificação de domínios:** Prioridade para fontes oficiais
4. **Cache 24h:** Redução de 80%+ nas chamadas de API
5. **Transparência:** Usuário vê categoria, confiança e trecho usado
6. **Fallback robusto:** Firecrawl → Native Fetch → Snippet SERP
7. **Modo combinado:** Auto por padrão, Deep sob demanda

---

## Detalhes Técnicos Adicionais

### Hash de Query para Cache

```typescript
async function hashQuery(query: string): Promise<string> {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Extração de Texto Nativa (Fallback)

```typescript
function extractTextFromHtml(html: string): string {
  // Remover scripts, styles, comentários
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  
  // Converter para texto
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}
```

### RLS Policies

**web_search_cache:**
- SELECT: service_role apenas (função interna)
- INSERT/UPDATE/DELETE: service_role apenas

**trusted_domains:**
- SELECT: público (frontend pode consultar para UI)
- INSERT/UPDATE/DELETE: admin apenas
