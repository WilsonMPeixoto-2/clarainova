import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function subPath(req: Request): string {
  const url = new URL(req.url);
  const idx = url.pathname.lastIndexOf("/admin-dashboard");
  if (idx < 0) return "";
  const rest = url.pathname.slice(idx + "/admin-dashboard".length);
  return rest.replace(/^\/+/, ""); // "" | "analytics" | "reports/..." | etc
}

function requireAdmin(req: Request): { ok: true } | { ok: false; response: Response } {
  const expectedKey = (Deno.env.get("ADMIN_KEY") || "").trim();
  const adminKey = (req.headers.get("x-admin-key") || "").trim();

  if (!expectedKey) {
    return { ok: false, response: json({ error: "Server misconfigured (ADMIN_KEY missing)" }, 500) };
  }
  if (!adminKey || adminKey !== expectedKey) {
    return { ok: false, response: json({ error: "Acesso não autorizado" }, 401) };
  }
  return { ok: true };
}

function getSupabaseAdmin() {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const supabaseServiceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("CONFIG:SUPABASE_ENV_MISSING");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function safeInt(value: string | null, fallback: number, min = 0, max = 100000): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function summarize(content: string): string {
  return content.replace(/[#*`\n]/g, " ").trim().substring(0, 150);
}

type ReportPayload = {
  title?: unknown;
  content?: unknown;
  tagIds?: unknown;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const path = subPath(req);
  const [resource, ...rest] = path.split("/").filter(Boolean);

  try {
    const supabase = getSupabaseAdmin();

    // ----------------------------
    // Analytics
    // ----------------------------
    if (resource === "analytics" && req.method === "GET") {
      const queriesLimit = safeInt(url.searchParams.get("queriesLimit"), 1000, 1, 5000);
      const feedbackLimit = safeInt(url.searchParams.get("feedbackLimit"), 500, 1, 5000);

      const [queriesRes, feedbackRes] = await Promise.all([
        supabase
          .from("query_analytics")
          .select("id,user_query,assistant_response,sources_cited,created_at,session_fingerprint")
          .order("created_at", { ascending: false })
          .limit(queriesLimit),
        supabase
          .from("response_feedback")
          .select("id,query_id,rating,feedback_category,feedback_text,created_at")
          .order("created_at", { ascending: false })
          .limit(feedbackLimit),
      ]);

      if (queriesRes.error) return json({ error: queriesRes.error.message }, 500);
      if (feedbackRes.error) return json({ error: feedbackRes.error.message }, 500);

      return json({ queries: queriesRes.data || [], feedbacks: feedbackRes.data || [] }, 200);
    }

    // ----------------------------
    // Feedback (enriched)
    // ----------------------------
    if (resource === "feedback" && req.method === "GET") {
      const days = safeInt(url.searchParams.get("days"), 30, 1, 365);
      const limit = safeInt(url.searchParams.get("limit"), 100, 1, 1000);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: feedback, error } = await supabase
        .from("response_feedback")
        .select("id,query_id,rating,feedback_category,feedback_text,created_at")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return json({ error: error.message }, 500);

      const items = Array.isArray(feedback) ? feedback : [];
      const queryIds = Array.from(new Set(items.map((f) => String(f.query_id)).filter(Boolean)));

      let queriesMap: Record<string, { user_query: string; assistant_response: string; session_fingerprint?: string | null }> =
        {};

      if (queryIds.length > 0) {
        const { data: queries, error: qErr } = await supabase
          .from("query_analytics")
          .select("id,user_query,assistant_response,session_fingerprint")
          .in("id", queryIds);

        if (qErr) return json({ error: qErr.message }, 500);

        queriesMap = (queries || []).reduce((acc, q: any) => {
          acc[String(q.id)] = {
            user_query: String(q.user_query || ""),
            assistant_response: String(q.assistant_response || ""),
            session_fingerprint: (q.session_fingerprint as string | null) ?? null,
          };
          return acc;
        }, {} as typeof queriesMap);
      }

      const enriched = items.map((f: any) => ({
        ...f,
        query: queriesMap[String(f.query_id)] || null,
      }));

      return json({ feedback: enriched }, 200);
    }

    // ----------------------------
    // Session context (by fingerprint)
    // ----------------------------
    if (resource === "session-context" && req.method === "GET") {
      const fingerprint = (url.searchParams.get("session_fingerprint") || "").trim();
      const limit = safeInt(url.searchParams.get("limit"), 10, 1, 50);
      if (!fingerprint) return json({ error: "session_fingerprint obrigatório" }, 400);

      const { data, error } = await supabase
        .from("query_analytics")
        .select("id,user_query,assistant_response,created_at")
        .eq("session_fingerprint", fingerprint)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) return json({ error: error.message }, 500);
      return json({ context: data || [] }, 200);
    }

    // ----------------------------
    // Report tags
    // ----------------------------
    if (resource === "report-tags" && req.method === "GET") {
      const { data, error } = await supabase
        .from("report_tags")
        .select("id,name,color")
        .order("name");
      if (error) return json({ error: error.message }, 500);
      return json({ tags: data || [] }, 200);
    }

    // ----------------------------
    // Reports
    // ----------------------------
    if (resource === "reports" && req.method === "GET") {
      const [reportsRes, tagsRes, relRes] = await Promise.all([
        supabase
          .from("development_reports")
          .select("id,title,content,summary,created_at,updated_at")
          .order("created_at", { ascending: false }),
        supabase.from("report_tags").select("id,name,color").order("name"),
        supabase.from("report_tag_relations").select("report_id,tag_id"),
      ]);

      if (reportsRes.error) return json({ error: reportsRes.error.message }, 500);
      if (tagsRes.error) return json({ error: tagsRes.error.message }, 500);
      if (relRes.error) return json({ error: relRes.error.message }, 500);

      const tags = tagsRes.data || [];
      const relations = relRes.data || [];
      const tagsById = tags.reduce((acc: Record<string, any>, t: any) => {
        acc[String(t.id)] = t;
        return acc;
      }, {});

      const reportTagIds = relations.reduce((acc: Record<string, string[]>, r: any) => {
        const rid = String(r.report_id);
        const tid = String(r.tag_id);
        if (!acc[rid]) acc[rid] = [];
        acc[rid].push(tid);
        return acc;
      }, {});

      const reportsWithTags = (reportsRes.data || []).map((r: any) => {
        const ids = reportTagIds[String(r.id)] || [];
        const reportTags = ids.map((id) => tagsById[id]).filter(Boolean);
        return { ...r, tags: reportTags };
      });

      return json({ reports: reportsWithTags, tags }, 200);
    }

    if (resource === "reports" && req.method === "POST") {
      const payload = (await req.json().catch(() => ({}))) as ReportPayload;
      const title = String(payload.title ?? "").trim();
      const content = String(payload.content ?? "").trim();
      const tagIds = Array.isArray(payload.tagIds)
        ? (payload.tagIds as unknown[]).map((x) => String(x)).filter(Boolean)
        : [];

      if (!title || !content) return json({ error: "title/content obrigatórios" }, 400);

      const { data: inserted, error } = await supabase
        .from("development_reports")
        .insert({ title, content, summary: summarize(content) })
        .select("id,title,content,summary,created_at,updated_at")
        .single();

      if (error) return json({ error: error.message }, 500);

      if (tagIds.length > 0) {
        const { error: relErr } = await supabase.from("report_tag_relations").insert(
          tagIds.map((tagId) => ({ report_id: inserted.id, tag_id: tagId })),
        );
        if (relErr) return json({ error: relErr.message }, 500);
      }

      return json({ report: inserted }, 200);
    }

    if (resource === "reports" && (req.method === "PATCH" || req.method === "DELETE")) {
      const reportId = String(rest[0] || "").trim();
      if (!reportId) return json({ error: "report id obrigatório" }, 400);

      if (req.method === "DELETE") {
        const { error: relErr } = await supabase
          .from("report_tag_relations")
          .delete()
          .eq("report_id", reportId);
        if (relErr) return json({ error: relErr.message }, 500);

        const { error } = await supabase.from("development_reports").delete().eq("id", reportId);
        if (error) return json({ error: error.message }, 500);

        return json({ ok: true }, 200);
      }

      const payload = (await req.json().catch(() => ({}))) as ReportPayload;
      const title = String(payload.title ?? "").trim();
      const content = String(payload.content ?? "").trim();
      const tagIds = Array.isArray(payload.tagIds)
        ? (payload.tagIds as unknown[]).map((x) => String(x)).filter(Boolean)
        : [];

      if (!title || !content) return json({ error: "title/content obrigatórios" }, 400);

      const { error: updErr } = await supabase
        .from("development_reports")
        .update({ title, content, summary: summarize(content) })
        .eq("id", reportId);
      if (updErr) return json({ error: updErr.message }, 500);

      const { error: relDelErr } = await supabase
        .from("report_tag_relations")
        .delete()
        .eq("report_id", reportId);
      if (relDelErr) return json({ error: relDelErr.message }, 500);

      if (tagIds.length > 0) {
        const { error: relInsErr } = await supabase.from("report_tag_relations").insert(
          tagIds.map((tagId) => ({ report_id: reportId, tag_id: tagId })),
        );
        if (relInsErr) return json({ error: relInsErr.message }, 500);
      }

      const { data: updated, error: fetchErr } = await supabase
        .from("development_reports")
        .select("id,title,content,summary,created_at,updated_at")
        .eq("id", reportId)
        .single();
      if (fetchErr) return json({ error: fetchErr.message }, 500);

      return json({ report: updated }, 200);
    }

    // ----------------------------
    // Storage stats / cleanup (RPC-backed)
    // ----------------------------
    if (resource === "storage-stats" && req.method === "GET") {
      const { data, error } = await supabase.rpc("get_chat_storage_stats");
      if (error) return json({ error: error.message }, 500);
      const row = Array.isArray(data) && data[0] ? data[0] : null;
      return json({ stats: row }, 200);
    }

    if (resource === "storage-preview" && req.method === "GET") {
      const days = safeInt(url.searchParams.get("days"), 90, 1, 3650);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .lt("updated_at", cutoff);
      if (error) return json({ error: error.message }, 500);
      return json({ count: count || 0 }, 200);
    }

    if (resource === "storage-cleanup" && req.method === "POST") {
      const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const daysOld = safeInt(String(payload.days_old ?? "90"), 90, 1, 3650);
      const { data, error } = await supabase.rpc("cleanup_old_chat_sessions", { days_old: daysOld });
      if (error) return json({ error: error.message }, 500);
      return json({ deleted: data || 0 }, 200);
    }

    // ----------------------------
    // Metrics dashboards (RPC-backed)
    // ----------------------------
    if (resource === "api-usage" && req.method === "GET") {
      const days = safeInt(url.searchParams.get("days"), 7, 1, 365);
      const [summaryRes, detailsRes] = await Promise.all([
        supabase.rpc("get_api_usage_summary", { p_days: days }),
        supabase.rpc("get_api_usage_stats", { p_days: days }),
      ]);
      if (summaryRes.error) return json({ error: summaryRes.error.message }, 500);
      if (detailsRes.error) return json({ error: detailsRes.error.message }, 500);
      return json({ summary: summaryRes.data || [], details: detailsRes.data || [] }, 200);
    }

    if (resource === "chat-metrics" && req.method === "GET") {
      const days = safeInt(url.searchParams.get("days"), 7, 1, 365);
      const [chatRes, feRes] = await Promise.all([
        supabase.rpc("get_chat_metrics_summary", { p_days: days }),
        supabase.rpc("get_frontend_errors_summary", { p_days: days }),
      ]);
      if (chatRes.error) return json({ error: chatRes.error.message }, 500);
      if (feRes.error) return json({ error: feRes.error.message }, 500);
      return json({ chatMetrics: chatRes.data || [], frontendErrors: feRes.data || [] }, 200);
    }

    if (resource === "processing-stats" && req.method === "GET") {
      const days = safeInt(url.searchParams.get("days"), 7, 1, 365);
      const limit = safeInt(url.searchParams.get("limit"), 10, 1, 100);
      const [statsRes, errorsRes, retryRes] = await Promise.all([
        supabase.rpc("get_processing_stats", { p_days: days }),
        supabase.rpc("get_recent_processing_errors", { p_limit: limit }),
        supabase.rpc("get_documents_for_retry"),
      ]);
      if (statsRes.error) return json({ error: statsRes.error.message }, 500);
      if (errorsRes.error) return json({ error: errorsRes.error.message }, 500);
      if (retryRes.error) return json({ error: retryRes.error.message }, 500);
      return json({ stats: statsRes.data || [], errors: errorsRes.data || [], retryDocs: retryRes.data || [] }, 200);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin-dashboard] ERROR", msg);
    const status = msg.startsWith("CONFIG:") ? 500 : 500;
    return json({ error: msg }, status);
  }
});

