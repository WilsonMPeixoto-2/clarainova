

# Análise: Sugestões Enterprise vs. Pipeline Atual

## Resumo Executivo

As sugestões são excelentes e revelam um entendimento profundo de desafios de produção. Porém, **duas das três já estão parcialmente implementadas** no seu pipeline atual. Vou detalhar o que já existe, o que falta, e o impacto real de cada melhoria.

---

## Sugestão 1: Segmentação Híbrida por Página

### O Problema Descrito
> "Um PDF de 50 páginas onde a página 1 é texto, páginas 2-49 são escaneadas, e página 50 é texto. O sistema ignora OCR nas páginas do meio."

### Estado Atual do Pipeline

| Componente | Implementado? | Localização |
|------------|---------------|-------------|
| Extração página a página | Sim | `extractPdfTextClient()` em `extractPdfText.ts` |
| Detecção de páginas vazias | Sim | `detectNeedsOcr()` conta `emptyPages` e `lowContentPages` |
| Validação de qualidade | Sim | `textQualityValidator.ts` com entropia + ratio de palavras |
| OCR via Gemini Vision | Sim | `extractPdfViaLovableAIBase64()` no Edge Function |

### O Gap Real
A lógica atual decide OCR no **nível do documento**, não por página:

```typescript
// ATUAL - detectNeedsOcr() em extractPdfText.ts
const needsOcr = 
  conditions.allPagesEmpty ||
  (conditions.tooLowAverage && conditions.tooManyEmptyPages) ||
  (totalPages > 3 && conditions.tooLowTotal);
// → Retorna TRUE ou FALSE para o documento inteiro
```

Isso significa que o cenário "Capa texto + 48 páginas escaneadas + Assinatura texto" seria classificado como `needsOcr: true` (porque >50% páginas vazias), mas **perderia o texto bom da capa e assinatura**.

### Solução: Segmentação por Página

**Mudança necessária:**

```text
extractPdfTextClient() retorna:
  pages: string[]           // texto de cada página
  pagesNeedingOcr: number[] // índices das páginas sem texto

Frontend envia ao backend:
  - Texto das páginas boas (pdfjs)
  - Lista de páginas que precisam de OCR

Backend processa via Gemini Vision:
  - Apenas as páginas da lista (economia de tokens)
  - Monta documento final com texto híbrido
```

**Arquivos a modificar:**

1. `src/utils/extractPdfText.ts` - Retornar `pagesNeedingOcr: number[]`
2. `src/pages/Admin.tsx` - Lógica de upload híbrido
3. `supabase/functions/documents/index.ts` - Novo endpoint `ingest-ocr-pages`

**Impacto:**

| Métrica | Antes | Depois |
|---------|-------|--------|
| Cobertura de texto | ~60-80% | ~99% |
| Custo de OCR | 100% do PDF | Só páginas escaneadas |
| Tempo de processamento | Variável | Otimizado |

**Complexidade:** Média-Alta (requer coordenação frontend-backend)

---

## Sugestão 2: Arquitetura Assíncrona (Background Tasks)

### O Problema Descrito
> "Você está no limite dos 60 segundos da Edge Function. Um manual de 200 páginas vai dar 504."

### Estado Atual

O pipeline **já implementa** processamento assíncrono via job queue:

```sql
-- Tabela document_jobs (já existe)
CREATE TABLE document_jobs (
  id UUID PRIMARY KEY,
  document_id UUID,
  status TEXT,           -- pending, processing, completed, failed
  next_page INT,         -- página atual
  total_pages INT,       -- total de páginas
  pages_per_batch INT,   -- páginas por lote (default: 10)
  error TEXT
);
```

**Endpoints implementados:**

| Endpoint | Função | Status |
|----------|--------|--------|
| `POST /documents/process-job` | Processa próximo job pendente | Implementado |
| `GET /documents/job-status/:id` | Retorna progresso | Implementado |
| `POST /documents/ingest-batch` | Recebe lotes de texto | Implementado |
| `GET /documents/resume/:id` | Retoma ingestão interrompida | Implementado |

### O Gap Real

1. **Não há worker automático** - O frontend precisa chamar `process-job` manualmente
2. **Sem polling automático** - UI não atualiza status em tempo real
3. **Chunking acontece no final** - Espera todo texto antes de fazer embeddings

### Soluções Incrementais

**Opção A: Polling com Auto-Retry (Simples)**
```typescript
// No Admin.tsx - já parcialmente implementado
useEffect(() => {
  const interval = setInterval(() => {
    if (processingDocs.size > 0) {
      fetchDocuments(); // Atualiza status
    }
  }, 5000);
}, [processingDocs]);
```

**Opção B: pg_cron para Background Worker (Robusto)**
```sql
-- Executar a cada 30 segundos
SELECT cron.schedule(
  'process-documents',
  '*/30 * * * * *',
  $$SELECT net.http_post(
    'https://.../functions/v1/documents/process-job',
    headers := '{"x-admin-key": "..."}'::jsonb
  )$$
);
```

