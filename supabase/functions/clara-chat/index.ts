import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

type SearchChunk = {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  chunk_index: number;
  similarity: number;
  text_rank?: number;
  combined_score?: number;
};

type ChatErrorCode = "RATE_LIMIT" | "PAYMENT" | "CONFIG" | "UPSTREAM" | "INPUT";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

const FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const SEARCH_THRESHOLD = 0.3;
const SEARCH_MATCH_COUNT = 10;
const VECTOR_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;

const RATE_LIMIT_MAX_REQUESTS = 15;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getApiKey(): string {
  return Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
}

function vectorToPgText(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeConversation(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).role &&
        (item as Record<string, unknown>).content,
    )
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        role: entry.role === "assistant" ? "assistant" : "user",
        content: String(entry.content ?? "").trim(),
      };
    })
    .filter((item) => item.content.length > 0)
    .slice(-8);
}

function buildPrompt(message: string, chunks: SearchChunk[], history: ConversationTurn[]): string {
  const context = chunks
    .map((chunk, index) => {
      const title =
        typeof chunk.metadata?.title === "string"
          ? chunk.metadata.title
          : `Documento ${index + 1}`;
      return `[Fonte ${index + 1}] ${title}\n${chunk.content}`;
    })
    .join("\n\n");

  const historyText = history
    .map((turn) => `${turn.role === "assistant" ? "Assistente" : "Usuario"}: ${turn.content}`)
    .join("\n");

  return [
    "Voce e CLARA, assistente para legislacao e rotinas administrativas.",
    "Responda em portugues do Brasil, com objetividade e sem inventar fatos.",
    "Quando houver contexto, cite as fontes como [Fonte 1], [Fonte 2], etc.",
    "",
    "Contexto recuperado:",
    context || "Sem contexto encontrado.",
    "",
    "Historico recente:",
    historyText || "Sem historico.",
    "",
    `Pergunta do usuario: ${message}`,
    "",
    "Resposta:",
  ].join("\n");
}

