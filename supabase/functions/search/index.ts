// Import map: ../import_map.json (used during Supabase deploy)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequests: 30, // 30 requests per window (higher limit for search)
  windowSeconds: 60, // 1 minute window
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

// =============================================
// MAPA DE SINÔNIMOS (preservado do original)
// =============================================
const SYNONYM_MAP: Record<string, string[]> = {
  "abrir": ["iniciar", "criar", "gerar", "cadastrar", "autuar", "instaurar"],
  "anexar": ["incluir", "adicionar", "inserir", "juntar", "acostar"],
  "processo": ["procedimento", "expediente", "autos", "documento", "protocolo"],
  "documento": ["arquivo", "peça", "ofício", "memorando", "despacho"],
  "assinar": ["rubricar", "autenticar", "validar", "firmar"],
  "enviar": ["tramitar", "encaminhar", "remeter", "despachar", "expedir"],
  "receber": ["acolher", "recepcionar", "dar entrada"],
  "cancelar": ["anular", "revogar", "invalidar", "desfazer", "estornar"],
  "editar": ["modificar", "alterar", "corrigir", "retificar", "atualizar"],
  "excluir": ["deletar", "remover", "apagar", "eliminar"],
  "buscar": ["pesquisar", "procurar", "localizar", "encontrar", "consultar"],
  "bloco": ["conjunto", "grupo", "lote", "pacote"],
  "unidade": ["setor", "órgão", "departamento", "coordenadoria", "gerência"],
  "usuário": ["servidor", "funcionário", "colaborador", "operador"],
  "permissão": ["acesso", "perfil", "credencial", "autorização", "habilitação"],
  "erro": ["problema", "falha", "bug", "inconsistência", "defeito"],
  "login": ["acesso", "autenticação", "entrada", "logon"],
  "senha": ["password", "credencial", "código de acesso"],
  "prestação de contas": ["PC", "relatório financeiro", "demonstrativo"],
  "despesa": ["gasto", "custo", "pagamento", "desembolso"],
  "verba": ["recurso", "dotação", "crédito", "orçamento"],
  "planilha": ["tabela", "demonstrativo", "quadro", "mapa"],
  "conferir": ["verificar", "checar", "validar", "auditar"],
  "aprovar": ["deferir", "autorizar", "homologar", "sancionar"],
  "reprovar": ["indeferir", "recusar", "rejeitar", "negar"],
  "pendência": ["pendente", "aguardando", "em aberto"],
  "concluir": ["finalizar", "encerrar", "terminar", "arquivar"],
  "modelo": ["template", "padrão", "minuta", "formulário"]
};

// Expandir query com sinônimos
function expandQueryWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const expanded: Set<string> = new Set(words);
  
  for (const word of words) {
    if (SYNONYM_MAP[word]) {
      SYNONYM_MAP[word].forEach(syn => expanded.add(syn));
    }
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (synonyms.includes(word)) {
        expanded.add(key);
        synonyms.forEach(syn => expanded.add(syn));
      }
    }
  }
  
  return Array.from(expanded);
}

// =============================================
// DYNAMIC SEARCH WEIGHTS (Query-Aware)
// =============================================
interface SearchWeights {
  keyword_weight: number;
  vector_weight: number;
  reason: string;
}

/**
 * Dynamically adjust RRF weights based on query patterns.
 * - Queries with specific numbers (e.g., "Decreto 45.123") → favor keyword search
 * - Exact phrase queries (with quotes) → favor keyword search
 * - Conceptual queries → favor vector search (default)
 */
function getSearchWeights(query: string): SearchWeights {
  const normalizedQuery = query.trim();
  
  // Pattern: Specific numbers (3+ digits) like "Decreto 45.123", "Lei 12345"
  const hasSpecificNumbers = /\d{3,}/.test(normalizedQuery);
  
  // Pattern: Exact phrase with quotes
  const hasExactPhrase = /"[^"]{3,}"/.test(normalizedQuery);
  
  // Pattern: Legal/administrative codes (Art. 1º, § 2º, Inciso III)
  const hasLegalCode = /\b(art\.?\s*\d+|§\s*\d+|inciso\s+[ivxlcdm]+|alínea\s+[a-z])\b/i.test(normalizedQuery);
  
  // Pattern: Protocol/process numbers (e.g., "SEI 12345.678901/2024-00")
  const hasProtocolNumber = /\d{5,}[\.\/-]\d+/.test(normalizedQuery);
  
  // Strong keyword preference: specific identifiers
  if (hasProtocolNumber || hasLegalCode) {
    return { 
      keyword_weight: 0.8, 
      vector_weight: 0.2,
      reason: "protocol_or_legal_code"
    };
  }
  
  // Medium keyword preference: numbers or exact phrases
  if (hasSpecificNumbers || hasExactPhrase) {
    return { 
      keyword_weight: 0.65, 
      vector_weight: 0.35,
      reason: "specific_numbers_or_phrase"
    };
  }
  
  // Default: balanced with slight vector preference for conceptual queries
  return { 
    keyword_weight: 0.4, 
    vector_weight: 0.6,
    reason: "conceptual_query"
  };
}

