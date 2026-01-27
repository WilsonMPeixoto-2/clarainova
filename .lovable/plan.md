
# Plano: Observabilidade, Separação Upload/Ingestão e Limites de Base64

## Contexto Atual

O sistema atual mistura **upload**, **extração**, **chunking** e **embeddings** no mesmo request, dificultando diagnósticos. Quando falha, retorna apenas "Erro ao processar PDF" sem indicar qual etapa ou provedor falhou.

### Problemas Identificados

| Problema | Impacto |
|----------|---------|
| Sem correlation ID | Impossível rastrear request específico nos logs |
| Sem tempos por etapa | Não sabe se timeout foi na extração ou embedding |
| Erro genérico | "Falha ao processar PDF" sem saber se foi Gemini, Lovable ou pdfjs |
| Upload + Ingestão acoplados | Se ingestão falha, perde o upload |
| Base64 sem limite explícito | PDFs grandes viram payloads impossíveis para AI |

---

## 1. Observabilidade Completa

### 1.1 Estrutura de Debug

Adicionar ao início de cada Edge Function:

```text
REQUEST FLOW
┌─────────────────────────────────────────────────────────────────┐
│ request_id: 8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b              │
│                                                                 │
│ [1] upload_storage    → ✓ 1,234ms                              │
│ [2] download_storage  → ✓ 456ms                                │
│ [3] extract_text      → ✓ 2,100ms (pdfjs-serverless)           │
│ [4] chunk_text        → ✓ 89ms (42 chunks)                     │
│ [5] generate_embed    → ✗ 429 @ 3,500ms (gemini/quota)         │
│                                                                 │
│ RESPONSE: partial_success (chunks saved, embeddings skipped)    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Interface de Debug

```typescript
interface DebugInfo {
  request_id: string;
  timings: {
    total_ms: number;
    download_storage_ms?: number;
    extract_ms?: number;
    chunk_ms?: number;
    embed_ms?: number;
    db_insert_ms?: number;
  };
  provider?: {
    name: "pdfjs-serverless" | "lovable-ai" | "gemini-base64";
    http_status?: number;
    error_body_trunc?: string;  // primeiros 2KB
    elapsed_ms: number;
  };
  steps_completed: string[];
  steps_failed: string[];
}
```

### 1.3 Implementação em `documents/index.ts`

```typescript
// No início do handler
const requestId = crypto.randomUUID();
const debug: DebugInfo = {
  request_id: requestId,
  timings: { total_ms: 0 },
  steps_completed: [],
  steps_failed: [],
};
const startTime = Date.now();

// Helper para medir tempo de cada etapa
async function measureStep<T>(
  name: string, 
  fn: () => Promise<T>
): Promise<T> {
  const stepStart = Date.now();
  try {
    const result = await fn();
    debug.timings[`${name}_ms`] = Date.now() - stepStart;
    debug.steps_completed.push(name);
    console.log(`[${requestId}] ✓ ${name}: ${debug.timings[`${name}_ms`]}ms`);
    return result;
  } catch (error) {
    debug.timings[`${name}_ms`] = Date.now() - stepStart;
    debug.steps_failed.push(name);
    console.error(`[${requestId}] ✗ ${name}: ${error}`);
    throw error;
  }
}

