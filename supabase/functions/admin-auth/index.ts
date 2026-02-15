import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedKey = (Deno.env.get("ADMIN_KEY") || "").trim();
  const adminKey = (req.headers.get("x-admin-key") || "").trim();

  if (!expectedKey) {
    return json(
      { valid: false, error: "Server misconfigured (ADMIN_KEY missing)", code: "CONFIG" },
      500,
    );
  }

  if (!adminKey || adminKey !== expectedKey) {
    return json({ valid: false, error: "Acesso não autorizado", code: "UNAUTHORIZED" }, 401);
  }

  return json({ valid: true }, 200);
});

