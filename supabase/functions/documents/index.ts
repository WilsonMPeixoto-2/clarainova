import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
// @ts-ignore - mammoth for DOCX parsing
import mammoth from "https://esm.sh/mammoth@1.6.0";
// @ts-ignore - pdfjs-serverless for deterministic PDF extraction
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// Lovable AI Gateway URL (only for OCR fallback now)
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const AI_TIMEOUT_MS = 120_000;
const PAGES_PER_BATCH = 10; // Process 10 pages at a time

function safeJsonStringify(x: unknown): string {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeoutPromise: Promise<T> = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`TIMEOUT: ${label} after ${ms}ms`));
    }, ms);
  });
  return (await Promise.race([promise, timeoutPromise])) as T;
}

async function blobToBase64(fileBlob: Blob): Promise<string> {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  return encodeBase64(uint8Array);
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("429") || 
           message.includes("rate limit") || 
           message.includes("quota") ||
           message.includes("resource_exhausted");
  }
  return false;
}

// =============================================
// DETERMINISTIC PDF EXTRACTION (pdfjs-serverless)
// =============================================
interface PdfExtractionResult {
  pages: string[];
  totalPages: number;
}

async function extractPdfTextDeterministic(
  fileData: Blob,
  startPage: number = 1,
  endPage?: number
): Promise<PdfExtractionResult> {
  console.log(`[documents] Extracting PDF pages ${startPage}-${endPage || "end"} via pdfjs-serverless...`);
  
  const arrayBuffer = await fileData.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const doc = await getDocument({ data }).promise;
  const totalPages = doc.numPages;
  const actualEndPage = Math.min(endPage || totalPages, totalPages);
  
  console.log(`[documents] PDF has ${totalPages} pages, extracting ${startPage}-${actualEndPage}`);
  
  const pages: string[] = [];
  
  for (let i = startPage; i <= actualEndPage; i++) {
    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(text);
      console.log(`[documents] Page ${i}/${totalPages}: ${text.length} chars`);
    } catch (pageError) {
      console.error(`[documents] Error extracting page ${i}:`, pageError);
      pages.push(""); // Empty page on error
    }
  }
  
  return { pages, totalPages };
}

// =============================================
// LLM FALLBACK FOR OCR (scanned PDFs)
// =============================================
async function extractPdfViaLovableAIBase64(fileBlob: Blob, lovableApiKey: string): Promise<string> {
  console.log("[documents] OCR FALLBACK: Attempting PDF extraction via Lovable AI...");

  const base64Data = await blobToBase64(fileBlob);
  const dataUrl = `data:application/pdf;base64,${base64Data}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableApiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: `Extraia TODO o texto deste documento mantendo a estrutura.
Regras:
- Preserve títulos, parágrafos, tabelas e listas
- Não resuma e não omita conteúdo
- Mantenha números/valores/códigos exatamente como no original
Responda APENAS com o texto extraído.`,
            },
          ],
        },
      ],
    }),
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(no body)");
    throw new Error(`LovableAI HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const extractedText = data.choices?.[0]?.message?.content || "";

  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error("Texto extraído via Lovable AI muito curto");
  }

  console.log(`[documents] OCR extracted via Lovable AI: ${extractedText.length} characters`);
  return extractedText;
}

// =============================================
// CHUNKING
// =============================================
const CHUNK_SIZE = 4000;
const CHUNK_OVERLAP = 500;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    
    if (end < text.length) {
      const doubleNewline = text.lastIndexOf("\n\n", end);
      if (doubleNewline > start + CHUNK_SIZE / 2) {
        end = doubleNewline + 2;
      } else {
        const period = text.lastIndexOf(". ", end);
        if (period > start + CHUNK_SIZE / 2) {
          end = period + 2;
        }
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    
    if (start < 0) start = 0;
    if (start >= text.length) break;
  }
  
  return chunks.filter(chunk => chunk.length > 50);
}

