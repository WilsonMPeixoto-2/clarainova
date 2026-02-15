import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-fingerprint",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function getSessionKey(req: Request): string {
  const fingerprint = req.headers.get("x-session-fingerprint");
  if (fingerprint && fingerprint.trim()) return fingerprint.trim();

  return (
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const queryId = String(payload.query_id ?? payload.queryId ?? "").trim();
  const rating = payload.rating === true;
  const feedbackCategory =
    payload.feedback_category == null ? null : String(payload.feedback_category).trim().slice(0, 80);
  const feedbackText =
    payload.feedback_text == null ? null : String(payload.feedback_text).trim().slice(0, 2000);

  if (!queryId || !isUuid(queryId)) {
    return json({ error: "Invalid query_id" }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Rate limit (best-effort).
  try {
    const { data } = await supabase.rpc("check_rate_limit", {
      p_client_key: getSessionKey(req),
      p_endpoint: "submit-feedback",
      p_max_requests: 10,
      p_window_seconds: 60,
    });

    if (Array.isArray(data) && data[0] && data[0].allowed === false) {
      return json({ ok: false, error: "RATE_LIMIT" }, 429);
    }
  } catch {
    // Ignore rate limit failures.
  }

  const { error } = await supabase.from("response_feedback").insert({
    query_id: queryId,
    rating,
    feedback_category: feedbackCategory,
    feedback_text: feedbackText,
  });

  if (error) {
    console.error("[submit-feedback] insert failed", error);
    return json({ ok: false }, 500);
  }

  return json({ ok: true }, 200);
});

