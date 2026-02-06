import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// MODELO DE EMBEDDING ATUALIZADO - gemini-embedding-001 (anteriormente era text-embedding-004)
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

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const apiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || "";

        if (!apiKey) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY não configurada");
        }

        const { message, conversationHistory = [] } = await req.json();

        if (!message) {
            return new Response(
                JSON.stringify({ error: "Mensagem é obrigatória" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[clara-chat] Received: ${message.slice(0, 100)}...`);

        // 1. Gerar embedding da pergunta usando o modelo atualizado
        const embedding = await generateEmbedding(message, apiKey);
        console.log(`[clara-chat] Embedding generated (${embedding.length} dimensions)`);

        // 2. Busca vetorial no Supabase
        const { data: chunks, error: searchError } = await supabase.rpc(
            "match_document_chunks",
            {
                query_embedding: embedding,
                match_threshold: 0.3,
                match_count: 10,
            }
        );

        if (searchError) {
            console.error(`[clara-chat] Vector search error:`, searchError);
            throw new Error(`Vector search failed: ${searchError.message}`);
        }

        console.log(`[clara-chat] Found ${chunks?.length || 0} chunks`);

        // 3. Construir contexto
        const context = chunks
            ?.map((c: any) => `[${c.document_title}] ${c.content}`)
            .join("\n\n") || "";

        // 4. Chamar Gemini para gerar resposta
        const geminiRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `Você é CLARA, assistente de legislação do SEI!RIO.

Contexto dos documentos:
${context}

Pergunta: ${message}

Responda de forma clara e cite as fontes quando possível.`,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048,
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            const errorText = await geminiRes.text();
            console.error(`[clara-chat] Gemini error: ${geminiRes.status} - ${errorText}`);
            throw new Error(`Gemini generation failed: ${geminiRes.status}`);
        }

        const geminiData = await geminiRes.json();
        const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const totalTime = Date.now() - startTime;
        console.log(`[clara-chat] ✅ Completed in ${totalTime}ms`);

        return new Response(
            JSON.stringify({
                answer,
                sources: chunks?.map((c: any) => ({
                    title: c.document_title,
                    similarity: c.similarity,
                })),
                metrics: {
                    total_time_ms: totalTime,
                    chunks_found: chunks?.length || 0,
                    embedding_model: EMBEDDING_MODEL,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        const totalTime = Date.now() - startTime;
        console.error(`[clara-chat] ❌ Error after ${totalTime}ms:`, err);

        return new Response(
            JSON.stringify({
                error: "Desculpe, ocorreu um erro ao processar sua mensagem.",
                details: (err as Error).message,
                time_elapsed_ms: totalTime,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
