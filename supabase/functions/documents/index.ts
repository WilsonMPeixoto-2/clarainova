// Import map: ../import_map.json (used during Supabase deploy)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
// @ts-ignore - mammoth for DOCX parsing
import mammoth from "https://esm.sh/mammoth@1.6.0";
// @ts-ignore - pdfjs-serverless for deterministic PDF extraction
import { getDocument } from "https://esm.sh/pdfjs-serverless@1.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// =============================================
// OBSERVABILITY TYPES AND LIMITS
// =============================================
interface DebugTimings {
  total_ms: number;
  download_storage_ms?: number;
  extract_ms?: number;
  chunk_ms?: number;
  embed_ms?: number;
  db_insert_ms?: number;
  [key: string]: number | undefined;
}

interface ProviderDebug {
  name: string;
  http_status?: number;
  error_body_trunc?: string;
  elapsed_ms: number;
}

interface DebugInfo {
  request_id: string;
  timings: DebugTimings;
  provider?: ProviderDebug;
  steps_completed: string[];
  steps_failed: string[];
}

// Clear size limits for base64/LLM operations
const LIMITS = {
  MAX_BASE64_OCR_MB: 4,       // 4MB PDF → ~5.3MB base64
  MAX_LLM_PAYLOAD_MB: 15,     // Hard limit for any LLM operation
  LARGE_PDF_THRESHOLD_MB: 20, // Warning for large PDFs
};

// Lovable AI Gateway URL (only for OCR fallback now)
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const AI_TIMEOUT_MS = 120_000;
const PAGES_PER_BATCH = 10;

function safeJsonStringify(x: unknown): string {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function truncateErrorBody(body: string, maxLen = 2048): string {
  if (!body) return "";
  return body.length > maxLen ? body.slice(0, maxLen) + "...[truncated]" : body;
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
  const arrayBuffer = await fileData.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const doc = await getDocument({ data }).promise;
  const totalPages = doc.numPages;
  const actualEndPage = Math.min(endPage || totalPages, totalPages);
  
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
    } catch (pageError) {
      console.error(`[documents] Error extracting page ${i}:`, pageError);
      pages.push("");
    }
  }
  
  return { pages, totalPages };
}

// =============================================
// LLM FALLBACK FOR OCR (scanned PDFs)
// =============================================
async function extractPdfViaLovableAIBase64(
  fileBlob: Blob,
  lovableApiKey: string,
  requestId: string,
  debug: DebugInfo
): Promise<string> {
  const sizeMB = fileBlob.size / (1024 * 1024);
  
  // Hard block for PDFs too large for LLM
  if (sizeMB > LIMITS.MAX_LLM_PAYLOAD_MB) {
    const errorMsg = `PDF muito grande para OCR (${sizeMB.toFixed(1)}MB). Limite: ${LIMITS.MAX_LLM_PAYLOAD_MB}MB. Use um PDF com texto selecionável ou divida em partes menores.`;
    console.error(`[${requestId}] ✗ ocr_fallback: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  // Warning for PDFs near the limit
  if (sizeMB > LIMITS.MAX_BASE64_OCR_MB) {
    console.warn(`[${requestId}] ⚠️ PDF grande para OCR: ${sizeMB.toFixed(1)}MB. Pode causar timeout ou erro de memória.`);
  }

  console.log(`[${requestId}] OCR FALLBACK: Attempting PDF extraction via Lovable AI (${sizeMB.toFixed(1)}MB)...`);

  const startTime = Date.now();
  const base64Data = await blobToBase64(fileBlob);
  const dataUrl = `data:application/pdf;base64,${base64Data}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(LOVABLE_AI_URL, {
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
  } finally {
    clearTimeout(timeoutId);
  }

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(no body)");
    debug.provider = {
      name: "lovable-ai",
      http_status: response.status,
      error_body_trunc: truncateErrorBody(errorText),
      elapsed_ms: elapsed,
    };
    throw new Error(`LovableAI HTTP ${response.status}: ${truncateErrorBody(errorText, 500)}`);
  }

  const data = await response.json();
  const extractedText = data.choices?.[0]?.message?.content || "";

  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error("Texto extraído via Lovable AI muito curto");
  }

  debug.provider = {
    name: "lovable-ai",
    http_status: 200,
    elapsed_ms: elapsed,
  };

  console.log(`[${requestId}] ✓ ocr_fallback: ${extractedText.length} chars via Lovable AI in ${elapsed}ms`);
  return extractedText;
}

// =============================================
// CHUNKING - Standardized policy for performance and quality
// =============================================
const CHUNK_SIZE = 4000;      // ~1000 tokens
const CHUNK_OVERLAP = 400;    // 10% overlap for context preservation

// Simple hash for idempotency
async function computeContentHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// Normalize text for better chunking
function normalizeText(text: string): string {
  return text
    // Remove repeated headers/footers (common in PDFs)
    .replace(/(\n.{0,50}\n)\1+/g, '$1')
    // Normalize multiple newlines
    .replace(/\n{4,}/g, '\n\n\n')
    // Fix broken hyphenation
    .replace(/(\w)-\n(\w)/g, '$1$2')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Detect section anchors for better metadata
function detectSectionAnchor(text: string): { title: string | null; level: number } {
  const lines = text.split('\n').slice(0, 3);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 150) continue;
    
    // Markdown headers
    const mdMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (mdMatch) {
      return { title: mdMatch[2], level: mdMatch[1].length };
    }
    
    // ALL CAPS titles (common in legal docs)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 5 && trimmed.length < 100 && /[A-Z]/.test(trimmed)) {
      return { title: trimmed, level: 1 };
    }
    
    // Numbered sections (1. Title, Art. 1º, etc)
    const numMatch = trimmed.match(/^(Art\.?\s*\d+[°º]?|Artigo\s+\d+|\d+\.\s+|[IVX]+\s*[-–.]\s*)(.{5,100})/i);
    if (numMatch) {
      return { title: numMatch[0], level: 2 };
    }
  }
  
  return { title: null, level: 0 };
}

