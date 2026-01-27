

# Plano: Extração Determinística de PDFs (Rota 1)

## Diagnóstico Confirmado

A análise está correta. O problema estrutural é usar LLM como extrator "literal completo" de PDFs grandes:

| Causa | Problema | Impacto |
|-------|----------|---------|
| **A** | LLM não consegue devolver 200+ páginas em uma resposta | Truncamento, timeout, erro 500 |
| **B** | `data:application/pdf;base64` via `image_url` não é suportado | Formato incompatível, 400/415 |
| **C** | Base64 de 13MB PDF = ~18MB em JSON | Limite de request size, memória |

## Solução: Extração Determinística + Processamento Incremental

```text
FLUXO ATUAL (frágil)
┌─────────────────────────────────────────────────────────────┐
│ PDF → Base64 → LLM "extraia tudo" → Erro (timeout/truncado) │
└─────────────────────────────────────────────────────────────┘

NOVO FLUXO (robusto)
┌─────────────────────────────────────────────────────────────┐
│ PDF → pdfjs-serverless → Extração por página              │
│   ↓                                                         │
│ Processamento incremental (10 páginas por execução)         │
│   ↓                                                         │
│ Chunks salvos → Embeddings (best-effort, tolerante a 429)   │
└─────────────────────────────────────────────────────────────┘
```

## Mudanças a Implementar

### 1. Nova Tabela: `document_jobs` (Fila de Processamento)

Permite processar PDFs grandes em fatias sem estourar timeout.

```sql
CREATE TABLE public.document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  -- Status: pending, processing, completed, failed
  next_page INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER,
  pages_per_batch INTEGER NOT NULL DEFAULT 10,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_jobs_status ON public.document_jobs(status);
CREATE INDEX idx_document_jobs_document_id ON public.document_jobs(document_id);
```

### 2. Edge Function `documents/index.ts` (Reescrita Completa)

**Mudanças principais:**

a) **Importar `pdfjs-serverless`**: Biblioteca compatível com Deno para extração determinística

b) **Nova função `extractPdfText`**: Extração página por página sem depender de LLM

c) **Processamento incremental**: Para PDFs grandes, processa 10 páginas por execução

d) **LLM apenas para embeddings e fallback**: Não mais como extrator primário

**Código-chave:**

```typescript
// Importação compatível com Deno
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.6.0";

const PAGES_PER_BATCH = 10;

// Extração determinística (sem LLM)
async function extractPdfText(
  fileData: Blob, 
  startPage: number = 1, 
  endPage?: number
): Promise<{ pages: string[], totalPages: number }> {
  const arrayBuffer = await fileData.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const doc = await getDocument({ data }).promise;
  const totalPages = doc.numPages;
  const actualEndPage = Math.min(endPage || totalPages, totalPages);
  
  const pages: string[] = [];
  
  for (let i = startPage; i <= actualEndPage; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(text);
    console.log(`[documents] Page ${i}/${totalPages}: ${text.length} chars`);
  }
  
  return { pages, totalPages };
}
```

**Fluxo de processamento:**

```typescript
// POST /documents - Inicia processamento
if (isPDF) {
  // 1. Extrair primeiras páginas para preview
  const { pages, totalPages } = await extractPdfText(fileData, 1, PAGES_PER_BATCH);
  
  // 2. Criar documento com texto parcial
  const partialText = pages.join("\n\n--- Página ---\n\n");
  const document = await createDocument(title, category, filePath, partialText);
  
  // 3. Se houver mais páginas, criar job para processamento em background
  if (totalPages > PAGES_PER_BATCH) {
    await createDocumentJob(document.id, PAGES_PER_BATCH + 1, totalPages);
    return { 
      success: true, 
      document,
      status: "processing",
      message: `Processando ${totalPages} páginas em background...`
    };
  }
  
  // 4. PDF pequeno: processar chunks e embeddings imediatamente
  await processChunksAndEmbeddings(document.id, partialText);
  return { success: true, document, status: "completed" };
}
```

### 3. Nova Rota: `POST /documents/process-job` (Worker)

Processa próximo lote de páginas de um job pendente:

