import {
  getAdminRequestHeaders,
  getSupabaseFunctionBaseUrl,
} from "./adminSession";

interface AdminAnalyticsRequestOptions {
  path: string;
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
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
  const cleanPath = options.path.replace(/^\/+/, "");
  const endpoint = `${getSupabaseFunctionBaseUrl()}/admin-analytics/${cleanPath}${toQueryString(options.query)}`;
  const headers = await getAdminRequestHeaders({
    "Content-Type": "application/json",
  });

  const response = await fetch(endpoint, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errorMessage = typeof payload.error === "string" ? payload.error : `Erro ${response.status}`;
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}