function extractMetadata(chunk: string, index: number): Record<string, any> {
  const lines = chunk.split("\n");
  const firstLine = lines[0] || "";
  
  const isTitle = firstLine.length < 100 && 
    (firstLine.startsWith("#") || 
     firstLine === firstLine.toUpperCase() ||
     firstLine.match(/^\d+\.\s/) ||
     firstLine.match(/^[A-Z][^.!?]*$/));
  
  const keywords: string[] = [];
  const keywordPatterns = [
    /SEI/gi, /processo/gi, /documento/gi, /assinatura/gi,
    /bloco/gi, /tramit/gi, /legislação/gi, /normativa/gi,
    /unidade/gi, /usuário/gi, /administrativ/gi
  ];
  
  for (const pattern of keywordPatterns) {
    if (pattern.test(chunk)) {
      keywords.push(pattern.source.replace(/\\s\*|\\|gi|g|i/g, "").toLowerCase());
    }
  }
  
  return {
    section_title: isTitle ? firstLine.replace(/^#+\s*/, "") : null,
    chunk_index: index,
    keywords: [...new Set(keywords)],
    char_count: chunk.length,
    word_count: chunk.split(/\s+/).length
  };
}

// Rate limiting configuration
const ADMIN_RATE_LIMIT = {
  maxRequests: 5,
  windowSeconds: 300,
};

function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  
  if (forwarded) return forwarded.split(",")[0].trim();
  if (cfIp) return cfIp;
  if (realIp) return realIp;
  return "unknown";
}

