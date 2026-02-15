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
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-fingerprint",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

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

const encoder = new TextEncoder();

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

function sseResponse(stream: ReadableStream<Uint8Array>, status = 200): Response {
  return new Response(stream, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function wantsSse(req: Request, body: Record<string, unknown>): boolean {
  const accept = (req.headers.get("accept") || "").toLowerCase();
  if (accept.includes("text/event-stream")) return true;
  const streamFlag = body.stream;
  if (streamFlag === true || streamFlag === "true") return true;
  return false;
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

function lastUserMessage(history: ConversationTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== "user") continue;
    const content = history[i].content.trim();
    if (content) return content;
  }
  return "";
}

function chunkText(text: string, maxChars = 140): string[] {
  const input = text ?? "";
  if (!input.trim()) return [""];
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += maxChars) {
    chunks.push(input.slice(i, i + maxChars));
  }
  return chunks.length > 0 ? chunks : [input];
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
  if (message.startsWith("SEARCH_FAILED:")) {
    return { code: "UPSTREAM", details: message, status: 502 };
  }
  if (message.startsWith("CONFIG:")) {
    return { code: "CONFIG", details: message, status: 500 };
  }
  if (message.startsWith("INPUT:")) {
    return { code: "INPUT", details: message, status: 400 };
  }
  return { code: "UPSTREAM", details: message, status: 500 };
}

function userFacingErrorMessage(code: ChatErrorCode): string {
  switch (code) {
    case "RATE_LIMIT":
      return "Muitas requisicoes. Tente novamente em alguns segundos.";
    case "PAYMENT":
      return "Creditos do provedor esgotados.";
    case "CONFIG":
      return "Falha de configuracao do servidor.";
    case "INPUT":
      return "Solicitacao invalida.";
    default:
      return "Falha ao processar a solicitacao.";
  }
}

type ComputeResult = {
  answer: string;
  model: string;
  queryId: string | null;
  sources: { title: string; similarity: number; chunk_index: number }[];
  chunksFound: number;
  timings: {
    totalTimeMs: number;
    embeddingLatencyMs: number;
    searchLatencyMs: number;
    llmTotalMs: number;
    rateLimitCheckMs: number;
  };
};

