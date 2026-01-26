import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
// @ts-ignore - mammoth for DOCX parsing
import mammoth from "https://esm.sh/mammoth@1.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// Lovable AI Gateway URL
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function blobToBase64(fileBlob: Blob): Promise<string> {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  return encodeBase64(uint8Array);
}

// Helper to check if error is a rate limit error
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

// Extract PDF text using Lovable AI Gateway (PRIMARY)
// IMPORTANT: PDFs cannot be sent as external URLs in `image_url`.
// The gateway/provider supports PDFs when sent as a data URL with MIME type.
async function extractPdfViaLovableAIBase64(fileBlob: Blob, lovableApiKey: string): Promise<string> {
  console.log("[documents] Attempting PDF extraction via Lovable AI (PRIMARY - base64 data URL)...");

  const base64Data = await blobToBase64(fileBlob);
  const dataUrl = `data:application/pdf;base64,${base64Data}`;

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableApiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
            {
              type: "text",
              text: `Extraia TODO o texto deste documento mantendo a estrutura.

Regras:
- Preserve títulos, parágrafos, tabelas (quando possível) e listas
- Não resuma e não omita conteúdo
- Mantenha números/valores/códigos exatamente como no original

Responda APENAS com o texto extraído.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[documents] Lovable AI error:", response.status, errorText);
    throw new Error(`Lovable AI failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const extractedText = data.choices?.[0]?.message?.content || "";

  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error("Texto extraído via Lovable AI muito curto");
  }

  console.log(`[documents] PDF extracted via Lovable AI: ${extractedText.length} characters`);
  return extractedText;
}

// Extract PDF text using Gemini with base64 (FALLBACK - for PDFs < 15MB)
async function extractPdfViaGeminiBase64(fileBlob: Blob, geminiApiKey: string): Promise<string> {
  const MAX_BASE64_SIZE = 20 * 1024 * 1024; // 20MB limit for base64 encoding
  
  if (fileBlob.size > MAX_BASE64_SIZE) {
    throw new Error(`PDF muito grande para fallback Gemini (${Math.round(fileBlob.size / 1024 / 1024)}MB, max: 15MB)`);
  }
  
  console.log("[documents] Converting PDF to base64 for Gemini fallback...");

  const base64Data = await blobToBase64(fileBlob);
  
  console.log(`[documents] Base64 size: ${Math.round(base64Data.length / 1024)}KB`);
  
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: base64Data  // Base64 works with Gemini!
      }
    },
    {
      text: `Extraia TODO o texto deste documento PDF de forma literal e completa. 

Instruções:
- Preserve a estrutura original (títulos, parágrafos, listas)
- Mantenha numerações e marcadores
- Inclua todo o conteúdo textual, sem resumir ou omitir
- Use quebras de linha para separar seções
- Não adicione comentários ou explicações, apenas o texto extraído

Responda APENAS com o texto extraído do documento.`
    }
  ]);
  
  const extractedText = result.response.text();
  
  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error("Texto extraído via Gemini base64 muito curto");
  }
  
  console.log(`[documents] PDF extracted via Gemini base64: ${extractedText.length} characters`);
  return extractedText;
}

// Tamanho do chunk: 4000 caracteres (preservado do original)
const CHUNK_SIZE = 4000;
const CHUNK_OVERLAP = 500;