async function generateEmbedding(message: string, apiKey: string): Promise<number[]> {
  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      content: { parts: [{ text: message }] },
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EMBEDDING_FAILED:${response.status}:${details}`);
  }

  const data = await response.json();
  const vector = data?.embedding?.values;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("EMBEDDING_EMPTY");
  }

  return vector as number[];
}

async function callGemini(prompt: string, apiKey: string): Promise<{ text: string; model: string }> {
  let lastError = "UNKNOWN";

  for (const model of FALLBACK_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
      },
    );

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (isNonEmptyString(text)) {
        return { text, model };
      }
      lastError = `${model}:EMPTY_TEXT`;
      continue;
    }

    const body = await response.text();
    lastError = `${model}:${response.status}:${body}`;

    if (response.status === 402) {
      throw new Error(`PAYMENT:${lastError}`);
    }
    if (response.status === 429) {
      throw new Error(`RATE_LIMIT:${lastError}`);
    }
  }

  throw new Error(`GENERATION_FAILED:${lastError}`);
}

function classifyError(message: string): { code: ChatErrorCode; details: string; status: number } {
  if (message.startsWith("RATE_LIMIT:")) {
    return { code: "RATE_LIMIT", details: message, status: 200 };
  }
  if (message.startsWith("PAYMENT:")) {
    return { code: "PAYMENT", details: message, status: 200 };
  }
  if (message.startsWith("EMBEDDING_FAILED:") || message.startsWith("GENERATION_FAILED:")) {
    return { code: "UPSTREAM", details: message, status: 502 };
  }
  if (message === "EMBEDDING_EMPTY") {
    return { code: "UPSTREAM", details: message, status: 502 };
  }
  if (message.startsWith("CONFIG:")) {
    return { code: "CONFIG", details: message, status: 500 };
  }
  return { code: "UPSTREAM", details: message, status: 500 };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed", request_id: requestId }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const apiKey = getApiKey();

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("CONFIG:SUPABASE_ENV_MISSING");
    }
    if (!apiKey) {
      throw new Error("CONFIG:GEMINI_API_KEY_MISSING");
    }

    const body = await req.json().catch(() => ({}));
    const message = String((body as Record<string, unknown>).message ?? "").trim();
    const conversationHistory = normalizeConversation(
      (body as Record<string, unknown>).conversationHistory,
    );

    if (!message) {
      return jsonResponse(
        { error: "Mensagem obrigatoria", details: "INPUT:EMPTY_MESSAGE", request_id: requestId },
        400,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const sessionFingerprint =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitStart = Date.now();
    const { data: limitData, error: limitError } = await supabase.rpc("check_rate_limit", {
      p_client_key: sessionFingerprint,
      p_endpoint: "clara-chat",
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (limitError) {
      console.error("[clara-chat] check_rate_limit failed", limitError);
    } else if (Array.isArray(limitData) && limitData[0] && limitData[0].allowed === false) {
      await supabase.from("chat_metrics").insert({
        request_id: requestId,
        rate_limit_hit: true,
        session_fingerprint: sessionFingerprint,
        mode: "rag",
        provider: "rate-limit",
        error_type: "RATE_LIMIT",
      });

      return jsonResponse(
        {
          error: "Muitas requisicoes. Tente novamente em alguns segundos.",
          details: "RATE_LIMIT",
          request_id: requestId,
        },
        200,
      );
    }

    const embeddingStart = Date.now();
    const embedding = await generateEmbedding(message, apiKey);
    const embeddingLatencyMs = Date.now() - embeddingStart;

    const searchStart = Date.now();
    const { data: chunksData, error: searchError } = await supabase.rpc("hybrid_search_chunks", {
      query_embedding: vectorToPgText(embedding),
      query_text: message,
      match_threshold: SEARCH_THRESHOLD,
      match_count: SEARCH_MATCH_COUNT,
      vector_weight: VECTOR_WEIGHT,
      keyword_weight: KEYWORD_WEIGHT,
    });

    if (searchError) {
      throw new Error(`SEARCH_FAILED:${searchError.message}`);
    }

    const chunks = (Array.isArray(chunksData) ? chunksData : []) as SearchChunk[];
    const searchLatencyMs = Date.now() - searchStart;

    const prompt = buildPrompt(message, chunks, conversationHistory);

    const llmStart = Date.now();
    const llm = await callGemini(prompt, apiKey);
    const llmTotalMs = Date.now() - llmStart;
    const totalTimeMs = Date.now() - startedAt;

    const sources = chunks.slice(0, 5).map((chunk, index) => ({
      title:
        typeof chunk.metadata?.title === "string"
          ? chunk.metadata.title
          : `Documento ${index + 1}`,
      similarity: chunk.similarity,
      chunk_index: chunk.chunk_index,
    }));

    await supabase.from("query_analytics").insert({
      user_query: message,
      assistant_response: llm.text,
      session_fingerprint: sessionFingerprint,
      sources_cited: sources.map((source) => source.title),
    });

    await supabase.from("search_metrics").insert({
      query_hash: await crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(message))
        .then((buf) =>
          Array.from(new Uint8Array(buf))
            .map((value) => value.toString(16).padStart(2, "0"))
            .join(""),
        ),
      vector_search_ms: searchLatencyMs,
      keyword_search_ms: 0,
      total_chunks_scanned: chunks.length,
      results_returned: chunks.length,
      threshold_used: SEARCH_THRESHOLD,
    });

    await supabase.from("chat_metrics").insert({
      request_id: requestId,
      embedding_latency_ms: embeddingLatencyMs,
      search_latency_ms: searchLatencyMs,
      llm_total_ms: llmTotalMs,
      llm_first_token_ms: llmTotalMs,
      local_chunks_found: chunks.length,
      provider: llm.model === FALLBACK_MODELS[0] ? "lovable-ai" : "gemini-direct",
      model: llm.model,
      mode: "rag",
      fallback_triggered: llm.model !== FALLBACK_MODELS[0],
      rate_limit_hit: false,
      web_search_used: false,
      web_sources_count: 0,
      session_fingerprint: sessionFingerprint,
    });

    console.log(
      `[clara-chat] OK request_id=${requestId} total=${totalTimeMs}ms chunks=${chunks.length} model=${llm.model} rateLimitCheck=${Date.now() - rateLimitStart}ms`,
    );

    return jsonResponse({
      answer: llm.text,
      provider: llm.model === FALLBACK_MODELS[0] ? "lovable-ai" : "gemini-direct",
      sources,
      metrics: {
        provider: llm.model === FALLBACK_MODELS[0] ? "lovable-ai" : "gemini-direct",
        model: llm.model,
        total_time_ms: totalTimeMs,
        embedding_ms: embeddingLatencyMs,
        search_ms: searchLatencyMs,
        llm_total_ms: llmTotalMs,
        chunks_found: chunks.length,
        version: "edge-v2",
      },
      request_id: requestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const classified = classifyError(message);

    console.error(`[clara-chat] ERROR request_id=${requestId}`, message);

    const payload = {
      error:
        classified.code === "RATE_LIMIT"
          ? "Sistema sobrecarregado, tente novamente em instantes."
          : classified.code === "PAYMENT"
            ? "Creditos do provedor esgotados."
            : "Falha ao processar a solicitacao.",
      details: classified.code,
      request_id: requestId,
    };

    if (classified.status === 200) {
      return jsonResponse(payload, 200);
    }

    return jsonResponse(payload, classified.status);
  }
});