async function computeAnswer(opts: {
  requestId: string;
  startedAt: number;
  sessionFingerprint: string;
  message: string;
  conversationHistory: ConversationTurn[];
  mode: string;
  webSearchMode: string;
  onThinking?: (step: string) => void;
}): Promise<ComputeResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const apiKey = getApiKey();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("CONFIG:SUPABASE_ENV_MISSING");
  }
  if (!apiKey) {
    throw new Error("CONFIG:GEMINI_API_KEY_MISSING");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const rateLimitStart = Date.now();
  opts.onThinking?.("Checando limite de uso...");

  const { data: limitData, error: limitError } = await supabase.rpc("check_rate_limit", {
    p_client_key: opts.sessionFingerprint,
    p_endpoint: "clara-chat",
    p_max_requests: RATE_LIMIT_MAX_REQUESTS,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (limitError) {
    console.error("[clara-chat] check_rate_limit failed", limitError);
  } else if (Array.isArray(limitData) && limitData[0] && limitData[0].allowed === false) {
    try {
      await supabase.from("chat_metrics").insert({
        request_id: opts.requestId,
        rate_limit_hit: true,
        session_fingerprint: opts.sessionFingerprint,
        mode: opts.mode,
        provider: "rate-limit",
        error_type: "RATE_LIMIT",
      });
    } catch (err) {
      console.error("[clara-chat] chat_metrics insert failed (rate-limit)", err);
    }

    throw new Error("RATE_LIMIT:HIT");
  }

  opts.onThinking?.("Gerando embedding...");
  const embeddingStart = Date.now();
  const embedding = await generateEmbedding(opts.message, apiKey);
  const embeddingLatencyMs = Date.now() - embeddingStart;

  opts.onThinking?.("Buscando documentos...");
  const searchStart = Date.now();
  const { data: chunksData, error: searchError } = await supabase.rpc("hybrid_search_chunks", {
    query_embedding: vectorToPgText(embedding),
    query_text: opts.message,
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

  opts.onThinking?.("Gerando resposta...");
  const prompt = buildPrompt(opts.message, chunks, opts.conversationHistory);

  const llmStart = Date.now();
  const llm = await callGemini(prompt, apiKey);
  const llmTotalMs = Date.now() - llmStart;

  const totalTimeMs = Date.now() - opts.startedAt;

  const sources = chunks.slice(0, 5).map((chunk, index) => ({
    title:
      typeof chunk.metadata?.title === "string"
        ? chunk.metadata.title
        : `Documento ${index + 1}`,
    similarity: chunk.similarity,
    chunk_index: chunk.chunk_index,
  }));

  let queryId: string | null = null;
  try {
    const { data: row, error } = await supabase
      .from("query_analytics")
      .insert({
        user_query: opts.message,
        assistant_response: llm.text,
        session_fingerprint: opts.sessionFingerprint,
        sources_cited: sources.map((source) => source.title),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[clara-chat] query_analytics insert failed", error);
    } else {
      queryId = row?.id ?? null;
    }
  } catch (err) {
    console.error("[clara-chat] query_analytics insert failed", err);
  }

  try {
    await supabase.from("search_metrics").insert({
      query_hash: await crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(opts.message))
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
  } catch (err) {
    console.error("[clara-chat] search_metrics insert failed", err);
  }

  try {
    const fallbackTriggered = llm.model !== FALLBACK_MODELS[0];
    await supabase.from("chat_metrics").insert({
      request_id: opts.requestId,
      embedding_latency_ms: embeddingLatencyMs,
      search_latency_ms: searchLatencyMs,
      llm_total_ms: llmTotalMs,
      llm_first_token_ms: llmTotalMs,
      local_chunks_found: chunks.length,
      provider: "gemini-direct",
      model: llm.model,
      mode: opts.mode,
      fallback_triggered: fallbackTriggered,
      rate_limit_hit: false,
      web_search_used: false,
      web_sources_count: 0,
      session_fingerprint: opts.sessionFingerprint,
    });
  } catch (err) {
    console.error("[clara-chat] chat_metrics insert failed", err);
  }

  console.log(
    `[clara-chat] OK request_id=${opts.requestId} total=${totalTimeMs}ms chunks=${chunks.length} model=${llm.model} rateLimitCheck=${Date.now() - rateLimitStart}ms`,
  );

  return {
    answer: llm.text,
    model: llm.model,
    queryId,
    sources,
    chunksFound: chunks.length,
    timings: {
      totalTimeMs,
      embeddingLatencyMs,
      searchLatencyMs,
      llmTotalMs,
      rateLimitCheckMs: Date.now() - rateLimitStart,
    },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", request_id: requestId }, 405);
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const wantsStream = wantsSse(req, body);

  const mode = String(body.mode ?? "fast");
  const webSearchMode = String(body.webSearchMode ?? "auto");
  const continuation = body.continuation === true;

  const conversationHistory = normalizeConversation(body.history ?? body.conversationHistory);

  let message = String(body.message ?? "").trim();
  if (!message && continuation) {
    message = lastUserMessage(conversationHistory);
  }

  if (!message) {
    return jsonResponse(
      { error: "Mensagem obrigatoria", details: "INPUT:EMPTY_MESSAGE", request_id: requestId },
      400,
    );
  }

  const sessionFingerprint =
    req.headers.get("x-session-fingerprint") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!wantsStream) {
    try {
      const result = await computeAnswer({
        requestId,
        startedAt,
        sessionFingerprint,
        message,
        conversationHistory,
        mode,
        webSearchMode,
      });

      return jsonResponse({
        answer: result.answer,
        provider: "gemini-direct",
        sources: result.sources,
        query_id: result.queryId,
        metrics: {
          provider: "gemini-direct",
          model: result.model,
          total_time_ms: result.timings.totalTimeMs,
          embedding_ms: result.timings.embeddingLatencyMs,
          search_ms: result.timings.searchLatencyMs,
          llm_total_ms: result.timings.llmTotalMs,
          chunks_found: result.chunksFound,
          version: "edge-v3",
        },
        request_id: requestId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      const classified = classifyError(message);

      console.error(`[clara-chat] ERROR request_id=${requestId}`, message);

      const payload = {
        error: userFacingErrorMessage(classified.code),
        details: classified.code,
        request_id: requestId,
      };

      return jsonResponse(payload, classified.status);
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(sseEvent(event, data));
      };

      send("request_id", { id: requestId });

      try {
        const result = await computeAnswer({
          requestId,
          startedAt,
          sessionFingerprint,
          message,
          conversationHistory,
          mode,
          webSearchMode,
          onThinking(step) {
            send("thinking", { step });
          },
        });

        send("api_provider", { provider: "gemini", model: result.model });

        const localTitles = result.sources.map((s) => s.title).filter(Boolean);
        send("sources", { local: localTitles, quorum_met: localTitles.length > 0 });

        for (const chunk of chunkText(result.answer)) {
          if (chunk) {
            send("delta", { content: chunk });
          }
        }

        send("done", { ok: true, query_id: result.queryId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        const classified = classifyError(message);

        console.error(`[clara-chat] ERROR request_id=${requestId}`, message);

        send("error", {
          message: userFacingErrorMessage(classified.code),
          details: classified.code,
          request_id: requestId,
        });
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream, 200);
});
