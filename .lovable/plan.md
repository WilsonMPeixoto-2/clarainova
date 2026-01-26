
# Relatório Técnico: Análise de Segurança do Projeto CLARA

## Situação Atual

**Por que os alertas aparecem mas "não precisam de reparo"?**

O sistema de segurança encontrou **4 alertas tipo "warn"** (avisos/recomendações) e **1 alerta tipo "error"** (que está intencionalmente ignorado). Quando você autoriza os reparos, o sistema verifica que:
- Os alertas "error" estão marcados como ignorados com justificativa válida
- Os alertas "warn" são **recomendações de melhores práticas**, não vulnerabilidades críticas
- Os alertas "info" são apenas informativos

**Resultado:** O projeto está **funcionalmente seguro**, mas pode ser **endurecido** com melhorias adicionais.

---

## Classificação dos Alertas por Prioridade

### 🔴 PRIORIDADE ALTA (Implementar)

#### 1. **Rate Limiting em Endpoints Administrativos**
- **Alerta:** `OPEN_ENDPOINTS` (admin_no_rate_limit)
- **Problema:** Os endpoints de administração não têm proteção contra ataques de força bruta
- **Risco:** Um atacante pode tentar adivinhar a `ADMIN_KEY` fazendo milhares de tentativas
- **Impacto:** ALTO se a chave for fraca; MÉDIO se a chave for forte

**Endpoints vulneráveis:**
```text
/functions/v1/admin-auth          → Sem limite de tentativas
/functions/v1/admin-upload        → Sem limite de tentativas
/functions/v1/admin_get_upload_url → Sem limite de tentativas
/functions/v1/documents (POST/DELETE) → Sem limite de tentativas
```

**Solução proposta:**
Adicionar rate limiting específico para admin (5 tentativas por 5 minutos):
```typescript
// Adicionar em todas as edge functions de admin
const { data: rateLimitResult } = await supabase.rpc(
  "check_rate_limit",
  {
    p_client_key: clientKey + ":admin",
    p_endpoint: "admin-auth",
    p_max_requests: 5,
    p_window_seconds: 300,
  }
);

if (!rateLimitResult?.[0]?.allowed) {
  return Response.json(
    { error: "Muitas tentativas. Tente novamente em " + rateLimitResult[0].reset_in + " segundos" },
    { status: 429 }
  );
}
```

---

#### 2. **Validação de Tamanho de Inputs**
- **Alerta:** `INPUT_VALIDATION` (edge_func_input_valid)
- **Problema:** Não há limites de tamanho para mensagens e queries
- **Risco:** Ataques de DoS (Denial of Service) com inputs enormes que consomem memória
- **Impacto:** MÉDIO

**Funções afetadas:**
- `clara-chat`: mensagens de usuário sem limite de tamanho
- `search`: queries sem limite de tamanho
- `documents`: títulos e categorias sem validação de tamanho

**Solução proposta:**
Adicionar validação de tamanho nos inputs:

```typescript
// clara-chat/index.ts
const { message, history = [], mode = "fast" } = await req.json();

if (!message || typeof message !== 'string') {
  return error('Mensagem inválida');
}
if (message.length > 10000) {
  return error('Mensagem muito longa (máximo 10.000 caracteres)');
}
if (history && (!Array.isArray(history) || history.length > 50)) {
  return error('Histórico inválido ou muito longo (máximo 50 mensagens)');
}

// search/index.ts
if (!query || typeof query !== 'string' || query.length > 500) {
  return error('Query inválida ou muito longa (máximo 500 caracteres)');
}

// documents/index.ts
if (title && title.length > 500) {
  return error('Título muito longo (máximo 500 caracteres)');
}
if (category && !/^[a-zA-Z0-9_-]+$/.test(category)) {
  return error('Formato de categoria inválido');
}
```

---

### 🟡 PRIORIDADE MÉDIA (Considerar)

