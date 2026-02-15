type JsonRecord = Record<string, unknown>;

function getAdminDashboardUrl(path: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    throw new Error("VITE_SUPABASE_URL não configurada");
  }
  const clean = path.replace(/^\/+/, "");
  return `${base}/functions/v1/admin-dashboard/${clean}`;
}

function getAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY não configurada");
  }
  return key;
}

export async function adminDashboardFetchJson<T>(
  adminKey: string,
  path: string,
  init: RequestInit & { jsonBody?: JsonRecord } = {},
): Promise<T> {
  if (!adminKey) {
    throw new Error("Chave de administrador ausente");
  }

  const url = getAdminDashboardUrl(path);
  const anonKey = getAnonKey();

  const headers = new Headers(init.headers);
  headers.set("x-admin-key", adminKey);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${anonKey}`);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined = init.body as BodyInit | undefined;
  if (init.jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.jsonBody);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");

  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in (payload as any)
        ? String((payload as any).error || "Erro desconhecido")
        : typeof payload === "string"
          ? payload
          : `Erro ${res.status}`;
    throw new Error(msg);
  }

  return payload as T;
}

