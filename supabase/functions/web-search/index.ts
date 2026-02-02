// Web Search Engine with Firecrawl + Native Fetch Fallback
// Handles caching, domain classification, and source confidence scoring

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================
// TYPES
// =============================================

interface WebSearchRequest {
  query: string;
  mode: "quick" | "deep" | "auto";
}

interface WebSource {
  url: string;
  title: string;
  domain: string;
  domain_category: "primary" | "official_mirror" | "aggregator" | "unknown";
  priority: number;
  excerpt_used: string;
  confidence: "high" | "medium" | "low";
  retrieved_at: string;
  extraction_method: "firecrawl" | "native_fetch" | "serp_snippet";
}

interface WebSearchResult {
  query: string;
  mode: "quick" | "deep";
  cached: boolean;
  sources: WebSource[];
  quorum_met: boolean;
  context_for_llm: string;
}

interface FirecrawlSearchResult {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  html?: string;
}

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  quick: {
    serpLimit: 5,
    fetchLimit: 3,
    crossCheck: false,
  },
  deep: {
    serpLimit: 10,
    fetchLimit: 6,
    crossCheck: true,
  },
};

// Patterns that indicate normative/legal queries requiring Deep mode
const NORMATIVE_PATTERNS = [
  /prazo|dias úteis|dias corridos/i,
  /decreto|lei|resolução|portaria|instrução normativa/i,
  /artigo|art\.|§|parágrafo/i,
  /obrigação|vedado|proibido|permitido/i,
  /penalidade|multa|sanção/i,
  /competência|atribuição/i,
  /vigência|vigente|revogad/i,
  /recurso|impugnação|contestação/i,
];

// =============================================
// SEI CONTEXT DETECTION
// =============================================

// Patterns that indicate SEI-related queries (electronic process system)
const SEI_PATTERNS = [
  /\bSEI\b/i,
  /processo eletr[oô]nico/i,
  /\bPEN\b/,
  /tramitar|tramita[çc][aã]o/i,
  /bloco.*assinatura|assinatura.*bloco/i,
  /dar ci[eê]ncia|ciencia/i,
  /\bNUP\b/i,
  /minutar|minuta/i,
  /sobrestamento|sobrestar/i,
  /unidade geradora/i,
  /documento externo/i,
  /processo relacionado/i,
  /tipo de conferência/i,
  /hipótese legal/i,
  /acompanhamento especial/i,
];

// Focused domains for SEI-related searches
const SEI_DOMAINS = [
  "manuais.processoeletronico.gov.br",
  "processoeletronico.gov.br",
  "wiki.processoeletronico.gov.br",
];

// Default domains for general municipal/legal searches
const DEFAULT_DOMAINS = [
  "prefeitura.rio",
  "gov.br",
  "leismunicipais.com.br",
];

function detectSEIContext(query: string): boolean {
  return SEI_PATTERNS.some((p) => p.test(query));
}

// =============================================
// UTILITIES
// =============================================

async function hashQuery(query: string): Promise<string> {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isNormativeQuery(query: string): boolean {
  return NORMATIVE_PATTERNS.some((p) => p.test(query));
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url.replace(/^https?:\/\/([^/]+).*$/, "$1");
  }
}

function extractTextFromHtml(html: string): string {
  // Remove scripts, styles, comments, nav, footer, header
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

  // Convert to text
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function extractRelevantExcerpt(content: string, query: string, maxLines: number = 6): string {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const sentences = content.split(/[.!?]\s+/);

  // Score sentences by relevance
  const scored = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (lower.includes(term)) score += 2;
    }
    // Bonus for normative patterns
    if (NORMATIVE_PATTERNS.some((p) => p.test(sentence))) score += 3;
    return { sentence, score };
  });

  // Sort by score and take top sentences
  const topSentences = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLines)
    .map((s) => s.sentence.trim());

  if (topSentences.length === 0) {
    // Fallback: take first few sentences
    return sentences.slice(0, 3).join(". ").slice(0, 500);
  }

  return topSentences.join(". ").slice(0, 800);
}

