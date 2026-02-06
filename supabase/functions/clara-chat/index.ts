import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// Modelo de embedding atualizado - gemini-embedding-001
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
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[clara-chat] Embedding error: ${response.status} - ${errorText}`);
        throw new Error(`Embedding failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.embedding?.values || [];
}

// Gerar resposta usando Lovable AI Gateway (sem limite de quota do Google)
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
        console.error(`[clara-chat] Lovable AI error: ${response.status} - ${errorText}`);

        if (response.status === 429) {
            throw new Error("Rate limit exceeded. Tente novamente em alguns segundos.");
        }
        if (response.status === 402) {
            throw new Error("Créditos de IA esgotados. Contate o administrador.");
        }

        throw new Error(`LLM generation failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

// Fallback: Gemini direto (caso Lovable AI esteja indisponível)
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
        console.error(`[clara-chat] Gemini direct error: ${geminiRes.status} - ${errorText}`);
        throw new Error(`Gemini generation failed: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    return geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const googleApiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";

        if (!googleApiKey && !lovableApiKey) {
            throw new Error("Nenhuma chave de API configurada (GOOGLE_GENERATIVE_AI_API_KEY ou LOVABLE_API_KEY)");
        }

        const { message, conversationHistory = [] } = await req.json();

        if (!message) {
            return new Response(
                JSON.stringify({ error: "Mensagem é obrigatória" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[clara-chat] Received: ${message.slice(0, 100)}...`);

        // 1. Gerar embedding para busca vetorial
        let chunks: any[] = [];
        let context = "";

        if (googleApiKey) {
            try {
                const embedding = await generateEmbedding(message, googleApiKey);
                console.log(`[clara-chat] Embedding OK: ${embedding.length} dimensões`);

                // 2. Busca híbrida no Supabase
                const { data: searchResults, error: searchError } = await supabase.rpc(
                    "hybrid_search_chunks",
                    {
                        query_embedding: JSON.stringify(embedding),
                        query_text: message,
                        match_threshold: 0.3,
                        match_count: 10,
                    }
                );

                if (searchError) {
                    console.error(`[clara-chat] Search error:`, searchError);
                    // Tentar busca vetorial simples como fallback
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
                    }
                } else {
                    chunks = searchResults || [];
                }

                console.log(`[clara-chat] Found ${chunks.length} chunks`);

                context = chunks
                    .map((c: any) => `[${c.document_title || c.document_id}] ${c.content}`)
                    .join("\n\n");
            } catch (embeddingError) {
                console.error(`[clara-chat] Embedding/search failed:`, embeddingError);
                // Continua sem contexto documental
            }
        }

        // 3. Construir prompt com contexto
        const prompt = context
            ? `Contexto dos documentos da base de conhecimento:\n${context}\n\nPergunta do usuário: ${message}\n\nResponda com base nos documentos acima e cite as fontes quando possível.`
            : `Pergunta do usuário: ${message}\n\nNota: Não foram encontrados documentos relevantes na base de conhecimento. Responda com base no seu conhecimento geral sobre legislação e procedimentos administrativos do SEI.`;

        // 4. Gerar resposta - priorizar Lovable AI Gateway
        let answer = "";
        let provider = "";

        if (lovableApiKey) {
            try {
                answer = await generateAnswer(prompt, lovableApiKey);
                provider = "lovable-ai";
                console.log(`[clara-chat] ✅ Answer via Lovable AI`);
            } catch (lovableError: any) {
                console.warn(`[clara-chat] Lovable AI failed: ${lovableError.message}`);

                // Fallback para Gemini direto
                if (googleApiKey) {
                    answer = await generateAnswerGeminiDirect(prompt, googleApiKey);
                    provider = "gemini-direct";
                    console.log(`[clara-chat] ✅ Answer via Gemini direct (fallback)`);
                } else {
                    throw lovableError;
                }
            }
        } else if (googleApiKey) {
            answer = await generateAnswerGeminiDirect(prompt, googleApiKey);
            provider = "gemini-direct";
            console.log(`[clara-chat] ✅ Answer via Gemini direct`);
        }

        const totalTime = Date.now() - startTime;
        console.log(`[clara-chat] ✅ Completed in ${totalTime}ms (${provider})`);

        return new Response(
            JSON.stringify({
                answer,
                sources: chunks.map((c: any) => ({
                    title: c.document_title || c.document_id,
                    similarity: c.similarity || c.combined_score,
                })),
                metrics: {
                    total_time_ms: totalTime,
                    chunks_found: chunks.length,
                    embedding_model: EMBEDDING_MODEL,
                    provider,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        const totalTime = Date.now() - startTime;
        const errorMessage = (err as Error).message;
        console.error(`[clara-chat] ❌ Error after ${totalTime}ms:`, err);

        const isRateLimit = errorMessage.includes("429") || errorMessage.includes("Rate limit");
        const isPayment = errorMessage.includes("402") || errorMessage.includes("Créditos");

        return new Response(
            JSON.stringify({
                error: isRateLimit
                    ? "O sistema está temporariamente sobrecarregado. Tente novamente em alguns segundos."
                    : isPayment
                    ? "Créditos de IA esgotados. Contate o administrador do sistema."
                    : "Desculpe, ocorreu um erro ao processar sua mensagem.",
                details: errorMessage,
                time_elapsed_ms: totalTime,
            }),
            {
                status: isRateLimit ? 429 : isPayment ? 402 : 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