// Dividir texto em chunks com overlap
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    
    // Tentar encontrar um ponto de quebra natural (parágrafo, frase)
    if (end < text.length) {
      // Procurar parágrafo duplo
      const doubleNewline = text.lastIndexOf("\n\n", end);
      if (doubleNewline > start + CHUNK_SIZE / 2) {
        end = doubleNewline + 2;
      } else {
        // Procurar fim de frase
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

// Extrair metadados do chunk (título da seção, etc.)
function extractMetadata(chunk: string, index: number): Record<string, any> {
  const lines = chunk.split("\n");
  const firstLine = lines[0] || "";
  
  // Detectar se a primeira linha parece um título
  const isTitle = firstLine.length < 100 && 
    (firstLine.startsWith("#") || 
     firstLine === firstLine.toUpperCase() ||
     firstLine.match(/^\d+\.\s/) ||
     firstLine.match(/^[A-Z][^.!?]*$/));
  
  // Extrair palavras-chave
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

// Rate limiting configuration for admin endpoints (stricter)
const ADMIN_RATE_LIMIT = {
  maxRequests: 5,    // 5 attempts per window
  windowSeconds: 300, // 5 minute window
};

// Helper to get client identifier for rate limiting
function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (cfIp) return cfIp;
  if (realIp) return realIp;
  
  return "unknown";
}

serve(async (req) => {
  // Handle CORS preflight
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
  const documentId = pathParts[pathParts.length - 1];

  try {
    // Rate limiting for POST/DELETE (admin operations)
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

      if (rateLimitError) {
        console.error("[documents] Rate limit check error:", rateLimitError);
      } else if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
        const resetIn = rateLimitResult[0].reset_in || ADMIN_RATE_LIMIT.windowSeconds;
        console.log(`[documents] Rate limited: ${clientKey}`);
        return new Response(
          JSON.stringify({
            error: `Muitas tentativas. Tente novamente em ${Math.ceil(resetIn / 60)} minutos.`,
            retryAfter: resetIn,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(resetIn),
            },
          }
        );
      }
    }

    // =============================================
    // GET /documents - Listar todos os documentos
    // =============================================
    if (req.method === "GET" && (!documentId || documentId === "documents")) {
      // Validate admin key for listing documents
       const adminKey = (req.headers.get("x-admin-key") || "").trim();
       if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data: documents, error } = await supabase
        .from("documents")
        .select(`
          id,
          title,
          category,
          file_path,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Contar chunks por documento
      const { data: chunkCounts } = await supabase
        .from("document_chunks")
        .select("document_id");
      
      const countMap = new Map<string, number>();
      chunkCounts?.forEach(c => {
        countMap.set(c.document_id, (countMap.get(c.document_id) || 0) + 1);
      });
      
      const documentsWithCounts = documents?.map(doc => ({
        ...doc,
        chunk_count: countMap.get(doc.id) || 0
      }));
      
      return new Response(
        JSON.stringify({ documents: documentsWithCounts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // POST /documents - Processar documento do Storage
    // =============================================
    if (req.method === "POST") {
      // Verificar admin key
       const adminKey = (req.headers.get("x-admin-key") || "").trim();
       if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // NOTE: GEMINI_API_KEY is optional for PDF extraction (we can use Lovable AI).
      // It is still used for embeddings when available.
      
      // Parse JSON body (not FormData anymore)
      const body = await req.json();
      const { filePath, title, category, fileType, originalName } = body;
      
      console.log(`[documents] ========== PROCESSING REQUEST ==========`);
      console.log(`[documents] filePath: ${filePath}`);
      console.log(`[documents] title: ${title}`);
      console.log(`[documents] category: ${category}`);
      console.log(`[documents] fileType: ${fileType}`);
      console.log(`[documents] originalName: ${originalName}`);
      
      // Input validation
      if (!filePath) {
        console.error(`[documents] ERROR: filePath is missing`);
        return new Response(
          JSON.stringify({ error: "filePath é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Download file from Storage
      console.log(`[documents] ========== DOWNLOADING FROM STORAGE ==========`);
      console.log(`[documents] Bucket: knowledge-base`);
      console.log(`[documents] Path: ${filePath}`);
      
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("knowledge-base")
        .download(filePath);
      
      if (downloadError || !fileData) {
        console.error(`[documents] DOWNLOAD FAILED`);
        console.error(`[documents] Error:`, downloadError);
        console.error(`[documents] Error message:`, downloadError?.message);
        return new Response(
          JSON.stringify({ 
            error: "Arquivo não encontrado no Storage",
            details: downloadError?.message,
            path: filePath
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[documents] DOWNLOAD SUCCESS`);
      console.log(`[documents] File size: ${Math.round(fileData.size / 1024)}KB`);
      
      // Determine file type from path or provided type
      const isPDF = filePath.endsWith(".pdf") || fileType?.includes("pdf");
      const isDOCX = filePath.endsWith(".docx") || fileType?.includes("wordprocessingml");
      const isTXT = filePath.endsWith(".txt") || fileType?.includes("text/plain");
      
      // Extract text based on file type
      let contentText: string;
      
      // File size limit for processing
      const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB (processed via signed URL)
      const MAX_DOCX_SIZE = 50 * 1024 * 1024; // 50MB
      
      if (isTXT) {
        contentText = await fileData.text();
        console.log(`[documents] TXT extracted: ${contentText.length} characters`);
      } else if (isPDF) {
        // Check file size
        if (fileData.size > MAX_PDF_SIZE) {
          console.error(`[documents] PDF too large: ${Math.round(fileData.size / 1024 / 1024)}MB (max ${MAX_PDF_SIZE / 1024 / 1024}MB)`);
          return new Response(
            JSON.stringify({ 
              error: `PDF muito grande (${Math.round(fileData.size / 1024 / 1024)}MB). O limite para PDFs é ${MAX_PDF_SIZE / 1024 / 1024}MB. Por favor, divida o documento em partes menores.`,
              code: "FILE_TOO_LARGE",
              maxSizeMB: MAX_PDF_SIZE / 1024 / 1024,
              actualSizeMB: Math.round(fileData.size / 1024 / 1024)
            }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Extraction flow:
        // 1) Lovable AI gateway with PDF as base64 data URL (does not depend on GEMINI_API_KEY quotas)
        // 2) Direct Gemini base64 fallback (requires GEMINI_API_KEY with active quota)

        console.log(`[documents] ========== EXTRACTION FLOW ==========`);
        console.log(`[documents] PDF size: ${Math.round(fileData.size / 1024)}KB`);

        let usedProvider = "unknown";
        const MAX_INLINE_PDF_SIZE = 20 * 1024 * 1024; // Keep request sizes reasonable
        
        try {
          // PRIMARY: Lovable AI (PDF base64 data URL)
          if (!LOVABLE_API_KEY) {
            throw new Error("LOVABLE_API_KEY não configurada - tentando Gemini base64");
          }

          if (fileData.size > MAX_INLINE_PDF_SIZE) {
            throw new Error(
              `PDF muito grande para extração via Lovable AI (base64) (${Math.round(fileData.size / 1024 / 1024)}MB > 20MB)`
            );
          }
          
          console.log(`[documents] PRIMARY: Attempting Lovable AI (base64) extraction...`);
          
          contentText = await extractPdfViaLovableAIBase64(fileData, LOVABLE_API_KEY);
          usedProvider = "lovable-ai";
          console.log(`[documents] SUCCESS: PDF extracted via Lovable AI: ${contentText.length} characters`);
          
        } catch (lovableError) {
          console.error("[documents] Lovable AI extraction failed:", lovableError);
          const lovableErrorMsg = lovableError instanceof Error ? lovableError.message : String(lovableError);
          
          // FALLBACK: Gemini with base64 (only for PDFs < 15MB)
          const MAX_BASE64_SIZE = 20 * 1024 * 1024; // 20MB limit
          
          if (GEMINI_API_KEY && fileData.size <= MAX_BASE64_SIZE) {
            console.log(`[documents] FALLBACK: Attempting Gemini base64 extraction...`);
            console.log(`[documents] File size (${Math.round(fileData.size / 1024)}KB) is within base64 limit`);
            
            try {
              contentText = await extractPdfViaGeminiBase64(fileData, GEMINI_API_KEY);
              usedProvider = "gemini-base64";
              console.log(`[documents] SUCCESS: PDF extracted via Gemini base64: ${contentText.length} characters`);
            } catch (geminiError) {
              console.error("[documents] Gemini base64 fallback also failed:", geminiError);
              const geminiErrorMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
              
              return new Response(
                JSON.stringify({ 
                  error: "Falha ao processar PDF. Ambos os provedores falharam.",
                  details: `Lovable AI: ${lovableErrorMsg}. Gemini: ${geminiErrorMsg}`
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else if (fileData.size > MAX_BASE64_SIZE) {
            // PDF too large for base64 fallback
            console.error(`[documents] PDF too large for Gemini base64 fallback: ${Math.round(fileData.size / 1024 / 1024)}MB`);
            return new Response(
              JSON.stringify({ 
                error: `Falha ao processar PDF. O arquivo é grande demais para extração inline (>${MAX_BASE64_SIZE / 1024 / 1024}MB). Divida em partes menores.`,
                details: lovableErrorMsg
              }),
              { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            // No GEMINI_API_KEY and Lovable AI failed
            return new Response(
              JSON.stringify({ 
                error: "Falha ao processar PDF. Lovable AI falhou e não há fallback disponível.",
                details: lovableErrorMsg
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        console.log(`[documents] ========== EXTRACTION COMPLETE ==========`);
        console.log(`[documents] Provider used: ${usedProvider}`);
        console.log(`[documents] Content length: ${contentText.length} characters`);
        
        // Log which provider was used for debugging
      } else if (isDOCX) {
        // Extract text from DOCX
        try {
          const arrayBuffer = await fileData.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          contentText = result.value;
          console.log(`[documents] DOCX extracted: ${contentText.length} characters`);
        } catch (docxError) {
          console.error("Erro ao extrair DOCX:", docxError);
          return new Response(
            JSON.stringify({ error: "Erro ao processar DOCX. Verifique se o arquivo não está corrompido." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Tipo de arquivo não suportado. Use PDF, DOCX ou TXT." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!contentText || contentText.trim().length < 100) {
        return new Response(
          JSON.stringify({ error: "Conteúdo do documento muito curto ou vazio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      
      // Split into chunks
      const chunks = splitIntoChunks(contentText);
      console.log(`[documents] Document split into ${chunks.length} chunks`);
      
       // Generate embeddings (best-effort)
       // If the key is missing or rate-limited, we still save chunks without embeddings.
       const chunkRecords: Array<any> = [];
       let embeddingsWarning: string | null = null;
       let embeddingModel: any = null;

       if (!GEMINI_API_KEY) {
         embeddingsWarning = "Embeddings não geradas (GEMINI_API_KEY não configurada).";
       } else {
         try {
           const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
           embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
         } catch (e) {
           embeddingsWarning = `Embeddings desativadas (falha ao inicializar modelo): ${e instanceof Error ? e.message : String(e)}`;
         }
       }

       let embeddingsDisabled = !embeddingModel;

       for (let i = 0; i < chunks.length; i++) {
         const chunk = chunks[i];
         const metadata = extractMetadata(chunk, i);

         let embeddingJson: string | null = null;
         if (!embeddingsDisabled && embeddingModel) {
           try {
             const embeddingResult = await embeddingModel.embedContent(chunk);
             const embedding = embeddingResult.embedding.values;
             embeddingJson = JSON.stringify(embedding);
           } catch (e) {
             // Disable further embedding attempts if we hit rate limits/quota or any persistent error.
             embeddingsDisabled = true;
             const msg = e instanceof Error ? e.message : String(e);
             embeddingsWarning = embeddingsWarning || `Embeddings interrompidas: ${msg}`;
             console.error("[documents] Embedding generation failed, continuing without embeddings:", e);
           }
         }

         chunkRecords.push({
           document_id: document.id,
           content: chunk,
           chunk_index: i,
           embedding: embeddingJson,
           metadata,
         });

         // Small pause to not overload the API
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
          console.error("Erro ao inserir chunks:", chunksError);
          throw chunksError;
        }
      }
      
      console.log(`[documents] All ${chunks.length} chunks inserted successfully`);
      
      return new Response(
        JSON.stringify({
          success: true,
           warning: embeddingsWarning,
          document: {
            id: document.id,
            title: document.title,
            category: document.category,
            chunk_count: chunks.length
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // DELETE /documents/:id - Remover documento
    // =============================================
    if (req.method === "DELETE") {
      // Verificar admin key
       const adminKey = (req.headers.get("x-admin-key") || "").trim();
       if (!adminKey || !ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Accept ID from URL path or from request body
      let docId = documentId && documentId !== "documents" ? documentId : null;
      
      if (!docId) {
        try {
          const body = await req.json();
          docId = body.id;
        } catch {
          // Body parsing failed, docId remains null
        }
      }
      
      if (!docId) {
        return new Response(
          JSON.stringify({ error: "ID do documento obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Buscar documento
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
      
      // Remover chunks
      const { error: chunksError } = await supabase
        .from("document_chunks")
        .delete()
        .eq("document_id", docId);
      
      if (chunksError) {
        console.error("Erro ao remover chunks:", chunksError);
      }
      
      // Remover arquivo do storage
      if (document.file_path) {
        const { error: storageError } = await supabase.storage
          .from("knowledge-base")
          .remove([document.file_path]);
        
        if (storageError) {
          console.error("Erro ao remover arquivo:", storageError);
        }
      }
      
      // Remover documento
      const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId);
      
      if (deleteError) throw deleteError;
      
      return new Response(
        JSON.stringify({ success: true, deleted: docId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Método não suportado
    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função documents:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
