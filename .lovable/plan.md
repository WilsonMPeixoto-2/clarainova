
# Plano: Extração de PDF no Cliente + Backend Leve para Texto

## Contexto do Problema

O sistema atual envia PDFs inteiros para o backend (Edge Function), que tenta:
1. Baixar do Storage
2. Extrair texto com `pdfjs-serverless`
3. Fallback para OCR via LLM se texto for insuficiente
4. Chunking + Embeddings

Isso causa:
- **Timeouts** em PDFs grandes
- **Erros de memória** na Edge Function
- **Complexidade desnecessária** para PDFs com texto nativo (maioria dos manuais/leis)
- **Custos de LLM** para OCR quando não é necessário

## Nova Arquitetura

```text
ANTES (backend pesado)
┌──────────────────────────────────────────────────────────────────┐
│  Browser                        Edge Function                    │
│  ────────                       ─────────────                    │
│  [Upload PDF] ──────────────────> [Download]                     │
│                                   [pdfjs-serverless]             │
│                                   [OCR LLM fallback]             │
│                                   [Chunk]                        │
│                                   [Embed]                        │
│                                   [Save DB]                      │
│                                                                  │
│  PROBLEMA: Edge Function faz tudo, timeout/memória em PDFs >15MB │
└──────────────────────────────────────────────────────────────────┘

DEPOIS (cliente extrai, backend leve)
┌──────────────────────────────────────────────────────────────────┐
│  Browser (Admin.tsx)            Edge Function                    │
│  ───────────────────            ─────────────                    │
│  [Load PDF]                                                      │
│  [PDF.js extract] ──> fullText                                   │
│  [Detect needs_ocr?]                                             │
│    │                                                             │
│    ├─ Se texto ok ──────────────> [Receive text only]            │
│    │  (POST /ingest-text)         [Chunk]                        │
│    │                              [Embed]                        │
│    │                              [Save DB]                      │
│    │                                                             │
│    └─ Se needs_ocr ─────────────> [Render pages as images]       │
│       (Upload PDF + flag)         [OCR em batches (3-5 pgs)]     │
│                                   [Chunk]                        │
│                                   [Embed]                        │
│                                   [Save DB]                      │
│                                                                  │
│  BENEFÍCIO: Backend recebe texto pronto, 90% menos trabalho      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Adicionar PDF.js no Frontend

### 1.1 Instalar dependência

```bash
npm install pdfjs-dist
```

O pacote `pdfjs-dist` inclui o worker necessário para extração em background thread.

### 1.2 Criar utilitário de extração

**Novo arquivo: `src/utils/extractPdfText.ts`**

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Worker CDN (evita problemas de bundling)
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

export interface PdfExtractionResult {
  fullText: string;
  pages: string[];
  totalPages: number;
  needsOcr: boolean;
  avgCharsPerPage: number;
}

export async function extractPdfTextClient(
  file: File,
  onProgress?: (percent: number) => void
): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const totalPages = pdf.numPages;
  const pages: string[] = [];
  
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(text);
    
    if (onProgress) {
      onProgress(Math.round((i / totalPages) * 100));
    }
  }
  
  const fullText = pages.join('\n\n--- Página ---\n\n');
  const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
  const avgCharsPerPage = totalChars / totalPages;
  
  // Heurística: PDFs escaneados têm pouco texto
  const MIN_CHARS_PER_PAGE = 100;
  const needsOcr = avgCharsPerPage < MIN_CHARS_PER_PAGE;
  
  return {
    fullText,
    pages,
    totalPages,
    needsOcr,
    avgCharsPerPage
  };
}
```

### 1.3 Interface de Progresso

Adicionar estado visual durante extração no `Admin.tsx`:

```typescript
// Estados adicionais
const [extractionProgress, setExtractionProgress] = useState(0);
const [extractionPhase, setExtractionPhase] = useState<'idle' | 'extracting' | 'uploading' | 'processing'>('idle');
```

---

## 2. Novo Endpoint: POST /documents/ingest-text

O backend recebe apenas o texto já extraído, eliminando a necessidade de processar PDFs.

### 2.1 Payload esperado

```typescript
interface IngestTextPayload {
  title: string;
  category: string;
  fullText: string;            // Texto extraído no cliente
  metadata: {
    originalFilename: string;
    totalPages: number;
    extractedAt: string;       // ISO timestamp
    extractionMethod: 'pdfjs-client' | 'manual';
  };
  filePath?: string;           // Opcional: se quiser manter PDF no Storage
}
```

### 2.2 Implementação em `documents/index.ts`