**Opção C: Supabase Realtime (UI Responsiva)**
```typescript
// Subscription para updates de status
supabase
  .channel('document-updates')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'documents' },
    (payload) => {
      updateDocumentStatus(payload.new);
    }
  )
  .subscribe();
```

**Recomendação:** Implementar **Opção A + C** primeiro (menor esforço, maior impacto na UX).

---

## Sugestão 3: Busca Híbrida com Reranking

### O Problema Descrito
> "Se o diretor digitar 'Decreto 45.123', a busca vetorial pode falhar porque foca em conceitos, não números exatos."

### Estado Atual - Já Implementado

O pipeline **já possui busca híbrida robusta**:

```sql
-- Função hybrid_search_chunks (já existe no banco)
CREATE FUNCTION hybrid_search_chunks(...) AS $$
  WITH vector_results AS (
    -- Busca semântica via pgvector
    SELECT (1 - (embedding <=> query_embedding)) AS vector_sim
  ),
  text_results AS (
    -- Busca keyword via ts_vector (BM25-like)
    SELECT ts_rank_cd(search_vector, ts_query) AS txt_rank
  ),
  combined AS (
    -- RRF com pesos configuráveis
    (vector_weight * (1.0 / (60 + vector_rank))) +
    (keyword_weight * (1.0 / (60 + text_rank)))
  )
$$;
```

**Parâmetros atuais:**
- `keyword_weight: 0.4`
- `vector_weight: 0.6`
- `k = 60` (constante RRF)

**Funcionalidades implementadas:**

| Feature | Status | Código |
|---------|--------|--------|
| Busca vetorial (pgvector + HNSW) | Sim | `search_document_chunks` |
| Busca keyword (ts_vector) | Sim | `ts_rank_cd` no SQL |
| RRF (Reciprocal Rank Fusion) | Sim | `hybrid_search_chunks` |
| Expansão de sinônimos | Sim | `expandQueryWithSynonyms()` |
| Fallback sem embeddings | Sim | Lógica no search/index.ts |

### O Gap: Reranking

O que **não está implementado** é um modelo de reranking dedicado. A sugestão menciona:

> "Usa um modelo 'Juiz' (Reranker) para decidir qual é a melhor resposta"

**Opções de Reranking:**

| Abordagem | Complexidade | Latência | Custo |
|-----------|--------------|----------|-------|
| Cross-encoder local (não viável em Edge) | Alta | Variável | - |
| Gemini como reranker | Baixa | +200-500ms | Tokens |
| Cohere Rerank API | Média | +100-300ms | $2/1M tokens |
| Ajustar pesos RRF | Trivial | 0ms | Zero |

**Recomendação para CLARA:**

1. **Primeiro:** Ajustar pesos RRF para queries com números (detectar padrão `\d+`)
2. **Segundo:** Testar Gemini como reranker em queries de baixa confiança
3. **Evitar:** Rerankers externos (custo + latência + dependência)

**Implementação sugerida (ajuste dinâmico de pesos):**

```typescript
// Em search/index.ts
function getSearchWeights(query: string) {
  const hasNumbers = /\d{3,}/.test(query); // Decreto 45.123
  const hasExactPhrase = query.includes('"');
  
  if (hasNumbers || hasExactPhrase) {
    return { keyword_weight: 0.7, vector_weight: 0.3 }; // Prioriza exato
  }
  return { keyword_weight: 0.4, vector_weight: 0.6 }; // Padrão
}
```

---

## Matriz de Priorização

| Sugestão | Já Existe? | Gap Real | Esforço | Impacto | Prioridade |
|----------|------------|----------|---------|---------|------------|
| 1. Segmentação por página | Parcial | Médio | Alto | Alto | P2 |
| 2. Arquitetura assíncrona | Sim | Pequeno | Baixo | Médio | P3 |
| 3. Busca híbrida + rerank | Sim | Pequeno | Baixo | Alto | **P1** |

---

## Plano de Implementação Recomendado

### Fase 1: Quick Wins (1-2 dias)
- Ajustar pesos dinâmicos para busca híbrida (já tem estrutura)
- Adicionar Realtime para updates de status (UX)

### Fase 2: Segmentação por Página (3-5 dias)
- Modificar `extractPdfTextClient` para retornar `pagesNeedingOcr[]`
- Criar endpoint `ingest-ocr-pages` para OCR seletivo
- Atualizar UI de upload para fluxo híbrido

### Fase 3: Otimização (futuro)
- Avaliar Gemini como reranker para queries ambíguas
- Implementar pg_cron se volume justificar

---

## Conclusão

As sugestões demonstram visão de produção madura. O pipeline atual **já cobre 70-80% das funcionalidades sugeridas**. Os gaps reais são:

1. **OCR por página** (vs. por documento) - maior impacto em PDFs mistos
2. **Pesos dinâmicos** na busca - melhora queries com números/códigos
3. **Polling/Realtime** - melhora UX durante processamento

Deseja que eu implemente alguma dessas melhorias em ordem de prioridade?

