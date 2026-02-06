import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

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
        throw new Error(`Embedding failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.embedding?.values || [];
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Proteger com x-admin-key
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_KEY");

    if (!adminKey || adminKey !== expectedKey) {
        return new Response(
            JSON.stringify({ error: "Acesso não autorizado" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        const googleApiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
        if (!googleApiKey) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY ou GEMINI_API_KEY não configurada");
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") || "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
        );

        // Buscar todos os chunks
        const { data: chunks, error: fetchError } = await supabase
            .from("document_chunks")
            .select("id, content")
            .order("created_at", { ascending: true });

        if (fetchError) throw new Error(`Erro ao buscar chunks: ${fetchError.message}`);
        if (!chunks || chunks.length === 0) {
            return new Response(
                JSON.stringify({ message: "Nenhum chunk encontrado para reprocessar" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[re-embed] Iniciando reprocessamento de ${chunks.length} chunks`);

        let success = 0;
        let errors = 0;
        const errorDetails: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                // Delay entre chamadas para evitar rate limit
                if (i > 0) await new Promise((r) => setTimeout(r, 200));

                const embedding = await generateEmbedding(chunk.content, googleApiKey);

                if (embedding.length !== 768) {
                    throw new Error(`Dimensão incorreta: ${embedding.length} (esperado 768)`);
                }

                const { error: updateError } = await supabase
                    .from("document_chunks")
                    .update({ embedding: JSON.stringify(embedding) })
                    .eq("id", chunk.id);

                if (updateError) throw new Error(`Update failed: ${updateError.message}`);

                success++;
                console.log(`[re-embed] ✅ ${i + 1}/${chunks.length} - chunk ${chunk.id}`);
            } catch (err) {
                errors++;
                const errMsg = `Chunk ${chunk.id}: ${(err as Error).message}`;
                errorDetails.push(errMsg);
                console.error(`[re-embed] ❌ ${errMsg}`);
            }
        }

        console.log(`[re-embed] Concluído: ${success} sucesso, ${errors} erros`);

        return new Response(
            JSON.stringify({
                message: `Reprocessamento concluído`,
                total: chunks.length,
                success,
                errors,
                errorDetails: errorDetails.slice(0, 10),
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error(`[re-embed] Erro fatal:`, err);
        return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
