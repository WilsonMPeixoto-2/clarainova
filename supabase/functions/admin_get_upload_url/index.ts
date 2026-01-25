import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate admin key
    const adminKey = (req.headers.get("x-admin-key") || "").trim();
    const expected = (Deno.env.get("ADMIN_KEY") || "").trim();
    
    if (!expected) {
      console.error("[admin_get_upload_url] ADMIN_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!adminKey || adminKey !== expected) {
      console.log("[admin_get_upload_url] Invalid admin key attempt");
      return new Response(
        JSON.stringify({ error: "Chave de administrador inválida." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error("[admin_get_upload_url] Missing Supabase config");
      return new Response(
        JSON.stringify({ error: "Configuração do Supabase incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Parse request body
    const { filename, contentType } = await req.json();
    
    if (!filename) {
      return new Response(
        JSON.stringify({ error: "Nome do arquivo (filename) é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bucket = "knowledge-base";
    
    // Sanitize filename and create unique path
    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const path = `documents/${Date.now()}_${safeName}`;

    console.log(`[admin_get_upload_url] ========== GENERATING SIGNED URL ==========`);
    console.log(`[admin_get_upload_url] Original filename: ${filename}`);
    console.log(`[admin_get_upload_url] Sanitized name: ${safeName}`);
    console.log(`[admin_get_upload_url] Full path: ${path}`);
    console.log(`[admin_get_upload_url] Bucket: ${bucket}`);
    console.log(`[admin_get_upload_url] Content-Type: ${contentType || 'application/octet-stream'}`);

    // Create signed upload URL using service role
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[admin_get_upload_url] ERROR creating signed URL:", error);
      console.error("[admin_get_upload_url] Error details:", JSON.stringify(error, null, 2));
      throw error;
    }

    console.log(`[admin_get_upload_url] SUCCESS - Signed URL created`);
    console.log(`[admin_get_upload_url] Token (first 20 chars): ${data.token?.substring(0, 20)}...`);
    console.log(`[admin_get_upload_url] URL (first 80 chars): ${data.signedUrl?.substring(0, 80)}...`);

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
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