```typescript
// POST /documents/process-job
if (req.method === "POST" && url.pathname.endsWith("/process-job")) {
  // 1. Buscar próximo job pendente
  const { data: job } = await supabase
    .from("document_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(1)
    .single();
  
  if (!job) return { message: "Nenhum job pendente" };
  
  // 2. Atualizar status para processing
  await supabase.from("document_jobs")
    .update({ status: "processing" })
    .eq("id", job.id);
  
  // 3. Baixar PDF e extrair próximo lote
  const document = await getDocument(job.document_id);
  const { data: fileData } = await supabase.storage
    .from("knowledge-base")
    .download(document.file_path);
  
  const endPage = Math.min(job.next_page + job.pages_per_batch - 1, job.total_pages);
  const { pages } = await extractPdfText(fileData, job.next_page, endPage);
  
  // 4. Append texto extraído ao documento
  const newText = pages.join("\n\n--- Página ---\n\n");
  await appendDocumentText(job.document_id, newText);
  
  // 5. Atualizar job (próximo lote ou concluído)
  if (endPage >= job.total_pages) {
    await supabase.from("document_jobs")
      .update({ status: "completed", next_page: endPage + 1 })
      .eq("id", job.id);
    
    // 6. Processar chunks e embeddings do documento completo
    await processChunksAndEmbeddings(job.document_id);
  } else {
    await supabase.from("document_jobs")
      .update({ status: "pending", next_page: endPage + 1 })
      .eq("id", job.id);
  }
  
  return { processed: endPage - job.next_page + 1, remaining: job.total_pages - endPage };
}
```

### 4. Frontend: Polling de Status no Admin

Atualizar `Admin.tsx` para mostrar progresso:

```typescript
// Após upload, fazer polling do status
const pollJobStatus = async (documentId: string) => {
  const interval = setInterval(async () => {
    const { data: job } = await supabase
      .from("document_jobs")
      .select("*")
      .eq("document_id", documentId)
      .single();
    
    if (job?.status === "completed") {
      clearInterval(interval);
      toast.success("Documento processado com sucesso!");
    } else if (job?.status === "failed") {
      clearInterval(interval);
      toast.error(`Erro: ${job.error}`);
    } else {
      const progress = Math.round((job.next_page / job.total_pages) * 100);
      setUploadProgress(progress);
    }
  }, 3000);
};
```

### 5. Fallback Inteligente (LLM para OCR)

Para PDFs com texto "invisível" (imagens/scans), usar LLM como fallback:

```typescript
async function extractPdfTextWithFallback(fileData: Blob) {
  try {
    // Tentar extração determinística primeiro
    const { pages, totalPages } = await extractPdfText(fileData);
    const totalText = pages.join(" ");
    
    // Se texto muito curto, pode ser PDF de imagens
    if (totalText.length < 100 && totalPages > 0) {
      console.log("[documents] Texto muito curto, tentando OCR via LLM...");
      // Fallback para LLM apenas para OCR de PDFs-imagem
      return await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY);
    }
    
    return totalText;
  } catch (e) {
    console.error("[documents] pdfjs-serverless failed:", e);
    // Fallback para LLM em caso de erro na biblioteca
    return await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY);
  }
}
```

## Resumo das Alterações

| Arquivo/Recurso | Mudança |
|-----------------|---------|
| **Migração SQL** | Criar tabela `document_jobs` para fila de processamento |
| **`documents/index.ts`** | Substituir LLM por `pdfjs-serverless` como extrator primário |
| **`documents/index.ts`** | Adicionar rota `/process-job` para worker incremental |
| **`documents/index.ts`** | LLM vira fallback apenas para OCR de PDFs-imagem |
| **`Admin.tsx`** | Polling de status para PDFs grandes em processamento |

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| PDF 10 páginas | Timeout/Truncado | Processado em 2-3s |
| PDF 200 páginas | Erro 500 | Processado em ~20-30s (incremental) |
| PDF-imagem (scan) | Erro | OCR via LLM fallback |
| Cota Gemini esgotada | Falha total | Chunks salvos sem embeddings |

## Vantagens da Abordagem

1. **Determinística**: Extração por biblioteca é previsível (sem variação de tokens)
2. **Incremental**: PDFs grandes processados em fatias de 10 páginas
3. **Tolerante a falhas**: Jobs podem ser retomados de onde pararam
4. **Eficiente**: Sem payload base64 gigante para gateway
5. **Fallback inteligente**: LLM usado apenas quando necessário (OCR)

## Ordem de Implementação

1. Criar migração SQL para `document_jobs`
2. Reescrever `documents/index.ts` com `pdfjs-serverless`
3. Adicionar rota `/process-job`
4. Atualizar `Admin.tsx` com polling de progresso
5. Testar com PDF pequeno (< 10 páginas)
6. Testar com PDF grande (200+ páginas)

