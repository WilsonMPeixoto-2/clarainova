

# Plano de Blindagem Final — Correções Críticas de Segurança e Observabilidade

## Diagnóstico Completo

### Verificações Positivas (OK)

| Verificação | Status | Evidência |
|-------------|--------|-----------|
| Artefatos de patch no código | **Limpo** | Busca por `"replace":` e `"search":` retornou zero em `/src` e `/supabase/functions` |
| Arquivos de governança | **Correto** | `CHANGELOG.md` e `REGRESSION_CHECKLIST.md` na raiz |
| RLS de `frontend_errors` | **Corrigida** | `INSERT → auth.role() = 'service_role'` |
| RLS de `rate_limits` | **Corrigida** | Deny para todas operações anon |
| Hash de fingerprint | **Implementado** | Função `hashFingerprint()` existe |
| Hash de IP para rate limit | **Implementado** | Função `getHashedClientKey()` existe |
| ErrorBoundary usa Edge Function | **Correto** | Chama `fetch(...log-frontend-error)` |

---

## Problemas Críticos Encontrados

### 1. IPs NÃO-HASHEADOS na tabela `rate_limits` (LGPD)

**Evidência direta da query:**
```
client_key: "44.247.181.160"
client_key: "191.57.19.69:admin-auth"
client_key: "20.124.127.7"
```

**Problema:** A função `getHashedClientKey()` foi criada, mas os registros antigos (e possivelmente novos de outros endpoints) ainda contêm IPs puros.

**Impacto:** Violação LGPD — IP é dado pessoal.

---

### 2. `log-frontend-error` sem Rate Limit (Vetor de Spam)

**Situação atual:** Endpoint público aceita POST sem limite, permitindo:
- Poluição de dados (inserções massivas)
- Exaustão de armazenamento
- Ataque de negação de serviço

**Solução:** Reutilizar `check_rate_limit` RPC com IP hasheado.

---

### 3. Fallback Salts Fixos em Produção

**Código atual:**
```typescript
const salt = Deno.env.get("FINGERPRINT_SALT") || "clara-fp-default-salt-2026";
const salt = Deno.env.get("RATELIMIT_SALT") || "clara-rl-default-salt-2026";
```

**Problema:** Fallback fixo é previsível. Em produção, se o secret não existir, o hash é "quebrável" por rainbow table.

**Solução:** Exigir secrets ou usar hash diferente (sem persistência) quando ausente.

---

### 4. `categorizeBrowser()` Classificando Incorretamente

**Evidência:** Registro mostra `user_agent: "Other"` mesmo para browsers comuns.

**Problema:** A ordem de verificação e os patterns estão incorretos:
- `edg/` precisa vir antes de `chrome` (Edge contém "chrome")
- Falta padrão para `android` e `ios`
- "Mobile Browser" é muito genérico

---

### 5. `Authorization: Bearer ${anonKey}` é Teatral

**Situação:** O ErrorBoundary envia `Authorization: Bearer ${anonKey}`.

**Problema:** Se `verify_jwt = false` (provável, pois não está configurado), o header não faz nada. Se `verify_jwt = true`, o anon key não é um JWT válido de usuário.

**Solução:** Remover o header (clareza) ou configurar `verify_jwt = false` explicitamente.

---

### 6. `chat_metrics` vazia (Instrumentação não está persistindo)

**Evidência:** Query retornou `[]` — nenhum registro após implementação.

**Possíveis causas:**
- A função `logChatMetrics` pode estar falhando silenciosamente
- O deploy da edge function pode não ter acontecido

---

## Implementação em 4 Fases

### Fase 1: Rate Limit no `log-frontend-error`

**Arquivo:** `supabase/functions/log-frontend-error/index.ts`

Adicionar rate limit usando o mesmo padrão do clara-chat:

```typescript
// Reutilizar funções de hash
async function hashClientIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATELIMIT_SALT");
  if (!salt) {
    console.warn("[log-frontend-error] RATELIMIT_SALT not configured, using request-only identifier");
    return "no-salt-configured";
  }
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// No handler, antes do insert:
const clientKey = await hashClientIp(getRawClientIp(req));

const { data: rateLimitResult } = await supabase.rpc("check_rate_limit", {
  p_client_key: clientKey,
  p_endpoint: "log-frontend-error",
  p_max_requests: 10,  // 10 erros por minuto (limite alto)
  p_window_seconds: 60,
});

if (rateLimitResult?.[0]?.allowed === false) {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded" }),
    { status: 429, headers: corsHeaders }
  );
}
```

---

### Fase 2: Eliminar Fallback Salts

**Arquivo:** `supabase/functions/clara-chat/index.ts`

Modificar funções de hash para exigir secrets ou degradar com segurança:

```typescript
async function hashFingerprint(fingerprint: string | null): Promise<string | null> {
  if (!fingerprint) return null;
  
  const salt = Deno.env.get("FINGERPRINT_SALT");
  if (!salt) {
    console.warn("[clara-chat] FINGERPRINT_SALT not configured - fingerprint will not be persisted");
    return null;  // Não persiste sem salt
  }
  
  return await hashIdentifier(fingerprint, salt);
}

async function hashClientIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATELIMIT_SALT");
  if (!salt) {
    console.warn("[clara-chat] RATELIMIT_SALT not configured - using fallback rate limit key");
    return "unknown-salt-missing";  // Todos caem no mesmo bucket (mais permissivo)
  }
  
  return await hashIdentifier(ip, salt);
}
```

**Criar secrets no Supabase:**
- `FINGERPRINT_SALT` — valor aleatório (ex: `openssl rand -hex 32`)
- `RATELIMIT_SALT` — valor aleatório diferente

---

### Fase 3: Melhorar `categorizeBrowser()`

**Arquivo:** `supabase/functions/log-frontend-error/index.ts`

Substituir função atual por versão mais precisa:

```typescript
function categorizeBrowser(userAgent: string | null): string {
  if (!userAgent) return "Unknown";
  
  const ua = userAgent.toLowerCase();
  
  // Ordem importa: Edge contém "chrome", Safari contém "safari" mas Chrome também
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("chrome/") || ua.includes("chromium/")) return "Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome")) return "Safari";
  
  // Mobile específico
  if (ua.includes("android")) return "Android Browser";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS WebKit";
  
  // Bots e crawlers
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) return "Bot";
  
  return "Other";
}
```

---

### Fase 4: Limpeza/Neutralização de IPs Antigos

**Migração SQL:**

```sql
-- Neutralizar IPs antigos na tabela rate_limits
-- Substituir IPs puros por hash indicativo
UPDATE public.rate_limits
SET client_key = 'legacy_redacted_' || id::text
WHERE client_key ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}';

-- Adicionar política de retenção (opcional, mas recomendado)
-- Limpar registros com mais de 30 dias
DELETE FROM public.rate_limits
WHERE window_start < NOW() - INTERVAL '30 days';
```

---

### Fase 5: Remover Authorization Header Desnecessário

**Arquivo:** `src/components/ErrorBoundary.tsx`

Simplificar chamada (header não é necessário se verify_jwt = false):

```typescript
await fetch(`${supabaseUrl}/functions/v1/log-frontend-error`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // Removido: Authorization header não necessário para função pública
  },
  body: JSON.stringify({
    error_message: error.message?.slice(0, 500) || "Unknown error",
    component_stack: errorInfo.componentStack?.slice(0, 1000) || null,
    url: window.location.pathname,
  }),
});
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/log-frontend-error/index.ts` | Adicionar rate limit + melhorar `categorizeBrowser()` |
| `supabase/functions/clara-chat/index.ts` | Eliminar fallback salts, exigir secrets |
| `src/components/ErrorBoundary.tsx` | Remover Authorization header |
| Nova migração SQL | Neutralizar IPs antigos + política de retenção |

---

## Secrets a Configurar

| Secret | Descrição | Comando para gerar |
|--------|-----------|-------------------|
| `FINGERPRINT_SALT` | Salt para hash de session fingerprint | `openssl rand -hex 32` |
| `RATELIMIT_SALT` | Salt para hash de IP (rate limit) | `openssl rand -hex 32` |

---

## Validação Pós-Implementação (Checklist de 10 minutos)

1. **Rate limit funciona no log-frontend-error:**
   - Fazer 11 POSTs em sequência
   - Verificar que o 11º retorna 429

2. **IPs não estão sendo armazenados puros:**
   - Fazer um chat
   - Query: `SELECT client_key FROM rate_limits ORDER BY window_start DESC LIMIT 1`
   - Resultado deve ser hash (32 chars hex) ou `unknown-salt-missing`

3. **Fingerprints estão hasheados:**
   - Fazer um chat
   - Query: `SELECT session_fingerprint FROM chat_metrics ORDER BY created_at DESC LIMIT 1`
   - Resultado deve ser hash (32 chars) ou NULL

4. **Browser categorizado corretamente:**
   - Forçar erro no frontend
   - Query: `SELECT user_agent FROM frontend_errors ORDER BY created_at DESC LIMIT 1`
   - Resultado deve ser "Chrome", "Firefox", etc. (não "Other" para browsers comuns)

5. **IPs antigos neutralizados:**
   - Query: `SELECT COUNT(*) FROM rate_limits WHERE client_key ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'`
   - Resultado deve ser 0

---

## Notas de Segurança

1. **Rotação de salts:** Trocar o salt invalida a correlação histórica. Isso pode ser desejável (fresh start) ou não (perde métricas de sessão).

2. **`unknown-salt-missing`:** Se o salt não estiver configurado, todos os requests caem no mesmo bucket de rate limit. Isso é mais permissivo, mas evita falsos positivos.

3. **Política de retenção:** Recomendado implementar job de limpeza (30-90 dias) para:
   - `rate_limits` (já sugerido)
   - `frontend_errors` (dados operacionais)
   - `chat_metrics` (agregar antes de limpar)