// Uso:
const fileData = await measureStep("download_storage", () =>
  supabase.storage.from("knowledge-base").download(filePath)
);
```

### 1.4 Retorno de Erro com Debug

```typescript
// Em qualquer catch
return new Response(
  JSON.stringify({
    success: false,
    error: "Falha ao processar documento",
    debug: {
      request_id: requestId,
      timings: { ...debug.timings, total_ms: Date.now() - startTime },
      provider: lastProvider,
      steps_completed: debug.steps_completed,
      steps_failed: debug.steps_failed,
    },
  }),
  { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

## 2. Separação Upload/Ingestão

### 2.1 Novo Fluxo

```text
ANTES (acoplado)
┌────────────────────────────────────────────────────────────────┐
│ Admin clica "Upload"                                           │
│   ↓                                                            │
│ admin_get_upload_url → Storage PUT → documents POST            │
│   ↓                                                            │
│ Download + Extração + Chunking + Embeddings (mesmo request)    │
│   ↓                                                            │
│ Se falhar em qualquer etapa: PERDE TUDO                        │
└────────────────────────────────────────────────────────────────┘

DEPOIS (desacoplado)
┌────────────────────────────────────────────────────────────────┐
│ [FASE 1: UPLOAD]                                               │
│ admin_get_upload_url → Storage PUT                             │
│   ↓                                                            │
│ documents POST (mode=upload-only)                              │
│   → Cria registro com status="UPLOADED"                        │
│   → NÃO processa texto/chunks/embeddings                       │
│   → Retorna document_id                                        │
│                                                                │
│ [FASE 2: INGESTÃO - separada]                                  │
│ documents POST (mode=process, document_id=xxx)                 │
│   → Download do Storage                                        │
│   → Extração + Chunking + Embeddings                           │
│   → Atualiza status="READY" ou status="FAILED"                 │
│                                                                │
│ [BENEFÍCIO]                                                    │
│ Se ingestão falhar: arquivo continua no Storage                │
│ Admin pode clicar "Reprocessar" sem re-upload                  │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Alterações no Schema

Adicionar coluna `status` na tabela `documents`:

```sql
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'uploaded';

-- Valores: 'uploaded', 'processing', 'ready', 'failed'
-- Adicionar índice para queries de status
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
```

### 2.3 Alterações em `documents/index.ts`

**Nova rota: `POST /documents` com `mode=upload-only`**

```typescript
if (req.method === "POST" && body.mode === "upload-only") {
  // Apenas cria registro, não processa
  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      title: body.title,
      category: body.category || "manual",
      file_path: body.filePath,
      status: "uploaded",
      content_text: null,  // Vazio até processar
    })
    .select()
    .single();

  return new Response(
    JSON.stringify({
      success: true,
      document_id: document.id,
      status: "uploaded",
      message: "Arquivo salvo. Clique em 'Processar' para extrair conteúdo.",
    }),
    { headers: corsHeaders }
  );
}
```

**Nova rota: `POST /documents/process`**

```typescript
if (req.method === "POST" && lastPart === "process") {
  const { document_id } = body;
  
  // Atualiza status para processing
  await supabase
    .from("documents")
    .update({ status: "processing" })
    .eq("id", document_id);

  try {
    // Download, extração, chunking, embeddings...
    // (código existente movido para cá)
    
    await supabase
      .from("documents")
      .update({ status: "ready", content_text: extractedText })
      .eq("id", document_id);
      
    return { success: true, status: "ready" };
  } catch (error) {
    await supabase
      .from("documents")
      .update({ status: "failed", error_reason: error.message })
      .eq("id", document_id);
      
    return { success: false, debug: {...} };
  }
}
```

### 2.4 Alterações no Admin.tsx

Adicionar botão "Processar" para documentos com `status="uploaded"` ou `status="failed"`:

```tsx
{/* Botão Processar/Reprocessar */}
{(doc.status === 'uploaded' || doc.status === 'failed') && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => handleProcessDocument(doc.id)}
    disabled={isProcessing}
  >
    <RefreshCw className="w-4 h-4 mr-1" />
    {doc.status === 'failed' ? 'Reprocessar' : 'Processar'}
  </Button>
)}

{/* Badge de status */}
<Badge variant={getStatusVariant(doc.status)}>
  {doc.status === 'uploaded' && 'Aguardando'}
  {doc.status === 'processing' && 'Processando...'}
  {doc.status === 'ready' && 'Pronto'}
  {doc.status === 'failed' && 'Falhou'}
