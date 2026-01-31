

# Plano de Implementação v2.1.0 — Chat Controls & Premium Features

**Status Atual**: Sprint 1 Completo ✅

## Sprints Concluídos

### ✅ Sprint 1: Fundação (Fases 0 + 1) — IMPLEMENTADO
**Data**: 2026-01-31

**Arquivos modificados**:
- `CHANGELOG.md` - Adicionada seção v2.1.0
- `src/hooks/useChat.ts` - Interface `MessageStatus`, `SendMessageOptions`, refs, `regenerateLast()`, `continueLast()`
- `src/components/chat/ChatMessage.tsx` - Props para controles, integração com `MessageControls`
- `src/components/chat/MessageControls.tsx` - **NOVO** componente para Stop/Regenerate/Continue
- `src/components/chat/ResponseNotice.tsx` - Adicionado tipo "stopped"
- `src/pages/Chat.tsx` - Passagem de props de controle para `ChatMessage`
- `supabase/functions/clara-chat/index.ts` - SSE `request_id`, flag `continuation`, instrução de continuação

**Features implementadas**:
- ✅ Botão "Parar" durante streaming
- ✅ Estado "stopped" com notice "Resposta interrompida"
- ✅ Botão "Regenerar" para gerar nova resposta
- ✅ Botão "Continuar" para continuar resposta interrompida
- ✅ Tracking de `request_id` via SSE
- ✅ Backend suporta `{ continuation: true }`

---

## Próximos Sprints

### Sprint 2: Integração de Sessões (Fase 2.1-2.2 parcial)
- [ ] Chat.tsx: integrar useChatSessions hook
- [ ] MessageActions.tsx: agrupar CopyButton, ChecklistButton, etc.
- [ ] Menu "..." para mobile com DropdownMenu

### Sprint 3: Admin Feedback Dashboard (Fase 3.2)
- [ ] FeedbackTab.tsx: componente com métricas
- [ ] Admin.tsx: adicionar aba "Feedback"

### Sprint 4: Knowledge Base Enhancements (Fase 5)
- [ ] Migração SQL: version_label, effective_date, supersedes_document_id, tags
- [ ] Admin UI: filtros e ação "Marcar como substituída"
- [ ] Reprocessamento com motivo

---



## Avaliação Crítica Consolidada

Analisei todas as 6 fases do seu plano contra o código atual. Abaixo está minha avaliação por categoria:

### Legenda de Status
- **Implementar**: Acréscimo positivo, implementação total recomendada
- **Adaptar**: Boa ideia, mas o código existente requer adaptação (não criação do zero)
- **Parcial**: Conceito válido, mas escopo deve ser reduzido para evitar complexidade
- **Postergar**: Válido, mas dependente de outras fases ou exige esforço desproporcional
- **Já existe**: Funcionalidade já implementada, apenas refinamentos necessários

---

## FASE 0 — Preparação de Release

| Item | Status | Avaliação |
|------|--------|-----------|
| CHANGELOG.md v2.1.0 | **Implementar** | Necessário para governança |
| .lovable/plan.md atualização | **Implementar** | Atualizar seções existentes |

**Risco**: Zero — apenas documentação

---

## FASE 1 — Chat Controls (Stop/Regenerate/Continue)

| Item | Status | Avaliação |
|------|--------|-----------|
| AbortController no useChat | **Adaptar** | `abortControllerRef` e `cancelStream()` **já existem** (linhas 108, 405-407). Falta: estados por mensagem, `lastUserMessageRef` |
| `message.status` (streaming/done/stopped/error) | **Implementar** | Interface `ChatMessage` precisa de `status?: "streaming" \| "done" \| "stopped" \| "error"` |
| `regenerateLast()` | **Implementar** | Nova função no hook |
| `continueLast()` | **Parcial** | Implementar com flag `continuation: true` no body, não texto literal "CONTINUE" |
| Botões no ChatMessage | **Implementar** | Parar durante streaming, Regenerar/Continuar após |
| request_id SSE | **Implementar** | Backend já gera `requestId` (linha 567), falta enviar via SSE |
| Logging client_abort | **Parcial** | Registrar em `chat_metrics` quando abort detectado |

