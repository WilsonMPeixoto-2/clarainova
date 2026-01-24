# Plano: Corrigir Upload de PDFs - Arquitetura Revisada

## Problema Identificado

1. **Limite de Payload**: Edge Functions têm limite de ~6MB. PDFs maiores falham silenciosamente.
2. **Biblioteca incorreta**: `pdf-lib` não extrai texto (apenas modifica PDFs).

## Solução: Padrão Upload-then-Process

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend   │ ──► │ Supabase Storage│ ──► │  Edge Function  │
│ (Upload)    │     │ (Bucket)        │     │ (Processa)      │
└─────────────┘     └─────────────────┘     └─────────────────┘
       │                                            │
       └──────── Envia apenas filePath ─────────────┘
```

### Fluxo Corrigido:

1. **Frontend faz upload para Storage** (suporta arquivos grandes)
2. **Frontend chama Edge Function** enviando apenas o `filePath`
3. **Edge Function baixa do Storage** e processa com Gemini (já funciona)

---

## Implementação

### 1. Atualizar Frontend (`src/pages/Admin.tsx`)

**Mudanças:**
- Upload direto para Supabase Storage (bucket: `knowledge-base`)
- Chamar Edge Function apenas com metadata + filePath

### 2. Atualizar Edge Function (`supabase/functions/documents/index.ts`)

**Mudanças:**
- Aceitar `filePath` em vez de arquivo binário
- Baixar arquivo do Storage usando Admin Client
- Processar com Gemini (já implementado e funcionando)

---

## Por que manter Gemini para PDFs?

A extração via Gemini já está funcionando no código atual e oferece vantagens:
- Suporta PDFs escaneados (OCR nativo)
- Compatível com Deno (sem dependências Node.js)
- Extração mais inteligente que pdfjs-dist

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Admin.tsx` | Upload para Storage primeiro |
| `supabase/functions/documents/index.ts` | Receber filePath, baixar do Storage |

---

## Resultado Esperado

- PDFs de qualquer tamanho (até limite do Storage: 50MB)
- Sem erros de payload
- Processamento robusto via Gemini
