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

type ResponseMode = "fast" | "deep";
type WebSearchMode = "auto" | "deep";

type DomainCategory = "primary" | "official_mirror" | "aggregator" | "unknown";
type Confidence = "high" | "medium" | "low";

type WebSourceData = {
  url: string;
  title: string;
  domain?: string;
  domain_category: DomainCategory;
  confidence: Confidence;
  excerpt_used: string;
  retrieved_at: string;
};

type ChatNotice = {
  type: "web_search" | "limited_base" | "general_guidance" | "out_of_scope" | "info";
  message: string;
};

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

function getWebSearchProvider(): string {
  return (Deno.env.get("WEB_SEARCH_PROVIDER") || "").trim().toLowerCase();
}

function getSerperApiKey(): string {
  return (Deno.env.get("SERPER_API_KEY") || "").trim();
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function looksTimeSensitive(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes("hoje") ||
    q.includes("agora") ||
    q.includes("atual") ||
    q.includes("atualmente") ||
    q.includes("últim") ||
    q.includes("recente") ||
    /\b202\d\b/.test(q) ||
    q.includes("mudou") ||
    q.includes("mudança") ||
    q.includes("nova regra") ||
    q.includes("novo") ||
    q.includes("novidade")
  );
}

function shouldUseWebSearch(mode: WebSearchMode, query: string, chunks: SearchChunk[]): boolean {
  if (mode === "deep") return true;
  // auto: only when local context is missing/weak or the question is clearly time-sensitive
  if (chunks.length === 0) return true;
  const top = chunks[0];
  const topSim = typeof top?.similarity === "number" ? top.similarity : 0;
  if (topSim < 0.55) return true;
  return looksTimeSensitive(query);
}

async function fetchTrustedDomainCategories(
  supabase: any,
  domains: string[],
): Promise<Record<string, DomainCategory>> {
  const unique = Array.from(new Set(domains.map((d) => d.toLowerCase()).filter(Boolean)));
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from("trusted_domains")
    .select("domain,category")
    .in("domain", unique);

  if (error) {
    console.error("[clara-chat] trusted_domains lookup failed", error);
    return {};
  }

  const map: Record<string, DomainCategory> = {};
  for (const row of data || []) {
    const domain = String((row as any).domain || "").toLowerCase();
    const categoryRaw = String((row as any).category || "").toLowerCase();
    const category: DomainCategory =
      categoryRaw === "primary" || categoryRaw === "official_mirror" || categoryRaw === "aggregator"
        ? (categoryRaw as DomainCategory)
        : "unknown";
    if (domain) map[domain] = category;
  }

  return map;
}

function deriveCategory(domain: string | null, trusted: Record<string, DomainCategory>): DomainCategory {
  if (!domain) return "unknown";
  const fromTable = trusted[domain];
  if (fromTable) return fromTable;
  if (domain.endsWith(".gov.br") || domain.endsWith(".jus.br")) return "primary";
  return "unknown";
}

function categoryConfidence(category: DomainCategory): Confidence {
  switch (category) {
    case "primary":
      return "high";
    case "official_mirror":
      return "medium";
    case "aggregator":
      return "medium";
    default:
      return "low";
  }
}

async function serperWebSearch(query: string, apiKey: string, num: number): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: query,
      num,
      gl: "br",
      hl: "pt",
    }),
  });

  if (!resp.ok) {
    const details = await resp.text().catch(() => "");
    throw new Error(`WEB_SEARCH_FAILED:${resp.status}:${details}`);
  }

  const data = await resp.json().catch(() => ({} as any));
  const organic = Array.isArray(data?.organic) ? data.organic : [];

  return organic
    .map((item: any) => ({
      url: String(item?.link || item?.url || "").trim(),
      title: String(item?.title || "").trim(),
      snippet: String(item?.snippet || item?.description || "").trim(),
    }))
    .filter((r: any) => r.url);
}

async function getCachedWebSources(
  supabase: any,
  queryHash: string,
  mode: WebSearchMode,
): Promise<WebSourceData[] | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("web_search_cache")
    .select("id,serp_results,hit_count,expires_at")
    .eq("query_hash", queryHash)
    .eq("mode", mode)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[clara-chat] web_search_cache read failed", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  const sourcesRaw = row?.serp_results;
  const sources = Array.isArray(sourcesRaw) ? (sourcesRaw as WebSourceData[]) : null;

  if (row?.id) {
    // Best-effort hit counter update.
    try {
      await supabase
        .from("web_search_cache")
        .update({ hit_count: Number(row.hit_count || 0) + 1 })
        .eq("id", row.id);
    } catch {
      // ignore
    }
  }

  return sources && sources.length > 0 ? sources : null;
}