#### 3. **Políticas RLS para Gerenciamento de Roles**
- **Alerta:** `MISSING_RLS` (user_roles_write_control)
- **Problema:** A tabela `user_roles` não tem políticas de INSERT/UPDATE/DELETE
- **Status Atual:** ✅ Correto por design - usuários **não devem** poder modificar roles
- **Limitação:** Não há mecanismo documentado para admins atribuírem roles

**Estado atual:**
```sql
-- Tabela: user_roles
-- RLS: Habilitado ✓
-- SELECT: Permitido para ver próprios roles ✓
-- INSERT/UPDATE/DELETE: Bloqueado (default deny) ✓
```

**Problema prático:**
- Novos usuários recebem role 'user' automaticamente via trigger `handle_new_user()`
- **Não há função RPC para admins promoverem usuários a 'admin' ou 'moderator'**

**Solução proposta:**
Criar função administrativa protegida:

```sql
-- Função para admins gerenciarem roles
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  target_user_id UUID,
  new_role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem atribuir roles';
  END IF;
  
  -- Inserir ou atualizar role
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Política para admins gerenciarem roles
CREATE POLICY "Admins can manage all roles"
ON user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
```

**Observação:** Este alerta pode ser **ignorado** se você não precisa de um sistema de roles além do atual.

---

#### 4. **Exposição de Email em Profiles**
- **Alerta:** `PUBLIC_USER_DATA` (profiles_email_exposure)
- **Problema:** Usuários autenticados podem teoricamente enumerar outros emails
- **Status Atual:** Políticas RLS corretas - cada usuário só vê o próprio perfil
- **Risco:** BAIXO - requer vulnerabilidade adicional no código da aplicação

**Políticas atuais (CORRETAS):**
```sql
-- Usuários autenticados veem APENAS o próprio perfil
CREATE POLICY "Authenticated users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Anônimos NÃO podem ver nada
CREATE POLICY "Deny anon select on profiles"
ON profiles FOR SELECT
USING (false);
```

**Recomendação:** Manter como está. O alerta é preventivo, não indica vulnerabilidade real.

---

#### 5. **Session Fingerprint em Analytics**
- **Alerta:** `MISSING_RLS_PROTECTION` (query_analytics_user_privacy)
- **Problema:** `session_fingerprint` poderia rastrear usuários entre sessões
- **Status Atual:** Apenas admins podem ler os dados; anônimos podem inserir
- **Risco:** BAIXO - fingerprint é apenas para analytics agregado

**Solução (se necessário):**
Hash o fingerprint antes de armazenar:
```typescript
// No edge function
const hashedFingerprint = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(sessionFingerprint + SALT)
).then(buf => Array.from(new Uint8Array(buf))
  .map(b => b.toString(16).padStart(2, '0')).join(''));
```

**Recomendação:** Ignorar alerta se você não usa session_fingerprint para rastreamento individual.

---

### 🟢 PRIORIDADE BAIXA (Informativo - Já Seguro)

#### 6. **Autenticação Client-Side do Admin**
- **Alerta:** `CLIENT_SIDE_AUTH` (admin_client_auth)
- **Status:** ✅ **Seguro** - Backend valida todas as operações
- **Explicação:** O `sessionStorage` é apenas UX; todas as chamadas validam `ADMIN_KEY` no servidor

**Arquitetura atual (CORRETA):**
```text
Frontend (sessionStorage)     Backend (Edge Functions)
       ↓                              ↓
  Armazena chave          Valida x-admin-key header
  para UX                 contra ADMIN_KEY secret
       ↓                              ↓
  Pode ser burlado        ✓ Barreira real de segurança
  (apenas visual)         ✓ Todas operações protegidas
```

**Ação:** Nenhuma necessária. Marcar como ignorado com justificativa.

---

#### 7. **Funções SECURITY DEFINER**
- **Alerta:** `DEFINER_OR_RPC_BYPASS` (definer_funcs_secure)
- **Status:** ✅ **Implementado corretamente**
- **Funções verificadas:** Todas têm `SET search_path = public` (previne ataques)

