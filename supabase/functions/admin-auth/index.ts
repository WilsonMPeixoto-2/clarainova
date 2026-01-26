import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

// Rate limiting configuration for admin endpoints (stricter)
const ADMIN_RATE_LIMIT = {
  maxRequests: 5,    // 5 attempts per window
  windowSeconds: 300, // 5 minute window
};

// Helper to get client identifier for rate limiting
function getClientKey(req: Request): string {
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for rate limiting
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[admin-auth] Missing Supabase config");
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta", code: "CONFIG_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Rate limiting check BEFORE validating admin key (prevent brute force)
    const clientKey = getClientKey(req);
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_client_key: `${clientKey}:admin-auth`,
        p_endpoint: "admin-auth",
        p_max_requests: ADMIN_RATE_LIMIT.maxRequests,
        p_window_seconds: ADMIN_RATE_LIMIT.windowSeconds,
      }
    );

    if (rateLimitError) {
      console.error("[admin-auth] Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
      const resetIn = rateLimitResult[0].reset_in || ADMIN_RATE_LIMIT.windowSeconds;
      console.log(`[admin-auth] Rate limited: ${clientKey}`);
      return new Response(
        JSON.stringify({
          error: `Muitas tentativas. Tente novamente em ${Math.ceil(resetIn / 60)} minutos.`,
          code: "RATE_LIMITED",
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

    const ADMIN_KEY = Deno.env.get("ADMIN_KEY");
    
    if (!ADMIN_KEY) {
      console.error("[admin-auth] ADMIN_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminKey = (req.headers.get("x-admin-key") || "").trim();

    if (!adminKey) {
      return new Response(
        JSON.stringify({ valid: false, error: "Chave de administrador não fornecida", code: "MISSING_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (adminKey !== ADMIN_KEY) {
      console.log("[admin-auth] Invalid admin key attempt");
      return new Response(
        JSON.stringify({ valid: false, error: "Chave de administrador inválida", code: "INVALID_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[admin-auth] Admin key validated successfully");
    return new Response(
      JSON.stringify({ valid: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[admin-auth] Error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erro interno", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