// =============================================
// FIRECRAWL API
// =============================================

async function searchWithFirecrawl(
  query: string,
  limit: number,
  domains?: string[]
): Promise<{ results: FirecrawlSearchResult[]; success: boolean }> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  
  if (!FIRECRAWL_API_KEY) {
    console.warn("[web-search] FIRECRAWL_API_KEY not configured");
    return { results: [], success: false };
  }

  // Build site filter based on provided domains or defaults
  const domainsToUse = domains && domains.length > 0 ? domains : DEFAULT_DOMAINS;
  const siteFilter = domainsToUse.map((d) => `site:${d}`).join(" OR ");
  const searchQuery = `${query} ${siteFilter}`;

  console.log(`[web-search] Firecrawl query: ${searchQuery.slice(0, 100)}...`);

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    });

    if (!response.ok) {
      console.error(`[web-search] Firecrawl error: ${response.status}`);
      return { results: [], success: false };
    }

    const data = await response.json();
    return {
      results: data.data || [],
      success: true,
    };
  } catch (error) {
    console.error("[web-search] Firecrawl request failed:", error);
    return { results: [], success: false };
  }
}

// =============================================
// NATIVE FETCH FALLBACK
// =============================================

async function fetchPageNative(url: string): Promise<{ content: string; success: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CLARA-Bot/1.0 (https://clarainova.lovable.app)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { content: "", success: false };
    }

    const html = await response.text();
    const content = extractTextFromHtml(html);

    return { content, success: content.length > 100 };
  } catch (error) {
    console.warn(`[web-search] Native fetch failed for ${url}:`, error);
    return { content: "", success: false };
  }
}

// =============================================
// DOMAIN CLASSIFICATION
// =============================================

interface DomainInfo {
  domain: string;
  category: "primary" | "official_mirror" | "aggregator" | "unknown";
  priority: number;
  description: string | null;
}

async function getDomainInfo(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  url: string
): Promise<DomainInfo> {
  const domain = extractDomain(url);

  try {
    const { data } = await supabase.rpc("get_domain_info", { p_url: url });
    const dataArray = data as Array<{ domain: string; category: string; priority: number; description: string | null }>;

    if (dataArray && dataArray.length > 0) {
      return {
        domain: dataArray[0].domain,
        category: dataArray[0].category as DomainInfo["category"],
        priority: dataArray[0].priority,
        description: dataArray[0].description,
      };
    }
  } catch (error) {
    console.warn("[web-search] get_domain_info failed:", error);
  }

  // Default for unknown domains
  return {
    domain,
    category: "unknown",
    priority: 30,
    description: null,
  };
}

// =============================================
// CONFIDENCE SCORING
// =============================================

