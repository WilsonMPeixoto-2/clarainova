
# Plano de Melhorias de Arquitetura - CLARA

## Visão Geral

Este plano abrange 6 melhorias de arquitetura solicitadas, executadas sequencialmente. Cada alteração será isolada e testável antes de prosseguir.

---

## 1. Blindar Dependências das Edge Functions

### Situação Atual
- 6 Edge Functions existentes: `admin-auth`, `admin-upload`, `admin_get_upload_url`, `clara-chat`, `documents`, `search`
- Todas usam imports diretos com versões inline (ex: `https://deno.land/std@0.224.0/http/server.ts`)
- Versões consistentes atualmente (std@0.224.0, supabase-js@2.49.1, generative-ai@0.21.0)
- Não existe `deno.json` em nenhuma function

### Alterações

#### 1.1 Criar deno.json para cada Edge Function

Criar um arquivo `deno.json` em cada pasta de função com import map isolado:

```text
supabase/functions/
├── admin-auth/
│   ├── deno.json          ← NOVO
│   └── index.ts
├── admin-upload/
│   ├── deno.json          ← NOVO
│   └── index.ts
├── admin_get_upload_url/
│   ├── deno.json          ← NOVO
│   └── index.ts
├── clara-chat/
│   ├── deno.json          ← NOVO
│   └── index.ts
├── documents/
│   ├── deno.json          ← NOVO
│   └── index.ts
└── search/
    ├── deno.json          ← NOVO
    └── index.ts
```

Cada `deno.json` terá:

```json
{
  "imports": {
    "@std/http": "https://deno.land/std@0.224.0/http/server.ts",
    "@std/encoding": "https://deno.land/std@0.224.0/encoding/base64.ts",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.49.1",
    "@google/generative-ai": "https://esm.sh/@google/generative-ai@0.21.0",
    "mammoth": "https://esm.sh/mammoth@1.6.0",
    "pdfjs-serverless": "https://esm.sh/pdfjs-serverless@0.6.0"
  }
}
```

#### 1.2 Refatorar imports nos arquivos index.ts

De:
```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
```

Para:
```typescript
import { serve } from "@std/http";
import { createClient } from "@supabase/supabase-js";
```

#### Arquivos Afetados
- 6 novos arquivos `deno.json`
- 6 arquivos `index.ts` com imports refatorados

---

## 2. Upload como Responsabilidade do Storage

### Situação Atual
- Frontend extrai texto do PDF via PDF.js
- Backend recebe texto via `/ingest-start`, `/ingest-batch`, `/ingest-finish`
- PDFs também são salvos no Storage via signed URL (já implementado)
- Backend pode baixar PDF do Storage para reprocessamento

### Alterações

Esta arquitetura já está parcialmente implementada. Vou formalizar:

#### 2.1 Documentar fluxo padrão (já existente)

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DE UPLOAD                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Frontend solicita signed URL (admin_get_upload_url)         │
│  2. Frontend faz PUT do arquivo para Storage (signed URL)       │
│  3. Frontend extrai texto localmente (PDF.js)                   │
│  4. Frontend envia TEXTO para backend (ingest-start/batch/      │
│     finish) com referência ao filePath no Storage               │
│  5. Backend processa chunks e embeddings                        │
│                                                                 │
│  O backend NUNCA recebe o PDF bruto - apenas:                   │
│  - filePath (ponteiro para Storage)                             │
│  - texto extraído                                               │
│  - metadata                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2 Remover endpoint legado de upload direto

O endpoint `admin-upload` que recebe FormData com arquivo será marcado como deprecated e removido em favor do fluxo signed URL.

#### Arquivos Afetados
- `supabase/functions/admin-upload/index.ts` - Adicionar deprecation warning

---

## 3. Padronizar Segurança: RLS + URLs Assinadas

### Situação Atual
- Bucket `knowledge-base` é privado
- Signed URLs já usados para upload
- RLS policies existentes, mas com warnings de "always true"
- Tabela `document_access_log` existe mas não é usada consistentemente

### Alterações

#### 3.1 Criar função para gerar signed URL de download

Nova função em `documents/index.ts`:

```typescript
// GET /documents/download/:documentId - Get signed download URL
if (req.method === "GET" && pathParts.includes("download")) {
  // Validar admin key
  // Buscar file_path do documento
  // Gerar signed URL com expiração curta (15 min)
  // Registrar acesso em document_access_log
  return { signedUrl, expiresAt };
}
```

#### 3.2 Migração SQL para hardening de RLS

