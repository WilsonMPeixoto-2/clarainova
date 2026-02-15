import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() || "upload.bin";
  // Keep ASCII-safe filename to avoid surprises across OS/browsers.
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 200) || "upload.bin";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedKey = (Deno.env.get("ADMIN_KEY") || "").trim();
  const adminKey = (req.headers.get("x-admin-key") || "").trim();
  if (!expectedKey || !adminKey || adminKey !== expectedKey) {
    return json({ error: "Acesso não autorizado" }, 401);
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const supabaseServiceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const filename = sanitizeFilename(String(payload.filename ?? "upload.bin"));
  const contentType = String(payload.contentType ?? "application/octet-stream").slice(0, 120);

  const bucket = (Deno.env.get("KNOWLEDGE_BUCKET") || "knowledge-base").trim();
  const datePrefix = new Date().toISOString().slice(0, 10);
  const path = `${datePrefix}/${crypto.randomUUID()}_${filename}`;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    console.error("[admin_get_upload_url] createSignedUploadUrl failed", error);
    return json(
      {
        error:
          "Falha ao obter URL de upload (verifique se o bucket existe e se o service role está configurado).",
      },
      500,
    );
  }

  return json(
    {
      signedUrl: data.signedUrl,
      path: data.path || path,
      contentType,
    },
    200,
  );
});