```typescript
// POST /documents/ingest-text - Recebe texto pronto do cliente
if (req.method === "POST" && lastPart === "ingest-text") {
  const adminKey = (req.headers.get("x-admin-key") || "").trim();
  if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
    return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
  }

  const body = await req.json();
  const { title, category, fullText, metadata, filePath } = body;

  if (!fullText || fullText.trim().length < 100) {
    return createDebugResponse(false, 400, { 
      error: "Texto muito curto. Mínimo 100 caracteres." 
    }, debug, startTime);
  }

  console.log(`[${requestId}] Ingesting pre-extracted text: ${fullText.length} chars`);

  // Criar documento
  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      title: title || metadata?.originalFilename || "Documento sem título",
      category: category || "manual",
      file_path: filePath || null,
      content_text: fullText,
      status: "processing"
    })
    .select()
    .single();

  if (docError) throw docError;

  debug.steps_completed.push("db_insert");
  console.log(`[${requestId}] ✓ db_insert: Document ${document.id}`);

  // Processar chunks e embeddings
  const { chunksCount, warning } = await processChunksAndEmbeddings(
    supabase, document.id, fullText, GEMINI_API_KEY, requestId, debug
  );

  // Atualizar status
  await supabase
    .from("documents")
    .update({ status: "ready" })
    .eq("id", document.id);

  return createDebugResponse(true, 200, {
    status: "ready",
    warning,
    document: { id: document.id, title: document.title, chunk_count: chunksCount }
  }, debug, startTime);
}
```

---

## 3. Fallback OCR para PDFs Escaneados

Quando `needsOcr === true`, o sistema oferece duas opções:

### 3.1 Modo A: Usuário fornece PDF com OCR

Muitos scanners modernos geram PDFs com camada de texto OCR. Orientar o usuário:

```tsx
{needsOcr && (
  <AlertDialog open={showOcrDialog}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>PDF Escaneado Detectado</AlertDialogTitle>
        <AlertDialogDescription>
          Este PDF parece ser uma imagem escaneada com pouco texto selecionável.
          
          <strong>Recomendação:</strong> Use seu scanner ou software de PDF para 
          gerar uma versão com OCR (camada de texto). Isso é mais rápido e preciso.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => setShowOcrDialog(false)}>
          Cancelar Upload
        </AlertDialogCancel>
        <AlertDialogAction onClick={() => handleOcrUpload(file)}>
          Processar via IA (lento)
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

### 3.2 Modo B: OCR Incremental via IA

Para PDFs escaneados que o usuário quer processar automaticamente:

1. **Renderizar páginas como imagens** no browser (canvas)
2. **Enviar em batches** de 3-5 páginas para a Edge Function
3. **Checkpoint por página** (salvar progresso parcial)

**Novo arquivo: `src/utils/renderPdfPages.ts`**

```typescript
import * as pdfjsLib from 'pdfjs-dist';

export async function renderPageAsImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number = 2.0
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  // Converter para base64 JPEG (menor que PNG)
  return canvas.toDataURL('image/jpeg', 0.85);
}
```

**Nova rota: POST /documents/ocr-batch**

```typescript
// POST /documents/ocr-batch - OCR de batch de imagens
if (req.method === "POST" && lastPart === "ocr-batch") {
  const body = await req.json();
  const { documentId, pageImages, startPage } = body;
  
  // pageImages: Array<{ pageNum: number, dataUrl: string }>
  
  const extractedTexts: string[] = [];
  
  for (const { pageNum, dataUrl } of pageImages) {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: "Extraia TODO o texto desta página. Responda apenas com o texto." }
          ]
        }]
      }),
    });
    
    const data = await response.json();
    extractedTexts.push(data.choices?.[0]?.message?.content || "");
  }
  
  // Append ao documento existente
  // ... salvar progresso
}
```

---

## 4. Embeddings Assíncronos com Fallback

### 4.1 Novo status: `chunks_ok_embed_pending`

Quando embeddings falham por quota (429), salvar chunks sem embedding:

```typescript
// Em processChunksAndEmbeddings
if (isRateLimitError(e)) {
  // Salvar chunks com embedding=null
  embeddingsDisabled = true;
  embeddingsWarning = "Embeddings pendentes (limite de API atingido). Use busca por palavras-chave temporariamente.";
  
  // Marcar documento para reprocessamento posterior
  await supabase
    .from("documents")
    .update({ status: "chunks_ok_embed_pending" })
    .eq("id", documentId);
}
```

### 4.2 Botão "Gerar Embeddings" no Admin

```tsx
{doc.status === 'chunks_ok_embed_pending' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => handleRegenerateEmbeddings(doc.id)}
  >
    <Sparkles className="w-4 h-4 mr-1" />
    Gerar Embeddings
  </Button>
)}
```

### 4.3 Fallback de Keyword na Busca

Atualizar `search/index.ts` para lidar com chunks sem embedding:

```typescript
// Na busca semântica, filtrar chunks com embedding
const { data: semanticChunks } = await supabase.rpc(
  "search_document_chunks",
  {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: 0.3,
    match_count: 15
  }
);

// Busca por keywords em TODOS os chunks (incluindo sem embedding)
const { data: allChunks } = await supabase
  .from("document_chunks")
  .select("id, content, document_id, metadata, chunk_index");