// Algoritmo de scoring por keywords (preservado do original)
function scoreChunkByKeywords(content: string, expandedTerms: string[], originalQuery: string): number {
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = originalQuery.toLowerCase();
  let score = 0;
  
  // Match exato de frase: +15 pontos
  if (normalizedContent.includes(normalizedQuery)) {
    score += 15;
  }
  
  // Match de palavras individuais: +2 pontos cada
  for (const term of expandedTerms) {
    if (normalizedContent.includes(term)) {
      score += 2;
    }
  }
  
  // Termos SEI-específicos: +3 pontos
  const seiTerms = ["sei", "processo", "documento", "assinatura", "bloco", "tramitação", "unidade", "usuário"];
  for (const term of seiTerms) {
    if (normalizedQuery.includes(term) && normalizedContent.includes(term)) {
      score += 3;
    }
  }
  
  // Palavras de ação em queries "como": +2 pontos
  if (normalizedQuery.startsWith("como")) {
    const actionWords = ["clique", "selecione", "acesse", "abra", "digite", "escolha", "confirme"];
    for (const action of actionWords) {
      if (normalizedContent.includes(action)) {
        score += 2;
      }
    }
  }
  
  return score;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client early for rate limiting
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Rate limiting check
    const clientKey = getClientKey(req);
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_client_key: clientKey,
        p_endpoint: "search",
        p_max_requests: RATE_LIMIT_CONFIG.maxRequests,
        p_window_seconds: RATE_LIMIT_CONFIG.windowSeconds,
      }
    );

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
      const resetIn = rateLimitResult[0].reset_in || RATE_LIMIT_CONFIG.windowSeconds;
      return new Response(
        JSON.stringify({
          error: "Limite de requisições excedido. Por favor, aguarde um momento.",
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

    const { query, limit = 12, threshold = 0.3 } = await req.json();
    
    // Timing for metrics
    const searchStartTime = Date.now();
    let vectorSearchMs = 0;
    let keywordSearchMs = 0;
    let totalChunksScanned = 0;
    
    // Input validation - query
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Input validation - query length (max 500 characters)
    if (query.length > 500) {
      return new Response(
        JSON.stringify({ error: "Query muito longa. Máximo de 500 caracteres permitidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Input validation - limit (max 50) and threshold (0.1 - 0.9)
    const safeLimit = Math.min(Math.max(1, Number(limit) || 12), 50);
    const safeThreshold = Math.max(0.1, Math.min(0.9, Number(threshold) || 0.3));

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    // Expandir query com sinônimos
    const expandedTerms = expandQueryWithSynonyms(query);
    
    // Gerar embedding da query
    const embedStart = Date.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = embeddingResult.embedding.values;
    const embedMs = Date.now() - embedStart;
    
    // Try hybrid search first (uses ts_vector + vector similarity)
    let finalResults: any[] = [];
    
    // Get dynamic weights based on query pattern
    const weights = getSearchWeights(query);
    console.log(`[search] Dynamic weights: keyword=${weights.keyword_weight}, vector=${weights.vector_weight}, reason=${weights.reason}`);
    
    const hybridStart = Date.now();
    const { data: hybridResults, error: hybridError } = await supabase.rpc(
      "hybrid_search_chunks",
      {
        query_text: query,
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: safeThreshold,
        match_count: safeLimit,
        keyword_weight: weights.keyword_weight,
        vector_weight: weights.vector_weight
      }
    );
    vectorSearchMs = Date.now() - hybridStart;
    
    if (!hybridError && hybridResults?.length > 0) {
      console.log(`[search] Hybrid search returned ${hybridResults.length} results in ${vectorSearchMs}ms`);
      totalChunksScanned = hybridResults.length;
      finalResults = hybridResults.map((r: any, index: number) => ({
        chunk: r,
        score: r.combined_score,
        semanticRank: index + 1,
        keywordRank: r.text_rank > 0 ? index + 1 : null
      }));
    } else {
      // Fallback to original RRF approach if hybrid search fails
      console.log(`[search] Falling back to RRF search. Hybrid error: ${hybridError?.message || 'no results'}`);
      
      // Busca semântica via pgvector
      const semanticStart = Date.now();
      const { data: semanticChunks, error: searchError } = await supabase.rpc(
        "search_document_chunks",
        {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: safeThreshold,
          match_count: 15
        }
      );
      vectorSearchMs = Date.now() - semanticStart;
      
      if (searchError) {
        console.error("Erro na busca semântica:", searchError);
      }
      
      // Busca por keywords em todos os chunks (limited for performance)
      const keywordStart = Date.now();
      const { data: allChunks } = await supabase
        .from("document_chunks")
        .select("id, content, document_id, metadata, chunk_index")
        .limit(2000);
      keywordSearchMs = Date.now() - keywordStart;
      totalChunksScanned = allChunks?.length || 0;
      // Aplicar scoring por keywords
      const keywordScoredChunks = (allChunks || [])
        .map(chunk => ({
          ...chunk,
          keywordScore: scoreChunkByKeywords(chunk.content, expandedTerms, query)
        }))
        .filter(chunk => chunk.keywordScore > 0)
        .sort((a, b) => b.keywordScore - a.keywordScore)
        .slice(0, 15);
      
      // Reciprocal Rank Fusion
      const chunkScores = new Map<string, { chunk: any; score: number; semanticRank?: number; keywordRank?: number }>();
      const k = 60;
      
      // Adicionar scores da busca semântica
      (semanticChunks || []).forEach((chunk: any, index: number) => {
        const rrfScore = 1 / (k + index + 1);
        chunkScores.set(chunk.id, { 
          chunk: { ...chunk, similarity: chunk.similarity },
          score: rrfScore,
          semanticRank: index + 1
        });
      });
      
      // Adicionar/combinar scores da busca por keywords
      keywordScoredChunks.forEach((chunk, index) => {
        const rrfScore = 1 / (k + index + 1);
        const existing = chunkScores.get(chunk.id);
        if (existing) {
          existing.score += rrfScore;
          existing.keywordRank = index + 1;
          existing.chunk.keywordScore = chunk.keywordScore;
        } else {
          chunkScores.set(chunk.id, { 
            chunk: { ...chunk, keywordScore: chunk.keywordScore },
            score: rrfScore,
            keywordRank: index + 1
          });
        }
      });
      
      // Ordenar e pegar top N
      finalResults = Array.from(chunkScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit);
    }
    
    // Buscar títulos dos documentos
    const documentIds = [...new Set(finalResults.map(r => r.chunk.document_id))];
    const { data: documents } = await supabase
      .from("documents")
      .select("id, title, category")
      .in("id", documentIds);
    
    const docMap = new Map(documents?.map(d => [d.id, d]) || []);
    
    // Formatar resultados
    const results = finalResults.map(r => {
      const doc = docMap.get(r.chunk.document_id);
      return {
        id: r.chunk.id,
        content: r.chunk.content,
        document_id: r.chunk.document_id,
        document_title: doc?.title || "Documento",
        document_category: doc?.category || "geral",
        chunk_index: r.chunk.chunk_index,
        metadata: r.chunk.metadata,
        scores: {
          combined: r.score,
          semantic_rank: r.semanticRank || null,
          keyword_rank: r.keywordRank || null,
          similarity: r.chunk.similarity || null,
          keyword_score: r.chunk.keywordScore || null
        }
      };
    });
    
    // Calculate total search time
    const totalSearchMs = Date.now() - searchStartTime;
    
    // Record search metrics (async, don't wait)
    const queryHash = query.slice(0, 50).replace(/\s+/g, '_');
    supabase.from('search_metrics').insert({
      query_hash: queryHash,
      vector_search_ms: vectorSearchMs,
      keyword_search_ms: keywordSearchMs,
      total_chunks_scanned: totalChunksScanned,
      results_returned: results.length,
      threshold_used: safeThreshold
    });
    
    return new Response(
      JSON.stringify({
        query,
        expanded_terms: expandedTerms,
        result_count: results.length,
        results,
        metrics: {
          total_ms: totalSearchMs,
          embed_ms: embedMs,
          vector_search_ms: vectorSearchMs,
          keyword_search_ms: keywordSearchMs,
          chunks_scanned: totalChunksScanned,
          threshold_used: safeThreshold,
          index_type: 'hnsw',
          weights_used: weights
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função search:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
