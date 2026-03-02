import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge', // Using Edge runtime for fast streaming response support
};

// --- INITIALIZATION ---

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Free Tier AI Client (AI Studio)
const freeAiKey = process.env.GEMINI_API_KEY || '';
const freeAiClient = new GoogleGenAI({ apiKey: freeAiKey });

// Helper to initialize Premium AI Client (Vertex AI) initialized on demand
function getPremiumClient() {
    const project = process.env.VERTEX_PROJECT_ID || 'dummy-project';
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    // Vertex AI auth defaults to Application Default Credentials
    // In Vercel, this requires GOOGLE_APPLICATION_CREDENTIALS env pointing to JSON,
    // or setting VERTEX_SERVICE_ACCOUNT logic.
    return new GoogleGenAI({
        vertexai: { project, location }
    });
}

// --- GATEWAY LOGIC ---

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { message, history = [], mode = 'fast' } = body;

    if (!message) {
        return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }

    // 1. FEATURE FLAG (Kill Switch)
    // If undefined or false, explicitly fallback to free tier.
    const isPremiumEnabled = process.env.ENABLE_VERTEX_PREMIUM === 'true';
    let routingPath: 'TEXTO' | 'VISUAL' = 'TEXTO';

    // 2. TRIAGING CLASSIFIER (If Premium is enabled)
    if (isPremiumEnabled) {
        try {
            const triagePrompt = `Classifique a pergunta do usuário em duas categorias: TEXTO (se a resposta for um texto simples, teórico ou orientativo) ou VISUAL (se a resposta exigir desenhar um fluxograma, passo a passo visual, ícone SVG, imagem, podcast ou tabela complexa).
Responda APENAS com a palavra "TEXTO" ou "VISUAL".

Pergunta: "${message}"`;

            const triageResponse = await freeAiClient.models.generateContent({
                model: 'gemini-1.5-flash-8b', // Fast & cheap
                contents: triagePrompt,
                config: { maxOutputTokens: 5, temperature: 0.1 }
            });

            const decision = triageResponse.text?.trim().toUpperCase();
            if (decision === 'VISUAL') {
                routingPath = 'VISUAL';
            }
        } catch (err) {
            console.warn("Triaging error, falling back to TEXTO route.", err);
        }
    }

    console.log(`[LLM Gateway] Premium Enabled: ${isPremiumEnabled} | Route Assigned: ${routingPath}`);

    // 3. RETRIEVING CONTEXT (RAG via Supabase)
    let vectorContext = "";
    try {
        // Generate simple embedding using free tier for search
        const embedRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${freeAiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: { parts: [{ text: message }] },
                outputDimensionality: 768,
            })
        });
        const embedData = await embedRes.json();
        const vector = embedData?.embedding?.values;

        if (vector) {
            const { data: chunks } = await supabase.rpc('hybrid_search_chunks', {
                query_embedding: `[${vector.join(",")}]`,
                query_text: message,
                match_threshold: 0.3,
                match_count: 5,
                vector_weight: 0.7,
                keyword_weight: 0.3,
            });

            if (chunks && Array.isArray(chunks)) {
                vectorContext = chunks.map((c: any, i: number) => `[Fonte ${i + 1}] ${c.content}`).join('\n\n');
            }
        }
    } catch (err) {
        console.error("Supabase vector retrieval error:", err);
    }

    // Define basic instructions based on routing path
    const systemInstructions = routingPath === 'VISUAL'
        ? `Você é Clara. O usuário fez uma pergunta que demanda uma resposta VISUAL.
Regras de Ouro:
1. Explique o contexto de forma clara e profissional.
2. Sempre que possível, inclua um grande bloco Markdown \`\`\`mermaid\`\`\` gerando um fluxograma detalhado para ilustrar o processo ou problema.
3. Se a interface exigir clicar em um botão específico (ex: "aprovar", "salvar", "alertas"), NÃO descreva o botão com palavras. Gere o código <svg> inline exatamente onde ele apareceria na frase usando as cores amarela e laranja.
4. Baseie-se no contexto RAG fornecido: ${vectorContext || 'Sem contexto adicional.'}`
        : `Você é Clara, especialista em administração e sistemas. Responda em português direto baseado no contexto.
Contexto: ${vectorContext || 'Sem contexto adicional.'}`;

    // Formatting history appropriately for the GenAI SDK
    const formattedHistory = history.map((h: { role: string; content: string }) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
    const finalContents = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] }
    ];

    // 4. ROUTING AND STREAMING BACK TO CLIENT
    try {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {

                let aiModelOptions;
                let clientToUse;

                if (routingPath === 'VISUAL') {
                    // Premium Route
                    clientToUse = getPremiumClient();
                    aiModelOptions = {
                        model: 'gemini-3.1-pro',
                        contents: finalContents,
                        config: {
                            systemInstruction: systemInstructions,
                            temperature: 0.4
                        }
                    };
                    controller.enqueue(encoder.encode(`event: notice\ndata: ${JSON.stringify({ type: "info", message: "⚡ Acionando Vertex AI Premium (Gemini 3.1 Pro) Inteligência Visual Ativa" })}\n\n`));
                } else {
                    // Free Route
                    clientToUse = freeAiClient;
                    aiModelOptions = {
                        model: 'gemini-1.5-flash',
                        contents: finalContents,
                        config: {
                            systemInstruction: systemInstructions,
                            temperature: 0.3
                        }
                    };
                    controller.enqueue(encoder.encode(`event: notice\ndata: ${JSON.stringify({ type: "info", message: "✅ Respondendo via API Gateway (Custo Otimizado)" })}\n\n`));
                }

                try {
                    // Execute SSE Streaming using selected model
                    const responseStream = await clientToUse.models.generateContentStream(aiModelOptions);

                    for await (const chunk of responseStream) {
                        if (chunk.text) {
                            const deltaPayload = JSON.stringify({ content: chunk.text });
                            controller.enqueue(encoder.encode(`event: delta\ndata: ${deltaPayload}\n\n`));
                        }
                    }

                    // Send completion signal
                    controller.enqueue(encoder.encode(`event: done\ndata: {"query_id": "vercel-gateway-session"}\n\n`));

                } catch (streamingError: any) {
                    console.error("Streaming error:", streamingError);
                    const errPayload = JSON.stringify({ message: "Ocorreu um erro gerando a resposta na rota escolhida." });
                    controller.enqueue(encoder.encode(`event: error\ndata: ${errPayload}\n\n`));
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error: any) {
        console.error("Gateway Final execution error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
