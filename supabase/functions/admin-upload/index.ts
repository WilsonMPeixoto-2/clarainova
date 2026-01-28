// Import map: ../import_map.json (used during Supabase deploy)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * @deprecated Use admin_get_upload_url + direct PUT to Storage instead.
 * 
 * This endpoint receives files directly via FormData, which:
 * 1. Has a 6MB Edge Function payload limit (vs 50MB with signed URLs)
 * 2. Increases backend load unnecessarily
 * 3. Doesn't scale well for large documents
 * 
 * PREFERRED FLOW:
 * 1. Frontend calls admin_get_upload_url to get signed URL
 * 2. Frontend PUTs file directly to Storage via signed URL
 * 3. Frontend extracts text locally (PDF.js)
 * 4. Frontend sends only text + metadata to /documents/ingest-*
 * 
 * This endpoint is maintained for backwards compatibility only.
 */

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

  try {
    const ADMIN_KEY = Deno.env.get("ADMIN_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ADMIN_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[admin-upload] Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limiting check BEFORE validating admin key (prevent brute force)
    const clientKey = getClientKey(req);
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_client_key: `${clientKey}:admin-upload`,
        p_endpoint: "admin-upload",
        p_max_requests: ADMIN_RATE_LIMIT.maxRequests,
        p_window_seconds: ADMIN_RATE_LIMIT.windowSeconds,
      }
    );

    if (rateLimitError) {
      console.error("[admin-upload] Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
      const resetIn = rateLimitResult[0].reset_in || ADMIN_RATE_LIMIT.windowSeconds;
      console.log(`[admin-upload] Rate limited: ${clientKey}`);
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

    // Validate admin key
    const adminKey = req.headers.get("x-admin-key");

    if (!adminKey) {
      return new Response(
        JSON.stringify({ error: "Chave de administrador não fornecida", code: "MISSING_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (adminKey !== ADMIN_KEY) {
      console.log("[admin-upload] Invalid admin key attempt");
      return new Response(
        JSON.stringify({ error: "Chave de administrador inválida", code: "INVALID_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const category = formData.get("category") as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Arquivo obrigatório", code: "MISSING_FILE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    const allowedExtensions = [".pdf", ".docx", ".txt"];
    const fileName = file.name.toLowerCase();
    const isValidType = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidType) {
      return new Response(
        JSON.stringify({ error: "Tipo de arquivo não suportado. Use PDF, DOCX ou TXT.", code: "INVALID_FILE_TYPE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: `Arquivo muito grande. Limite: 50MB. Seu arquivo: ${Math.round(file.size / 1024 / 1024)}MB`, code: "FILE_TOO_LARGE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-upload] Processing file: ${file.name}, size: ${Math.round(file.size / 1024)}KB`);

    // Generate unique file path
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
    const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `documents/${uniqueFileName}`;

    // Upload file to Storage using service role
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("knowledge-base")
      .upload(filePath, arrayBuffer, {
        contentType: file.type || `application/${fileExt}`,
        upsert: false,
      });

    if (uploadError) {
      console.error("[admin-upload] Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: `Erro ao fazer upload: ${uploadError.message}`, code: "UPLOAD_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-upload] File uploaded successfully: ${filePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        filePath,
        originalName: file.name,
        fileSize: file.size,
        fileType: file.type,
        title: title || file.name.replace(/\.[^/.]+$/, ""),
        category: category || "manual",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[admin-upload] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