**Decisão Técnica**: O "Continue" enviará `{ continuation: true }` para o backend, que injetará instrução "continue de onde parou, sem repetir o início" no prompt — mais limpo que enviar texto literal.

**Complexidade**: Média — requer mudanças coordenadas frontend + backend

---

## FASE 2 — Premium Message Actions & Persistência

### 2.1 Ações de Mensagem (Copy/Checklist/Share)

| Item | Status | Avaliação |
|------|--------|-----------|
| CopyButton | **Já existe** | `CopyButton.tsx` implementado |
| ChecklistButton | **Já existe** | `ChecklistButton.tsx` implementado |
| Copiar Markdown | **Implementar** | Adicionar variante no CopyButton |
| MessageActions.tsx | **Adaptar** | Agrupar botões existentes + novo "Copiar Markdown" |
| Menu "..." para mobile | **Implementar** | Usar DropdownMenu para telas < 640px |
| clipboard.ts | **Postergar** | Funções simples podem ficar no próprio componente |

### 2.2 Persistência de Sessões

| Item | Status | Avaliação |
|------|--------|-----------|
| Tabela chat_sessions | **Já existe** | Tabela existe com `messages: jsonb` |
| useChatSessions hook | **Já existe** | Hook completo implementado |
| ChatHistory sidebar | **Já existe** | Componente implementado com Sheet |
| Integração no Chat.tsx | **Postergar** | O hook existe mas **não está integrado** na página Chat.tsx — requer conexão |
| Normalização para chat_session_messages | **Postergar** | O modelo atual (jsonb) funciona para MVP; normalizar depois se necessário |

**Decisão**: Integrar o `useChatSessions` existente no `Chat.tsx` em vez de refatorar para modelo normalizado.

### 2.3 Compartilhamento por Link

| Item | Status | Avaliação |
|------|--------|-----------|
| Tabela shared_items | **Postergar** | Feature "nice to have", não essencial para v2.1 |
| Rota /share/:token | **Postergar** | Dependente da tabela |
| Botão Compartilhar | **Postergar** | Placeholder apenas — implementar em fase futura |

**Decisão**: Fase 2.3 adiada para v2.2 — priorizar Chat Controls e integração de sessões.

---

## FASE 3 — Feedback e Qualidade

### 3.1 Thumbs up/down

| Item | Status | Avaliação |
|------|--------|-----------|
| FeedbackButtons | **Já existe** | Componente completo com modal |
| FeedbackModal com categorias | **Já existe** | 6 categorias implementadas (incorrect, outdated, incomplete, confusing, off_topic, other) |
| Tabela response_feedback | **Já existe** | Estrutura: query_id, rating, feedback_category, feedback_text |
| useFeedback hook | **Já existe** | Hook completo |

**Conclusão**: Fase 3.1 está 100% implementada. Nenhuma ação necessária.

### 3.2 Admin: Painel de Feedback

| Item | Status | Avaliação |
|------|--------|-----------|
| Aba Feedback no Admin | **Implementar** | Criar componente FeedbackTab.tsx |
| Ranking de reason_code | **Implementar** | Query agregada por feedback_category |
| Últimos negativos | **Implementar** | Lista com link para query (se disponível) |

**Complexidade**: Baixa — queries simples + UI de cards/tabela

---

## FASE 4 — Web Search Governance

### 4.1 Política de Fontes

| Item | Status | Avaliação |
|------|--------|-----------|
| Tabela trusted_domains | **Já existe** | Estrutura: domain, category, priority, description |
| Categorias | **Adaptar** | Tabela tem `category` texto livre; atual usa "primary", "official_mirror", etc. |
| Quorum | **Já existe** | Campo `quorum_met` já propagado nas fontes |
| Notices automáticos | **Já existe** | `ResponseNotice` implementado com tipos web_search, limited_base, etc. |

**Decisão**: Refinar categorias na tabela para alinhar com frontend (verificar consistência).

### 4.2 "Por que esta fonte?"

| Item | Status | Avaliação |
|------|--------|-----------|
| HoverCard nas fontes | **Já existe** | `SourceChipWeb.tsx` já tem HoverCard completo |
| Informações exibidas | **Já existe** | Mostra: título, categoria, confiança, excerpt, data |

