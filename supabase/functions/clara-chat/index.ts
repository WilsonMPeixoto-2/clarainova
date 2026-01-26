import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequests: 15, // 15 requests per window
  windowSeconds: 60, // 1 minute window
};

// Helper to get client identifier for rate limiting
function getClientKey(req: Request): string {
  // Try multiple headers for client identification
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
// SYSTEM PROMPT COMPLETO DA CLARA
// Preservado 100% do original server/rag.ts
// =============================================
const CLARA_SYSTEM_PROMPT = `Você é a **CLARA** (Consultora de Legislação e Apoio a Rotinas Administrativas).
Sua missão é atuar como uma colega sênior: experiente, paciente e objetiva.
Prioridade absoluta: resolver a dúvida do usuário com resultado operacional.
Isso significa responder: O que fazer agora + Por quê + Qual o risco se fizer errado.

## Empatia Operacional (3 micro-regras)

1. **Acolha sem exagero:** Uma frase breve de contexto ("Entendo, isso é comum..." ou "Boa pergunta, vamos resolver..."). Nunca mais de uma linha.
2. **Explique o PORQUÊ:** Nunca dê apenas o comando técnico. Diga a razão prática.
   - Comando frio: "Clique em Concluir."
   - Comando com contexto: "Clique em **Concluir** para liberar o processo para tramitação."
3. **Antecipe o erro comum:** Se houver uma "pegadinha" conhecida, alerte uma vez, de forma direta.

## Formatação Visual

- Use **negrito** para botões, telas e sistemas (ex: **SEI!Rio**, botão **Incluir Documento**).
- Use \`código\` para campos e menus do sistema (ex: menu \`Processo\` > \`Incluir\`).
- Use listas numeradas para procedimentos sequenciais.
- Emojis estratégicos (máximo 1 por bloco, nunca no título):
  - 💡 Para dica de ouro ou atalho útil
  - ⚠️ Para alerta crítico, prazo fatal ou risco de erro
  - ✅ Para confirmação de etapa concluída

## Escopo de Atuação

Você SOMENTE responde perguntas sobre:

**1. Sistemas SEI (SEI!Rio e SEI Federal)**
- Criação, tramitação e arquivamento de processos
- Inclusão, edição e assinatura de documentos
- Blocos de assinatura (internos e externos)
- Níveis de acesso, permissões e credenciamento
- Pesquisa, localização e acompanhamento de processos
- Erros operacionais do sistema e suas soluções

**2. Procedimentos Administrativos Formais**
- Prestação de contas de verbas (PDDE, FNDE, verbas municipais)
- Formalização de ações (dispensas, inexigibilidades, contratos)
- Documentos necessários para cada tipo de procedimento
- Fluxos e trâmites entre setores e órgãos

**3. Legislação e Normas Vigentes**
- Decretos, portarias, resoluções e instruções normativas
- Consultas do tipo "qual decreto regula X?"
- Prazos legais, obrigações e penalidades
- Orientações de órgãos de controle (CGM, TCM, CGU)

## Tratamento de Perguntas Fora do Escopo

Se a pergunta NÃO se enquadrar nos 3 eixos acima, use um destes modelos:

**Modelo 1 - Recusa + Reformulação:**
"Meu foco é apoiar rotinas administrativas no SEI e procedimentos formais. Se sua dúvida estiver relacionada a algum processo administrativo ou ao uso do sistema, ficarei feliz em ajudar. Podemos reformular?"

**Modelo 2 - Recusa + Conversão Proativa:**
"Essa pergunta está fora do meu escopo, mas posso ajudar se você tiver dúvidas sobre:
- Como registrar isso no SEI
- Qual procedimento administrativo se aplica
- Qual legislação regula esse assunto
Quer explorar algum desses ângulos?"

**Lista de exclusão explícita (nunca responda):**
- Assuntos pessoais (saúde, receitas, relacionamentos)
- Esportes, entretenimento, cultura geral
- Opinião política ou ideológica
- Suporte de TI (rede, hardware, software)
- Interpretação jurídica de casos concretos

## Protocolo de Resposta

1. **Perguntas específicas:** Resposta direta + passo a passo numerado + fonte.
2. **Perguntas amplas ("Como uso o SEI?"):** Forneça um mapa de navegação:
   - 3 conceitos fundamentais
   - 3 perguntas específicas para começar
   - Não dê palestras
3. **Lacunas de informação:**
   - NÃO INVENTE. Proibido alucinar leis, prazos ou procedimentos.
   - Diga: "Não localizei essa informação nos manuais disponíveis."
   - Indique caminho: "Recomendo consultar o D.O. Rio ou o portal da CGM."
4. **Sistemas distintos:** Diferencie SEI Federal vs SEI!Rio vs Processo.rio. Se a pergunta for ambígua, peça esclarecimento.

## Citação de Fontes

- Cite fontes ao final do parágrafo relevante: [Manual SEI 4.0, p. X]
- Se a informação veio do contexto fornecido, cite o documento.
- Se não houver fonte na base, indique claramente.`;

// =============================================
// MAPA DE SINÔNIMOS
// Preservado 100% do original server/rag.ts
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

// =============================================
// CLASSIFICADOR DE INTENÇÃO
// Preservado do original
// =============================================
interface IntentClassification {
  intent: string;
  confidence: number;
  keywords: string[];
}

function classifyIntent(query: string): IntentClassification {
  const normalizedQuery = query.toLowerCase();
  
  const intents = [
    { intent: "CREATE_PROCESS", patterns: ["criar processo", "abrir processo", "iniciar processo", "novo processo", "autuar"], keywords: ["criar", "abrir", "iniciar", "novo", "autuar"] },
    { intent: "ADD_DOCUMENT", patterns: ["anexar documento", "incluir documento", "adicionar arquivo", "upload"], keywords: ["anexar", "incluir", "adicionar", "upload", "documento"] },
    { intent: "SIGN_DOCUMENT", patterns: ["assinar documento", "assinatura", "rubricar", "validar documento"], keywords: ["assinar", "assinatura", "rubricar", "validar"] },
    { intent: "SEND_PROCESS", patterns: ["enviar processo", "tramitar", "encaminhar", "remeter"], keywords: ["enviar", "tramitar", "encaminhar", "remeter"] },
    { intent: "SEARCH", patterns: ["buscar", "pesquisar", "localizar", "encontrar", "onde fica"], keywords: ["buscar", "pesquisar", "localizar", "encontrar", "onde"] },
    { intent: "ERROR_HELP", patterns: ["erro", "problema", "não consigo", "falha", "bug", "não funciona"], keywords: ["erro", "problema", "falha", "bug", "não consigo"] },
    { intent: "SDP_PRESTACAO", patterns: ["prestação de contas", "sdp", "despesa", "verba", "planilha"], keywords: ["prestação", "contas", "sdp", "despesa", "verba"] },
    { intent: "BLOCK_SIGNATURE", patterns: ["bloco de assinatura", "bloco interno", "bloco externo"], keywords: ["bloco", "assinatura"] },
    { intent: "GENERAL_INFO", patterns: ["o que é", "como funciona", "explicar", "definição"], keywords: ["o que", "como", "explicar", "definição"] }
  ];
  
  let bestMatch: IntentClassification = { intent: "GENERAL_INFO", confidence: 0.3, keywords: [] };
  
  for (const { intent, patterns, keywords } of intents) {
    for (const pattern of patterns) {
      if (normalizedQuery.includes(pattern)) {
        return { intent, confidence: 0.9, keywords };
      }
    }
    const matchedKeywords = keywords.filter(k => normalizedQuery.includes(k));
    if (matchedKeywords.length > bestMatch.keywords.length) {
      bestMatch = { intent, confidence: 0.5 + (matchedKeywords.length * 0.1), keywords: matchedKeywords };
    }
  }
  
  return bestMatch;
}

// =============================================
// EXPANSÃO DE QUERY COM SINÔNIMOS
// =============================================
function expandQueryWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const expanded: Set<string> = new Set(words);
  
  for (const word of words) {
    // Adicionar sinônimos
    if (SYNONYM_MAP[word]) {
      SYNONYM_MAP[word].forEach(syn => expanded.add(syn));
    }
    // Verificar se a palavra é um sinônimo de algo
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
// ALGORITMO DE SCORING POR KEYWORDS
// Preservado do original server/rag.ts
// =============================================
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
        p_endpoint: "clara-chat",
        p_max_requests: RATE_LIMIT_CONFIG.maxRequests,
        p_window_seconds: RATE_LIMIT_CONFIG.windowSeconds,
      }
    );

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      // Continue without rate limiting if there's an error
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

    const { message, history = [] } = await req.json();
    
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API keys
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada");
    }
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Classificar intenção
    const intentClass = classifyIntent(message);
    
    // Expandir query com sinônimos
    const expandedTerms = expandQueryWithSynonyms(message);
    
    // Buscar chunks relevantes usando embeddings (still use Gemini for embeddings)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    // Gerar embedding da query
    const embeddingResult = await embeddingModel.embedContent(message);
    const queryEmbedding = embeddingResult.embedding.values;
    
    // Busca semântica via pgvector
    const { data: semanticChunks, error: searchError } = await supabase.rpc(
      "search_document_chunks",
      {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.3,
        match_count: 10
      }
    );
    
    if (searchError) {
      console.error("Erro na busca semântica:", searchError);
    }
    
    // Busca por keywords em todos os chunks
    const { data: allChunks } = await supabase
      .from("document_chunks")
      .select("id, content, document_id, metadata");
    
    // Aplicar scoring por keywords
    const keywordScoredChunks = (allChunks || [])
      .map(chunk => ({
        ...chunk,
        keywordScore: scoreChunkByKeywords(chunk.content, expandedTerms, message)
      }))
      .filter(chunk => chunk.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, 10);
    
    // Combinar resultados (Reciprocal Rank Fusion)
    const chunkScores = new Map<string, { chunk: any; score: number }>();
    const k = 60; // Constante RRF
    
    // Adicionar scores da busca semântica
    (semanticChunks || []).forEach((chunk: any, index: number) => {
      const rrfScore = 1 / (k + index + 1);
      chunkScores.set(chunk.id, { chunk, score: rrfScore });
    });
    
    // Adicionar/combinar scores da busca por keywords
    keywordScoredChunks.forEach((chunk, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = chunkScores.get(chunk.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        chunkScores.set(chunk.id, { chunk, score: rrfScore });
      }
    });
    
    // Ordenar e pegar top 12
    const finalChunks = Array.from(chunkScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(item => item.chunk);
    
    // Buscar títulos dos documentos
    const documentIds = [...new Set(finalChunks.map(c => c.document_id))];
    const { data: documents } = await supabase
      .from("documents")
      .select("id, title, category")
      .in("id", documentIds);
    
    const docMap = new Map(documents?.map(d => [d.id, d]) || []);
    
    // Montar contexto
    const contextParts = finalChunks.map(chunk => {
      const doc = docMap.get(chunk.document_id);
      const source = doc ? `[${doc.title}]` : "[Documento]";
      return `${source}\n${chunk.content}`;
    });
    
    const context = contextParts.join("\n\n---\n\n");
    
    // Preparar histórico de mensagens para Lovable AI Gateway (OpenAI format)
    const chatHistory = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content
    }));
    
    // Prompt do usuário com contexto
    const userPrompt = `## Contexto da Base de Conhecimento

${context || "Nenhum documento relevante encontrado na base de conhecimento."}

---

## Pergunta do Usuário

${message}

---

## Instruções

Responda à pergunta do usuário com base no contexto fornecido. Se o contexto não contiver informação suficiente, use seu conhecimento geral sobre o SEI e sistemas administrativos, mas indique claramente quando estiver fazendo isso.

Sempre cite as fontes quando usar informação do contexto [Nome do Documento].`;

    // Use Lovable AI Gateway for chat completion (OpenAI-compatible API)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: CLARA_SYSTEM_PROMPT },
          ...chatHistory,
          { role: "user", content: userPrompt }
        ],
        stream: true,
        temperature: 0.5,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições da IA excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Lovable AI Gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Coletar fontes locais
    const localSources = documents?.map(d => d.title) || [];
    
    // Create SSE stream that transforms OpenAI format to our format
    const encoder = new TextEncoder();
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error("No response body from AI gateway");
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Enviar evento de início
          controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ status: "searching", step: "Buscando na base de conhecimento..." })}\n\n`));
          
          const decoder = new TextDecoder();
          let buffer = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process line by line
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (line.startsWith(":") || line.trim() === "") continue;
              if (!line.startsWith("data: ")) continue;
              
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                if (content) {
                  controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // Incomplete JSON, put it back and wait for more data
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }
          
          // Final flush
          if (buffer.trim()) {
            for (let raw of buffer.split("\n")) {
              if (!raw) continue;
              if (raw.endsWith("\r")) raw = raw.slice(0, -1);
              if (raw.startsWith(":") || raw.trim() === "") continue;
              if (!raw.startsWith("data: ")) continue;
              const jsonStr = raw.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                if (content) {
                  controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content })}\n\n`));
                }
              } catch { /* ignore partial leftovers */ }
            }
          }
          
          // Enviar fontes locais
          if (localSources.length > 0) {
            controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify({ local: localSources })}\n\n`));
          }
          
          // Enviar evento de conclusão
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Erro no streaming:", error);
          const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`));
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
    
  } catch (error) {
    console.error("Erro na função clara-chat:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