</Badge>
```

---

## 3. Limites de Base64 para IA

### 3.1 Regras de Tamanho

```text
MATRIZ DE DECISÃO
┌────────────────────┬─────────────────────┬────────────────────────┐
│ Tamanho PDF        │ Método Extração     │ Fallback OCR           │
├────────────────────┼─────────────────────┼────────────────────────┤
│ < 4 MB             │ pdfjs-serverless    │ Lovable AI (base64)    │
│ 4-20 MB            │ pdfjs-serverless    │ Gemini (base64 chunked)│
│ > 20 MB            │ pdfjs-serverless    │ NÃO usar base64        │
└────────────────────┴─────────────────────┴────────────────────────┘
```

### 3.2 Constantes de Limite

```typescript
// Limites claros no topo do arquivo
const LIMITS = {
  // Base64 cresce ~33%, então 4MB PDF → ~5.3MB base64
  MAX_BASE64_OCR_MB: 4,
  
  // Limite absoluto para qualquer operação com LLM
  MAX_LLM_PAYLOAD_MB: 15,
  
  // Alerta para PDFs que vão demorar
  LARGE_PDF_THRESHOLD_MB: 20,
};
```

### 3.3 Guard no Fallback OCR

```typescript
async function extractPdfViaOcrFallback(fileBlob: Blob, apiKey: string): Promise<string> {
  const sizeMB = fileBlob.size / (1024 * 1024);
  
  // Hard block para PDFs grandes demais
  if (sizeMB > LIMITS.MAX_LLM_PAYLOAD_MB) {
    throw new Error(
      `PDF muito grande para OCR (${sizeMB.toFixed(1)}MB). ` +
      `Limite: ${LIMITS.MAX_LLM_PAYLOAD_MB}MB. ` +
      `Use um PDF com texto selecionável ou divida em partes menores.`
    );
  }
  
  // Warning para PDFs no limite
  if (sizeMB > LIMITS.MAX_BASE64_OCR_MB) {
    console.warn(
      `[documents] ⚠️ PDF grande para OCR: ${sizeMB.toFixed(1)}MB. ` +
      `Pode causar timeout ou erro de memória.`
    );
  }
  
  // Continua com OCR...
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migração SQL** | Adicionar coluna `status` e `error_reason` em `documents` |
| **`documents/index.ts`** | Correlation ID, timings, debug info, separação upload/process, limites base64 |
| **`Admin.tsx`** | Botão "Processar/Reprocessar", badge de status, exibição de debug em erros |
| **`types.ts`** | Será atualizado automaticamente após migração |

---

## Benefícios Esperados

| Problema Atual | Solução | Resultado |
|----------------|---------|-----------|
| "Erro 500" sem contexto | Correlation ID + timings | Sabe exatamente onde falhou e quanto tempo levou |
| Upload perdido se ingestão falha | Separação em 2 fases | Arquivo sempre preservado, pode reprocessar |
| Base64 gigante explode | Limite de 4-15MB | Erro claro antes de tentar, não timeout misterioso |
| Logs genéricos | `debug.provider` com HTTP status | Sabe se foi Gemini 429 ou Lovable 500 |

---

## Ordem de Implementação

1. **Migração SQL**: Adicionar `status` e `error_reason` em `documents`
2. **Observabilidade**: Implementar `requestId`, `measureStep`, `debug` em `documents/index.ts`
3. **Separação Upload/Ingestão**: Novas rotas `upload-only` e `process`
4. **Limites Base64**: Guards com constantes claras
5. **Admin.tsx**: UI para status e botão reprocessar
6. **Testes**: Upload de PDF grande, simulação de falha, reprocessamento

---

## Seção Técnica: Estrutura de Resposta

```typescript
// Resposta de sucesso com debug
{
  "success": true,
  "status": "ready",
  "document": { "id": "...", "title": "..." },
  "debug": {
    "request_id": "8f42b1c3-...",
    "timings": {
      "total_ms": 4500,
      "download_storage_ms": 456,
      "extract_ms": 2100,
      "chunk_ms": 89,
      "embed_ms": 1800,
      "db_insert_ms": 55
    },
    "steps_completed": ["download_storage", "extract", "chunk", "embed", "db_insert"],
    "steps_failed": []
  }
}

// Resposta de erro com debug
{
  "success": false,
  "error": "Falha na geração de embeddings",
  "debug": {
    "request_id": "8f42b1c3-...",
    "timings": {
      "total_ms": 3600,
      "download_storage_ms": 456,
      "extract_ms": 2100,
      "chunk_ms": 89,
      "embed_ms": 900
    },
    "provider": {
      "name": "gemini-embedding",
      "http_status": 429,
      "error_body_trunc": "RESOURCE_EXHAUSTED: Quota exceeded...",
      "elapsed_ms": 900
    },
    "steps_completed": ["download_storage", "extract", "chunk"],
    "steps_failed": ["embed"]
  }
}
```
