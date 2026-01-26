

# Plano: Seletor de Modo de Resposta (Rápido vs. Profundo)

## Visão Geral

Implementar um toggle/botão que permite ao usuário escolher entre dois modos de resposta:

| Modo | Rótulo para Usuário | Modelo Real | Características |
|------|---------------------|-------------|-----------------|
| **Rápido** | "Resposta Rápida" | `google/gemini-3-flash-preview` | Menor latência, bom para dúvidas simples |
| **Profundo** | "Análise Completa" | `google/gemini-3-pro-preview` | Raciocínio avançado, ideal para legislação complexa |

Os nomes técnicos (Google, Gemini) ficam ocultos - o usuário só vê rótulos amigáveis.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ChatInput.tsx                                        │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  [⚡ Rápido]  [🧠 Análise Completa]           │  │   │
│  │  │       ↓ toggle selecionado                    │  │   │
│  │  │  state: responseMode = "fast" | "deep"        │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useChat.ts                                           │   │
│  │   sendMessage(content, mode) → POST /clara-chat      │   │
│  │   body: { message, history, mode: "fast"|"deep" }    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  EDGE FUNCTION                              │
│                                                             │
│  supabase/functions/clara-chat/index.ts                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  const mode = body.mode || "fast";                   │   │
│  │                                                      │   │
│  │  const MODEL_MAP = {                                 │   │
│  │    "fast": "google/gemini-3-flash-preview",          │   │
│  │    "deep": "google/gemini-3-pro-preview"             │   │
│  │  };                                                  │   │
│  │                                                      │   │
│  │  model: MODEL_MAP[mode]                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Etapas de Implementação

### Etapa 1: Atualizar Edge Function (`clara-chat`)

**Arquivo:** `supabase/functions/clara-chat/index.ts`

**Mudanças:**
1. Adicionar constante `MODEL_MAP` no topo do arquivo:
   ```typescript
   const MODEL_MAP: Record<string, string> = {
     "fast": "google/gemini-3-flash-preview",
     "deep": "google/gemini-3-pro-preview"
   };
   ```

2. Extrair o parâmetro `mode` do body da requisição (com default "fast"):
   ```typescript
   const { message, history = [], mode = "fast" } = await req.json();
   ```

3. Usar o modelo correto na chamada à API:
   ```typescript
   model: MODEL_MAP[mode] || MODEL_MAP["fast"],
   ```

4. Ajustar `max_tokens` e `temperature` por modo (opcional):
   - Fast: `temperature: 0.5`, `max_tokens: 4096`
   - Deep: `temperature: 0.3`, `max_tokens: 8192`

---

### Etapa 2: Atualizar Hook `useChat`

**Arquivo:** `src/hooks/useChat.ts`

**Mudanças:**
1. Adicionar tipo para o modo:
   ```typescript
   export type ResponseMode = "fast" | "deep";
   ```

2. Modificar `sendMessage` para aceitar o modo:
   ```typescript
   const sendMessage = useCallback(async (content: string, mode: ResponseMode = "fast") => {
   ```

3. Incluir `mode` no body do fetch:
   ```typescript
   body: JSON.stringify({
     message: content,
     history: historyForApi.slice(0, -1),
     mode: mode
   }),
   ```

---

### Etapa 3: Criar Componente de Seleção de Modo

**Arquivo (novo):** `src/components/chat/ResponseModeSelector.tsx`

**Funcionalidade:**
- Toggle com dois botões estilizados
- Ícones visuais: ⚡ (Rápido) e 🧠 (Análise Completa)
- Tooltip explicando cada modo
- Estado controlado pelo componente pai

**Design sugerido:**
```text
┌──────────────────────────────────────┐
│  [⚡ Rápido]   [🧠 Análise Completa] │
│     ↑ selecionado (fundo primário)   │
└──────────────────────────────────────┘
```

---

### Etapa 4: Integrar no ChatInput

**Arquivo:** `src/components/chat/ChatInput.tsx`

**Mudanças:**
1. Importar e usar `ResponseModeSelector`
2. Adicionar estado local: `const [mode, setMode] = useState<ResponseMode>("fast")`
3. Posicionar o seletor acima ou ao lado do campo de texto
4. Passar o `mode` no `onSend`:
   ```typescript
   interface ChatInputProps {
     onSend: (message: string, mode: ResponseMode) => void;
     // ...
   }
   ```

---

### Etapa 5: Atualizar ChatPanel

**Arquivo:** `src/components/chat/ChatPanel.tsx`

**Mudanças:**
- Ajustar a chamada do `sendMessage` para passar o modo recebido do `ChatInput`
- As sugestões de perguntas usam modo "fast" por padrão

---

## Design Visual do Seletor

Duas opções de posicionamento:

**Opção A - Dentro do ChatInput (recomendada):**
```text
┌────────────────────────────────────────────────────┐
│  [⚡ Rápido] [🧠 Completa]                         │
├────────────────────────────────────────────────────┤
│  Digite sua pergunta...                      [➤]  │
└────────────────────────────────────────────────────┘
```

**Opção B - Barra de status inferior:**
```text
┌────────────────────────────────────────────────────┐
│  Digite sua pergunta...                      [➤]  │
├────────────────────────────────────────────────────┤
│  Modo: [⚡ Rápido] [🧠 Completa]    120/2000      │
└────────────────────────────────────────────────────┘
```

**Cores:**
- Botão selecionado: fundo `bg-primary`, texto `text-primary-foreground`
- Botão não selecionado: fundo `bg-muted/50`, texto `text-muted-foreground`
- Transição suave com `transition-colors`

---

## Tooltips Explicativos

| Modo | Tooltip |
|------|---------|
| ⚡ Rápido | "Respostas ágeis para dúvidas simples e procedimentos do dia a dia." |
| 🧠 Análise Completa | "Análise mais profunda para questões complexas de legislação e normas." |

---

## Persistência (Opcional)

O modo selecionado pode ser salvo no `localStorage` para manter a preferência do usuário entre sessões:
```typescript
const STORAGE_KEY = "clara-response-mode";
const [mode, setMode] = useLocalStorage<ResponseMode>(STORAGE_KEY, "fast");
```

---

## Considerações Técnicas

| Aspecto | Detalhe |
|---------|---------|
| **Custo** | O modo "deep" (Pro) consome mais créditos que o "fast" (Flash) |
| **Latência** | Flash responde ~2-3x mais rápido que Pro |
| **Default** | "fast" é o padrão - maioria das dúvidas são operacionais |
| **Migração** | Atualiza de `gemini-2.5-flash` para `gemini-3-flash-preview` |

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/clara-chat/index.ts` | Modificar - adicionar MODEL_MAP e extrair mode |
| `src/hooks/useChat.ts` | Modificar - adicionar parâmetro mode |
| `src/components/chat/ResponseModeSelector.tsx` | **Criar** - novo componente |
| `src/components/chat/ChatInput.tsx` | Modificar - integrar seletor |
| `src/components/chat/ChatPanel.tsx` | Modificar - propagar mode nas chamadas |

