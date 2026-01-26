import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
// @ts-ignore - mammoth for DOCX parsing
import mammoth from "https://esm.sh/mammoth@1.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

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
      
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY não configurada");
      }
      
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
      
      if (isTXT) {
        contentText = await fileData.text();
        console.log(`[documents] TXT extracted: ${contentText.length} characters`);
      } else if (isPDF) {
        // Extract text from PDF using Gemini (compatible with Deno)
        try {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64Data = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          console.log(`[documents] PDF size: ${Math.round(arrayBuffer.byteLength / 1024)}KB, extracting with Gemini...`);
          
          const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          
          const result = await model.generateContent([
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data
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
          
          contentText = result.response.text();
          console.log(`[documents] PDF extracted via Gemini: ${contentText.length} characters`);
          
          if (!contentText || contentText.trim().length < 50) {
            throw new Error("Texto extraído muito curto - PDF pode estar escaneado ou corrompido");
          }
        } catch (pdfError) {
          console.error("Erro ao extrair PDF:", pdfError);
          return new Response(
            JSON.stringify({ 
              error: "Erro ao processar PDF. Verifique se o arquivo não está corrompido ou protegido.",
              details: pdfError instanceof Error ? pdfError.message : "Erro desconhecido"
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
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
      
      // Generate embeddings
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
      
      const chunkRecords = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const metadata = extractMetadata(chunk, i);
        
        // Generate embedding
        const embeddingResult = await embeddingModel.embedContent(chunk);
        const embedding = embeddingResult.embedding.values;
        
        chunkRecords.push({
          document_id: document.id,
          content: chunk,
          chunk_index: i,
          embedding: JSON.stringify(embedding),
          metadata
        });
        
        // Small pause to not overload the API
        if (i % 5 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
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