**Conclusão**: Fase 4.2 está implementada. O HoverCard mostra categoria, confiança e excerpt.

### 4.3 Cache de Busca Web

| Item | Status | Avaliação |
|------|--------|-----------|
| Tabela web_search_cache | **Já existe** | Estrutura: query_hash, serp_results, fetched_pages, expires_at (24h TTL) |
| Uso no backend | **Verificar** | Precisa confirmar se edge function usa o cache |

---

## FASE 5 — Base de Conhecimento Operável

### 5.1 Versionamento de Documentos

| Item | Status | Avaliação |
|------|--------|-----------|
| Campo version | **Já existe** | Coluna `version: integer` na tabela documents |
| version_label | **Implementar** | Adicionar coluna texto (ex: "v3.2", "2024.1") |
| effective_date | **Implementar** | Adicionar coluna date |
| supersedes_document_id | **Implementar** | Adicionar FK para documento substituído |
| tags[] | **Implementar** | Adicionar coluna text[] |
| Admin UI de filtros | **Implementar** | Criar componente com filtros |

### 5.2 Reprocessamento com Motivo

| Item | Status | Avaliação |
|------|--------|-----------|
| Botão Reprocessar | **Parcial** | Verificar se já existe ação de reprocessar |
| Modal com motivo | **Implementar** | Criar modal simples |
| Log em processing_metrics | **Implementar** | Adicionar campo metadata com reason |

---

## FASE 6 — Performance e Estabilidade

### 6.1 Virtualização da Lista

| Item | Status | Avaliação |
|------|--------|-----------|
| react-virtual ou similar | **Postergar** | Complexidade alta com framer-motion |
| Smart auto-scroll | **Já existe** | Lógica `isUserAtBottom` implementada no Chat.tsx |

**Decisão**: Adiar virtualização — só implementar se usuários reportarem lentidão com sessões longas.

### 6.2 Abort Robusto + Indicadores

| Item | Status | Avaliação |
|------|--------|-----------|
| Estado "stopped" | **Implementar** | Parte da Fase 1 |
| Notice "Resposta interrompida" | **Implementar** | Usar ResponseNotice existente |
| Botão Continuar automático | **Implementar** | Parte da Fase 1 |

---

## Plano de Implementação Faseado

### Sprint 1: Fundação (Fases 0 + 1)
**Foco**: Chat Controls — a feature mais impactante para UX

```text
1. CHANGELOG.md + plan.md (10 min)
2. Interface ChatMessage: adicionar status, lastUserQuery (30 min)
3. useChat.ts: 
   - lastUserMessageRef, lastModeRef
   - Modificar sendMessage para status transitions
   - regenerateLast() e continueLast()
   (2h)
4. clara-chat/index.ts:
   - Emitir event: request_id via SSE
   - Suporte a { continuation: true }
   - Log client_abort em chat_metrics
   (2h)
5. ChatMessage.tsx:
   - Botões condicionais (Parar/Regenerar/Continuar)
   - Notice "Resposta interrompida"
   (1h)
```

**Arquivos modificados**:
- CHANGELOG.md
- .lovable/plan.md
- src/hooks/useChat.ts
- src/components/chat/ChatMessage.tsx
- supabase/functions/clara-chat/index.ts

### Sprint 2: Integração de Sessões (Fase 2.1-2.2 parcial)
**Foco**: Conectar useChatSessions ao Chat.tsx

```text
1. Chat.tsx: integrar useChatSessions hook (1h)
2. MessageActions.tsx: agrupar CopyButton, ChecklistButton, etc. (1h)
3. Adicionar "Copiar Markdown" ao CopyButton (30 min)
4. Menu "..." para mobile com DropdownMenu (1h)
```

**Arquivos modificados**:
- src/pages/Chat.tsx
- src/components/chat/MessageActions.tsx (novo)
- src/components/chat/CopyButton.tsx

### Sprint 3: Admin Feedback Dashboard (Fase 3.2)
**Foco**: Visibilidade de feedback negativo

```text
1. FeedbackTab.tsx: componente com métricas (2h)
   - Top categorias (gráfico de barras)
   - Últimos negativos (tabela)
   - Taxa de feedback
2. Admin.tsx: adicionar aba "Feedback" (30 min)
```