**Ação:** Nenhuma necessária. Alerta informativo.

---

#### 8. **Gerenciamento de Secrets**
- **Alerta:** `SECRETS_EXPOSED` (secrets_management)
- **Status:** ✅ **Implementado corretamente**
- **Separação:** Secrets sensíveis apenas no servidor; cliente usa chaves públicas

**Ação:** Nenhuma necessária. Alerta informativo.

---

#### 9. **Tabela Rate Limits**
- **Alerta:** `rate_limits_by_design`
- **Status:** ✅ **Design BY DESIGN e seguro**
- **Padrão:** Service role access via SECURITY DEFINER (não precisa de RLS policies)

**Ação:** Nenhuma necessária. Marcar como ignorado.

---

#### 10. **Bucket Público**
- **Alerta:** `STORAGE_EXPOSURE` (knowledge_base_public)
- **Level:** error (mas **ignorado intencionalmente**)
- **Status:** ✅ **Intencional** - CLARA é assistente público; documentos são educacionais
- **Proteção:** Escrita restrita apenas a service role

**Ação:** Já está ignorado com justificativa válida.

---

#### 11. **Extensão pgvector no Schema Public**
- **Alerta:** `SUPA_extension_in_public`
- **Status:** ✅ **Limitação da plataforma Supabase**
- **Explicação:** Supabase gerencia extensões; não há risco de segurança

**Ação:** Já está ignorado com justificativa válida.

---

## Resumo Executivo

| Categoria | Quantidade | Ação Recomendada |
|-----------|------------|------------------|
| 🔴 Alta Prioridade | 2 | **Implementar** rate limiting admin + validação input |
| 🟡 Média Prioridade | 3 | Considerar (não crítico) |
| 🟢 Informativo (OK) | 6 | Marcar como ignorado com justificativa |

---

## Plano de Implementação

### Fase 1: Hardening Crítico (Prioridade Alta)

**Arquivos a modificar:**

1. **`supabase/functions/admin-auth/index.ts`**
   - Adicionar rate limiting (5 tentativas / 5 min)

2. **`supabase/functions/admin_get_upload_url/index.ts`**
   - Adicionar rate limiting

3. **`supabase/functions/admin-upload/index.ts`**
   - Adicionar rate limiting

4. **`supabase/functions/documents/index.ts`**
   - Adicionar rate limiting em POST/DELETE
   - Adicionar validação de tamanho em title/category

5. **`supabase/functions/clara-chat/index.ts`**
   - Adicionar validação: message ≤ 10.000 chars
   - Adicionar validação: history ≤ 50 mensagens

6. **`supabase/functions/search/index.ts`**
   - Adicionar validação: query ≤ 500 chars

---

### Fase 2: Melhorias Opcionais (Prioridade Média)

1. **Migration SQL**: Criar função `admin_assign_role()` + policy
2. **Hashing de fingerprint** (se analytics for sensível)

---

### Fase 3: Marcar Alertas Informativos como Ignorados

Usar a ferramenta `security--manage_security_finding` para marcar os seguintes alertas como ignorados com justificativa:

```typescript
{
  operations: [
    {
      operation: "update",
      internal_id: "admin_client_auth",
      finding: {
        ignore: true,
        ignore_reason: "Client-side sessionStorage é apenas UX. Todas as operações administrativas são validadas server-side via x-admin-key header contra ADMIN_KEY secret. Não há risco de segurança real - o backend é a barreira de proteção."
      }
    },
    {
      operation: "update",
      internal_id: "profiles_email_exposure",
      finding: {
        ignore: true,
        ignore_reason: "As políticas RLS estão corretas: cada usuário vê apenas o próprio perfil (auth.uid() = id). Anônimos não têm acesso. Não há enumeração possível sem vulnerabilidade adicional no código."
      }
    },
    {
      operation: "update",
      internal_id: "query_analytics_user_privacy",
      finding: {
        ignore: true,
        ignore_reason: "Session fingerprint é usado apenas para analytics agregado. Apenas admins podem ler os dados. Se necessário, pode-se implementar hashing antes do armazenamento."
      }
    }
  ]
}
```

