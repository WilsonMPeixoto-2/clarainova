import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