**Arquivos modificados**:
- src/components/admin/FeedbackTab.tsx (novo)
- src/pages/Admin.tsx

### Sprint 4: Knowledge Base Enhancements (Fase 5)
**Foco**: Versionamento e tags

```text
1. Migração SQL: adicionar colunas version_label, effective_date, supersedes_document_id, tags (30 min)
2. Admin UI: filtros e ação "Marcar como substituída" (2h)
3. Reprocessamento com motivo (1h)
```

**Arquivos modificados**:
- Nova migração SQL
- src/components/admin/DocumentsTab.tsx (se existir) ou ProcessingStatsTab.tsx

### Backlog (Futuro)
- Fase 2.3: Compartilhamento por link (v2.2)
- Fase 6.1: Virtualização (sob demanda)
- Normalização chat_session_messages (se JSONB causar problemas)

---

## Detalhamento Técnico: Sprint 1

### 1. Interface ChatMessage Atualizada

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: ChatMessageSources;
  isStreaming?: boolean; // deprecated - usar status
  status?: "streaming" | "done" | "stopped" | "error";
  queryId?: string;
  userQuery?: string;
  apiProvider?: ApiProviderInfo;
  notice?: ChatNotice;
  requestId?: string; // novo - para tracking
}
```

### 2. useChat.ts — Novas Refs e Funções

```typescript
// Refs para regenerate/continue
const lastUserMessageRef = useRef<string>("");
const lastModeRef = useRef<ResponseMode>("fast");
const lastWebSearchModeRef = useRef<WebSearchMode>("auto");
const activeRequestIdRef = useRef<string | null>(null);

// Função regenerateLast
const regenerateLast = useCallback(() => {
  if (!lastUserMessageRef.current) return;
  // Remover última resposta do assistant
  setMessages(prev => {
    const lastAssistantIdx = prev.findLastIndex(m => m.role === "assistant");
    if (lastAssistantIdx > -1) {
      return prev.slice(0, lastAssistantIdx);
    }
    return prev;
  });
  // Re-enviar com mesmos parâmetros
  sendMessage(lastUserMessageRef.current, lastModeRef.current, lastWebSearchModeRef.current);
}, [sendMessage]);

// Função continueLast  
const continueLast = useCallback(async () => {
  // Enviar com flag continuation
  await sendMessage("", lastModeRef.current, lastWebSearchModeRef.current, { continuation: true });
}, [sendMessage]);
```

### 3. clara-chat SSE Events — Adicionar request_id

```typescript
// Após criar requestId, emitir evento SSE
writer.write(
  encoder.encode(`event: request_id\ndata: ${JSON.stringify({ id: requestId })}\n\n`)
);
```

### 4. Suporte a Continuation no Backend

```typescript
const { message, history, mode, webSearchMode, continuation = false } = await req.json();

// Se continuation, não adicionar nova mensagem do user
// Em vez disso, injetar instrução no system prompt:
if (continuation) {
  const continuationInstruction = `
O usuário solicitou que você continue sua resposta anterior.
Continue exatamente de onde parou, sem repetir o que já foi dito.
Mantenha a mesma estrutura e tom.`;
  // Adicionar ao final do system prompt
}
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Abort não limpa estado corretamente | Média | Testes manuais extensivos |
| Regenerate cria mensagens duplicadas | Baixa | Lógica clara de remoção antes de re-envio |
| Continuation repete conteúdo | Média | Instrução clara no prompt + testes |
| Mobile overflow com novos botões | Baixa | Design responsivo com menu "..." |

---

## Critérios de Aceite por Sprint

### Sprint 1
- Botão Parar visível durante streaming
- Clicar Parar interrompe resposta, mensagem fica com status "stopped"
- Regenerar remove última resposta e re-envia
- Continuar adiciona conteúdo sem repetir
- Console log mostra request_id

### Sprint 2
- Histórico de sessões visível no sidebar
- Clicar em sessão carrega mensagens
- Menu "..." funciona no mobile sem overflow

### Sprint 3
- Aba Feedback visível no Admin
- Top 5 categorias com contagem
- Lista de últimos feedbacks negativos

### Sprint 4
- Documentos podem ter tags
- Filtro por tags funciona
- Ação "Marcar como substituída" disponível

