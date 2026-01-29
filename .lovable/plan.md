
# Plano: Busca Web Robusta — "Consulta com Evidência"

## Diagnóstico Confirmado

### Arquitetura Atual
A CLARA usa **Google Search Grounding nativo do Gemini SDK**:
```
Query → RAG insuficiente? → modelOptions.tools = [{ googleSearch: {} }]
                                    ↓
                          Gemini recebe query + grounding
                                    ↓
                          Resposta com groundingMetadata (snippets)
```

### Problemas Identificados
| Problema | Impacto | Causa Raiz |
|----------|---------|------------|
| Confunde SEI Rio com Processo.Rio | Alto | Resposta baseada em snippet SERP, sem ler a página |
| Links incorretos | Alto | Grounding retorna URL do snippet, não valida conteúdo |
| Sem evidência citável | Médio | Apenas "title - url", sem trecho exato |
| 1 fonte = alto risco | Alto | Sem quórum de validação cruzada |
| Custo descontrolado | Médio | Sem cache, toda query gasta API |

---

## Solução Proposta

### Nova Arquitetura: Fetch + Validate

```text
Query → RAG Local (pgvector)
              ↓
  Se < 3 chunks OU avgScore < 0.015
              ↓
  ┌────────────────────────────────┐
  │    WEB SEARCH ENGINE           │
  │  ┌──────────────────────────┐  │
  │  │ 1. Check Cache (24h)     │  │
  │  │ 2. Buscar SERP (6-10)    │  │
  │  │ 3. Fetch HTML/PDF        │  │
  │  │ 4. Extrair texto         │  │
  │  │ 5. Classificar domínio   │  │
  │  │ 6. Validar quórum        │  │
  │  │ 7. Extrair excerpts      │  │
  │  │ 8. Salvar cache          │  │
  │  └──────────────────────────┘  │
  └────────────────────────────────┘
              ↓
  Contexto enriquecido com evidências
              ↓
  Gemini + prompt com citações obrigatórias
```

---

## Parte 1: Infraestrutura de Cache e Domínios

### 1.1 Nova Tabela: `web_search_cache`
```sql
CREATE TABLE web_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,  -- SHA256 da query normalizada
  query_text TEXT NOT NULL,
  
  -- Resultados SERP
  serp_results JSONB NOT NULL,  -- [{url, title, snippet}]
  
  -- Conteúdo extraído
  fetched_pages JSONB NOT NULL,  -- [{url, title, content, excerpt_used, confidence}]
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  hit_count INTEGER DEFAULT 0,
  
  -- Indexação
  UNIQUE(query_hash)
);

CREATE INDEX idx_cache_query_hash ON web_search_cache(query_hash);
CREATE INDEX idx_cache_expires ON web_search_cache(expires_at);
```

### 1.2 Nova Tabela: `trusted_domains`
```sql
CREATE TABLE trusted_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,  -- 'primary', 'official_mirror', 'aggregator'
  priority INTEGER DEFAULT 50,  -- 100 = máxima, 1 = mínima
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir domínios iniciais
INSERT INTO trusted_domains (domain, category, priority, description) VALUES
  ('doweb.rio.rj.gov.br', 'primary', 100, 'Diário Oficial do Município - espelho oficial'),
  ('prefeitura.rio', 'primary', 95, 'Portal oficial Prefeitura Rio'),
  ('rio.rj.gov.br', 'primary', 95, 'Domínio oficial governo Rio'),
  ('gov.br', 'primary', 90, 'Portais federais/estaduais'),
  ('tcm.rj.gov.br', 'primary', 85, 'Tribunal de Contas do Município'),
  ('camara.rj.gov.br', 'primary', 80, 'Câmara Municipal'),
  ('leismunicipais.com.br', 'aggregator', 60, 'Consolidador - útil mas secundário'),
  ('jusbrasil.com.br', 'aggregator', 40, 'Referência mas preferir fontes oficiais');
```

---

## Parte 2: Edge Function de Web Search

### 2.1 Nova Função: `web-search/index.ts`

Responsabilidades:
- Consultar cache antes de buscar
- Usar Google Custom Search API (ou fetch nativo com parsing)
- Fazer HTTP GET nos top N URLs
- Extrair texto (HTML → Markdown limpo)
- Classificar por domínio e calcular confiança
- Retornar com excerpts citáveis

### 2.2 Parâmetros de Controle (Web Quick vs Deep)

| Modo | Resultados SERP | Páginas Fetch | Cross-check | Uso |
|------|-----------------|---------------|-------------|-----|
| `quick` | 5 | 3 | Não | Dúvidas simples |
| `deep` | 10 | 6 | Sim (2+ fontes) | Prazos, artigos, obrigações |

### 2.3 Estrutura de Resposta

```typescript
interface WebSearchResult {
  query: string;
  mode: 'quick' | 'deep';
  cached: boolean;
  sources: {
    url: string;
    title: string;
    domain: string;
    domain_category: 'primary' | 'official_mirror' | 'aggregator';
    priority: number;
    excerpt_used: string;  // 2-6 linhas
    confidence: 'high' | 'medium' | 'low';
    retrieved_at: string;
  }[];
  quorum_met: boolean;  // true se 2+ fontes independentes
  context_for_llm: string;  // Texto consolidado para o prompt
}
```

---

## Parte 3: Integração no clara-chat

### 3.1 Fluxo Atualizado

