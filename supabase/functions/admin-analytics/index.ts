import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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

function parseIntParam(value: string | null, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Parse admin keys from environment.
 * Supports multiple keys via ADMIN_KEYS (comma-separated) with fallback to ADMIN_KEY.
 */
function parseAdminKeys(): string[] {
  const adminKeys = Deno.env.get("ADMIN_KEYS");
  if (adminKeys) {
    const keys = adminKeys
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (keys.length > 0) return keys;
  }

  const adminKey = Deno.env.get("ADMIN_KEY");
  if (adminKey && adminKey.trim().length > 0) return [adminKey.trim()];

  return [];
}

function isValidAdminKey(providedKey: string, validKeys: string[]): boolean {
  if (!providedKey || validKeys.length === 0) return false;
  return validKeys.includes(providedKey.trim());
}

function requireSupabaseEnv(): { url: string; serviceKey: string } {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) {
    throw new Error("CONFIG:SUPABASE_ENV_MISSING");
  }
  return { url, serviceKey };
}

function requireAdmin(req: Request): string {
  const validKeys = parseAdminKeys();
  if (validKeys.length === 0) {
    throw new Error("CONFIG:ADMIN_KEY_MISSING");
  }
  const providedKey = (req.headers.get("x-admin-key") || "").trim();
  if (!isValidAdminKey(providedKey, validKeys)) {
    throw new Error("AUTH:UNAUTHORIZED");
  }
  return providedKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Validate admin key
    requireAdmin(req);

    const { url: supabaseUrl, serviceKey } = requireSupabaseEnv();
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || "";

    // Optional filtering by days for all endpoints
    const days = clampInt(parseIntParam(url.searchParams.get("days"), 0), 0, 365);
    const sinceIso = days > 0
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // =============================================
    // GET /admin-analytics/analytics
    // Returns raw queries + feedbacks for admin dashboards.
    // =============================================
    if (lastPart === "analytics") {
      const limitQueries = clampInt(parseIntParam(url.searchParams.get("limit_queries"), 1000), 1, 2000);
      const limitFeedback = clampInt(parseIntParam(url.searchParams.get("limit_feedback"), 500), 1, 2000);

      let q = supabase
        .from("query_analytics")
        .select("id, user_query, assistant_response, sources_cited, created_at, session_fingerprint")
        .order("created_at", { ascending: false })
        .limit(limitQueries);
      if (sinceIso) q = q.gte("created_at", sinceIso);

      let f = supabase
        .from("response_feedback")
        .select("id, query_id, rating, feedback_category, feedback_text, created_at")
        .order("created_at", { ascending: false })
        .limit(limitFeedback);
      if (sinceIso) f = f.gte("created_at", sinceIso);

      const [queriesRes, feedbackRes] = await Promise.all([q, f]);
      if (queriesRes.error) throw new Error(`DB:QUERY_ANALYTICS:${queriesRes.error.message}`);
      if (feedbackRes.error) throw new Error(`DB:RESPONSE_FEEDBACK:${feedbackRes.error.message}`);

      return jsonResponse({
        queries: queriesRes.data || [],
        feedbacks: feedbackRes.data || [],
      });
    }

    // =============================================
    // GET /admin-analytics/feedback?days=30&limit=100
    // Returns enriched feedback list with query snippets.
    // =============================================
    if (lastPart === "feedback") {
      const daysParam = clampInt(parseIntParam(url.searchParams.get("days"), 30), 1, 365);
      const limit = clampInt(parseIntParam(url.searchParams.get("limit"), 100), 1, 500);
      const startDateIso = new Date(Date.now() - daysParam * 24 * 60 * 60 * 1000).toISOString();

      const { data: feedback, error } = await supabase
        .from("response_feedback")
        .select("id, query_id, rating, feedback_category, feedback_text, created_at")
        .gte("created_at", startDateIso)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(`DB:RESPONSE_FEEDBACK:${error.message}`);

      const queryIds = Array.from(new Set((feedback || []).map((f) => f.query_id).filter(Boolean)));
      let queriesMap: Record<string, { user_query: string; assistant_response: string }> = {};

      if (queryIds.length > 0) {
        const { data: queries, error: queryError } = await supabase
          .from("query_analytics")
          .select("id, user_query, assistant_response")
          .in("id", queryIds);

        if (!queryError && queries) {
          queriesMap = queries.reduce((acc, q) => {
            acc[q.id] = { user_query: q.user_query, assistant_response: q.assistant_response };
            return acc;
          }, {} as Record<string, { user_query: string; assistant_response: string }>);
        }
      }

      const enriched = (feedback || []).map((f) => ({
        ...f,
        query: queriesMap[f.query_id],
      }));

      return jsonResponse({ feedback: enriched });
    }

    // =============================================
    // GET /admin-analytics/queries-by-fingerprint?fingerprint=...&limit=10
    // Returns session context for a fingerprint.
    // =============================================
    if (lastPart === "queries-by-fingerprint") {
      const fingerprint = (url.searchParams.get("fingerprint") || "").trim();
      if (!fingerprint) {
        return jsonResponse({ error: "fingerprint obrigatorio" }, 400);
      }

      const limit = clampInt(parseIntParam(url.searchParams.get("limit"), 10), 1, 50);

      const { data, error } = await supabase
        .from("query_analytics")
        .select("id, user_query, assistant_response, created_at")
        .eq("session_fingerprint", fingerprint)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) throw new Error(`DB:QUERY_ANALYTICS:${error.message}`);

      return jsonResponse({ queries: data || [] });
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "AUTH:UNAUTHORIZED") {
      return jsonResponse({ error: "Nao autorizado" }, 401);
    }
    if (message.startsWith("CONFIG:")) {
      return jsonResponse({ error: "Configuracao do servidor incompleta", details: message }, 500);
    }

    console.error("[admin-analytics] Error:", message);
    return jsonResponse({ error: "Erro interno", details: message }, 500);
  }
});

