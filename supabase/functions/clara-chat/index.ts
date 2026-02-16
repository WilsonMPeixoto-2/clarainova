import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  GUARDRAIL_SYSTEM_PROMPT,
  getSafeResponse,
  sanitizeAndClassifyRisk,
} from "./guardrails.ts";

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

type ResponseMode = "fast" | "deep";
type WebSearchMode = "auto" | "deep";

const SEARCH_THRESHOLD = 0.3;
const SEARCH_MATCH_COUNT = 10;
const VECTOR_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;

// If results are too weak, we attempt web search (auto/deep modes only).
// hybrid_search_chunks produces RRF-style combined_score around ~0.016 at rank 1, so < 0.015 is a good "weak" signal.
const WEB_SEARCH_WEAK_AVG_SCORE = 0.015;

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

function normalizeMode(value: unknown): ResponseMode {
  return value === "deep" ? "deep" : "fast";
}

function normalizeWebSearchMode(value: unknown): WebSearchMode {
  return value === "deep" ? "deep" : "auto";
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

type WebSource = {
  url: string;
  title: string;
  domain?: string;
  domain_category: "primary" | "official_mirror" | "aggregator" | "unknown";
  confidence: "high" | "medium" | "low";
  excerpt_used: string;
  retrieved_at: string;
};

type WebSearchResult = {
  sources: WebSource[];
  quorum_met: boolean;
  mode: "quick" | "deep";
  cached: boolean;
};

function isWebSource(value: unknown): value is WebSource {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.url === "string" &&
    typeof obj.title === "string" &&
    typeof obj.domain_category === "string" &&
    typeof obj.confidence === "string" &&
    typeof obj.excerpt_used === "string" &&
    typeof obj.retrieved_at === "string"
  );
}

