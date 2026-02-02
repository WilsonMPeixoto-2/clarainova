# Plano: Corrigir Edge Function `documents` (Boot Failure)

## ✅ Status: CONCLUÍDO

**Data:** 2026-02-02

---

## Problema Identificado

A Edge Function `documents` estava falhando ao iniciar com:
```
worker boot error: The requested module 'pdfjs-serverless@0.6.0' does not provide an export named 'getDocument'
```

---

## Solução Aplicada

Atualizado `pdfjs-serverless` de `0.6.0` para `1.1.0` em:

1. ✅ `supabase/functions/import_map.json` (linha 8)
2. ✅ `supabase/functions/documents/index.ts` (linha 9)

---

## Próximo Passo

Verificar logs da função `documents` após deploy para confirmar boot sem erros.

---

## Nota sobre ADMIN_KEY

O erro 401 "Chave de administrador inválida" é separado e requer verificação do secret `ADMIN_KEY` nas configurações do projeto.