```sql
-- Remover política permissiva de document_jobs
DROP POLICY IF EXISTS "Service role can manage document jobs" ON public.document_jobs;

-- Criar política específica para service role via função
CREATE POLICY "Edge functions can manage document jobs"
  ON public.document_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

#### 3.3 Configurar expiração padrão para signed URLs

| Operação | Expiração |
|----------|-----------|
| Upload | 2 horas (padrão Supabase) |
| Download | 15 minutos |
| Preview | 5 minutos |

#### Arquivos Afetados
- `supabase/functions/documents/index.ts` - Novo endpoint download
- Nova migração SQL para RLS

---

## 4. Ingestão Idempotente e Retomável

### Situação Atual
- `document_jobs` já existe com campos de status e retry
- `content_hash` já existe em `document_chunks`
- Lógica de "delete-then-insert" já implementada
- Faltam campos para tracking granular de batches

### Alterações

#### 4.1 Adicionar campos de tracking em document_jobs

```sql
ALTER TABLE public.document_jobs
ADD COLUMN IF NOT EXISTS last_batch_index INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_batches INT,
ADD COLUMN IF NOT EXISTS batch_hashes JSONB DEFAULT '[]'::jsonb;
```

#### 4.2 Refatorar ingest-batch para idempotência

```typescript
// Em ingest-batch:
// 1. Verificar se batch_index já foi processado
// 2. Comparar hash do batch_text com hash salvo
// 3. Se hash igual, pular (idempotente)
// 4. Se diferente, substituir batch
```

#### 4.3 Criar endpoint de retomada

```typescript
// POST /documents/resume/:documentId
// 1. Buscar último batch processado
// 2. Retornar { resumeFrom: lastBatchIndex + 1, status }
```

#### Arquivos Afetados
- Nova migração SQL
- `supabase/functions/documents/index.ts` - Novos endpoints

---

## 5. Otimizar Busca Vetorial

### Situação Atual
- Índice HNSW já existe: `idx_document_chunks_embedding` com `vector_cosine_ops`
- Índice GIN para tsvector: `idx_document_chunks_search`
- Threshold fixo de 0.3
- Sem parâmetros de tuning HNSW

### Alterações

#### 5.1 Otimizar índice HNSW com parâmetros

```sql
-- Recriar índice com parâmetros otimizados
DROP INDEX IF EXISTS idx_document_chunks_embedding;

CREATE INDEX idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Configurar ef_search para consultas
-- (feito em runtime via SET)
```

#### 5.2 Adicionar configuração dinâmica de threshold

```typescript
// Em search/index.ts:
const { query, limit = 12, threshold = 0.3 } = await req.json();

// Permitir threshold dinâmico com limites
const safeThreshold = Math.max(0.1, Math.min(0.9, Number(threshold)));
```

#### 5.3 Adicionar métricas de busca

```typescript
// Retornar métricas na resposta
return {
  results,
  metrics: {
    vector_search_ms: vectorDuration,
    keyword_search_ms: keywordDuration,
    total_chunks_scanned: allChunks?.length || 0,
    index_type: 'hnsw'
  }
};
```

#### Arquivos Afetados
- Nova migração SQL
- `supabase/functions/search/index.ts`

---

## 6. Observabilidade de Produto

### Situação Atual
- `DebugInfo` já existe em documents com timings
- Não há visualização no Admin
- Logs apenas no console

### Alterações

#### 6.1 Criar tabela de métricas de processamento

```sql
CREATE TABLE public.processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  step TEXT NOT NULL, -- 'upload', 'extract', 'ocr', 'chunk', 'embed', 'db_insert'
  duration_ms INT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX idx_processing_metrics_document ON public.processing_metrics(document_id);
CREATE INDEX idx_processing_metrics_step ON public.processing_metrics(step);
CREATE INDEX idx_processing_metrics_created ON public.processing_metrics(created_at DESC);
```

#### 6.2 Adicionar função RPC para estatísticas

```sql
CREATE OR REPLACE FUNCTION public.get_processing_stats(p_days INT DEFAULT 7)
RETURNS TABLE (
  step TEXT,
  avg_duration_ms NUMERIC,
  success_rate NUMERIC,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.step,
    ROUND(AVG(pm.duration_ms)::NUMERIC, 2) as avg_duration_ms,
    ROUND((SUM(CASE WHEN pm.success THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as success_rate,
    COUNT(*)::BIGINT as total_count
  FROM public.processing_metrics pm
  WHERE pm.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pm.step
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 6.3 Modificar documents/index.ts para salvar métricas

```typescript
// Após cada etapa:
await supabase.from('processing_metrics').insert({
  document_id: documentId,
  step: 'extract',
  duration_ms: debug.timings.extract_ms,
  success: true,
  metadata: { pages: totalPages }
});
```

#### 6.4 Adicionar aba de Observabilidade no Admin

Novo componente `ProcessingStatsTab` com:
- Gráfico de tempo médio por etapa
- Taxa de sucesso por tipo de operação
- Lista de erros recentes por categoria
- Botão "Retomar do checkpoint" para documentos com falha

#### Arquivos Afetados
- Nova migração SQL
- `supabase/functions/documents/index.ts`
- Novo componente `src/components/admin/ProcessingStatsTab.tsx`
- `src/pages/Admin.tsx` - Nova aba

---

## Ordem de Execução

| Ordem | Melhoria | Complexidade | Arquivos |
|-------|----------|--------------|----------|
| 1 | Blindar dependências | Média | 12 arquivos |
| 2 | Upload como Storage | Baixa | 1 arquivo |
| 3 | RLS + URLs assinadas | Média | 2 arquivos + migração |
| 4 | Ingestão idempotente | Média | 2 arquivos + migração |
| 5 | Otimizar busca vetorial | Baixa | 1 arquivo + migração |
| 6 | Observabilidade | Alta | 4 arquivos + migração |

---

## Seção Técnica

### Dependências a Serem Padronizadas

```json
{
  "@std/http": "std@0.224.0",
  "@std/encoding": "std@0.224.0", 
  "@supabase/supabase-js": "2.49.1",
  "@google/generative-ai": "0.21.0",
  "mammoth": "1.6.0",
  "pdfjs-serverless": "0.6.0"
}
```

### Migrações SQL Necessárias

1. **RLS Hardening**: Remover políticas permissivas
2. **Job Tracking**: Campos de batch em document_jobs
3. **HNSW Tuning**: Recriar índice com parâmetros
4. **Processing Metrics**: Nova tabela e função RPC

### Compatibilidade

- Todas as alterações são retrocompatíveis
- Endpoints legados mantidos com deprecation warning
- Frontend não precisa de alterações significativas (apenas nova aba)