// =============================================
// PROCESS CHUNKS AND EMBEDDINGS
// =============================================
async function processChunksAndEmbeddings(
  supabase: any,
  documentId: string,
  contentText: string,
  geminiApiKey: string | undefined
): Promise<{ chunksCount: number; warning: string | null }> {
  const chunks = splitIntoChunks(contentText);
  console.log(`[documents] Document split into ${chunks.length} chunks`);
  
  const chunkRecords: Array<any> = [];
  let embeddingsWarning: string | null = null;
  let embeddingModel: any = null;

  if (!geminiApiKey) {
    embeddingsWarning = "Embeddings não geradas (GEMINI_API_KEY não configurada).";
  } else {
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    } catch (e) {
      embeddingsWarning = `Embeddings desativadas: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  let embeddingsDisabled = !embeddingModel;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const metadata = extractMetadata(chunk, i);

    let embeddingJson: string | null = null;
    if (!embeddingsDisabled && embeddingModel) {
      try {
        const embeddingResult = await withTimeout<any>(
          embeddingModel.embedContent(chunk) as Promise<any>,
          AI_TIMEOUT_MS,
          "Gemini embedContent"
        );
        const embedding = embeddingResult?.embedding?.values;
        if (!embedding) throw new Error("Embedding inválido");
        embeddingJson = JSON.stringify(embedding);
      } catch (e) {
        embeddingsDisabled = true;
        const msg = e instanceof Error ? e.message : String(e);
        embeddingsWarning = embeddingsWarning || `Embeddings interrompidas: ${msg}`;
        console.error("[documents] Embedding failed:", e);
      }
    }

    chunkRecords.push({
      document_id: documentId,
      content: chunk,
      chunk_index: i,
      embedding: embeddingJson,
      metadata,
    });

    if (!embeddingsDisabled && i % 5 === 0 && i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  // Insert chunks in batches
  const batchSize = 50;
  for (let i = 0; i < chunkRecords.length; i += batchSize) {
    const batch = chunkRecords.slice(i, i + batchSize);
    const { error: chunksError } = await supabase
      .from("document_chunks")
      .insert(batch);
    
    if (chunksError) {
      console.error("Error inserting chunks:", chunksError);
      throw chunksError;
    }
  }
  
  console.log(`[documents] All ${chunks.length} chunks inserted`);
  return { chunksCount: chunks.length, warning: embeddingsWarning };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const ADMIN_KEY = Deno.env.get("ADMIN_KEY")?.trim();
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  try {
    // Rate limiting for POST/DELETE
    if (req.method === "POST" || req.method === "DELETE") {
      const clientKey = getClientKey(req);
      const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
        "check_rate_limit",
        {
          p_client_key: `${clientKey}:admin-documents`,
          p_endpoint: "documents-admin",
          p_max_requests: ADMIN_RATE_LIMIT.maxRequests,
          p_window_seconds: ADMIN_RATE_LIMIT.windowSeconds,
        }
      );

      if (!rateLimitError && rateLimitResult?.length > 0 && !rateLimitResult[0].allowed) {
        const resetIn = rateLimitResult[0].reset_in || ADMIN_RATE_LIMIT.windowSeconds;
        return new Response(
          JSON.stringify({ error: `Muitas tentativas. Tente em ${Math.ceil(resetIn / 60)} min.`, retryAfter: resetIn }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(resetIn) } }
        );
      }
    }

    // =============================================
    // POST /documents/process-job - WORKER for incremental processing
    // =============================================
    if (req.method === "POST" && lastPart === "process-job") {
      const adminKey = (req.headers.get("x-admin-key") || "").trim();
      if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[documents] Processing next pending job...");

      // 1. Find next pending job
      const { data: job, error: jobError } = await supabase
        .from("document_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .single();

      if (jobError || !job) {
        return new Response(
          JSON.stringify({ message: "Nenhum job pendente", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[documents] Found job ${job.id} for document ${job.document_id}, pages ${job.next_page}-${job.total_pages}`);

      // 2. Update status to processing
      await supabase.from("document_jobs").update({ status: "processing" }).eq("id", job.id);

      try {
        // 3. Get document info
        const { data: document, error: docError } = await supabase
          .from("documents")
          .select("id, file_path, content_text")
          .eq("id", job.document_id)
          .single();

        if (docError || !document) {
          throw new Error("Documento não encontrado");
        }

        // 4. Download PDF from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("knowledge-base")
          .download(document.file_path);

        if (downloadError || !fileData) {
          throw new Error(`Falha ao baixar arquivo: ${downloadError?.message}`);
        }

        // 5. Extract next batch of pages
        const endPage = Math.min(job.next_page + job.pages_per_batch - 1, job.total_pages);
        const { pages } = await extractPdfTextDeterministic(fileData, job.next_page, endPage);

        // 6. Append text to document
        const newText = pages.join("\n\n--- Página ---\n\n");
        const updatedText = (document.content_text || "") + "\n\n--- Página ---\n\n" + newText;
        
        await supabase
          .from("documents")
          .update({ content_text: updatedText, updated_at: new Date().toISOString() })
          .eq("id", job.document_id);

        // 7. Check if completed
        if (endPage >= job.total_pages) {
          // Job completed - process chunks and embeddings
          await supabase.from("document_jobs").update({ 
            status: "completed", 
            next_page: endPage + 1 
          }).eq("id", job.id);

          console.log(`[documents] Job ${job.id} completed. Processing chunks...`);
          
          // Get final document text
          const { data: finalDoc } = await supabase
            .from("documents")
            .select("content_text")
            .eq("id", job.document_id)
            .single();

          if (finalDoc?.content_text) {
            await processChunksAndEmbeddings(supabase, job.document_id, finalDoc.content_text, GEMINI_API_KEY);
          }

          return new Response(
            JSON.stringify({ 
              status: "completed",
              jobId: job.id,
              documentId: job.document_id,
              processed: endPage - job.next_page + 1,
              remaining: 0
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // More pages to process - update job for next iteration
          await supabase.from("document_jobs").update({ 
            status: "pending", 
            next_page: endPage + 1 
          }).eq("id", job.id);

          return new Response(
            JSON.stringify({ 
              status: "processing",
              jobId: job.id,
              documentId: job.document_id,
              processed: endPage - job.next_page + 1,
              remaining: job.total_pages - endPage,
              nextPage: endPage + 1
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (jobProcessError) {
        console.error("[documents] Job processing error:", jobProcessError);
        
        await supabase.from("document_jobs").update({ 
          status: "failed", 
          error: jobProcessError instanceof Error ? jobProcessError.message : String(jobProcessError)
        }).eq("id", job.id);

        return new Response(
          JSON.stringify({ 
            error: "Erro ao processar job",
            details: jobProcessError instanceof Error ? jobProcessError.message : String(jobProcessError)
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // =============================================
    // GET /documents/job-status/:documentId - Check job status
    // =============================================
    if (req.method === "GET" && pathParts.includes("job-status")) {
      const adminKey = (req.headers.get("x-admin-key") || "").trim();
      if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const documentId = lastPart;
      
      const { data: job, error } = await supabase
        .from("document_jobs")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !job) {
        return new Response(
          JSON.stringify({ status: "not_found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const progress = job.total_pages ? Math.round((job.next_page / job.total_pages) * 100) : 0;

      return new Response(
        JSON.stringify({
          status: job.status,
          progress,
          nextPage: job.next_page,
          totalPages: job.total_pages,
          error: job.error
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // GET /documents - List all documents
    // =============================================
    if (req.method === "GET" && (!lastPart || lastPart === "documents")) {
      const adminKey = (req.headers.get("x-admin-key") || "").trim();
      if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, title, category, file_path, created_at, updated_at")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Count chunks per document
      const { data: chunkCounts } = await supabase.from("document_chunks").select("document_id");
      
      const countMap = new Map<string, number>();
      chunkCounts?.forEach(c => {
        countMap.set(c.document_id, (countMap.get(c.document_id) || 0) + 1);
      });

      // Get job status for documents
      const { data: jobs } = await supabase
        .from("document_jobs")
        .select("document_id, status, next_page, total_pages")
        .in("status", ["pending", "processing"]);

      const jobMap = new Map<string, any>();
      jobs?.forEach(j => jobMap.set(j.document_id, j));
      
      const documentsWithInfo = documents?.map(doc => ({
        ...doc,
        chunk_count: countMap.get(doc.id) || 0,
        processing_status: jobMap.get(doc.id)?.status || null,
        processing_progress: jobMap.get(doc.id) 
          ? Math.round((jobMap.get(doc.id).next_page / jobMap.get(doc.id).total_pages) * 100) 
          : null
      }));
      
      return new Response(
        JSON.stringify({ documents: documentsWithInfo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // POST /documents - Process document from Storage
    // =============================================
    if (req.method === "POST" && lastPart !== "process-job") {
      const adminKey = (req.headers.get("x-admin-key") || "").trim();
      if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const body = await req.json();
      const { filePath, title, category, fileType, originalName } = body;
      
      console.log(`[documents] ========== PROCESSING REQUEST ==========`);
      console.log(`[documents] filePath: ${filePath}`);
      console.log(`[documents] title: ${title}`);
      
      if (!filePath) {
        return new Response(
          JSON.stringify({ error: "filePath é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Download file from Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("knowledge-base")
        .download(filePath);
      
      if (downloadError || !fileData) {
        return new Response(
          JSON.stringify({ error: "Arquivo não encontrado no Storage", details: downloadError?.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[documents] Downloaded: ${Math.round(fileData.size / 1024)}KB`);
      
      const isPDF = filePath.endsWith(".pdf") || fileType?.includes("pdf");
      const isDOCX = filePath.endsWith(".docx") || fileType?.includes("wordprocessingml");
      const isTXT = filePath.endsWith(".txt") || fileType?.includes("text/plain");
      
      let contentText: string;
      
      if (isTXT) {
        contentText = await fileData.text();
        console.log(`[documents] TXT extracted: ${contentText.length} chars`);
      } else if (isPDF) {
        console.log(`[documents] ========== DETERMINISTIC PDF EXTRACTION ==========`);
        
        try {
          // Extract first batch of pages deterministically
          const { pages, totalPages } = await extractPdfTextDeterministic(fileData, 1, PAGES_PER_BATCH);
          const partialText = pages.join("\n\n--- Página ---\n\n");
          
          console.log(`[documents] Extracted ${pages.length} pages, total: ${totalPages}`);
          
          // Check if extraction returned minimal text (might be scanned PDF)
          const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
          
          if (totalChars < 100 && totalPages > 0 && LOVABLE_API_KEY) {
            // Fallback to OCR for scanned PDFs
            console.log(`[documents] Low text content (${totalChars} chars), trying OCR fallback...`);
            
            try {
              contentText = await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY);
            } catch (ocrError) {
              console.error("[documents] OCR fallback failed:", ocrError);
              contentText = partialText; // Use what we got
            }
          } else {
            contentText = partialText;
          }
          
          // Create document in database
          const { data: document, error: docError } = await supabase
            .from("documents")
            .insert({
              title: title || originalName || "Documento sem título",
              category: category || "manual",
              file_path: filePath,
              content_text: contentText
            })
            .select()
            .single();
          
          if (docError) throw docError;
          
          console.log(`[documents] Document created: ${document.id}`);
          
          // If PDF has more pages, create background job
          if (totalPages > PAGES_PER_BATCH) {
            console.log(`[documents] Creating background job for ${totalPages - PAGES_PER_BATCH} remaining pages...`);
            
            const { error: jobError } = await supabase
              .from("document_jobs")
              .insert({
                document_id: document.id,
                status: "pending",
                next_page: PAGES_PER_BATCH + 1,
                total_pages: totalPages,
                pages_per_batch: PAGES_PER_BATCH
              });
            
            if (jobError) {
              console.error("[documents] Error creating job:", jobError);
            }
            
            return new Response(
              JSON.stringify({
                success: true,
                status: "processing",
                message: `Documento criado. Processando ${totalPages} páginas em background...`,
                document: {
                  id: document.id,
                  title: document.title,
                  category: document.category,
                  totalPages,
                  processedPages: PAGES_PER_BATCH
                }
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Small PDF - process chunks immediately
          const { chunksCount, warning } = await processChunksAndEmbeddings(
            supabase, document.id, contentText, GEMINI_API_KEY
          );
          
          return new Response(
            JSON.stringify({
              success: true,
              status: "completed",
              warning,
              document: {
                id: document.id,
                title: document.title,
                category: document.category,
                chunk_count: chunksCount
              }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
          
        } catch (pdfError) {
          console.error("[documents] PDF extraction failed:", pdfError);
          
          // Try OCR as last resort
          if (LOVABLE_API_KEY && fileData.size < 20 * 1024 * 1024) {
            console.log("[documents] Trying OCR fallback...");
            try {
              contentText = await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY);
            } catch (ocrError) {
              return new Response(
                JSON.stringify({ 
                  error: "Falha ao processar PDF",
                  details: pdfError instanceof Error ? pdfError.message : String(pdfError),
                  ocrError: ocrError instanceof Error ? ocrError.message : String(ocrError)
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            return new Response(
              JSON.stringify({ 
                error: "Falha ao processar PDF",
                details: pdfError instanceof Error ? pdfError.message : String(pdfError)
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } else if (isDOCX) {
        try {
          const arrayBuffer = await fileData.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          contentText = result.value;
          console.log(`[documents] DOCX extracted: ${contentText.length} chars`);
        } catch (docxError) {
          return new Response(
            JSON.stringify({ error: "Erro ao processar DOCX" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Tipo de arquivo não suportado. Use PDF, DOCX ou TXT." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // For non-PDF files (TXT, DOCX) - standard processing
      if (!isPDF) {
        if (!contentText || contentText.trim().length < 100) {
          return new Response(
            JSON.stringify({ error: "Conteúdo muito curto ou vazio" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const { data: document, error: docError } = await supabase
          .from("documents")
          .insert({
            title: title || originalName || "Documento sem título",
            category: category || "manual",
            file_path: filePath,
            content_text: contentText
          })
          .select()
          .single();
        
        if (docError) throw docError;
        
        const { chunksCount, warning } = await processChunksAndEmbeddings(
          supabase, document.id, contentText, GEMINI_API_KEY
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            status: "completed",
            warning,
            document: {
              id: document.id,
              title: document.title,
              category: document.category,
              chunk_count: chunksCount
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // =============================================
    // DELETE /documents/:id - Remove document
    // =============================================
    if (req.method === "DELETE") {
      const adminKey = (req.headers.get("x-admin-key") || "").trim();
      if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let docId = lastPart && lastPart !== "documents" ? lastPart : null;
      
      if (!docId) {
        try {
          const body = await req.json();
          docId = body.id;
        } catch { /* ignore */ }
      }
      
      if (!docId) {
        return new Response(
          JSON.stringify({ error: "ID do documento obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data: document, error: fetchError } = await supabase
        .from("documents")
        .select("id, file_path")
        .eq("id", docId)
        .single();
      
      if (fetchError || !document) {
        return new Response(
          JSON.stringify({ error: "Documento não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Remove related jobs
      await supabase.from("document_jobs").delete().eq("document_id", docId);
      
      // Remove chunks
      await supabase.from("document_chunks").delete().eq("document_id", docId);
      
      // Remove file from storage
      if (document.file_path) {
        await supabase.storage.from("knowledge-base").remove([document.file_path]);
      }
      
      // Remove document
      const { error: deleteError } = await supabase.from("documents").delete().eq("id", docId);
      
      if (deleteError) throw deleteError;
      
      return new Response(
        JSON.stringify({ success: true, deleted: docId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in documents function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
