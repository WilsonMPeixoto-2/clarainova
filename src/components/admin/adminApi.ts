interface AdminAnalyticsRequestOptions {
  adminKey: string;
  path: string;
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL || "";
}

function getSupabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
}

function toQueryString(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function adminAnalyticsRequest<T>(options: AdminAnalyticsRequestOptions): Promise<T> {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const key = options.adminKey.trim();

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  if (!key) {
    throw new Error("Chave de administrador ausente.");
  }

  const cleanPath = options.path.replace(/^\/+/, "");
  const endpoint = `${supabaseUrl}/functions/v1/admin-analytics/${cleanPath}${toQueryString(options.query)}`;

  const response = await fetch(endpoint, {
    method: options.method || "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-admin-key": key,
      "Content-Type": "application/json",
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errorMessage = typeof payload.error === "string" ? payload.error : `Erro ${response.status}`;
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}
