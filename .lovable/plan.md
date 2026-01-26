
# Plano: Correção Definitiva do Upload de PDFs

## Resumo do Problema

O erro 400 ao processar PDFs grandes ocorre porque o Gemini SDK com `fileUri` **não aceita URLs externas** (como signed URLs do Supabase). O Gemini espera URLs do Google Cloud Storage ou dados inline em base64.

## Solução Arquitetural

Inverter a lógica de extração: usar **Lovable AI como método primário** (suporta URLs externas) e **Gemini com base64 como fallback** (para PDFs menores quando Lovable AI falhar).

```text
┌─────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL (com problema)                                  │
├─────────────────────────────────────────────────────────────┤
│ PDF → Signed URL → Gemini fileUri → Erro 400                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NOVO FLUXO (solução)                                        │
├─────────────────────────────────────────────────────────────┤
│ PDF → Lovable AI (URL externa) ✓                            │
│   ↓                                                         │
│ Se falhar → Gemini base64 (<15MB) ✓                         │
└─────────────────────────────────────────────────────────────┘
```

## Mudanças a Implementar

### 1. Edge Function `documents/index.ts` (A Grande Mudança)

**Arquivo:** `supabase/functions/documents/index.ts`

**Mudanças:**

a) **Inverter ordem de extração**: Lovable AI primeiro, Gemini depois

b) **Nova função `extractPdfViaGeminiBase64`**: Converte PDF para base64 e envia via `inlineData` (funciona!)

c) **Remover uso de `fileUri`**: O parâmetro `fileData.fileUri` não funciona com URLs externas

d) **Limite de 15MB para fallback Gemini**: Base64 dobra o tamanho, então limite conservador

**Código principal da mudança (linhas 394-477):**

```typescript
// NOVO: Tentar Lovable AI primeiro (suporta URLs externas)
try {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY não configurada");
  }
  
  console.log(`[documents] Attempting PDF extraction via Lovable AI (primary)...`);
  contentText = await extractPdfViaLovableAI(signedUrl, LOVABLE_API_KEY);
  console.log(`[documents] PDF extracted via Lovable AI: ${contentText.length} characters`);
  
} catch (lovableError) {
  console.error("[documents] Lovable AI extraction failed:", lovableError);
  
  // Fallback: Gemini com base64 (apenas para PDFs < 15MB)
  const MAX_BASE64_SIZE = 15 * 1024 * 1024; // 15MB
  
  if (GEMINI_API_KEY && fileData.size <= MAX_BASE64_SIZE) {
    console.log("[documents] Attempting fallback to Gemini with base64...");
    
    try {
      contentText = await extractPdfViaGeminiBase64(fileData, GEMINI_API_KEY);
      console.log(`[documents] PDF extracted via Gemini base64: ${contentText.length} characters`);
    } catch (geminiError) {
      throw new Error(`Falha em ambos provedores: Lovable AI e Gemini`);
    }
  } else {
    throw lovableError;
  }
}
```

**Nova função `extractPdfViaGeminiBase64`:**

```typescript
async function extractPdfViaGeminiBase64(
  fileBlob: Blob, 
  geminiApiKey: string
): Promise<string> {
  console.log("[documents] Converting PDF to base64...");
  
  const arrayBuffer = await fileBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Convert to base64 in chunks (memory efficient)
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  const base64Data = btoa(binaryString);
  
  console.log(`[documents] Base64 size: ${Math.round(base64Data.length / 1024)}KB`);
  
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: base64Data  // ✅ Base64 funciona!
      }
    },
    {
      text: `Extraia TODO o texto deste documento PDF de forma literal...`
    }
  ]);
  
  return result.response.text();
}
```

### 2. Frontend `Admin.tsx` (Robustez)

**Arquivo:** `src/pages/Admin.tsx`

**Mudanças:**

a) **Retry com Exponential Backoff**: 3 tentativas com delays crescentes (1s, 2s, 4s)

b) **Timeouts diferenciados já existem**: 60s desktop, 120s mobile (já implementado!)

c) **Mensagens de progresso mais claras**: Indicar qual etapa está em andamento

**Função de upload com retry (linhas 327-386):**

```typescript
// Retry com exponential backoff
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 segundo

const uploadWithRetry = async (
  fileToUpload: File, 
  signedUrl: string
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      debugLog(`[Admin] Upload attempt ${attempt}/${MAX_RETRIES}`);
      return await uploadFile(fileToUpload, signedUrl);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Não fazer retry para erros definitivos
      if (lastError.message.includes("muito grande") || 
          lastError.message.includes("não autorizado")) {
        throw lastError;
      }
      
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
        debugLog(`[Admin] Retry in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError || new Error("Upload falhou após todas tentativas");
};
```

### 3. Limpeza de Código Legado

**Remover:**
- Uso de `fileData.fileUri` no Gemini (não funciona com URLs externas)
- Qualquer referência a `pdf-parse` ou `pdfjs` (não usadas, mas garantir limpeza)

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/documents/index.ts` | Inverter lógica: Lovable AI primário, Gemini base64 fallback |
| `src/pages/Admin.tsx` | Adicionar retry com exponential backoff (3 tentativas) |

## Resultado Esperado

1. **PDFs de qualquer tamanho (até 50MB)**: Processados via Lovable AI
2. **Fallback robusto**: Se Lovable AI falhar, Gemini com base64 para PDFs < 15MB
3. **Retry automático**: 3 tentativas com delays crescentes para falhas de rede
4. **Sem dependência de cota Gemini**: Lovable AI como primário não tem limite de cota restritivo

## Detalhes Técnicos

### Por que Gemini `fileUri` não funciona?

O parâmetro `fileUri` do Gemini SDK espera URLs de:
- Google Cloud Storage (`gs://bucket/file.pdf`)
- File API do Gemini (upload prévio via API)

URLs externas (como signed URLs do Supabase) são rejeitadas com erro 400.

### Por que `inlineData` com base64 funciona?

O parâmetro `inlineData.data` aceita dados base64 diretamente, sem depender de URLs. Limitação: o tamanho do payload aumenta ~33% devido à codificação base64.

### Limite de 15MB para Gemini base64

- Payload base64 = 1.33x tamanho original
- 15MB original = ~20MB em base64
- Limite seguro para Edge Functions Deno
