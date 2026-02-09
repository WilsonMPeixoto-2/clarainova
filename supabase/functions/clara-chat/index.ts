import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const VERSION = "v3.0.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
    const response = await fetch(EMBEDDING_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            content: { parts: [{ text }] },
            outputDimensionality: 768,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[clara-chat ${VERSION}] Embedding error: ${response.status} - ${errorText}`);
        throw new Error(`Embedding failed: ${response.status}`);
    }

    const data = await response.json();
    const values = data.embedding?.values || [];
    if (values.length === 0) {
        throw new Error("Embedding retornou vetor vazio");
    }
    return values;
}

async function generateAnswer(prompt: string, lovableApiKey: string): Promise<string> {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
                {
                    role: "system",
                    content: `Você é CLARA, a Consultora de Legislação e Apoio a Rotinas Administrativas do SEI!RIO.

Suas diretrizes:
- Responda de forma clara, objetiva e fundamentada
- Cite as fontes documentais quando possível
- Use linguagem formal mas acessível
- Se não encontrar informação nos documentos fornecidos, informe ao usuário
- Nunca invente informações que não estejam nos documentos de contexto`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 2048,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[clara-chat ${VERSION}] Lovable AI error: ${response.status} - ${errorText}`);

        if (response.status === 429) {
            throw new Error("RATE_LIMIT: Tente novamente em alguns segundos.");
        }
        if (response.status === 402) {
            throw new Error("PAYMENT: Créditos de IA esgotados.");
        }

        throw new Error(`LLM_ERROR: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

async function generateAnswerGeminiDirect(prompt: string, apiKey: string): Promise<string> {
    const geminiRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );

    if (!geminiRes.ok) {
        const errorText = await geminiRes.text();
        console.error(`[clara-chat ${VERSION}] Gemini direct error: ${geminiRes.status} - ${errorText}`);
        throw new Error(`GEMINI_ERROR: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    return geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    console.log(`[clara-chat ${VERSION}] Request received`);

    try {
        const googleApiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";

        if (!googleApiKey && !lovableApiKey) {
            console.error(`[clara-chat ${VERSION}] No API keys configured`);
            throw new Error("CONFIG_ERROR: Nenhuma chave de API configurada");
        }

        const body = await req.json();
        const { message, conversationHistory = [] } = body;

        // Validação de entrada
        if (!message || typeof message !== "string") {
            return new Response(
                JSON.stringify({ error: "Mensagem é obrigatória" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (message.length > 10000) {
            return new Response(
                JSON.stringify({ error: "Mensagem muito longa (máximo 10.000 caracteres)" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (conversationHistory && (!Array.isArray(conversationHistory) || conversationHistory.length > 50)) {
            return new Response(
                JSON.stringify({ error: "Histórico de conversa inválido ou muito grande (máximo 50 mensagens)" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[clara-chat ${VERSION}] Query: "${message.slice(0, 80)}..."`);

        // 1. Gerar embedding para busca vetorial
        let chunks: any[] = [];
        let context = "";
        let embeddingTimeMs = 0;
        let searchTimeMs = 0;

        if (googleApiKey) {
            try {
                const embStart = Date.now();
                const embedding = await generateEmbedding(message, googleApiKey);
                embeddingTimeMs = Date.now() - embStart;
                console.log(`[clara-chat ${VERSION}] Embedding OK: ${embedding.length}d in ${embeddingTimeMs}ms`);

                const searchStart = Date.now();
                const { data: searchResults, error: searchError } = await supabase.rpc(
                    "hybrid_search_chunks",
                    {
                        query_embedding: JSON.stringify(embedding),
                        query_text: message,
                        match_threshold: 0.3,
                        match_count: 10,
                    }
                );
                searchTimeMs = Date.now() - searchStart;

                if (searchError) {
                    console.error(`[clara-chat ${VERSION}] Hybrid search error:`, searchError.message);
                    const { data: vectorResults, error: vectorError } = await supabase.rpc(
                        "search_document_chunks",
                        {
                            query_embedding: JSON.stringify(embedding),
                            match_threshold: 0.3,
                            match_count: 10,
                        }
                    );

                    if (!vectorError && vectorResults) {
                        chunks = vectorResults;
                        console.log(`[clara-chat ${VERSION}] Vector fallback: ${chunks.length} chunks`);
                    }
                } else {
                    chunks = searchResults || [];
                }

                console.log(`[clara-chat ${VERSION}] Search: ${chunks.length} chunks in ${searchTimeMs}ms`);

                context = chunks
                    .map((c: any) => `[${c.document_title || c.document_id}] ${c.content}`)
                    .join("\n\n");
            } catch (embeddingError: any) {
                console.error(`[clara-chat ${VERSION}] Embedding/search failed: ${embeddingError.message}`);
            }
        }

        // 2. Construir prompt com contexto
        const prompt = context
            ? `Contexto dos documentos da base de conhecimento:\n${context}\n\nPergunta do usuário: ${message}\n\nResponda com base nos documentos acima e cite as fontes quando possível.`
            : `Pergunta do usuário: ${message}\n\nNota: Não foram encontrados documentos relevantes na base de conhecimento. Responda com base no seu conhecimento geral sobre legislação e procedimentos administrativos do SEI.`;

        // 3. Gerar resposta - PRIORIZAR Gemini direto (usa chave do usuário, sem cobranças)
        let answer = "";
        let provider = "";
        let llmTimeMs = 0;

        const llmStart = Date.now();

        if (googleApiKey) {
            // Primário: Gemini direto com a chave do usuário (sem custo Lovable)
            answer = await generateAnswerGeminiDirect(prompt, googleApiKey);
            provider = "gemini-direct";
            console.log(`[clara-chat ${VERSION}] ✅ Answer via Gemini direct (${answer.length} chars)`);
        } else if (lovableApiKey) {
            // Fallback: Lovable AI Gateway (apenas se não tiver chave Google)
            answer = await generateAnswer(prompt, lovableApiKey);
            provider = "lovable-ai-fallback";
            console.log(`[clara-chat ${VERSION}] ✅ Answer via Lovable AI fallback (${answer.length} chars)`);
        }

        llmTimeMs = Date.now() - llmStart;

        // 4. Validar resposta - não retornar vazio
        if (!answer || answer.trim() === "") {
            console.warn(`[clara-chat ${VERSION}] Empty answer from ${provider}, trying fallback...`);
            
            if (provider === "lovable-ai" && googleApiKey) {
                answer = await generateAnswerGeminiDirect(prompt, googleApiKey);
                provider = "gemini-direct-empty-fallback";
                console.log(`[clara-chat ${VERSION}] Fallback answer: ${answer.length} chars`);
            }

            if (!answer || answer.trim() === "") {
                answer = "Não encontrei informações suficientes para responder à sua pergunta. Por favor, tente reformulá-la de outra forma.";
                provider = "default-message";
            }
        }

        // 5. Verificar se resposta está vazia e tentar fallback
        if (!answer || answer.trim() === "") {
            if (provider === "lovable-ai" && googleApiKey) {
                console.log(`[clara-chat] ⚠️ Lovable AI retornou vazio, tentando Gemini direto...`);
                answer = await generateAnswerGeminiDirect(prompt, googleApiKey);
                provider = "gemini-direct-fallback";
            }

            // Se ainda vazio, retornar mensagem informativa
            if (!answer || answer.trim() === "") {
                answer = "Não encontrei informações suficientes para responder sua pergunta. Por favor, tente reformulá-la ou seja mais específico.";
                provider = "fallback-message";
            }
        }

        const totalTime = Date.now() - startTime;
        console.log(`[clara-chat ${VERSION}] ✅ Done in ${totalTime}ms | provider=${provider} | chunks=${chunks.length}`);

        return new Response(
            JSON.stringify({
                answer,
                sources: chunks.map((c: any) => ({
                    title: c.document_title || c.document_id,
                    similarity: c.similarity || c.combined_score,
                })),
                metrics: {
                    version: VERSION,
                    total_time_ms: totalTime,
                    embedding_time_ms: embeddingTimeMs,
                    search_time_ms: searchTimeMs,
                    llm_time_ms: llmTimeMs,
                    chunks_found: chunks.length,
                    embedding_model: EMBEDDING_MODEL,
                    provider,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
  const totalTime = Date.now() - startTime;

  // Sempre logar o erro completo no servidor (não vaza para o cliente)
  const msg = String((err as any)?.message ?? err ?? "");
  console.error(`[clara-chat ${VERSION}] ❌ Error after ${totalTime}ms`, { msg, err });

  // Heurísticas para categorizar o erro
  const isRateLimit = /429|rate limit|too many requests/i.test(msg);
  const isPayment = /payment|min balance|credits|quota/i.test(msg);

  // HTTP status coerente com a categoria
  const status = isRateLimit ? 429 : isPayment ? 402 : 500;

  // Mensagem amigável ao usuário
  const userMessage = isRateLimit
    ? "O sistema está temporariamente sobrecarregado. Tente novamente em alguns segundos."
    : isPayment
      ? "Créditos de IA esgotados. Contate o administrador do sistema."
      : "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.";

  // Provider pode não estar definido em alguns fluxos
  const providerSafe =
    typeof provider === "string" && provider.trim() ? provider : "unknown";

  return new Response(
    JSON.stringify({
      error: userMessage,
      details: isRateLimit
        ? "rate_limited"
        : isPayment
          ? "quota_exceeded"
          : "internal_error",
      provider: providerSafe,
      sources: [],
      metrics: {
        total_time_ms: totalTime,
        chunks_found: 0,
      },
      time_elapsed_ms: totalTime, // compatibilidade com payload antigo
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
});