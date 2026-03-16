// Import map: ../import_map.json (used during Supabase deploy)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminErrorResponse, requireAdminUser } from "../_shared/admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limiting configuration for admin endpoints (stricter)
const ADMIN_RATE_LIMIT = {
  maxRequests: 5,    // 5 attempts per window
  windowSeconds: 300, // 5 minute window
};

// Helper to get raw client IP (before privacy hashing)
function getRawClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (cfIp) return cfIp;
  if (realIp) return realIp;
  
  return "unknown";
}

async function hashClientIdentifier(value: string): Promise<string> {
  const salt = Deno.env.get("RATELIMIT_SALT");
  if (!salt) {
    console.warn("[admin_get_upload_url] RATELIMIT_SALT not configured - using degraded identifier");
    return "no-salt-configured";
  }

  const data = new TextEncoder().encode(value + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase } = await requireAdminUser(req);

    // Rate limiting check BEFORE validating admin key (prevent brute force)
    const rawClientIp = getRawClientIp(req);
    const clientKey = await hashClientIdentifier(rawClientIp);
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_client_key: `${clientKey}:admin-upload`,
        p_endpoint: "admin_get_upload_url",
        p_max_requests: ADMIN_RATE_LIMIT.maxRequests,
        p_window_seconds: ADMIN_RATE_LIMIT.windowSeconds,
      }
    );

    if (rateLimitError) {
      console.error("[admin_get_upload_url] Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
      const resetIn = rateLimitResult[0].reset_in || ADMIN_RATE_LIMIT.windowSeconds;
      console.log(`[admin_get_upload_url] Rate limited: ${clientKey.slice(0, 8)}...`);
      return new Response(
        JSON.stringify({
          error: `Muitas tentativas. Tente novamente em ${Math.ceil(resetIn / 60)} minutos.`,
          retryAfter: resetIn,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(resetIn),
          },
        }
      );
    }

    // Parse request body
    const { filename, contentType } = await req.json();
    
    if (!filename) {
      return new Response(
        JSON.stringify({ error: "Nome do arquivo (filename) é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bucket = "knowledge-base";
    // Note: createSignedUploadUrl has a default 2-hour expiration (sufficient for uploads)
    
    // Sanitize filename and create unique path
    const safeName = filename.replace(/[^\w.-]+/g, "_");
    const path = `documents/${Date.now()}_${safeName}`;

    console.log(
      `[admin_get_upload_url] generating upload url for bucket=${bucket}, path=${path}, contentType=${contentType || "application/octet-stream"}`
    );

    // Create signed upload URL using service role
    // Note: createSignedUploadUrl uses default expiration (2 hours)
    // The expiresIn parameter is only for createSignedUrl (download), not upload
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[admin_get_upload_url] ERROR creating signed URL");
      console.error("[admin_get_upload_url] Error code:", error.name);
      console.error("[admin_get_upload_url] Error message:", error.message);
      throw error;
    }

    console.log(`[admin_get_upload_url] signed upload url generated successfully for ${path}`);

    return new Response(
      JSON.stringify({ 
        bucket, 
        path, 
        signedUrl: data.signedUrl,
        token: data.token,
        contentType: contentType || "application/octet-stream"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (e) {
    console.error("[admin_get_upload_url] Error:", e);
    return adminErrorResponse(e, corsHeaders);
  }
});