function buildWebContext(sources: WebSource[]): string {
  if (sources.length === 0) return "Sem fontes web.";
  return sources
    .slice(0, 6)
    .map((s, i) => {
      const domain =
        s.domain ||
        (() => {
          try {
            return new URL(s.url).hostname;
          } catch {
            return "";
          }
        })();
      return [
        `[Web ${i + 1}] ${s.title}${domain ? ` (${domain})` : ""}`,
        s.excerpt_used ? s.excerpt_used : "",
        s.url,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

const MODE_INSTRUCTIONS: Record<ResponseMode, string> = {
  fast: [
    "Modo: DIRETO (objetivo).",
    "- Responda em ate 10 linhas quando possivel.",
    "- Priorize passos numerados e checklists curtas.",
    "- Se faltar informacao, faca 1-2 perguntas de esclarecimento.",
  ].join("\n"),
  deep: [
    "Modo: DIDATICO (explicativo).",
    "- Explique o 'por que' com contexto e definicoes curtas.",
    "- Estruture em secoes: Resumo, Passo a passo, Observacoes, Exemplo (se ajudar).",
    "- Evite jargoes; quando usar, defina em 1 frase.",
  ].join("\n"),
};

function buildPrompt(opts: {
  message: string;
  mode: ResponseMode;
  chunks: SearchChunk[];
  webSources: WebSource[];
  history: ConversationTurn[];
}): string {
  const context = chunks
    .map((chunk, index) => {
      const title =
        typeof chunk.metadata?.title === "string"
          ? chunk.metadata.title
          : `Documento ${index + 1}`;
      return `[Fonte ${index + 1}] ${title}\n${chunk.content}`;
    })
    .join("\n\n");

  const historyText = opts.history
    .map((turn) => `${turn.role === "assistant" ? "Assistente" : "Usuario"}: ${turn.content}`)
    .join("\n");

  const webContext = buildWebContext(opts.webSources);

  return [
    GUARDRAIL_SYSTEM_PROMPT.trim(),
    "",
    "Voce e CLARA, assistente para legislacao e rotinas administrativas.",
    "Responda em portugues do Brasil, com objetividade e sem inventar fatos.",
    "Tom: acolhedor, direto e profissional. Evite sermoes e seja pratica.",
    "",
    MODE_INSTRUCTIONS[opts.mode],
    "",
    "Regras de fontes:",
    "- Use primeiro a base interna (Fontes locais).",
    "- Se usar Fontes Web, trate como complementar e cite como [Web 1], [Web 2], etc.",
    "- Se nao houver fontes suficientes, diga isso explicitamente.",
    "- Se nao houver fontes locais nem web, responda apenas com orientacao geral e indique onde confirmar em fonte oficial.",
    "Quando houver contexto, cite as fontes como [Fonte 1], [Fonte 2], [Web 1], etc.",
    "",
    "Contexto recuperado:",
    context || "Sem contexto encontrado.",
    "",
    "Fontes web (se houver):",
    webContext,
    "",
    "Historico recente:",
    historyText || "Sem historico.",
    "",
    `Pergunta do usuario: ${opts.message}`,
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

async function maybeWebSearch(opts: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  query: string;
  mode: WebSearchMode;
}): Promise<WebSearchResult | null> {
  const endpoint = `${opts.supabaseUrl.replace(/\/$/, "")}/functions/v1/web-search`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: opts.supabaseServiceRoleKey,
        Authorization: `Bearer ${opts.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        query: opts.query,
        mode: opts.mode,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[clara-chat] web-search failed: ${response.status} ${text.slice(0, 200)}`);
      return null;
    }

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) return null;

    const sourcesRaw = data.sources;
    const sources = Array.isArray(sourcesRaw) ? sourcesRaw.filter(isWebSource) : [];
    const quorum_met = data.quorum_met === true;
    const cached = data.cached === true;
    const modeRaw = data.mode;
    const mode = modeRaw === "deep" ? "deep" : "quick";

    return {
      sources,
      quorum_met,
      cached,
      mode,
    };
  } catch (error) {
    console.warn("[clara-chat] web-search call error:", error);
    return null;
  }
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
  webSources: WebSource[];
  webQuorumMet: boolean;
  webSearchUsed: boolean;
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
  mode: ResponseMode;
  webSearchMode: WebSearchMode;
  onThinking?: (step: string) => void;
  onNotice?: (notice: {
    type: "web_search" | "limited_base" | "general_guidance" | "out_of_scope" | "info";
    message: string;
  }) => void;
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
        provider: "gemini",
        error_type: "RATE_LIMIT",
      });
    } catch (err) {
      console.error("[clara-chat] chat_metrics insert failed (rate-limit)", err);
    }

    throw new Error("RATE_LIMIT:HIT");
  }

  const risk = sanitizeAndClassifyRisk(opts.message);
  if (risk.blocked) {
    const safe = getSafeResponse(risk.category);
    opts.onNotice?.({
      type: "out_of_scope",
      message:
        "Posso ajudar com SEI, rotinas administrativas e legislacao. Reformule sua pergunta nesse contexto.",
    });

    return {
      answer: safe,
      model: "guardrails",
      queryId: null,
      sources: [],
      webSources: [],
      webQuorumMet: false,
      webSearchUsed: false,
      chunksFound: 0,
      timings: {
        totalTimeMs: Date.now() - opts.startedAt,
        embeddingLatencyMs: 0,
        searchLatencyMs: 0,
        llmTotalMs: 0,
        rateLimitCheckMs: Date.now() - rateLimitStart,
      },
    };
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

  const localAvgScore = (() => {
    const values = chunks
      .slice(0, 5)
      .map((c) => (typeof c.combined_score === "number" ? c.combined_score : 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  })();

  const shouldWebSearch =
    opts.webSearchMode === "deep" ||
    (opts.webSearchMode === "auto" &&
      (chunks.length === 0 || localAvgScore < WEB_SEARCH_WEAK_AVG_SCORE));

  let webSources: WebSource[] = [];
  let webQuorumMet = false;
  let webSearchUsed = false;

  if (chunks.length === 0) {
    opts.onNotice?.({
      type: "limited_base",
      message:
        "Base interna com pouca informacao para essa pergunta. Posso complementar com busca web quando necessario.",
    });
  }

  if (shouldWebSearch) {
    opts.onThinking?.("Buscando na web...");
    const result = await maybeWebSearch({
      supabaseUrl,
      supabaseServiceRoleKey,
      query: opts.message,
      mode: opts.webSearchMode,
    });

    webSources = result?.sources || [];
    webQuorumMet = result?.quorum_met === true;
    webSearchUsed = webSources.length > 0;

    if (webSearchUsed) {
      opts.onNotice?.({
        type: "web_search",
        message: `Usei busca na web para complementar (${webSources.length} fonte${
          webSources.length === 1 ? "" : "s"
        }).`,
      });
    }
  }

  opts.onThinking?.("Gerando resposta...");
  const prompt = buildPrompt({
    message: opts.message,
    mode: opts.mode,
    chunks,
    webSources,
    history: opts.conversationHistory,
  });

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
    const cited = [
      ...sources.map((s) => s.title),
      ...webSources.slice(0, 6).map((s) => s.title || s.url),
    ].filter(Boolean);

    const { data: row, error } = await supabase
      .from("query_analytics")
      .insert({
        user_query: opts.message,
        assistant_response: llm.text,
        session_fingerprint: opts.sessionFingerprint,
        sources_cited: cited,
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
      provider: "gemini",
      model: llm.model,
      mode: opts.mode,
      fallback_triggered: fallbackTriggered,
      rate_limit_hit: false,
      web_search_used: webSearchUsed,
      web_sources_count: webSources.length,
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
    webSources,
    webQuorumMet,
    webSearchUsed,
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

  const mode = normalizeMode(body.mode);
  const webSearchMode = normalizeWebSearchMode(body.webSearchMode);
  const continuation = body.continuation === true;

  const rawHistory = body.history ?? body.conversationHistory;
  if (Array.isArray(rawHistory) && rawHistory.length > 50) {
    return jsonResponse(
      { error: "Historico muito longo (max 50 mensagens).", details: "INPUT:HISTORY_TOO_LONG", request_id: requestId },
      400,
    );
  }
  const conversationHistory = normalizeConversation(rawHistory);

  let message = String(body.message ?? "").trim();
  if (!message && continuation) {
    message = lastUserMessage(conversationHistory);
  }

  if (message.length > 10000) {
    return jsonResponse(
      { error: "Mensagem muito longa (max 10000 caracteres).", details: "INPUT:MESSAGE_TOO_LONG", request_id: requestId },
      400,
    );
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
        provider: "gemini",
        sources: result.sources,
        web_sources: result.webSources,
        web_quorum_met: result.webQuorumMet,
        query_id: result.queryId,
        metrics: {
          provider: "gemini",
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
          onNotice(notice) {
            send("notice", notice);
          },
        });

        send("api_provider", { provider: "gemini", model: result.model });

        const localTitles = result.sources.map((s) => s.title).filter(Boolean);
        const web = result.webSources;
        send("sources", {
          local: localTitles,
          ...(web.length > 0 ? { web } : {}),
          ...(result.webSearchUsed ? { quorum_met: result.webQuorumMet } : {}),
        });

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