function calculateConfidence(
  domainCategory: string,
  extractionMethod: string,
  contentLength: number,
  quorumSources: number
): "high" | "medium" | "low" {
  let score = 0;

  // Domain category scoring
  if (domainCategory === "primary") score += 40;
  else if (domainCategory === "official_mirror") score += 30;
  else if (domainCategory === "aggregator") score += 15;
  else score += 5;

  // Extraction method scoring
  if (extractionMethod === "firecrawl") score += 25;
  else if (extractionMethod === "native_fetch") score += 15;
  else score += 5; // serp_snippet

  // Content quality scoring
  if (contentLength > 500) score += 15;
  else if (contentLength > 200) score += 10;
  else score += 5;

  // Quorum bonus
  if (quorumSources >= 2) score += 20;

  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// =============================================
// MAIN SEARCH FUNCTION
// =============================================

async function performWebSearch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  query: string,
  requestedMode: "quick" | "deep" | "auto"
): Promise<WebSearchResult> {
  // Determine actual mode
  const mode: "quick" | "deep" =
    requestedMode === "auto"
      ? isNormativeQuery(query)
        ? "deep"
        : "quick"
      : requestedMode;

  const config = CONFIG[mode];
  const queryHash = await hashQuery(query);

  // Check cache first
  try {
    const { data: cached } = await supabase.rpc("get_cached_web_search", {
      p_query_hash: queryHash,
      p_mode: mode,
    });
    
    interface CachedResult {
      id: string;
      serp_results: unknown;
      fetched_pages: Array<Record<string, unknown>>;
      hit_count: number;
    }
    const cachedArray = cached as CachedResult[] | null;

    if (cachedArray && cachedArray.length > 0) {
      console.log(`[web-search] Cache hit for query: ${query.slice(0, 50)}...`);
      const cachedResult = cachedArray[0];
      
      // Reconstruct sources from cached data
      const sources: WebSource[] = (cachedResult.fetched_pages || []).map(
        (page: Record<string, unknown>) => ({
          url: page.url as string,
          title: page.title as string,
          domain: page.domain as string,
          domain_category: page.domain_category as WebSource["domain_category"],
          priority: page.priority as number,
          excerpt_used: page.excerpt_used as string,
          confidence: page.confidence as WebSource["confidence"],
          retrieved_at: page.retrieved_at as string,
          extraction_method: page.extraction_method as WebSource["extraction_method"],
        })
      );

      const primarySources = sources.filter(
        (s) => s.domain_category === "primary" || s.domain_category === "official_mirror"
      );

      return {
        query,
        mode,
        cached: true,
        sources,
        quorum_met: primarySources.length >= 2,
        context_for_llm: buildLLMContext(sources, query),
      };
    }
  } catch (error) {
    console.warn("[web-search] Cache check failed:", error);
  }

  // Detect SEI context for focused search
  const isSEIQuery = detectSEIContext(query);
  const searchDomains = isSEIQuery ? SEI_DOMAINS : undefined;

  console.log(`[web-search] Performing ${mode} search for: ${query.slice(0, 50)}... (SEI context: ${isSEIQuery})`);

  // Step 1: Try Firecrawl search with appropriate domains
  const { results: firecrawlResults, success: firecrawlSuccess } = await searchWithFirecrawl(
    query,
    config.serpLimit,
    searchDomains
  );

  const sources: WebSource[] = [];
  const serpResults: object[] = [];

  // Process Firecrawl results
  for (const result of firecrawlResults.slice(0, config.fetchLimit)) {
    const domainInfo = await getDomainInfo(supabase, result.url);
    const content = result.markdown || result.description || "";
    const excerpt = extractRelevantExcerpt(content, query);

    serpResults.push({
      url: result.url,
      title: result.title,
      description: result.description,
    });

    if (content.length < 200 && !firecrawlSuccess) {
      // Firecrawl failed or weak content, try native fetch
      const { content: nativeContent, success: nativeSuccess } = await fetchPageNative(result.url);

      if (nativeSuccess && nativeContent.length > 100) {
        const nativeExcerpt = extractRelevantExcerpt(nativeContent, query);
        sources.push({
          url: result.url,
          title: result.title,
          domain: domainInfo.domain,
          domain_category: domainInfo.category,
          priority: domainInfo.priority,
          excerpt_used: nativeExcerpt,
          confidence: calculateConfidence(domainInfo.category, "native_fetch", nativeContent.length, 0),
          retrieved_at: new Date().toISOString(),
          extraction_method: "native_fetch",
        });
        continue;
      }
    }

    // Use Firecrawl content if good, otherwise fallback to SERP snippet
    if (content.length >= 100) {
      sources.push({
        url: result.url,
        title: result.title,
        domain: domainInfo.domain,
        domain_category: domainInfo.category,
        priority: domainInfo.priority,
        excerpt_used: excerpt,
        confidence: calculateConfidence(domainInfo.category, "firecrawl", content.length, 0),
        retrieved_at: new Date().toISOString(),
        extraction_method: "firecrawl",
      });
    } else if (result.description) {
      // Fallback to SERP snippet
      sources.push({
        url: result.url,
        title: result.title,
        domain: domainInfo.domain,
        domain_category: domainInfo.category,
        priority: domainInfo.priority,
        excerpt_used: result.description.slice(0, 300),
        confidence: "low",
        retrieved_at: new Date().toISOString(),
        extraction_method: "serp_snippet",
      });
    }
  }

  // If Firecrawl failed entirely, try native fetch on SERP results
  if (!firecrawlSuccess && serpResults.length === 0) {
    console.log("[web-search] Firecrawl failed, no results to fallback");
  }

  // Re-calculate confidence with quorum information
  const primarySources = sources.filter(
    (s) => s.domain_category === "primary" || s.domain_category === "official_mirror"
  );
  const quorumMet = primarySources.length >= 2;

  // Update confidence based on quorum
  for (const source of sources) {
    source.confidence = calculateConfidence(
      source.domain_category,
      source.extraction_method,
      source.excerpt_used.length,
      primarySources.length
    );
  }

  // Sort by priority
  sources.sort((a, b) => b.priority - a.priority);

  // Save to cache
  try {
    await supabase.rpc("save_web_search_cache", {
      p_query_hash: queryHash,
      p_query_text: query,
      p_mode: mode,
      p_serp_results: serpResults,
      p_fetched_pages: sources,
    });
    console.log(`[web-search] Saved to cache: ${queryHash.slice(0, 16)}...`);
  } catch (error) {
    console.warn("[web-search] Failed to save cache:", error);
  }

  return {
    query,
    mode,
    cached: false,
    sources,
    quorum_met: quorumMet,
    context_for_llm: buildLLMContext(sources, query),
  };
}

