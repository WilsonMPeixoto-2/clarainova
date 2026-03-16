import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminErrorResponse, requireAdminUser } from "../_shared/admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { supabase } = await requireAdminUser(req);

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
      if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

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
      if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

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
      if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

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

    // =============================================
    // GET /admin-analytics/chat-metrics?days=7
    // Returns observability summaries for chat + frontend errors.
    // =============================================
    if (lastPart === "chat-metrics") {
      if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const daysParam = clampInt(parseIntParam(url.searchParams.get("days"), 7), 1, 365);
      const [chatRes, frontendRes] = await Promise.all([
        supabase.rpc("get_chat_metrics_summary", { p_days: daysParam }),
        supabase.rpc("get_frontend_errors_summary", { p_days: daysParam }),
      ]);

      if (chatRes.error) throw new Error(`DB:CHAT_METRICS:${chatRes.error.message}`);
      if (frontendRes.error) throw new Error(`DB:FRONTEND_ERRORS:${frontendRes.error.message}`);

      return jsonResponse({
        chat_metrics: chatRes.data || [],
        frontend_errors: frontendRes.data || [],
      });
    }

    // =============================================
    // GET /admin-analytics/api-usage?days=7
    // Returns API usage summary + details for admin monitor.
    // =============================================
    if (lastPart === "api-usage") {
      if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const daysParam = clampInt(parseIntParam(url.searchParams.get("days"), 7), 1, 365);
      const [summaryRes, detailsRes] = await Promise.all([
        supabase.rpc("get_api_usage_summary", { p_days: daysParam }),
        supabase.rpc("get_api_usage_stats", { p_days: daysParam }),
      ]);

      if (summaryRes.error) throw new Error(`DB:API_USAGE_SUMMARY:${summaryRes.error.message}`);
      if (detailsRes.error) throw new Error(`DB:API_USAGE_DETAILS:${detailsRes.error.message}`);

      return jsonResponse({
        summary: summaryRes.data || [],
        details: detailsRes.data || [],
      });
    }

    // =============================================
    // GET /admin-analytics/processing?days=7&errors_limit=10
    // Returns processing observability data.
    // =============================================
    if (lastPart === "processing") {
      if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const daysParam = clampInt(parseIntParam(url.searchParams.get("days"), 7), 1, 365);
      const errorsLimit = clampInt(parseIntParam(url.searchParams.get("errors_limit"), 10), 1, 100);

      const [statsRes, errorsRes, retryRes] = await Promise.all([
        supabase.rpc("get_processing_stats", { p_days: daysParam }),
        supabase.rpc("get_recent_processing_errors", { p_limit: errorsLimit }),
        supabase.rpc("get_documents_for_retry"),
      ]);

      if (statsRes.error) throw new Error(`DB:PROCESSING_STATS:${statsRes.error.message}`);
      if (errorsRes.error) throw new Error(`DB:PROCESSING_ERRORS:${errorsRes.error.message}`);
      if (retryRes.error) throw new Error(`DB:PROCESSING_RETRY_DOCS:${retryRes.error.message}`);

      return jsonResponse({
        stats: statsRes.data || [],
        errors: errorsRes.data || [],
        retry_docs: retryRes.data || [],
      });
    }

    // =============================================
    // GET /admin-analytics/storage?days_old=90
    // Returns storage usage stats + preview delete count.
    // =============================================
    if (lastPart === "storage") {
      if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const daysOld = clampInt(parseIntParam(url.searchParams.get("days_old"), 90), 1, 3650);
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

      const [storageRes, previewRes] = await Promise.all([
        supabase.rpc("get_chat_storage_stats"),
        supabase
          .from("chat_sessions")
          .select("id", { count: "exact", head: true })
          .lt("updated_at", cutoffDate),
      ]);

      if (storageRes.error) throw new Error(`DB:CHAT_STORAGE_STATS:${storageRes.error.message}`);
      if (previewRes.error) throw new Error(`DB:CHAT_STORAGE_PREVIEW:${previewRes.error.message}`);

      const stats = Array.isArray(storageRes.data) && storageRes.data.length > 0
        ? storageRes.data[0]
        : {
            total_sessions: 0,
            total_size_bytes: 0,
            oldest_session: null,
            newest_session: null,
          };

      return jsonResponse({
        stats,
        preview_count: previewRes.count || 0,
        days_old: daysOld,
      });
    }

    // =============================================
    // POST /admin-analytics/storage-cleanup
    // Body: { days_old?: number }
    // Executes storage cleanup safely behind admin auth.
    // =============================================
    if (lastPart === "storage-cleanup") {
      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const bodyDaysOld = typeof body.days_old === "number"
        ? body.days_old
        : parseIntParam(typeof body.days_old === "string" ? body.days_old : null, 90);
      const daysOld = clampInt(bodyDaysOld, 1, 3650);

      const cleanupRes = await supabase.rpc("cleanup_old_chat_sessions", { days_old: daysOld });
      if (cleanupRes.error) throw new Error(`DB:CHAT_STORAGE_CLEANUP:${cleanupRes.error.message}`);

      const deletedCount = Number(cleanupRes.data) || 0;
      return jsonResponse({
        deleted_count: deletedCount,
        days_old: daysOld,
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    console.error("[admin-analytics] Error:", error);
    return adminErrorResponse(error, corsHeaders);
  }
});