// RRF combina ambos, então chunks sem embedding ainda aparecem via keyword
```

---

## 5. Alterações no Admin.tsx

### 5.1 Novo fluxo de upload

```typescript
const handleFileUpload = async (files: FileList | null) => {
  // ... validação existente ...

  for (const file of validFiles) {
    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    
    if (isPDF) {
      setExtractionPhase('extracting');
      
      // STEP 1: Extrair texto no cliente
      const result = await extractPdfTextClient(file, setExtractionProgress);
      
      if (result.needsOcr) {
        // Mostrar diálogo de OCR
        setOcrFile(file);
        setShowOcrDialog(true);
        continue;
      }
      
      // STEP 2: Upload do PDF para Storage (opcional, para backup)
      setExtractionPhase('uploading');
      const signedUrlData = await getSignedUploadUrl(file.name, file.type);
      await uploadFile(file, signedUrlData.signedUrl);
      
      // STEP 3: Enviar texto extraído para backend
      setExtractionPhase('processing');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documents/ingest-text`,
        {
          method: 'POST',
          headers: {
            'x-admin-key': key,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ''),
            category: 'manual',
            fullText: result.fullText,
            filePath: signedUrlData.path,
            metadata: {
              originalFilename: file.name,
              totalPages: result.totalPages,
              extractedAt: new Date().toISOString(),
              extractionMethod: 'pdfjs-client'
            }
          }),
        }
      );
      
      // ... tratamento de resposta ...
    } else {
      // TXT/DOCX: ler texto no cliente e enviar
      // ...
    }
  }
};
```

### 5.2 UI de Progresso Melhorada

```tsx
{isUploading && (
  <Card className="border-primary/50">
    <CardContent className="pt-6">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>
            {extractionPhase === 'extracting' && 'Extraindo texto do PDF...'}
            {extractionPhase === 'uploading' && 'Enviando arquivo...'}
            {extractionPhase === 'processing' && 'Processando chunks e embeddings...'}
          </span>
          <span>{extractionProgress}%</span>
        </div>
        <Progress value={extractionProgress} />
      </div>
    </CardContent>
  </Card>
)}
```

---

## 6. Resumo de Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `package.json` | Modificar | Adicionar `pdfjs-dist` |
| `src/utils/extractPdfText.ts` | Criar | Utilitário de extração no cliente |
| `src/utils/renderPdfPages.ts` | Criar | Renderizar páginas como imagens para OCR |
| `src/pages/Admin.tsx` | Modificar | Novo fluxo com extração cliente-side |
| `supabase/functions/documents/index.ts` | Modificar | Adicionar rota `/ingest-text`, `/ocr-batch` |
| `supabase/functions/search/index.ts` | Modificar | Garantir fallback keyword para chunks sem embedding |

---

## 7. Migração de Dados

Para documentos existentes sem embeddings:

```sql
-- Identificar documentos com chunks sem embedding
SELECT d.id, d.title, d.status,
       COUNT(c.id) as total_chunks,
       COUNT(c.embedding) as chunks_with_embedding
FROM documents d
LEFT JOIN document_chunks c ON c.document_id = d.id
GROUP BY d.id
HAVING COUNT(c.embedding) < COUNT(c.id);

-- Atualizar status para reprocessamento
UPDATE documents
SET status = 'chunks_ok_embed_pending'
WHERE id IN (
  SELECT d.id
  FROM documents d
  LEFT JOIN document_chunks c ON c.document_id = d.id
  GROUP BY d.id
  HAVING COUNT(c.embedding) < COUNT(c.id)
);
```

---

## 8. Benefícios Esperados

| Problema Atual | Solução | Resultado |
|----------------|---------|-----------|
| Edge Function processa PDF inteiro | Extração no browser | Backend leve, só recebe texto |
| Timeouts em PDFs grandes | Processamento local sem limite | Sem timeouts de rede |
| OCR para todos os PDFs | Detecção automática de `needsOcr` | OCR só quando necessário |
| Embeddings falham = tudo falha | Status `chunks_ok_embed_pending` | Chunks salvos, busca por keyword funciona |
| Sem feedback de progresso | Progress bar por etapa | UX clara do que está acontecendo |

---

## 9. Ordem de Implementação

1. **Adicionar pdfjs-dist** e criar `extractPdfText.ts`
2. **Criar rota /ingest-text** no backend (aceita texto pronto)
3. **Modificar Admin.tsx** para usar extração cliente-side
4. **Adicionar status `chunks_ok_embed_pending`** e botão de regenerar
5. **Implementar OCR incremental** para PDFs escaneados
6. **Testar** com PDFs de diferentes tamanhos e tipos

---

## Seção Tecnica: Configuracao PDF.js

O worker do PDF.js precisa ser carregado corretamente:

```typescript
// Opção 1: CDN (mais simples, recomendado)
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

// Opção 2: Local (requer config do Vite)
// vite.config.ts:
// optimizeDeps: {
//   include: ['pdfjs-dist/build/pdf.worker.mjs'],
// }
```

Para evitar problemas de CORS e bundling, a opção CDN é mais confiável.
