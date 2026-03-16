import { supabase } from "@/integrations/supabase/client";

function getSupabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
}

export function getSupabaseFunctionBaseUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  if (!supabaseUrl) {
    throw new Error("Supabase não configurado (VITE_SUPABASE_URL).");
  }
  return `${supabaseUrl}/functions/v1`;
}

export async function getCurrentAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error("Não foi possível verificar a sessão atual.");
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Sua sessão expirou. Entre novamente para acessar o admin.");
  }

  return accessToken;
}

export async function getCurrentSessionUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error("Não foi possível verificar a sessão atual.");
  }

  return data.session?.user?.id ?? null;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const userId = await getCurrentSessionUserId();
  if (!userId) return false;

  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    throw new Error("Não foi possível verificar suas permissões administrativas.");
  }

  return data === true;
}

export async function getAdminRequestHeaders(
  extraHeaders: HeadersInit = {},
): Promise<Record<string, string>> {
  const accessToken = await getCurrentAccessToken();
  const apikey = getSupabaseAnonKey();

  if (!apikey) {
    throw new Error("Supabase não configurado (VITE_SUPABASE_ANON_KEY).");
  }

  const normalizedExtra = new Headers(extraHeaders);
  const headers: Record<string, string> = {
    apikey,
    Authorization: `Bearer ${accessToken}`,
  };

  normalizedExtra.forEach((value, key) => {
    headers[key] = value;
  });

  return headers;
}