```typescript
// Determinar se precisa web search
const needsWebSearch = 
  finalChunks.length < 3 || avgTopScore < 0.015;

if (needsWebSearch) {
  // Determinar modo baseado no tipo de query
  const webMode = isNormativeQuery(message) ? 'deep' : 'quick';
  
  // Chamar web search engine
  const webResults = await callWebSearch(message, webMode);
  
  // Validar quórum para queries normativas
  if (isNormativeQuery(message) && !webResults.quorum_met) {
    // Emitir notice de baixa confiança
    controller.enqueue(encoder.encode(
      `event: notice\ndata: ${JSON.stringify({ 
        type: "limited_base", 
        message: "Encontrei apenas 1 fonte. Recomendo confirmar na fonte oficial." 
      })}\n\n`
    ));
  }
  
  // Adicionar contexto web ao prompt
  context += webResults.context_for_llm;
  webSources = webResults.sources;
}
```

### 3.2 Detector de Query Normativa

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

### 3.3 Prompt Atualizado com Regras de Citação

Adicionar ao system prompt:
```
## Regras de Citação Web (OBRIGATÓRIO quando usar fontes externas)

1. **Cite com trecho:** Para afirmações normativas (prazo, artigo, obrigação), COPIE o trecho exato da fonte:
   > "O prazo para recurso é de 10 (dez) dias úteis..." - [Decreto nº X, doweb.rio.rj.gov.br]

2. **Indique confiança:**
   - 🟢 Alta: 2+ fontes oficiais concordam
   - 🟡 Média: 1 fonte oficial
   - 🔴 Baixa: apenas agregadores/blogs

3. **Quórum normativo:** Para prazos, artigos e obrigações, busque confirmação em 2 fontes independentes.

4. **Não infira:** Se a fonte não disser explicitamente, use o template de lacuna.
```

---

## Parte 4: UI de Fontes Premium

### 4.1 Chip de Fonte Atualizado

Já temos `.source-chip-web`, agora adicionar:
- Badge de categoria (Oficial, Espelho, Agregador)
- Badge de confiança (Alta/Média/Baixa)
- Tooltip com excerpt usado
- Data de recuperação

### 4.2 Componente: `SourceChipWeb.tsx`

```tsx
interface WebSource {
  url: string;
  title: string;
  domain_category: 'primary' | 'official_mirror' | 'aggregator';
  confidence: 'high' | 'medium' | 'low';
  excerpt_used: string;
  retrieved_at: string;
}

// Renderização com tooltip expandível mostrando o trecho
```

---

## Parte 5: Extração de Conteúdo

### 5.1 Estratégia de Fetch

Como não temos Firecrawl configurado, usar fetch nativo:

```typescript
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CLARA-Bot/1.0 (Assistente Administrativo)'
      },
      signal: AbortSignal.timeout(5000)  // 5s timeout
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    return extractTextFromHtml(html);
  } catch {
    return null;
  }
}

function extractTextFromHtml(html: string): string {
  // Remover scripts, styles, nav, footer, header
  // Manter apenas conteúdo principal
  // Converter para texto limpo
}
```

### 5.2 Limitações Conhecidas

- PDFs: precisam de parser adicional (já temos pdfjs-serverless no import_map)
- SPAs: não conseguiremos conteúdo dinâmico
- Sites com JS pesado: fallback para snippet SERP

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_web_search_cache.sql` | Criar | Tabelas de cache e domínios |
| `supabase/functions/web-search/index.ts` | Criar | Engine de busca com fetch |
| `supabase/functions/clara-chat/index.ts` | Modificar | Integrar web-search |
| `src/components/chat/SourceChipWeb.tsx` | Criar | Chip premium com evidência |
| `src/components/chat/ChatMessage.tsx` | Modificar | Usar novo SourceChipWeb |
| `src/hooks/useChat.ts` | Modificar | Tipos para novos campos de fonte |

---

## Opção: Firecrawl Connector

Se você quiser uma solução mais robusta (JS rendering, melhor extração), posso:
1. Solicitar conexão do Firecrawl Connector
2. Implementar usando a API do Firecrawl para scrape

**Vantagens do Firecrawl:**
- Renderiza JavaScript
- Extrai markdown limpo
- Suporta PDFs nativamente
- Mais confiável que fetch simples

**Desvantagens:**
- Custo adicional por request
- Dependência externa

---

## Ordem de Execução

1. Criar migração para tabelas de cache e domínios
2. Criar edge function `web-search` com fetch nativo
3. Atualizar `clara-chat` para usar nova engine
4. Criar componente `SourceChipWeb` com evidência
5. Atualizar UI do chat
6. Testar com queries normativas

---

## Resultado Esperado

1. **Busca web com evidência:** Cada afirmação normativa terá trecho citável
2. **Quórum de fontes:** 2+ fontes para prazos e obrigações
3. **Classificação de domínios:** Prioridade para fontes oficiais
4. **Cache 24h:** Redução de 80%+ nas chamadas de API para queries repetidas
5. **Transparência:** Usuário vê "por que" aquela fonte foi usada
6. **Menos alucinação:** Sem trecho = template de lacuna, não inferência

---

## Pergunta Antes de Implementar

Você prefere:
- **A) Fetch nativo** (mais simples, funciona na maioria dos casos)
- **B) Firecrawl Connector** (mais robusto, requer configuração e tem custo)

E sobre o modo Web Quick/Deep:
- **A) Automático** (baseado em detecção de query normativa)
- **B) Toggle no chat** (usuário escolhe)
- **C) Combinado** (automático com override opcional)
