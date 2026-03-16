import { createClient } from "@supabase/supabase-js";

export class AdminAuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name) || "";
  if (!value) {
    throw new AdminAuthError(500, "CONFIG_ERROR", `Configuração ausente: ${name}`);
  }
  return value;
}

function getBearerToken(req: Request): string {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AdminAuthError(401, "MISSING_TOKEN", "Sessão ausente ou inválida.");
  }
  return match[1];
}

export function createServiceRoleClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export async function requireAdminUser(req: Request) {
  const supabase = createServiceRoleClient();
  const token = getBearerToken(req);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new AdminAuthError(401, "INVALID_SESSION", "Sua sessão expirou ou não pôde ser validada.");
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  if (roleError) {
    throw new AdminAuthError(500, "ROLE_LOOKUP_FAILED", "Não foi possível verificar as permissões administrativas.");
  }

  if (!Array.isArray(roleRows) || roleRows.length === 0) {
    throw new AdminAuthError(403, "FORBIDDEN", "Acesso restrito à administração.");
  }

  return { supabase, user };
}

export function adminErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  if (error instanceof AdminAuthError) {
    return new Response(
      JSON.stringify({ error: error.message, code: error.code }),
      {
        status: error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return new Response(
    JSON.stringify({ error: message, code: "INTERNAL_ERROR" }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
