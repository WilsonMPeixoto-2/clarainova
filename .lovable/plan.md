
# Plano: Correção do Build + Hardening Completo do Pipeline de Ingestão

## 1. Correção do Erro de Build (CRÍTICO)

### Problema
O `pdfjs-dist@4.0.379` usa **top-level await**, que não é suportado pelos targets de browser configurados no Vite (`chrome87`, `edge88`, `es2020`).

### Solução: Atualizar Vite Build Target para `esnext`

**Arquivo: `vite.config.ts`**

```typescript
// Adicionar target: "esnext" em build e esbuild
export default defineConfig(({ mode }) => ({
  // ...existing config...
  optimizeDeps: {
    include: ["react", "react-dom", "framer-motion"],
    exclude: [],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  esbuild: {
    target: "esnext",
  },
}));
```

**Por que esta solução:**
- O `esnext` suporta top-level await nativamente
- Navegadores modernos (Chrome 89+, Firefox 89+, Safari 15+) todos suportam
- Alternativa seria usar `pdfjs-dist/legacy/build/pdf.mjs`, mas isso adiciona complexidade

---

## 2. Hardening do Frontend (Limites e Medições)

### 2.1 Medir Payload Antes de Enviar

**Arquivo: `src/utils/extractPdfText.ts`** - Adicionar função de medição:

```typescript
export interface TextSizeInfo {
  charCount: number;
  estimatedBytes: number;
  estimatedMB: number;
  isOversized: boolean;
}

export const MAX_TEXT_PAYLOAD_MB = 4; // 4MB limite para POST único

export function measureTextSize(text: string): TextSizeInfo {
  const bytes = new TextEncoder().encode(text).length;
  const mb = bytes / (1024 * 1024);
  return {
    charCount: text.length,
    estimatedBytes: bytes,
    estimatedMB: mb,
    isOversized: mb > MAX_TEXT_PAYLOAD_MB,
  };
}
```

### 2.2 Detecção de OCR Melhorada

**Arquivo: `src/utils/extractPdfText.ts`** - Ajustar heurística:

```typescript
function detectNeedsOcr(pages: string[], totalPages: number): boolean {
  const MIN_CHARS_PER_PAGE = 80;
  const LOW_TEXT_THRESHOLD = 0.6; // 60% das páginas com pouco texto

  const lowTextPages = pages.filter(p => p.length < MIN_CHARS_PER_PAGE).length;
  const lowTextRatio = lowTextPages / totalPages;
  const avgCharsPerPage = pages.reduce((sum, p) => sum + p.length, 0) / totalPages;

  return avgCharsPerPage < MIN_CHARS_PER_PAGE || lowTextRatio >= LOW_TEXT_THRESHOLD;
}
```

### 2.3 UI de Medição no Admin

**Arquivo: `src/pages/Admin.tsx`** - Exibir tamanho do texto extraído:

```tsx
// Após extração, mostrar métricas
{extractionPhase === 'extracting' && (
  <div className="text-sm text-muted-foreground mt-2">
    {extractedTextSize && (
      <span>
        Texto extraído: {extractedTextSize.charCount.toLocaleString()} chars 
        ({extractedTextSize.estimatedMB.toFixed(2)} MB)
        {extractedTextSize.isOversized && (
          <span className="text-yellow-500 ml-2">
            ⚠️ Grande - será enviado em partes
          </span>
        )}
      </span>
    )}
  </div>
)}
```

---

## 3. Ingestão em Batches (Multi-POST)

### 3.1 Novo Fluxo de Ingestão

```text
ANTES (1 POST gigante)
┌────────────────────────────────────────┐
│ POST /ingest-text                      │
│   body: { fullText: "...5MB..." }      │
│   → Pode falhar com 413/timeout        │
└────────────────────────────────────────┘

DEPOIS (Multi-POST controlado)
┌────────────────────────────────────────────────────────────┐
│ POST /ingest-start                                         │
│   → Cria documento + session_id                            │
│   → Retorna: { documentId, sessionId, expectedBatches }    │
│                                                            │
│ POST /ingest-batch (N vezes)                               │
│   → body: { sessionId, batchIndex, text, isFinal }         │
│   → Append incremental ao content_text                     │
│   → Idempotente via batch_index único                      │
│                                                            │
│ POST /ingest-finish                                        │
│   → Dispara chunking + embeddings                          │
│   → Retorna status final                                   │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Tabela de Controle de Batches (Migração SQL)

```sql
CREATE TABLE IF NOT EXISTS document_text_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  batch_index INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, batch_index)
);

CREATE INDEX idx_batches_session ON document_text_batches(session_id);
```

### 3.3 Frontend: Dividir e Enviar em Partes

**Arquivo: `src/pages/Admin.tsx`** - Lógica de batching:

```typescript
const MAX_BATCH_SIZE = 500_000; // 500KB por batch