// =============================================
// LLM CONTEXT BUILDER
// =============================================

function buildLLMContext(sources: WebSource[], query: string): string {
  if (sources.length === 0) {
    return `Nenhuma fonte web encontrada para: "${query}"`;
  }

  const lines: string[] = [
    "## Fontes Web Encontradas\n",
  ];

  // Group by confidence
  const highConf = sources.filter((s) => s.confidence === "high");
  const medConf = sources.filter((s) => s.confidence === "medium");
  const lowConf = sources.filter((s) => s.confidence === "low");

  if (highConf.length > 0) {
    lines.push("### Fontes de Alta Confiança (Oficiais):\n");
    for (const source of highConf) {
      lines.push(`**[${source.title}](${source.url})** (${source.domain})`);
      lines.push(`> ${source.excerpt_used}\n`);
    }
  }

  if (medConf.length > 0) {
    lines.push("\n### Fontes de Média Confiança:\n");
    for (const source of medConf) {
      lines.push(`**[${source.title}](${source.url})** (${source.domain})`);
      lines.push(`> ${source.excerpt_used}\n`);
    }
  }

  if (lowConf.length > 0 && highConf.length === 0 && medConf.length === 0) {
    lines.push("\n### Fontes Disponíveis (confirmar em fonte oficial):\n");
    for (const source of lowConf) {
      lines.push(`**[${source.title}](${source.url})** (${source.domain})`);
      lines.push(`> ${source.excerpt_used}\n`);
    }
  }

  // Quorum warning
  const primaryCount = sources.filter(
    (s) => s.domain_category === "primary" || s.domain_category === "official_mirror"
  ).length;

  if (primaryCount >= 2) {
    lines.push("\n✅ **Quórum atingido:** 2+ fontes oficiais confirmam a informação.");
  } else if (primaryCount === 1) {
    lines.push("\n⚠️ **Fonte única oficial:** Recomenda-se confirmar em fonte adicional.");
  } else {
    lines.push("\n⚠️ **Sem fonte oficial primária:** Informação de agregadores. Confirmar em D.O. ou portal oficial.");
  }

  return lines.join("\n");
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { query, mode = "auto" }: Partial<WebSearchRequest> = await req.json();

    // Validation
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (query.length > 500) {
      return new Response(
        JSON.stringify({ error: "Query muito longa. Máximo de 500 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validModes = ["quick", "deep", "auto"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Mode inválido. Use 'quick', 'deep' ou 'auto'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await performWebSearch(supabase, query, mode as WebSearchRequest["mode"]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[web-search] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