---

## Por que os Alertas Não Desaparecem?

**Explicação técnica:**

1. O sistema de segurança identifica **padrões de risco** (rate limiting ausente, validação de input, etc.)
2. Quando você autoriza reparos, ele verifica se há **vulnerabilidades exploráveis** (level: error)
3. Como os alertas são **avisos** (level: warn), não **erros críticos**, o sistema diz "nada a fazer"
4. **Os alertas continuam aparecendo** porque são **recomendações válidas**, não bugs a corrigir

**Solução:**
- Implementar as melhorias de Fase 1 (rate limiting + validação)
- Marcar os alertas informativos como ignorados (Fase 3)
- Isso reduzirá os alertas para apenas os que realmente precisam de atenção

---

## Risco Atual do Projeto

**Avaliação Geral: 🟡 BAIXO-MÉDIO**

| Aspecto | Status | Risco |
|---------|--------|-------|
| Autenticação Admin | ✓ Servidor validado | Baixo |
| RLS Policies | ✓ Corretas | Baixo |
| Rate Limiting (público) | ✓ Implementado | Baixo |
| Rate Limiting (admin) | ✗ Ausente | **Médio** |
| Validação de Input | ✗ Parcial | **Médio** |
| Secrets Management | ✓ Correto | Baixo |
| Bucket Exposure | ✓ Intencional | Baixo |

**Conclusão:** O projeto está **funcionalmente seguro** para uso em produção, mas pode ser **endurecido** com rate limiting admin e validação de inputs para prevenir abusos.

---

## Estrutura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                    FASE 1: HARDENING                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Edge Functions (Rate Limiting Admin)                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │  admin-auth                                        │    │
│  │  admin_get_upload_url           Add:               │    │
│  │  admin-upload               check_rate_limit()     │    │
│  │  documents (POST/DELETE)    5 req / 5 min         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Edge Functions (Input Validation)                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  clara-chat                                        │    │
│  │    message ≤ 10.000 chars                         │    │
│  │    history ≤ 50 messages                          │    │
│  │                                                    │    │
│  │  search                                            │    │
│  │    query ≤ 500 chars                              │    │
│  │                                                    │    │
│  │  documents                                         │    │
│  │    title ≤ 500 chars                              │    │
│  │    category regex validation                      │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              FASE 2: MELHORIAS OPCIONAIS                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Database Migration (Role Management)                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │  CREATE FUNCTION admin_assign_role()               │    │
│  │  CREATE POLICY "Admins can manage all roles"      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Analytics (Privacy Enhancement)                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Hash session_fingerprint before storage          │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          FASE 3: MARCAR ALERTAS INFORMATIVOS                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Security Findings (Set ignore=true)                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ✓ admin_client_auth                               │    │
│  │  ✓ profiles_email_exposure                         │    │
│  │  ✓ query_analytics_user_privacy                    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Decisão Recomendada

**Opção A: Hardening Completo (Recomendado)**
- Implementar Fase 1 (rate limiting + validação)
- Implementar Fase 3 (marcar alertas informativos)
- Resultado: Projeto totalmente endurecido, sem alertas falsos

**Opção B: Apenas Marcar Informativos**
- Implementar apenas Fase 3
- Resultado: Alertas reduzidos, mas rate limiting admin continua ausente

**Opção C: Status Quo**
- Não fazer nada
- Resultado: Continuar vendo alertas a cada publicação

**Minha Recomendação:** **Opção A** - O rate limiting admin leva ~30 minutos para implementar e previne ataques de força bruta. A validação de input leva ~20 minutos e previne abusos de DoS.