async function saveWebSourcesToCache(
  supabase: any,
  queryHash: string,
  queryText: string,
  mode: WebSearchMode,
  sources: WebSourceData[],
): Promise<void> {
  try {
    await supabase.from("web_search_cache").insert({
      query_hash: queryHash,
      query_text: queryText,
      mode,
      serp_results: sources,
      fetched_pages: null,
      hit_count: 0,
    });
  } catch (err) {
    console.error("[clara-chat] web_search_cache insert failed", err);
  }
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

function buildPrompt(opts: {
  message: string;
  chunks: SearchChunk[];
  webSources: WebSourceData[];
  history: ConversationTurn[];
  mode: ResponseMode;
  webSearchMode: WebSearchMode;
}): string {
  const maxChunks = 6;
  const maxChunkChars = 1200;
  const localContext = opts.chunks
    .slice(0, maxChunks)
    .map((chunk, index) => {
      const title =
        typeof chunk.metadata?.title === "string" ? chunk.metadata.title : `Documento ${index + 1}`;
      const content = String(chunk.content || "").slice(0, maxChunkChars);
      return `[Fonte ${index + 1}] ${title}\n${content}`;
    })
    .join("\n\n");

  const maxWeb = 5;
  const maxExcerpt = 420;
  const webContext = opts.webSources
    .slice(0, maxWeb)
    .map((source, index) => {
      const title = source.title || source.domain || `Fonte web ${index + 1}`;
      const excerpt = String(source.excerpt_used || "").slice(0, maxExcerpt);
      return `[Web ${index + 1}] ${title}\nURL: ${source.url}\nTrecho: ${excerpt}`;
    })
    .join("\n\n");

  const historyText = opts.history
    .map((turn) => `${turn.role === "assistant" ? "Assistente" : "Usuario"}: ${turn.content}`)
    .join("\n");

  const modeStyle =
    opts.mode === "deep"
      ? [
          "Modo DIDATICO:",
          "- Explique passo a passo, com contexto e exemplos quando ajudar.",
          "- Se for um procedimento, termine com um checklist curto de proximos passos.",
          "- Mantenha tom acolhedor e claro, sem enrolacao.",
        ].join("\n")
      : [
          "Modo DIRETO:",
          "- Responda de forma objetiva, com passos numerados quando fizer sentido.",
          "- Evite texto longo. Se faltar informacao, faca 1-3 perguntas curtas.",
        ].join("\n");

  const webPolicy =
    opts.webSearchMode === "deep"
      ? "A busca web foi solicitada (deep). Use fontes [Web X] quando relevantes."
      : "Busca web em modo auto: use fontes [Web X] apenas se forem necessarias para complementar a base local.";

  return [
    "Voce e CLARA (Consultora de Legislacao e Apoio a Rotinas Administrativas).",
    "Responda em portugues do Brasil. Nao invente fatos; se nao tiver base, diga claramente.",
    "Cite fontes sempre que usar informacoes do contexto: [Fonte 1], [Fonte 2]... e/ou [Web 1], [Web 2]...",
    modeStyle,
    webPolicy,
    "",
    "Contexto LOCAL recuperado (base de conhecimento):",
    localContext || "Sem contexto local encontrado.",
    "",
    "Contexto WEB (quando houver):",
    webContext || "Sem fontes web nesta resposta.",
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

async function callGemini(
  prompt: string,
  apiKey: string,
  generationConfig: { temperature?: number; maxOutputTokens?: number } = {},
): Promise<{ text: string; model: string }> {
  let lastError = "UNKNOWN";

  const temperature = typeof generationConfig.temperature === "number" ? generationConfig.temperature : 0.3;
  const maxOutputTokens =
    typeof generationConfig.maxOutputTokens === "number" ? generationConfig.maxOutputTokens : 2048;

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
            temperature,
            maxOutputTokens,
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
  webSources: WebSourceData[];
  quorumMet: boolean;
  notice: ChatNotice | null;
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

  const responseMode: ResponseMode = opts.mode === "deep" ? "deep" : "fast";
  const webMode: WebSearchMode = opts.webSearchMode === "deep" ? "deep" : "auto";

  let webSources: WebSourceData[] = [];
  let webSearchUsed = false;
  let notice: ChatNotice | null = null;

  const wantsWeb = shouldUseWebSearch(webMode, opts.message, chunks);
  if (wantsWeb) {
    const provider = getWebSearchProvider();
    if (!provider) {
      notice = {
        type: "info",
        message: "Busca na web indisponivel (WEB_SEARCH_PROVIDER nao configurado).",
      };
    } else if (provider === "serper") {
      const serperKey = getSerperApiKey();
      if (!serperKey) {
        notice = {
          type: "info",
          message: "Busca na web indisponivel (SERPER_API_KEY nao configurada).",
        };
      } else {
        try {
          opts.onThinking?.("Buscando na web...");

          const queryHash = await sha256Hex(`${provider}:${webMode}:${opts.message}`);
          const cached = await getCachedWebSources(supabase, queryHash, webMode);
          if (cached) {
            webSources = cached;
            webSearchUsed = true;
          } else {
            const num = webMode === "deep" ? 8 : 5;
            const results = await serperWebSearch(opts.message, serperKey, num);
            const domains = results.map((r) => extractDomain(r.url)).filter((d): d is string => Boolean(d));
            const trusted = await fetchTrustedDomainCategories(supabase, domains);
            const retrievedAt = new Date().toISOString();

            webSources = results.slice(0, num).map((r) => {
              const domain = extractDomain(r.url) || undefined;
              const category = deriveCategory(domain ?? null, trusted);
              return {
                url: r.url,
                title: r.title || domain || "Fonte web",
                domain,
                domain_category: category,
                confidence: categoryConfidence(category),
                excerpt_used: r.snippet || "",
                retrieved_at: retrievedAt,
              };
            });

            if (webSources.length > 0) {
              webSearchUsed = true;
              await saveWebSourcesToCache(supabase, queryHash, opts.message, webMode, webSources);
            }
          }

          if (webSearchUsed) {
            notice = {
              type: "web_search",
              message:
                webMode === "deep"
                  ? "Usei busca na web (deep) para complementar a base local."
                  : "Usei busca na web para complementar a base local.",
            };
          }
        } catch (err) {
          console.error("[clara-chat] web search failed", err);
          notice = {
            type: "info",
            message: "Busca na web falhou; respondi usando apenas a base local.",
          };
        }
      }
    } else {
      notice = {
        type: "info",
        message: `WEB_SEARCH_PROVIDER '${provider}' nao suportado (use 'serper' ou deixe vazio).`,
      };
    }
  }

  if (chunks.length === 0 && webSources.length === 0) {
    notice = {
      type: "limited_base",
      message:
        "Nao encontrei fontes na base de conhecimento para esta pergunta. Posso orientar de forma geral, mas talvez voce queira adicionar documentos ou detalhar o caso.",
    };
  }

  opts.onThinking?.("Gerando resposta...");
  const prompt = buildPrompt({
    message: opts.message,
    chunks,
    webSources,
    history: opts.conversationHistory,
    mode: responseMode,
    webSearchMode: webMode,
  });

  const llmStart = Date.now();
  const llm = await callGemini(prompt, apiKey, {
    temperature: responseMode === "deep" ? 0.35 : 0.25,
    maxOutputTokens: responseMode === "deep" ? 2600 : 1400,
  });
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

  const sourcesCited = [
    ...sources.map((s) => s.title),
    ...webSources.slice(0, 5).map((s) => s.title || s.url),
  ].filter(Boolean);

  const distinctWebDomains = new Set(webSources.map((s) => s.domain).filter(Boolean)).size;
  const quorumMet =
    sources.length > 0 ||
    (webSources.length >= (webMode === "deep" ? 3 : 1) &&
      distinctWebDomains >= (webMode === "deep" ? 2 : 1));

  let queryId: string | null = null;
  try {
    const { data: row, error } = await supabase
      .from("query_analytics")
      .insert({
        user_query: opts.message,
        assistant_response: llm.text,
        session_fingerprint: opts.sessionFingerprint,
        sources_cited: sourcesCited,
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
      query_hash: await sha256Hex(opts.message),
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
      web_search_used: webSearchUsed,
      web_sources_count: webSources.length,
      session_fingerprint: opts.sessionFingerprint,
    });
  } catch (err) {
    console.error("[clara-chat] chat_metrics insert failed", err);
  }

  console.log(
    `[clara-chat] OK request_id=${opts.requestId} total=${totalTimeMs}ms chunks=${chunks.length} web=${webSources.length} model=${llm.model} rateLimitCheck=${Date.now() - rateLimitStart}ms`,
  );

  return {
    answer: llm.text,
    model: llm.model,
    queryId,
    sources,
    webSources,
    quorumMet,
    notice,
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
        web_sources: result.webSources,
        notice: result.notice,
        quorum_met: result.quorumMet,
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
        send("sources", {
          local: localTitles,
          web: result.webSources,
          quorum_met: result.quorumMet,
        });

        if (result.notice) {
          send("notice", result.notice);
        }

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
