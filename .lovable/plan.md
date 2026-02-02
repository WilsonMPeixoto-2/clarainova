

# Plano: Corrigir Erro `supabase.sql is not a function`

## Problema Identificado

Na Edge Function `documents/index.ts`, linha 538, há uma chamada inválida:

```typescript
version: supabase.sql`COALESCE(version, 0) + 1`
```

O cliente `@supabase/supabase-js` **não possui** um método `.sql()`. Isso causa um erro 500 sempre que um documento é processado e precisa atualizar a versão.

---

## Solução

Substituir a linha 538 por uma lógica de "fetch-then-update":

### Antes (linha 531-540):
```typescript
// Update document metadata
await supabase
  .from("documents")
  .update({
    content_hash: contentHash,
    chunk_count: chunks.length,
    processed_at: new Date().toISOString(),
    version: supabase.sql`COALESCE(version, 0) + 1`  // ← ERRO
  })
  .eq("id", documentId);
```

### Depois:
```typescript
// Fetch current version for atomic increment
const { data: currentDoc } = await supabase
  .from("documents")
  .select("version")
  .eq("id", documentId)
  .single();

const nextVersion = (currentDoc?.version || 0) + 1;

// Update document metadata
await supabase
  .from("documents")
  .update({
    content_hash: contentHash,
    chunk_count: chunks.length,
    processed_at: new Date().toISOString(),
    version: nextVersion
  })
  .eq("id", documentId);
```

---

## Arquivo Afetado

- `supabase/functions/documents/index.ts` (linhas 531-540)

---

## Critérios de Aceite

1. Upload de documento não retorna erro 500 `supabase.sql is not a function`
2. Campo `version` do documento é incrementado corretamente a cada processamento
3. Logs mostram `db_insert` como step completado

---

## Como Testar

1. Acessar `/admin` e fazer login
2. Fazer upload de um PDF pequeno (< 5MB)
3. Verificar que o documento aparece na lista sem erro
4. Verificar no banco que o campo `version` foi preenchido (1, 2, 3...)

---

## Risco

- **Baixo**: Alteração simples de lógica
- **Race condition teórica**: Em uploads simultâneos do mesmo documento, o version poderia não incrementar atomicamente. Isso é aceitável para o caso de uso (admin único fazendo uploads)

