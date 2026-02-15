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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    // Avoid leaking details (this is a public endpoint).
    return json({ ok: false }, 200);
  }

  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const errorMessageRaw = String(payload.error_message ?? "").trim();
  const componentStackRaw = payload.component_stack == null ? null : String(payload.component_stack).trim();
  const urlRaw = payload.url == null ? null : String(payload.url).trim();
  const userAgentRaw = payload.user_agent == null ? null : String(payload.user_agent).trim();

  if (!errorMessageRaw) {
    return json({ ok: true }, 200);
  }

  const errorMessage = errorMessageRaw.slice(0, 500);
  const componentStack = componentStackRaw ? componentStackRaw.slice(0, 2000) : null;
  const url = urlRaw ? urlRaw.slice(0, 512) : null;
  const userAgent = userAgentRaw ? userAgentRaw.slice(0, 512) : null;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Basic rate limit (best-effort).
  try {
    await supabase.rpc("check_rate_limit", {
      p_client_key: getSessionKey(req),
      p_endpoint: "log-frontend-error",
      p_max_requests: 30,
      p_window_seconds: 60,
    });
  } catch {
    // Ignore rate limit failures.
  }

  try {
    await supabase.from("frontend_errors").insert({
      error_message: errorMessage,
      component_stack: componentStack,
      url,
      user_agent: userAgent,
    });
  } catch {
    // Ignore insert errors.
  }

  return json({ ok: true }, 200);
});

