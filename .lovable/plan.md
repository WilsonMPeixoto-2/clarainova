

# Plano: Migrar CLARA do Lovable AI Gateway para API Direta do Gemini

## Objetivo
Modificar a Edge Function `clara-chat` para usar sua chave `GEMINI_API_KEY` diretamente em vez do Lovable AI Gateway, garantindo limites de uso conhecidos e transparentes.

---

## Vantagens da Migração

| Aspecto | Lovable AI Gateway (Atual) | API Direta Gemini (Novo) |
|---------|---------------------------|-------------------------|
| Rate Limits | Opacos/compartilhados | **15 RPM, 1.500 req/dia** (Free Tier) |
| Monitoramento | Não disponível | **Google AI Studio Console** |
| Custo | Potencial cobrança não transparente | **Gratuito** até os limites |
| Modelos | gemini-3-flash/pro | **gemini-2.0-flash** (recomendado) ou **gemini-1.5-pro** |

---

## Mudanças Técnicas

### 1. Modelos Disponíveis na API Direta
A API direta do Google AI não usa os mesmos nomes de modelo que o gateway Lovable. Os modelos equivalentes são:

- **Fast Mode**: `gemini-2.0-flash` (substitui `google/gemini-3-flash-preview`)
- **Deep Mode**: `gemini-1.5-pro` (substitui `google/gemini-3-pro-preview`)

### 2. Google Search Grounding
A API direta do Gemini também suporta Google Search como ferramenta, então o fallback para busca web continuará funcionando.

### 3. Streaming
A SDK oficial do Google (`@google/generative-ai`) suporta streaming nativo via `generateContentStream()`.

---

## Arquivos a Modificar

### `supabase/functions/clara-chat/index.ts`

**Alterações principais:**

1. **Remover chamada ao Lovable AI Gateway** (linhas 693-701)
2. **Usar SDK Google Generative AI** que já está importada para chat completion
3. **Atualizar MODEL_MAP** com nomes de modelo corretos para a API direta
4. **Adaptar streaming** para usar o formato nativo da SDK do Google
5. **Remover tratamento de erros 402** (não aplicável na API direta)

---

## Detalhes da Implementação

### Atualização do MODEL_MAP (linha 11-14)

```text
Antes:
  fast: "google/gemini-3-flash-preview"
  deep: "google/gemini-3-pro-preview"

Depois:
  fast: "gemini-2.0-flash"
  deep: "gemini-1.5-pro"
```

### Nova Lógica de Chat (substituir linhas 674-719)

1. Criar modelo generativo com a SDK já importada
2. Configurar Google Search como ferramenta quando necessário
3. Usar `generateContentStream()` para streaming nativo
4. Processar chunks do stream e emitir eventos SSE no formato atual

### Tratamento de Rate Limits

- **Erro 429 da API do Google**: Continua sendo tratado
- **Erro 402 (Payment Required)**: Removido (não existe na API gratuita do Google)

---

## Limites do Free Tier do Gemini (Garantidos)

| Modelo | RPM | TPM | RPD |
|--------|-----|-----|-----|
| gemini-2.0-flash | 15 | 1.000.000 | 1.500 |
| gemini-1.5-pro | 2 | 32.000 | 50 |

**Nota**: O modo "Deep" (gemini-1.5-pro) tem limites muito mais baixos. Se o uso intensivo do modo profundo for esperado, considere usar `gemini-2.0-flash` para ambos os modos.

---

## Monitoramento

Após a migração, você poderá monitorar o uso em:
**https://aistudio.google.com** → Seção "Get API Key" → Ver uso por projeto

---

## Risco e Rollback

- **Risco baixo**: A SDK já está em uso para embeddings, então a integração é comprovada
- **Rollback**: Basta reverter as mudanças no arquivo se necessário
- **Testes**: Executarei os testes existentes da Edge Function para validar

---

## Resumo das Tarefas

1. Atualizar `MODEL_MAP` com nomes de modelo da API direta
2. Substituir fetch ao Lovable Gateway por chamada à SDK do Google
3. Adaptar lógica de streaming para formato nativo da SDK
4. Manter suporte a Google Search Grounding
5. Remover tratamento de erro 402 (não aplicável)
6. Testar função com modo fast e deep