async function sendTextInBatches(
  fullText: string, 
  filePath: string, 
  metadata: any,
  adminKey: string
): Promise<{ documentId: string; status: string }> {
  // 1. Iniciar sessão
  const startRes = await fetch(`${SUPABASE_URL}/functions/v1/documents/ingest-start`, {
    method: 'POST',
    headers: { 'x-admin-key': adminKey, ... },
    body: JSON.stringify({ 
      title: metadata.originalFilename,
      category: 'manual',
      filePath,
      totalBytes: new TextEncoder().encode(fullText).length
    })
  });
  const { documentId, sessionId } = await startRes.json();

  // 2. Enviar batches
  const batches = splitTextIntoBatches(fullText, MAX_BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    await fetch(`${SUPABASE_URL}/functions/v1/documents/ingest-batch`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, ... },
      body: JSON.stringify({
        sessionId,
        batchIndex: i,
        text: batches[i],
        isFinal: i === batches.length - 1
      })
    });
    onProgress((i + 1) / batches.length * 100);
  }

  // 3. Finalizar
  const finishRes = await fetch(`${SUPABASE_URL}/functions/v1/documents/ingest-finish`, {
    method: 'POST',
    headers: { 'x-admin-key': adminKey, ... },
    body: JSON.stringify({ sessionId, documentId })
  });
  
  return finishRes.json();
}
```

### 3.4 Backend: Novos Endpoints

**Arquivo: `supabase/functions/documents/index.ts`**

```typescript
// POST /ingest-start
if (req.method === "POST" && lastPart === "ingest-start") {
  const { title, category, filePath, totalBytes } = await req.json();
  const sessionId = crypto.randomUUID();
  
  const { data: doc } = await supabase.from("documents").insert({
    title, category, file_path: filePath, status: "uploading", content_text: ""
  }).select().single();
  
  return createDebugResponse(true, 200, {
    documentId: doc.id,
    sessionId,
    maxBatchSize: 500_000
  }, debug, startTime);
}

// POST /ingest-batch
if (req.method === "POST" && lastPart === "ingest-batch") {
  const { sessionId, batchIndex, text, isFinal } = await req.json();
  
  // Upsert (idempotente)
  await supabase.from("document_text_batches").upsert({
    session_id: sessionId,
    batch_index: batchIndex,
    text_content: text
  }, { onConflict: "document_id,batch_index" });
  
  return createDebugResponse(true, 200, { 
    received: true, batchIndex 
  }, debug, startTime);
}

// POST /ingest-finish
if (req.method === "POST" && lastPart === "ingest-finish") {
  const { sessionId, documentId } = await req.json();
  
  // Consolidar batches
  const { data: batches } = await supabase
    .from("document_text_batches")
    .select("text_content, batch_index")
    .eq("session_id", sessionId)
    .order("batch_index");
  
  const fullText = batches.map(b => b.text_content).join("");
  
  await supabase.from("documents").update({
    content_text: fullText,
    status: "processing"
  }).eq("id", documentId);
  
  // Processar chunks/embeddings
  const result = await processChunksAndEmbeddings(...);
  
  // Limpar batches
  await supabase.from("document_text_batches").delete().eq("session_id", sessionId);
  
  return createDebugResponse(true, 200, result, debug, startTime);
}
```

---

## 4. Separação Explícita: Salvar Texto ≠ Processar

### 4.1 Fluxo em 2 Fases

```text
FASE 1: SALVAR (rápido, sem risco)
┌─────────────────────────────────────────┐
│ /ingest-text ou /ingest-finish          │
│   → Salva texto no documents.content_text│
│   → Retorna 200 imediatamente           │
│   → status = "text_received"            │
└─────────────────────────────────────────┘

FASE 2: PROCESSAR (pode falhar, retry ok)
┌─────────────────────────────────────────┐
│ POST /documents/process                 │
│   → Chunking                            │
│   → Embeddings (best-effort)            │
│   → status = "ready" ou "chunks_ok..."  │
└─────────────────────────────────────────┘
```

### 4.2 Opção de Processamento Automático vs Manual

**Arquivo: `src/pages/Admin.tsx`** - Toggle:

```tsx
const [autoProcess, setAutoProcess] = useState(true);

// No fluxo de upload
if (autoProcess) {
  await handleProcessDocument(documentId);
} else {
  toast({
    title: 'Texto salvo',
    description: 'Clique em "Processar" para gerar chunks e embeddings.',
  });
}
```

---

## 5. Embeddings Best-Effort (Formalizado)

### 5.1 Status Claros

| Status | Significado |
|--------|-------------|
| `uploaded` | Arquivo no Storage, texto não extraído |
| `text_received` | Texto salvo, chunks não gerados |
| `processing` | Gerando chunks/embeddings |
| `ready` | Tudo completo |
| `chunks_ok_embed_pending` | Chunks OK, embeddings falharam |
| `failed` | Erro irrecuperável |

### 5.2 Rate Limit de Embeddings

**Arquivo: `supabase/functions/documents/index.ts`**

```typescript
const EMBED_BATCH_SIZE = 10;
const EMBED_DELAY_MS = 150;
const MAX_EMBEDS_PER_EXECUTION = 100;

