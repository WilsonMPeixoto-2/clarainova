
# Plano: Corrigir Edge Function `documents` (Boot Failure)

## Problema Identificado

A Edge Function `documents` está falhando ao iniciar com o seguinte erro:

```
worker boot error: Uncaught SyntaxError: The requested module 
'https://esm.sh/pdfjs-serverless@0.6.0' does not provide an export named 'getDocument'
```

A versão `0.6.0` do `pdfjs-serverless` exporta apenas `resolvePDFJS`, não `getDocument`. A versão `1.1.0` corrige isso.

---

## Solução

Atualizar a versão do `pdfjs-serverless` de `0.6.0` para `1.1.0` em dois arquivos:

### Arquivo 1: `supabase/functions/import_map.json`

Alterar linha 8:
```json
// DE:
"pdfjs-serverless": "https://esm.sh/pdfjs-serverless@0.6.0"

// PARA:
"pdfjs-serverless": "https://esm.sh/pdfjs-serverless@1.1.0"
```

### Arquivo 2: `supabase/functions/documents/index.ts`

Alterar linha 9:
```typescript
// DE:
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.6.0";

// PARA:
import { getDocument } from "https://esm.sh/pdfjs-serverless@1.1.0";
```

---

## Critérios de Aceite

1. Edge Function `documents` inicia sem erro de boot
2. Logs não mostram mais `does not provide an export named 'getDocument'`
3. Upload de documentos no Admin funciona (após resolver ADMIN_KEY)
4. Listagem de documentos (GET /documents) retorna dados

---

## Como Testar

1. Após o deploy, verificar logs da função `documents`
2. Acessar Admin > Documentos - deve carregar a lista
3. Testar upload de um PDF pequeno

---

## Risco

- **Baixo**: Apenas atualização de versão de dependência
- **Rollback**: Reverter para versão anterior se houver breaking changes na API (improvável, mesma função `getDocument`)

---

## Nota sobre ADMIN_KEY

O erro 401 "Chave de administrador inválida" é separado e requer verificação do secret `ADMIN_KEY` nas configurações do projeto. Após aprovar este plano, posso ajudar a configurar a chave correta.