function splitIntoChunks(text: string): { content: string; metadata: Record<string, any> }[] {
  const normalizedText = normalizeText(text);
  const chunks: { content: string; metadata: Record<string, any> }[] = [];
  let start = 0;
  let chunkIndex = 0;
  
  while (start < normalizedText.length) {
    let end = start + CHUNK_SIZE;
    
    if (end < normalizedText.length) {
      // Try to break at semantic boundaries
      const searchWindow = normalizedText.slice(start + CHUNK_SIZE / 2, end);
      
      // Priority: section break > double newline > sentence end
      const sectionBreak = searchWindow.lastIndexOf('\n\n\n');
      if (sectionBreak > 0) {
        end = start + CHUNK_SIZE / 2 + sectionBreak + 3;
      } else {
        const doubleNewline = searchWindow.lastIndexOf('\n\n');
        if (doubleNewline > 0) {
          end = start + CHUNK_SIZE / 2 + doubleNewline + 2;
        } else {
          const period = searchWindow.lastIndexOf('. ');
          if (period > 0) {
            end = start + CHUNK_SIZE / 2 + period + 2;
          }
        }
      }
    }
    
    const content = normalizedText.slice(start, end).trim();
    if (content.length > 50) {
      const anchor = detectSectionAnchor(content);
      
      chunks.push({
        content,
        metadata: {
          chunk_index: chunkIndex,
          char_count: content.length,
          word_count: content.split(/\s+/).length,
          section_title: anchor.title,
          section_level: anchor.level,
          start_offset: start,
          end_offset: Math.min(end, normalizedText.length)
        }
      });
      chunkIndex++;
    }
    
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    if (start >= normalizedText.length) break;
  }
  
  return chunks;
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

/**
 * Parse admin keys from environment.
 * Supports multiple keys via ADMIN_KEYS (comma-separated) with fallback to ADMIN_KEY.
 * This allows key rotation without downtime.
 */
function parseAdminKeys(): string[] {
  // Try ADMIN_KEYS first (multiple keys, comma-separated)
  const adminKeys = Deno.env.get("ADMIN_KEYS");
  if (adminKeys) {
    const keys = adminKeys
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    if (keys.length > 0) {
      return keys;
    }
  }
  
  // Fallback to single ADMIN_KEY
  const adminKey = Deno.env.get("ADMIN_KEY");
  if (adminKey && adminKey.trim().length > 0) {
    return [adminKey.trim()];
  }
  
  return [];
}

/**
 * Validate admin key from request headers.
 * Returns true if key is valid.
 */
function validateAdminKey(req: Request): boolean {
  const providedKey = (req.headers.get("x-admin-key") || "").trim();
  if (!providedKey) return false;
  
  const validKeys = parseAdminKeys();
  if (validKeys.length === 0) return false;
  
  return validKeys.includes(providedKey);
}

// =============================================
// PROCESS CHUNKS AND EMBEDDINGS (Idempotent)
// =============================================
async function processChunksAndEmbeddings(
  supabase: any,
  documentId: string,
  contentText: string,
  geminiApiKey: string | undefined,
  requestId: string,
  debug: DebugInfo
): Promise<{ chunksCount: number; warning: string | null; contentHash: string }> {
  // Compute content hash for idempotency check
  const contentHash = await computeContentHash(contentText);
  console.log(`[${requestId}] Content hash: ${contentHash}`);
  
  const chunkStart = Date.now();
  const chunks = splitIntoChunks(contentText);
  debug.timings.chunk_ms = Date.now() - chunkStart;
  debug.steps_completed.push("chunk");
  console.log(`[${requestId}] ✓ chunk: ${chunks.length} chunks in ${debug.timings.chunk_ms}ms`);
  
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
  const embedStart = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const { content, metadata } = chunks[i];
    const chunkHash = await computeContentHash(content);

    let embeddingJson: string | null = null;
    if (!embeddingsDisabled && embeddingModel) {
      try {
        const embeddingResult = await withTimeout<any>(
          embeddingModel.embedContent(content) as Promise<any>,
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
        
        debug.provider = {
          name: "gemini-embedding",
          http_status: isRateLimitError(e) ? 429 : 500,
          error_body_trunc: truncateErrorBody(msg),
          elapsed_ms: Date.now() - embedStart,
        };
        
        console.error(`[${requestId}] ✗ embed: ${msg}`);
        debug.steps_failed.push("embed");
      }
    }

    chunkRecords.push({
      document_id: documentId,
      content,
      chunk_index: i,
      embedding: embeddingJson,
      metadata,
      content_hash: chunkHash,
    });

    // Rate limit embeddings
    if (!embeddingsDisabled && i % 5 === 0 && i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  if (!embeddingsDisabled) {
    debug.timings.embed_ms = Date.now() - embedStart;
    debug.steps_completed.push("embed");
    console.log(`[${requestId}] ✓ embed: ${chunks.length} embeddings in ${debug.timings.embed_ms}ms`);
  }
  
  // IDEMPOTENT: Delete existing chunks then insert new ones (transactional behavior)
  const dbInsertStart = Date.now();
  
  // Delete old chunks first
  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);
  
  if (deleteError) {
    console.warn(`[${requestId}] ⚠ delete_old_chunks: ${deleteError.message}`);
  } else {
    console.log(`[${requestId}] ✓ delete_old_chunks: Cleared previous chunks`);
  }
  
  // Insert new chunks in batches
  const batchSize = 50;
  for (let i = 0; i < chunkRecords.length; i += batchSize) {
    const batch = chunkRecords.slice(i, i + batchSize);
    const { error: chunksError } = await supabase
      .from("document_chunks")
      .insert(batch);
    
    if (chunksError) {
      console.error(`[${requestId}] ✗ db_insert: ${chunksError.message}`);
      debug.steps_failed.push("db_insert");
      throw chunksError;
    }
  }
  
  // Fetch current version for atomic increment
  const { data: currentDoc } = await supabase
    .from("documents")
    .select("version")
    .eq("id", documentId)
    .single();

  const nextVersion = (currentDoc?.version || 0) + 1;

  // Update document metadata
  await supabase
    .from("documents")
    .update({
      content_hash: contentHash,
      chunk_count: chunks.length,
      processed_at: new Date().toISOString(),
      version: nextVersion
    })
    .eq("id", documentId);
  
  debug.timings.db_insert_ms = Date.now() - dbInsertStart;
  debug.steps_completed.push("db_insert");
  console.log(`[${requestId}] ✓ db_insert: ${chunks.length} chunks in ${debug.timings.db_insert_ms}ms (idempotent)`);
  
  return { chunksCount: chunks.length, warning: embeddingsWarning, contentHash };
}

// =============================================
// HELPER: Create debug response
// =============================================
function createDebugResponse(
  success: boolean,
  status: number,
  data: Record<string, any>,
  debug: DebugInfo,
  startTime: number
): Response {
  debug.timings.total_ms = Date.now() - startTime;
  
  return new Response(
    JSON.stringify({
      ...data,
      success,
      debug: {
        request_id: debug.request_id,
        timings: debug.timings,
        provider: debug.provider,
        steps_completed: debug.steps_completed,
        steps_failed: debug.steps_failed,
      },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // =============================================
  // OBSERVABILITY: Generate correlation ID
  // =============================================
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const debug: DebugInfo = {
    request_id: requestId,
    timings: { total_ms: 0 },
    steps_completed: [],
    steps_failed: [],
  };

  console.log(`\n[${requestId}] ========== NEW REQUEST ==========`);
  console.log(`[${requestId}] Method: ${req.method}, URL: ${req.url}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // GEMINI_API_KEY for embeddings, LOVABLE_API_KEY for OCR fallback
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  try {
    // Rate limiting for POST/DELETE - exclude worker endpoints from rate limiting
    const isWorkerEndpoint = lastPart === "process-job" || lastPart === "ingest-batch";
    
    if ((req.method === "POST" || req.method === "DELETE") && !isWorkerEndpoint) {
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
        return createDebugResponse(false, 429, {
          error: `Muitas tentativas. Tente em ${Math.ceil(resetIn / 60)} min.`,
          retryAfter: resetIn,
        }, debug, startTime);
      }
    }

    // =============================================
    // POST /documents/process-job - WORKER for incremental processing
    // =============================================
    if (req.method === "POST" && lastPart === "process-job") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      console.log(`[${requestId}] Processing next pending job...`);

      // 1. Find next pending job
      const { data: job, error: jobError } = await supabase
        .from("document_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .single();

      if (jobError || !job) {
        return createDebugResponse(true, 200, { 
          message: "Nenhum job pendente", 
          processed: 0 
        }, debug, startTime);
      }

      console.log(`[${requestId}] Found job ${job.id} for document ${job.document_id}`);

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
        const downloadStart = Date.now();
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("knowledge-base")
          .download(document.file_path);

        if (downloadError || !fileData) {
          throw new Error(`Falha ao baixar arquivo: ${downloadError?.message}`);
        }
        debug.timings.download_storage_ms = Date.now() - downloadStart;
        debug.steps_completed.push("download_storage");
        console.log(`[${requestId}] ✓ download_storage: ${debug.timings.download_storage_ms}ms`);

        // 5. Extract next batch of pages
        const extractStart = Date.now();
        const endPage = Math.min(job.next_page + job.pages_per_batch - 1, job.total_pages);
        const { pages } = await extractPdfTextDeterministic(fileData, job.next_page, endPage);
        debug.timings.extract_ms = Date.now() - extractStart;
        debug.steps_completed.push("extract");
        console.log(`[${requestId}] ✓ extract: pages ${job.next_page}-${endPage} in ${debug.timings.extract_ms}ms`);

        // 6. Append text to document
        const newText = pages.join("\n\n--- Página ---\n\n");
        const updatedText = (document.content_text || "") + "\n\n--- Página ---\n\n" + newText;
        
        await supabase
          .from("documents")
          .update({ content_text: updatedText, updated_at: new Date().toISOString() })
          .eq("id", job.document_id);

        // 7. Check if completed
        if (endPage >= job.total_pages) {
          await supabase.from("document_jobs").update({ 
            status: "completed", 
            next_page: endPage + 1 
          }).eq("id", job.id);

          // Update document status to ready
          await supabase
            .from("documents")
            .update({ status: "ready" })
            .eq("id", job.document_id);

          console.log(`[${requestId}] Job completed. Processing chunks...`);
          
          const { data: finalDoc } = await supabase
            .from("documents")
            .select("content_text")
            .eq("id", job.document_id)
            .single();

          if (finalDoc?.content_text) {
            await processChunksAndEmbeddings(supabase, job.document_id, finalDoc.content_text, GEMINI_API_KEY, requestId, debug);
          }

          return createDebugResponse(true, 200, {
            status: "completed",
            jobId: job.id,
            documentId: job.document_id,
            processed: endPage - job.next_page + 1,
            remaining: 0
          }, debug, startTime);
        } else {
          await supabase.from("document_jobs").update({ 
            status: "pending", 
            next_page: endPage + 1 
          }).eq("id", job.id);

          return createDebugResponse(true, 200, {
            status: "processing",
            jobId: job.id,
            documentId: job.document_id,
            processed: endPage - job.next_page + 1,
            remaining: job.total_pages - endPage,
            nextPage: endPage + 1
          }, debug, startTime);
        }
      } catch (jobProcessError) {
        console.error(`[${requestId}] ✗ job_process: ${jobProcessError}`);
        debug.steps_failed.push("job_process");
        
        const errorMsg = jobProcessError instanceof Error ? jobProcessError.message : String(jobProcessError);
        
        await supabase.from("document_jobs").update({ 
          status: "failed", 
          error: errorMsg
        }).eq("id", job.id);

        // Update document status to failed
        await supabase
          .from("documents")
          .update({ status: "failed", error_reason: errorMsg })
          .eq("id", job.document_id);

        return createDebugResponse(false, 500, {
          error: "Erro ao processar job",
          details: errorMsg
        }, debug, startTime);
      }
    }

    // =============================================
    // GET /documents/job-status/:documentId - Check job status
    // =============================================
    if (req.method === "GET" && pathParts.includes("job-status")) {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
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
        return createDebugResponse(true, 200, { status: "not_found" }, debug, startTime);
      }

      const progress = job.total_pages ? Math.round((job.next_page / job.total_pages) * 100) : 0;

      return createDebugResponse(true, 200, {
        status: job.status,
        progress,
        nextPage: job.next_page,
        totalPages: job.total_pages,
        error: job.error
      }, debug, startTime);
    }

    // =============================================
    // GET /documents - List all documents
    // =============================================
    if (req.method === "GET" && (!lastPart || lastPart === "documents")) {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }
      
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, title, category, file_path, created_at, updated_at, status, error_reason")
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
      
      return createDebugResponse(true, 200, { documents: documentsWithInfo }, debug, startTime);
    }

    // =============================================
    // GET /documents/download/:documentId - Get signed download URL
    // =============================================
    if (req.method === "GET" && pathParts.includes("download")) {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      const documentId = lastPart;
      console.log(`[${requestId}] DOWNLOAD: Generating signed URL for document ${documentId}`);

      // Get document file path
      const { data: document, error: docError } = await supabase
        .from("documents")
        .select("id, title, file_path")
        .eq("id", documentId)
        .single();

      if (docError || !document || !document.file_path) {
        return createDebugResponse(false, 404, { 
          error: "Documento não encontrado ou sem arquivo" 
        }, debug, startTime);
      }

      // Generate signed URL with 15 minutes expiration
      const DOWNLOAD_URL_EXPIRATION_SECONDS = 15 * 60; // 15 minutes
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("knowledge-base")
        .createSignedUrl(document.file_path, DOWNLOAD_URL_EXPIRATION_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(`[${requestId}] ✗ signed_url: ${signedUrlError?.message}`);
        return createDebugResponse(false, 500, { 
          error: "Falha ao gerar URL de download" 
        }, debug, startTime);
      }

      // Log document access
      const clientIp = getClientKey(req);
      await supabase.rpc("log_document_access", {
        p_document_id: documentId,
        p_access_type: "download",
        p_ip_address: clientIp,
        p_user_agent: req.headers.get("user-agent") || "unknown"
      });

      debug.steps_completed.push("signed_url");
      console.log(`[${requestId}] ✓ signed_url: Generated for ${document.title}`);

      const expiresAt = new Date(Date.now() + DOWNLOAD_URL_EXPIRATION_SECONDS * 1000).toISOString();

      return createDebugResponse(true, 200, {
        signedUrl: signedUrlData.signedUrl,
        expiresAt,
        expiresInSeconds: DOWNLOAD_URL_EXPIRATION_SECONDS,
        document: {
          id: document.id,
          title: document.title,
          filePath: document.file_path
        }
      }, debug, startTime);
    }

    // =============================================
    // POST /documents/ingest-start - Start a batch ingestion session
    // =============================================
    if (req.method === "POST" && lastPart === "ingest-start") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      const body = await req.json();
      const { title, category, filePath, metadata } = body;

      console.log(`[${requestId}] INGEST-START: title="${title}", totalPages=${metadata?.totalPages || '?'}`);

      // Create document record with status 'ingesting'
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          title: title || metadata?.originalFilename || "Documento sem título",
          category: category || "manual",
          file_path: filePath || null,
          content_text: "",
          status: "ingesting"
        })
        .select()
        .single();

      if (docError) throw docError;

      debug.steps_completed.push("db_insert");
      console.log(`[${requestId}] ✓ db_insert: Document ${document.id} created with status=ingesting`);

      return createDebugResponse(true, 200, {
        status: "ingesting",
        documentId: document.id,
        document: { id: document.id, title: document.title }
      }, debug, startTime);
    }

    // =============================================
    // POST /documents/ingest-batch - Append batch of text to document (idempotent)
    // =============================================
    if (req.method === "POST" && lastPart === "ingest-batch") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      const body = await req.json();
      const { documentId, batchText, batchIndex, totalBatches } = body;

      if (!documentId || batchText === undefined || batchIndex === undefined) {
        return createDebugResponse(false, 400, { 
          error: "documentId, batchText e batchIndex são obrigatórios" 
        }, debug, startTime);
      }

      // Compute hash for idempotency check
      const encoder = new TextEncoder();
      const data = encoder.encode(batchText);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const batchHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

      console.log(`[${requestId}] INGEST-BATCH: doc=${documentId}, batch=${batchIndex}/${totalBatches}, chars=${batchText.length}, hash=${batchHash}`);

      // Check idempotency via RPC
      const { data: idempotencyResult, error: idempotencyError } = await supabase.rpc(
        "record_batch_processed",
        {
          p_document_id: documentId,
          p_batch_index: batchIndex,
          p_batch_hash: batchHash
        }
      );

      if (idempotencyError) {
        console.warn(`[${requestId}] ⚠ idempotency_check: ${idempotencyError.message}`);
      } else if (idempotencyResult?.[0]?.is_duplicate) {
        console.log(`[${requestId}] ⏭ batch_skip: Batch ${batchIndex} already processed (same hash)`);
        return createDebugResponse(true, 200, {
          status: "batch_skipped",
          reason: "idempotent",
          documentId,
          batchIndex,
          message: "Batch já processado com mesmo conteúdo"
        }, debug, startTime);
      }

      // Get current document
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("content_text, status")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        return createDebugResponse(false, 404, { error: "Documento não encontrado" }, debug, startTime);
      }

      if (doc.status !== "ingesting") {
        return createDebugResponse(false, 400, { 
          error: `Documento não está em modo de ingestão (status: ${doc.status})` 
        }, debug, startTime);
      }

      // Append batch text
      const updatedText = (doc.content_text || "") + batchText;
      
      await supabase
        .from("documents")
        .update({ 
          content_text: updatedText, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", documentId);

      debug.steps_completed.push("batch_append");

      return createDebugResponse(true, 200, {
        status: "batch_received",
        documentId,
        batchIndex,
        totalBatches,
        totalChars: updatedText.length,
        batchHash
      }, debug, startTime);
    }

    // =============================================
    // GET /documents/resume/:documentId - Get resume point for interrupted ingestion
    // =============================================
    if (req.method === "GET" && pathParts.includes("resume")) {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      const documentId = lastPart;
      console.log(`[${requestId}] RESUME: Checking resume point for document ${documentId}`);

      // Get resume point via RPC
      const { data: resumeData, error: resumeError } = await supabase.rpc(
        "get_ingestion_resume_point",
        { p_document_id: documentId }
      );

      if (resumeError) {
        return createDebugResponse(false, 500, { 
          error: `Falha ao verificar ponto de retomada: ${resumeError.message}` 
        }, debug, startTime);
      }

      const result = resumeData?.[0] || { resume_from_batch: 0, total_batches_recorded: 0, job_status: 'not_started' };

      // Also get document status
      const { data: doc } = await supabase
        .from("documents")
        .select("id, title, status, content_text")
        .eq("id", documentId)
        .single();

      const contentLength = doc?.content_text?.length || 0;

      return createDebugResponse(true, 200, {
        documentId,
        resumeFromBatch: result.resume_from_batch,
        totalBatchesRecorded: result.total_batches_recorded,
        lastHash: result.last_hash,
        jobStatus: result.job_status,
        documentStatus: doc?.status || 'not_found',
        currentContentLength: contentLength,
        canResume: result.job_status === 'processing' || doc?.status === 'ingesting'
      }, debug, startTime);
    }

    // =============================================
    // POST /documents/ingest-finish - Finalize ingestion and process chunks
    // =============================================
    if (req.method === "POST" && lastPart === "ingest-finish") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      const body = await req.json();
      const { documentId } = body;

      if (!documentId) {
        return createDebugResponse(false, 400, { error: "documentId é obrigatório" }, debug, startTime);
      }

      console.log(`[${requestId}] INGEST-FINISH: doc=${documentId}`);

      // Get document with full text
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("id, title, content_text, status")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        return createDebugResponse(false, 404, { error: "Documento não encontrado" }, debug, startTime);
      }

      if (!doc.content_text || doc.content_text.trim().length < 100) {
        await supabase
          .from("documents")
          .update({ status: "failed", error_reason: "Texto muito curto após ingestão" })
          .eq("id", documentId);

        return createDebugResponse(false, 400, { 
          error: "Texto muito curto. Mínimo 100 caracteres." 
        }, debug, startTime);
      }

      // Update status to processing
      await supabase
        .from("documents")
        .update({ status: "processing" })
        .eq("id", documentId);

      // Process chunks and embeddings
      const { chunksCount, warning } = await processChunksAndEmbeddings(
        supabase, documentId, doc.content_text, GEMINI_API_KEY, requestId, debug
      );

      // Determine final status based on embeddings
      const finalStatus = warning?.includes("Embeddings") ? "chunks_ok_embed_pending" : "ready";

      // Update document status
      await supabase
        .from("documents")
        .update({ status: finalStatus })
        .eq("id", documentId);

      return createDebugResponse(true, 200, {
        status: finalStatus,
        warning,
        document: { id: doc.id, title: doc.title, chunk_count: chunksCount }
      }, debug, startTime);
    }

    // =============================================
    // POST /documents/ingest-text - Receive pre-extracted text from client (backwards compatible)
    // =============================================
    if (req.method === "POST" && lastPart === "ingest-text") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      const body = await req.json();
      const { title, category, fullText, metadata, filePath } = body;

      if (!fullText || fullText.trim().length < 100) {
        return createDebugResponse(false, 400, { 
          error: "Texto muito curto. Mínimo 100 caracteres." 
        }, debug, startTime);
      }

      const charCount = fullText.length;
      const mbSize = (new TextEncoder().encode(fullText).length / (1024 * 1024)).toFixed(2);
      console.log(`[${requestId}] INGEST-TEXT: ${charCount} chars (~${mbSize}MB), ${metadata?.totalPages || '?'} pages`);

      // Build extraction_metadata from client metadata
      const extractionMetadata: Record<string, any> = {
        method: metadata?.extractionMethod || 'unknown',
        quality_score: metadata?.qualityScore ?? null,
        quality_issues: metadata?.qualityIssues || [],
        user_override: metadata?.userOverride || false,
        original_filename: metadata?.originalFilename || null,
        total_pages: metadata?.totalPages || null,
        extracted_at: metadata?.extractedAt || new Date().toISOString(),
        original_chars: charCount,
      };

      console.log(`[${requestId}] Extraction metadata:`, {
        method: extractionMetadata.method,
        quality_score: extractionMetadata.quality_score,
        user_override: extractionMetadata.user_override,
      });

      // Create document record with extraction_metadata
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          title: title || metadata?.originalFilename || "Documento sem título",
          category: category || "manual",
          file_path: filePath || null,
          content_text: fullText,
          status: "processing",
          extraction_metadata: extractionMetadata
        })
        .select()
        .single();

      if (docError) throw docError;

      debug.steps_completed.push("db_insert");
      console.log(`[${requestId}] ✓ db_insert: Document ${document.id}`);

      // Process chunks and embeddings
      const { chunksCount, warning } = await processChunksAndEmbeddings(
        supabase, document.id, fullText, GEMINI_API_KEY, requestId, debug
      );

      // Determine final status based on embeddings
      const finalStatus = warning?.includes("Embeddings") ? "chunks_ok_embed_pending" : "ready";

      // Update document status and final extraction metadata
      const finalMetadata = {
        ...extractionMetadata,
        final_chars: charCount,
        chunks_count: chunksCount,
        processing_completed_at: new Date().toISOString(),
      };

      await supabase
        .from("documents")
        .update({ 
          status: finalStatus,
          extraction_metadata: finalMetadata
        })
        .eq("id", document.id);

      return createDebugResponse(true, 200, {
        status: finalStatus,
        warning,
        document: { id: document.id, title: document.title, chunk_count: chunksCount },
        metrics: { charCount, mbSize: parseFloat(mbSize) }
      }, debug, startTime);
    }

    // =============================================
    // POST /documents/ocr-batch - OCR for scanned PDF pages
    // =============================================
    if (req.method === "POST" && lastPart === "ocr-batch") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      if (!LOVABLE_API_KEY) {
        return createDebugResponse(false, 500, { 
          error: "LOVABLE_API_KEY não configurada para OCR" 
        }, debug, startTime);
      }

      const body = await req.json();
      const { documentId, pageImages, appendToExisting } = body;

      if (!pageImages || !Array.isArray(pageImages) || pageImages.length === 0) {
        return createDebugResponse(false, 400, { 
          error: "pageImages é obrigatório (array de { pageNum, dataUrl })" 
        }, debug, startTime);
      }

      console.log(`[${requestId}] OCR-BATCH: ${pageImages.length} pages for document ${documentId || 'new'}`);

      const extractedTexts: Array<{ pageNum: number; text: string }> = [];
      const ocrStart = Date.now();

      for (const { pageNum, dataUrl } of pageImages) {
        const pageStart = Date.now();
        try {
          const response = await withTimeout(
            fetch(LOVABLE_AI_URL, {
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
                    { type: "text", text: "Extraia TODO o texto desta página. Responda APENAS com o texto extraído." }
                  ]
                }]
              }),
            }),
            60000,
            `OCR page ${pageNum}`
          );

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.error(`[${requestId}] OCR failed for page ${pageNum}: HTTP ${response.status}`);
            extractedTexts.push({ pageNum, text: `[Erro OCR página ${pageNum}]` });
            continue;
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          extractedTexts.push({ pageNum, text });
          console.log(`[${requestId}] ✓ OCR page ${pageNum}: ${text.length} chars in ${Date.now() - pageStart}ms`);
        } catch (ocrError) {
          console.error(`[${requestId}] OCR error page ${pageNum}:`, ocrError);
          extractedTexts.push({ pageNum, text: `[Erro OCR página ${pageNum}]` });
        }
      }

      debug.timings.extract_ms = Date.now() - ocrStart;
      debug.steps_completed.push("ocr_batch");

      // Sort by page number and combine
      extractedTexts.sort((a, b) => a.pageNum - b.pageNum);
      const combinedText = extractedTexts
        .map(({ pageNum, text }) => `--- Página ${pageNum} ---\n\n${text}`)
        .join('\n\n');

      // If documentId provided, append to existing document
      if (documentId) {
        const { data: doc, error: docError } = await supabase
          .from("documents")
          .select("content_text")
          .eq("id", documentId)
          .single();

        if (docError || !doc) {
          return createDebugResponse(false, 404, { error: "Documento não encontrado" }, debug, startTime);
        }

        const updatedText = appendToExisting 
          ? (doc.content_text || "") + "\n\n" + combinedText
          : combinedText;

        await supabase
          .from("documents")
          .update({ content_text: updatedText, updated_at: new Date().toISOString() })
          .eq("id", documentId);

        return createDebugResponse(true, 200, {
          status: "ocr_complete",
          documentId,
          pagesProcessed: extractedTexts.length,
          totalChars: combinedText.length
        }, debug, startTime);
      }

      // Return extracted text for client to handle
      return createDebugResponse(true, 200, {
        status: "ocr_complete",
        pagesProcessed: extractedTexts.length,
        extractedText: combinedText,
        pages: extractedTexts
      }, debug, startTime);
    }

    // =============================================
    // POST /documents/process - Process existing document (PHASE 2)
    // =============================================
    if (req.method === "POST" && lastPart === "process") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }

      const body = await req.json();
      const { document_id } = body;

      if (!document_id) {
        return createDebugResponse(false, 400, { error: "document_id é obrigatório" }, debug, startTime);
      }

      console.log(`[${requestId}] Processing document ${document_id}...`);

      // Get document info
      const { data: document, error: docError } = await supabase
        .from("documents")
        .select("id, file_path, title, category, status")
        .eq("id", document_id)
        .single();

      if (docError || !document) {
        return createDebugResponse(false, 404, { error: "Documento não encontrado" }, debug, startTime);
      }

      // Update status to processing
      await supabase
        .from("documents")
        .update({ status: "processing", error_reason: null })
        .eq("id", document_id);

      try {
        // Download file from Storage
        const downloadStart = Date.now();
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("knowledge-base")
          .download(document.file_path);

        if (downloadError || !fileData) {
          throw new Error(`Arquivo não encontrado no Storage: ${downloadError?.message}`);
        }
        debug.timings.download_storage_ms = Date.now() - downloadStart;
        debug.steps_completed.push("download_storage");
        console.log(`[${requestId}] ✓ download_storage: ${Math.round(fileData.size / 1024)}KB in ${debug.timings.download_storage_ms}ms`);

        const isPDF = document.file_path.endsWith(".pdf");
        let contentText: string;

        if (isPDF) {
          const extractStart = Date.now();
          const { pages, totalPages } = await extractPdfTextDeterministic(fileData, 1, PAGES_PER_BATCH);
          const partialText = pages.join("\n\n--- Página ---\n\n");
          debug.timings.extract_ms = Date.now() - extractStart;
          debug.steps_completed.push("extract");
          console.log(`[${requestId}] ✓ extract: ${pages.length}/${totalPages} pages in ${debug.timings.extract_ms}ms`);

          const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
          
          // OCR fallback for scanned PDFs
          if (totalChars < 100 && totalPages > 0 && LOVABLE_API_KEY) {
            const sizeMB = fileData.size / (1024 * 1024);
            if (sizeMB <= LIMITS.MAX_LLM_PAYLOAD_MB) {
              try {
                contentText = await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY, requestId, debug);
              } catch (ocrError) {
                console.error(`[${requestId}] OCR fallback failed:`, ocrError);
                contentText = partialText;
              }
            } else {
              contentText = partialText;
            }
          } else {
            contentText = partialText;
          }

          // If more pages, create background job
          if (totalPages > PAGES_PER_BATCH) {
            // Delete old chunks first
            await supabase.from("document_chunks").delete().eq("document_id", document_id);
            
            const { error: jobError } = await supabase
              .from("document_jobs")
              .insert({
                document_id: document_id,
                status: "pending",
                next_page: PAGES_PER_BATCH + 1,
                total_pages: totalPages,
                pages_per_batch: PAGES_PER_BATCH
              });

            if (jobError) {
              console.error(`[${requestId}] Error creating job:`, jobError);
            }

            await supabase
              .from("documents")
              .update({ content_text: contentText, status: "processing" })
              .eq("id", document_id);

            return createDebugResponse(true, 200, {
              status: "processing",
              message: `Processando ${totalPages} páginas em background...`,
              document: { id: document_id, title: document.title, totalPages, processedPages: PAGES_PER_BATCH }
            }, debug, startTime);
          }
        } else {
          // TXT/DOCX - extract directly
          const extractStart = Date.now();
          if (document.file_path.endsWith(".txt")) {
            contentText = await fileData.text();
          } else {
            const arrayBuffer = await fileData.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            contentText = result.value;
          }
          debug.timings.extract_ms = Date.now() - extractStart;
          debug.steps_completed.push("extract");
          console.log(`[${requestId}] ✓ extract: ${contentText.length} chars in ${debug.timings.extract_ms}ms`);
        }

        // Delete old chunks
        await supabase.from("document_chunks").delete().eq("document_id", document_id);

        // Process chunks and embeddings
        const { chunksCount, warning } = await processChunksAndEmbeddings(
          supabase, document_id, contentText, GEMINI_API_KEY, requestId, debug
        );

        // Update document as ready
        await supabase
          .from("documents")
          .update({ content_text: contentText, status: "ready", error_reason: null })
          .eq("id", document_id);

        return createDebugResponse(true, 200, {
          status: "ready",
          warning,
          document: { id: document_id, title: document.title, chunk_count: chunksCount }
        }, debug, startTime);

      } catch (processError) {
        const errorMsg = processError instanceof Error ? processError.message : String(processError);
        console.error(`[${requestId}] ✗ process: ${errorMsg}`);
        
        await supabase
          .from("documents")
          .update({ status: "failed", error_reason: errorMsg })
          .eq("id", document_id);

        return createDebugResponse(false, 500, {
          error: "Falha ao processar documento",
          details: errorMsg
        }, debug, startTime);
      }
    }

    // =============================================
    // POST /documents - Create document (PHASE 1: upload-only or full process)
    // =============================================
    if (req.method === "POST" && lastPart !== "process-job" && lastPart !== "process") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }
      
      const body = await req.json();
      const { filePath, title, category, fileType, originalName, mode } = body;
      
      console.log(`[${requestId}] ========== PROCESSING REQUEST ==========`);
      console.log(`[${requestId}] filePath: ${filePath}, mode: ${mode || "full"}`);
      
      if (!filePath) {
        return createDebugResponse(false, 400, { error: "filePath é obrigatório" }, debug, startTime);
      }

      // =============================================
      // MODE: upload-only (PHASE 1 only)
      // =============================================
      if (mode === "upload-only") {
        console.log(`[${requestId}] Mode: upload-only - creating document record only`);
        
        const { data: document, error: docError } = await supabase
          .from("documents")
          .insert({
            title: title || originalName || "Documento sem título",
            category: category || "manual",
            file_path: filePath,
            status: "uploaded",
            content_text: null,
          })
          .select()
          .single();

        if (docError) throw docError;

        debug.steps_completed.push("db_insert");
        console.log(`[${requestId}] ✓ db_insert: Document ${document.id} created with status=uploaded`);

        return createDebugResponse(true, 200, {
          status: "uploaded",
          message: "Arquivo salvo. Clique em 'Processar' para extrair conteúdo.",
          document_id: document.id,
          document: { id: document.id, title: document.title, status: "uploaded" }
        }, debug, startTime);
      }

      // =============================================
      // MODE: full (backward compatible - upload + process)
      // =============================================
      
      // Download file from Storage
      const downloadStart = Date.now();
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("knowledge-base")
        .download(filePath);
      
      if (downloadError || !fileData) {
        return createDebugResponse(false, 404, {
          error: "Arquivo não encontrado no Storage",
          details: downloadError?.message
        }, debug, startTime);
      }
      
      debug.timings.download_storage_ms = Date.now() - downloadStart;
      debug.steps_completed.push("download_storage");
      console.log(`[${requestId}] ✓ download_storage: ${Math.round(fileData.size / 1024)}KB in ${debug.timings.download_storage_ms}ms`);
      
      const isPDF = filePath.endsWith(".pdf") || fileType?.includes("pdf");
      const isDOCX = filePath.endsWith(".docx") || fileType?.includes("wordprocessingml");
      const isTXT = filePath.endsWith(".txt") || fileType?.includes("text/plain");
      
      let contentText: string;
      
      if (isTXT) {
        const extractStart = Date.now();
        contentText = await fileData.text();
        debug.timings.extract_ms = Date.now() - extractStart;
        debug.steps_completed.push("extract");
        console.log(`[${requestId}] ✓ extract: TXT ${contentText.length} chars in ${debug.timings.extract_ms}ms`);
      } else if (isPDF) {
        console.log(`[${requestId}] ========== DETERMINISTIC PDF EXTRACTION ==========`);
        
        try {
          const extractStart = Date.now();
          const { pages, totalPages } = await extractPdfTextDeterministic(fileData, 1, PAGES_PER_BATCH);
          const partialText = pages.join("\n\n--- Página ---\n\n");
          debug.timings.extract_ms = Date.now() - extractStart;
          debug.steps_completed.push("extract");
          console.log(`[${requestId}] ✓ extract: ${pages.length}/${totalPages} pages in ${debug.timings.extract_ms}ms`);
          
          const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
          
          if (totalChars < 100 && totalPages > 0 && LOVABLE_API_KEY) {
            const sizeMB = fileData.size / (1024 * 1024);
            if (sizeMB <= LIMITS.MAX_LLM_PAYLOAD_MB) {
              try {
                contentText = await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY, requestId, debug);
              } catch (ocrError) {
                console.error(`[${requestId}] OCR fallback failed:`, ocrError);
                contentText = partialText;
              }
            } else {
              console.warn(`[${requestId}] PDF too large for OCR (${sizeMB.toFixed(1)}MB), using partial text`);
              contentText = partialText;
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
              content_text: contentText,
              status: totalPages > PAGES_PER_BATCH ? "processing" : "ready"
            })
            .select()
            .single();
          
          if (docError) throw docError;
          
          debug.steps_completed.push("db_insert");
          console.log(`[${requestId}] ✓ db_insert: Document ${document.id}`);
          
          // If PDF has more pages, create background job
          if (totalPages > PAGES_PER_BATCH) {
            console.log(`[${requestId}] Creating background job for ${totalPages - PAGES_PER_BATCH} remaining pages...`);
            
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
              console.error(`[${requestId}] Error creating job:`, jobError);
            }
            
            return createDebugResponse(true, 200, {
              status: "processing",
              message: `Documento criado. Processando ${totalPages} páginas em background...`,
              document: { id: document.id, title: document.title, category: document.category, totalPages, processedPages: PAGES_PER_BATCH }
            }, debug, startTime);
          }
          
          // Small PDF - process chunks immediately
          const { chunksCount, warning } = await processChunksAndEmbeddings(
            supabase, document.id, contentText, GEMINI_API_KEY, requestId, debug
          );
          
          return createDebugResponse(true, 200, {
            status: "completed",
            warning,
            document: { id: document.id, title: document.title, category: document.category, chunk_count: chunksCount }
          }, debug, startTime);
          
        } catch (pdfError) {
          console.error(`[${requestId}] ✗ pdf_extraction: ${pdfError}`);
          debug.steps_failed.push("extract");
          
          // Try OCR as last resort
          if (LOVABLE_API_KEY && fileData.size < LIMITS.MAX_LLM_PAYLOAD_MB * 1024 * 1024) {
            console.log(`[${requestId}] Trying OCR fallback...`);
            try {
              contentText = await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY, requestId, debug);
            } catch (ocrError) {
              return createDebugResponse(false, 500, {
                error: "Falha ao processar PDF",
                details: pdfError instanceof Error ? pdfError.message : String(pdfError),
                ocrError: ocrError instanceof Error ? ocrError.message : String(ocrError)
              }, debug, startTime);
            }
          } else {
            return createDebugResponse(false, 500, {
              error: "Falha ao processar PDF",
              details: pdfError instanceof Error ? pdfError.message : String(pdfError)
            }, debug, startTime);
          }
        }
      } else if (isDOCX) {
        try {
          const extractStart = Date.now();
          const arrayBuffer = await fileData.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          contentText = result.value;
          debug.timings.extract_ms = Date.now() - extractStart;
          debug.steps_completed.push("extract");
          console.log(`[${requestId}] ✓ extract: DOCX ${contentText.length} chars in ${debug.timings.extract_ms}ms`);
        } catch (docxError) {
          debug.steps_failed.push("extract");
          return createDebugResponse(false, 400, { error: "Erro ao processar DOCX" }, debug, startTime);
        }
      } else {
        return createDebugResponse(false, 400, {
          error: "Tipo de arquivo não suportado. Use PDF, DOCX ou TXT."
        }, debug, startTime);
      }
      
      // For non-PDF files (TXT, DOCX) - standard processing
      if (!isPDF) {
        if (!contentText || contentText.trim().length < 100) {
          return createDebugResponse(false, 400, { error: "Conteúdo muito curto ou vazio" }, debug, startTime);
        }
        
        const { data: document, error: docError } = await supabase
          .from("documents")
          .insert({
            title: title || originalName || "Documento sem título",
            category: category || "manual",
            file_path: filePath,
            content_text: contentText,
            status: "ready"
          })
          .select()
          .single();
        
        if (docError) throw docError;
        
        debug.steps_completed.push("db_insert");
        
        const { chunksCount, warning } = await processChunksAndEmbeddings(
          supabase, document.id, contentText, GEMINI_API_KEY, requestId, debug
        );
        
        return createDebugResponse(true, 200, {
          status: "completed",
          warning,
          document: { id: document.id, title: document.title, category: document.category, chunk_count: chunksCount }
        }, debug, startTime);
      }
    }

    // =============================================
    // DELETE /documents/:id - Remove document
    // =============================================
    if (req.method === "DELETE") {
      if (!validateAdminKey(req)) {
        return createDebugResponse(false, 401, { error: "Não autorizado" }, debug, startTime);
      }
      
      let docId = lastPart && lastPart !== "documents" ? lastPart : null;
      
      if (!docId) {
        try {
          const body = await req.json();
          docId = body.id;
        } catch { /* ignore */ }
      }
      
      if (!docId) {
        return createDebugResponse(false, 400, { error: "ID do documento obrigatório" }, debug, startTime);
      }
      
      const { data: document, error: fetchError } = await supabase
        .from("documents")
        .select("id, file_path")
        .eq("id", docId)
        .single();
      
      if (fetchError || !document) {
        return createDebugResponse(false, 404, { error: "Documento não encontrado" }, debug, startTime);
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
      
      debug.steps_completed.push("delete");
      return createDebugResponse(true, 200, { deleted: docId }, debug, startTime);
    }

    return createDebugResponse(false, 405, { error: "Método não suportado" }, debug, startTime);

  } catch (error) {
    console.error(`[${requestId}] ✗ FATAL: ${error}`);
    return createDebugResponse(false, 500, {
      error: error instanceof Error ? error.message : "Erro interno"
    }, debug, startTime);
  }
});