async function processChunksAndEmbeddings(...) {
  // ... chunking ...
  
  let embedsProcessed = 0;
  for (let i = 0; i < chunks.length && embedsProcessed < MAX_EMBEDS_PER_EXECUTION; i++) {
    // Embed batch
    if (i % EMBED_BATCH_SIZE === 0 && i > 0) {
      await new Promise(r => setTimeout(r, EMBED_DELAY_MS));
    }
    // ... embed logic ...
    embedsProcessed++;
  }
  
  if (embedsProcessed < chunks.length) {
    // Marcar para continuar depois
    await supabase.from("documents").update({
      status: "chunks_ok_embed_pending",
      processing_progress: embedsProcessed
    }).eq("id", documentId);
  }
}
```

---

## 6. OCR Incremental: Controle de Payload

### 6.1 Ajustes de Qualidade

**Arquivo: `src/utils/renderPdfPages.ts`**

```typescript
// Constantes otimizadas
const OCR_SCALE = 1.5;        // Reduzido de 2.0
const OCR_QUALITY = 0.7;       // Reduzido de 0.85
const MAX_IMAGE_KB = 400;      // Limite por imagem

export async function renderPageAsImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number = OCR_SCALE,
  quality: number = OCR_QUALITY
): Promise<PageImage> {
  // ... render logic ...
  
  // Verificar tamanho e reduzir se necessário
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  const sizeKB = (dataUrl.length * 0.75) / 1024; // base64 overhead
  
  if (sizeKB > MAX_IMAGE_KB && quality > 0.4) {
    dataUrl = canvas.toDataURL('image/jpeg', quality - 0.15);
  }
  
  return { pageNum, dataUrl, width, height };
}
```

### 6.2 Resposta Parcial do OCR

**Arquivo: `supabase/functions/documents/index.ts`** - Já implementado, mas adicionar:

```typescript
// No endpoint /ocr-batch
return createDebugResponse(true, 200, {
  status: "ocr_batch_complete",
  batchIndex: body.batchIndex,
  pagesProcessed: extractedTexts.length,
  pagesFailed: pageImages.length - extractedTexts.filter(t => !t.text.includes('[Erro')).length,
  totalChars: combinedText.length,
  extractedText: combinedText // Retornar texto para concatenação no frontend
}, debug, startTime);
```

---

## 7. Observabilidade: Diagnóstico Copiável

### 7.1 Estrutura de Debug Melhorada

**Já implementada**, mas adicionar no frontend:

**Arquivo: `src/pages/Admin.tsx`** - Botão "Copiar Diagnóstico":

```tsx
const [lastDebugInfo, setLastDebugInfo] = useState<any>(null);

// Após qualquer resposta
if (response.debug) {
  setLastDebugInfo(response.debug);
}

// No UI
{lastDebugInfo && (
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => {
      navigator.clipboard.writeText(JSON.stringify(lastDebugInfo, null, 2));
      toast({ title: 'Diagnóstico copiado!' });
    }}
  >
    <ClipboardCopy className="w-4 h-4 mr-1" />
    Copiar Diagnóstico
  </Button>
)}
```

### 7.2 Logging Estruturado no Console

```typescript
// Em erros
console.error('[Admin] Upload failed:', {
  file: file.name,
  phase: extractionPhase,
  error: error.message,
  debug: response?.debug
});
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `vite.config.ts` | Adicionar `target: "esnext"` |
| `src/utils/extractPdfText.ts` | Funções de medição, heurística OCR melhorada |
| `src/utils/renderPdfPages.ts` | Constantes de qualidade otimizadas |
| `src/pages/Admin.tsx` | UI de medição, batching, diagnóstico copiável |
| `supabase/functions/documents/index.ts` | Endpoints batch, rate limit embeddings |
| **Migração SQL** | Tabela `document_text_batches` |

---

## Ordem de Implementação

1. **Corrigir build** (`vite.config.ts`) - CRÍTICO
2. **Migração SQL** (tabela de batches)
3. **Endpoints de batch** no backend
4. **Medição + batching** no frontend
5. **OCR quality** ajustes
6. **Observabilidade** UI
7. **Testes** end-to-end

---

## Seção Técnica: Configuração Final do Vite

```typescript
// vite.config.ts completo
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "framer-motion"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "framer-motion"],
    exclude: [],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    commonjsOptions: { include: [/node_modules/] },
  },
  esbuild: {
    target: "esnext",
  },
}));
```
