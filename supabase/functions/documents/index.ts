import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
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
    /bloco/gi, /tramit/gi, /SDP/gi, /prestação/gi,
    /4ª\s*CRE/gi, /unidade/gi, /usuário/gi
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const ADMIN_KEY = Deno.env.get("ADMIN_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const documentId = pathParts[pathParts.length - 1];

  try {
    // =============================================
    // GET /documents - Listar todos os documentos
    // =============================================
    if (req.method === "GET" && (!documentId || documentId === "documents")) {
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
    // POST /documents - Upload e processamento
    // =============================================
    if (req.method === "POST") {
      // Verificar admin key
      const adminKey = req.headers.get("x-admin-key");
      if (!adminKey || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY não configurada");
      }
      
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const title = formData.get("title") as string || "Documento sem título";
      const category = formData.get("category") as string || "manual";
      
      if (!file) {
        return new Response(
          JSON.stringify({ error: "Arquivo é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Validar tipo de arquivo
      const allowedTypes = [
        "text/plain",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      
      if (!allowedTypes.includes(file.type) && !file.name.endsWith(".txt")) {
        return new Response(
          JSON.stringify({ error: "Tipo de arquivo não suportado. Use PDF, DOCX ou TXT." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Ler conteúdo do arquivo
      let contentText: string;
      
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        contentText = await file.text();
      } else {
        // Para PDF e DOCX, precisaríamos de bibliotecas específicas
        // Por enquanto, vamos aceitar apenas TXT ou receber o texto diretamente
        const textContent = formData.get("text_content") as string;
        if (textContent) {
          contentText = textContent;
        } else {
          return new Response(
            JSON.stringify({ 
              error: "Para PDF e DOCX, envie também o campo 'text_content' com o texto extraído.",
              hint: "Você pode usar ferramentas como pdf.js ou mammoth para extrair o texto antes do upload."
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      if (!contentText || contentText.trim().length < 100) {
        return new Response(
          JSON.stringify({ error: "Conteúdo do documento muito curto ou vazio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Upload do arquivo para o Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `documents/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("knowledge-base")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });
      
      if (uploadError) {
        console.error("Erro no upload:", uploadError);
        // Continuar mesmo sem upload do arquivo original
      }
      
      // Criar documento no banco
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          title,
          category,
          file_path: uploadError ? null : filePath,
          content_text: contentText
        })
        .select()
        .single();
      
      if (docError) throw docError;
      
      // Dividir em chunks
      const chunks = splitIntoChunks(contentText);
      console.log(`Documento dividido em ${chunks.length} chunks`);
      
      // Gerar embeddings
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
      
      const chunkRecords = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const metadata = extractMetadata(chunk, i);
        
        // Gerar embedding
        const embeddingResult = await embeddingModel.embedContent(chunk);
        const embedding = embeddingResult.embedding.values;
        
        chunkRecords.push({
          document_id: document.id,
          content: chunk,
          chunk_index: i,
          embedding: JSON.stringify(embedding),
          metadata
        });
        
        // Pequena pausa para não sobrecarregar a API
        if (i % 5 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Inserir chunks em lotes
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
    if (req.method === "DELETE" && documentId && documentId !== "documents") {
      // Verificar admin key
      const adminKey = req.headers.get("x-admin-key");
      if (!adminKey || adminKey !== ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Buscar documento
      const { data: document, error: fetchError } = await supabase
        .from("documents")
        .select("id, file_path")
        .eq("id", documentId)
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
        .eq("document_id", documentId);
      
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
        .eq("id", documentId);
      
      if (deleteError) throw deleteError;
      
      return new Response(
        JSON.stringify({ success: true, deleted: documentId }),
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
