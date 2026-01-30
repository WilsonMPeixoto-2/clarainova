import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration for error logging
const RATE_LIMIT_CONFIG = {
  maxRequests: 10, // 10 errors per minute (generous for legitimate use)
  windowSeconds: 60,
};

// Browser family categorization (privacy-preserving, order matters)
function categorizeBrowser(userAgent: string | null): string {
  if (!userAgent) return "Unknown";
  
  const ua = userAgent.toLowerCase();
  
  // Order matters: Edge contains "chrome", Safari check must exclude Chrome
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("chrome/") || ua.includes("chromium/")) return "Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome")) return "Safari";
  
  // Mobile-specific detection
  if (ua.includes("android")) return "Android Browser";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS WebKit";
  
  // Bots and crawlers
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) return "Bot";
  
  return "Other";
}

// Get raw client IP from request headers
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

// Hash client IP for rate limiting (LGPD compliance)
async function hashClientIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATELIMIT_SALT");
  if (!salt) {
    console.warn("[log-frontend-error] RATELIMIT_SALT not configured - using degraded identifier");
    return "no-salt-configured";
  }
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Sanitize error message (remove potential PII)
function sanitizeErrorMessage(message: string | null): string {
  if (!message) return "Unknown error";
  
  // Truncate and remove common PII patterns
  let sanitized = message.slice(0, 500);
  
  // Remove email patterns
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  
  // Remove potential IP addresses
  sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]");
  
  // Remove potential phone numbers
  sanitized = sanitized.replace(/\b\d{10,11}\b/g, "[PHONE]");
  
  // Remove CPF patterns (Brazilian ID)
  sanitized = sanitized.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]");
  
  return sanitized;
}

// Sanitize component stack (remove file paths that might contain usernames)
function sanitizeComponentStack(stack: string | null): string | null {
  if (!stack) return null;
  
  // Truncate
  let sanitized = stack.slice(0, 1000);
  
  // Remove full file paths (keep just component names)
  sanitized = sanitized.replace(/\/Users\/[^/]+\//g, "/[USER]/");
  sanitized = sanitized.replace(/C:\\Users\\[^\\]+\\/g, "C:\\[USER]\\");
  sanitized = sanitized.replace(/\/home\/[^/]+\//g, "/[USER]/");
  
  return sanitized;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { error_message, component_stack, url } = body;

    // Basic validation
    if (!error_message && !component_stack) {
      return new Response(
        JSON.stringify({ error: "Missing error data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get browser category from user agent (not the full string)
    const userAgent = req.headers.get("user-agent");
    const browserCategory = categorizeBrowser(userAgent);

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[log-frontend-error] Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit check (prevent spam/DoS)
    const rawIp = getRawClientIp(req);
    const hashedIp = await hashClientIp(rawIp);
    
    const { data: rateLimitResult } = await supabase.rpc("check_rate_limit", {
      p_client_key: hashedIp,
      p_endpoint: "log-frontend-error",
      p_max_requests: RATE_LIMIT_CONFIG.maxRequests,
      p_window_seconds: RATE_LIMIT_CONFIG.windowSeconds,
    });

    if (rateLimitResult?.[0]?.allowed === false) {
      console.warn(`[log-frontend-error] Rate limited: ${hashedIp.slice(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert sanitized error data
    const { error: insertError } = await supabase.from("frontend_errors").insert({
      error_message: sanitizeErrorMessage(error_message),
      component_stack: sanitizeComponentStack(component_stack),
      url: url?.slice(0, 200) || null,
      user_agent: browserCategory, // Only store category, not full UA
    });

    if (insertError) {
      console.error("[log-frontend-error] Insert failed:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to log error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[log-frontend-error] Logged: ${browserCategory} - ${url || "unknown"}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[log-frontend-error] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
