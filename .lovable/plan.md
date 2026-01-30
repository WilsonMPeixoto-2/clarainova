
# Plano de Saneamento de Segurança e Observabilidade

## Diagnóstico Completo

### Status dos Artefatos de Patch
**RESULTADO: Limpo** - Nenhum artefato de patch encontrado no código fonte. Buscas por `"replace":`, `"search":`, `"Plan approved"` e `"Implementando o upgrade"` retornaram zero ocorrências em `/src`.

### Arquivos de Governança
**RESULTADO: Correto** - Os arquivos `CHANGELOG.md` e `REGRESSION_CHECKLIST.md` estão na raiz do projeto (não contaminaram componentes).

---

## Problemas Identificados (Críticos)

### 1. RLS Permissiva: frontend_errors aceita INSERT público
**Situação atual:**
```sql
Policy: "Anyone can insert frontend errors"
With Check Expression: true  -- ABERTA PARA TODOS
```

**Risco:** Qualquer pessoa pode inserir dados na tabela, potencialmente usada para:
- Poluição de dados (garbage data)
- Ataque de exaustão de armazenamento
- Injeção de conteúdo malicioso

**Solução recomendada:** Frontend NÃO grava direto. Usar Edge Function intermediária.

### 2. sessionFingerprint armazenado sem hash
**Situação atual:**
- Frontend gera fingerprint: `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
- Backend armazena em `chat_metrics.session_fingerprint` sem transformação

**Risco:** Fingerprint pode ser correlacionado entre requests, criando perfil de uso.

**Solução:** Hash SHA-256 do fingerprint antes de persistir.

### 3. IP usado para rate limit sem proteção
**Situação atual:**
```typescript
function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  // ... retorna IP "cru"
}
```

**Uso:** IP é passado para `check_rate_limit` que armazena em `rate_limits.client_key`.

**Risco:** IP armazenado pode ser dado pessoal (LGPD).

**Solução:** Hash do IP antes de armazenar.

### 4. user_agent armazenado em frontend_errors
**Situação atual:**
```typescript
user_agent: navigator.userAgent?.slice(0, 200) || null
```

**Risco:** User-agent pode identificar usuário (fingerprinting).

**Solução:** Truncar para categoria genérica (browser family apenas).

---

## Implementação em 3 Fases

### Fase 1: Edge Function para Error Logging (Segurança)

Criar nova Edge Function `log-frontend-error` que:
1. Recebe payload do frontend (error_message, component_stack, url)
2. Sanitiza dados (remove qualquer identificador)
3. Agrupa user_agent em categorias (Chrome, Firefox, Safari, etc.)
4. Insere com `service_role` (RLS não é problema)

**Arquivos:**
- Criar `supabase/functions/log-frontend-error/index.ts`
- Atualizar `src/components/ErrorBoundary.tsx`

**Mudança no ErrorBoundary:**
```typescript
private async logErrorToAnalytics(error: Error, errorInfo: ErrorInfo): Promise<void> {
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-frontend-error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
      },
      body: JSON.stringify({
        error_message: error.message?.slice(0, 500) || "Unknown error",
        component_stack: errorInfo.componentStack?.slice(0, 1000) || null,
        url: window.location.pathname,
      })
    });
  } catch {
    // Silently fail
  }
}
```

### Fase 2: Hash de Identificadores (Privacidade)

**2.1. Hash do sessionFingerprint no backend:**

Em `supabase/functions/clara-chat/index.ts`:
```typescript
// Função de hash simples para fingerprint
async function hashFingerprint(fingerprint: string): Promise<string> {
  const salt = Deno.env.get("FINGERPRINT_SALT") || "clara-default-salt";
  const data = new TextEncoder().encode(fingerprint + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Uso antes de persistir:
const hashedFingerprint = sessionFingerprint 
  ? await hashFingerprint(sessionFingerprint) 
  : null;
```

**2.2. Hash do IP para rate limit:**

Modificar `getClientKey`:
```typescript
async function getHashedClientKey(req: Request): Promise<string> {
  const ip = getRawClientIp(req);
  const salt = Deno.env.get("RATELIMIT_SALT") || "clara-rate-salt";
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
```

### Fase 3: Restringir RLS do frontend_errors

**Migração SQL:**
```sql
-- Remover policy pública
DROP POLICY IF EXISTS "Anyone can insert frontend errors" ON public.frontend_errors;

-- Nova policy: apenas service_role pode inserir
CREATE POLICY "Service role can insert frontend errors" 
ON public.frontend_errors FOR INSERT
WITH CHECK (auth.role() = 'service_role');
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/log-frontend-error/index.ts` | **Criar** — Edge function para logging seguro |
| `src/components/ErrorBoundary.tsx` | Modificar — Chamar edge function em vez de Supabase direto |
| `supabase/functions/clara-chat/index.ts` | Modificar — Hash de fingerprint e IP |
| Nova migração SQL | Restringir RLS de frontend_errors |

---

## Validação de Implementação Existente

### Tabelas criadas corretamente
- `chat_metrics`: Existe com estrutura correta
- `frontend_errors`: Existe, mas RLS precisa ajuste

### RLS de chat_metrics (OK)
```
INSERT: Service role can insert chat metrics → (auth.role() = 'service_role')
SELECT: Admins can read chat metrics → has_role(auth.uid(), 'admin')
```
**Conclusão:** Segura. Apenas edge function (service_role) insere, apenas admins leem.

### Instrumentação no clara-chat (OK)
- `llmFirstTokenMs` é setado corretamente no primeiro chunk do streaming
- Latências são capturadas em pontos corretos (embedding, search, LLM)
- `logChatMetrics` é fire-and-forget (não bloqueia streaming)

---

## Critérios de Aceite

- [ ] `frontend_errors` não aceita INSERT de anon/public
- [ ] ErrorBoundary chama edge function (não Supabase direto)
- [ ] `session_fingerprint` armazenado como hash (32 chars hex)
- [ ] `client_key` em rate_limits armazenado como hash
- [ ] Nenhum IP puro em nenhuma tabela
- [ ] Build/lint passam sem erros
- [ ] Edge function `log-frontend-error` deployada e funcional

---

## Notas de Segurança

1. **FINGERPRINT_SALT e RATELIMIT_SALT** devem ser configurados como secrets no Supabase
2. Se não configurados, usam fallback (menos seguro, mas funcional)
3. Hash SHA-256 truncado para 32 chars é suficiente para correlação sem reversibilidade
4. User-agent categorizado (não string completa) reduz fingerprinting
