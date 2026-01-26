

# Plano: Fallback com Lovable AI para Processamento de Documentos

## Problema Identificado
A conexão está funcionando corretamente. O erro 400 que você viu foi causado porque a **cota gratuita do Gemini esgotou** (erro 429 nos bastidores). O PDF de 34MB foi enviado com sucesso, mas o Gemini não pôde processar.

## Solução Proposta
Implementar o mesmo sistema de fallback que já existe no chat: quando o Gemini retornar erro de cota (429), automaticamente tentar processar via **Lovable AI**.

## Benefícios
- O processamento de documentos continua funcionando mesmo com cota esgotada
- Não precisa aguardar reset da cota ou pagar por chave premium
- Consistência com o comportamento do chat

## O que será alterado

### Arquivo: `supabase/functions/documents/index.ts`

1. Adicionar variável de ambiente para Lovable AI
2. Criar função de extração via Lovable AI (similar ao clara-chat)
3. Implementar lógica de fallback: se Gemini falhar com 429, tentar Lovable AI

```text
┌─────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL                                                 │
├─────────────────────────────────────────────────────────────┤
│ PDF → URL Assinada → Gemini API                             │
│         ↓                                                   │
│      Se 429 → ERRO (parou aqui)                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FLUXO PROPOSTO                                              │
├─────────────────────────────────────────────────────────────┤
│ PDF → URL Assinada → Gemini API                             │
│         ↓                                                   │
│      Se 429 → Tenta Lovable AI (fallback)                   │
│                   ↓                                         │
│               Sucesso → Continua processamento              │
└─────────────────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Variáveis de ambiente necessárias
- `LOVABLE_API_KEY` - já configurada no projeto

### Função de extração via Lovable AI
```typescript
async function extractPdfViaLovableAI(signedUrl: string): Promise<string> {
  const response = await fetch("https://ai.lovable.dev/api/v1/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{
        role: "user",
        content: [
          { type: "file_url", file_url: { url: signedUrl } },
          { type: "text", text: "Extraia TODO o texto deste PDF..." }
        ]
      }]
    }),
  });
  // ... parse response
}
```

### Lógica de fallback
```typescript
try {
  // Tentar Gemini primeiro
  contentText = await extractWithGemini(signedUrl);
} catch (geminiError) {
  if (isRateLimitError(geminiError)) {
    console.log("[documents] Gemini rate limited, trying Lovable AI...");
    contentText = await extractPdfViaLovableAI(signedUrl);
  } else {
    throw geminiError;
  }
}
```

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/documents/index.ts` | Adicionar fallback com Lovable AI para extração de PDF |

## Resultado Esperado
Após a implementação, o processamento de documentos grandes continuará funcionando mesmo quando a cota do Gemini esgotar.

