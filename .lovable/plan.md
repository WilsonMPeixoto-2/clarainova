

# ETAPA 1 — Chat Premium: Refinamentos Estratégicos

## Visão Geral do Diretor de Arte

Após análise detalhada do código, identifico que o sistema atual já possui:
- ✅ Markdown rendering robusto (headers, listas, code blocks)
- ✅ Sistema de fontes colapsável (SourcesSection)
- ✅ Toggle de modo Rápido/Análise Completa (ResponseModeSelector)
- ✅ Ações de Copiar, PDF, Feedback
- ✅ Web search fallback com grounding
- ✅ Indicador de pensamento (ThinkingIndicator)

O foco será **refinamento cirúrgico**, não reestruturação.

---

## 1.1 Hierarquia Visual das Respostas (Sem Rigidez)

### O que manter
- Renderização markdown existente (funciona bem)
- Sistema de fontes colapsável atual
- Estética dark premium com tokens do design system

### O que ajustar
Introduzir **divisores visuais sutis** entre seções naturais da resposta, sem impor estrutura ao conteúdo. A IA continuará livre para estruturar conforme necessário.

### Implementação
1. **Aprimorar `renderMarkdown()`** em `ChatMessage.tsx`:
   - Adicionar classe visual diferenciada para `<h2>` e `<h3>` com borda lateral sutil âmbar
   - Manter horizontal rules (`---`) mais elegantes com opacidade reduzida
   - Nenhuma limitação de conteúdo — apenas estilização

2. **Estilização de seções** via CSS em `index.css`:
   ```css
   .chat-section-title {
     border-left: 2px solid hsl(var(--primary) / 0.4);
     padding-left: 12px;
     margin-top: 16px;
   }
   ```

### Critério de sucesso
Respostas longas ficam mais "escaneáveis" visualmente, sem alterar o conteúdo gerado pela IA.

---

## 1.2 Chips de Fontes Premium + Ações Rápidas

### O que manter
- Sistema colapsável de fontes existente (SourcesSection)
- Copiar resposta completa (CopyButton)
- Download PDF (DownloadPdfButton)

### O que ajustar
Transformar as fontes em **chips clicáveis estilo Apple** e adicionar novas ações:
- Chips formatados: `Manual SEI 4.0 • p. 32` ou `Decreto nº X • art. Y`
- Nova ação: **"Copiar como Checklist"** (converte bullets em formato checklist)

### Implementação
1. **Redesenhar `SourcesSection`** em `ChatMessage.tsx`:
   - Chips com visual premium (glass effect, hover sutil)
   - Tooltip com "Por que esta fonte?" (opcional, fase futura)
   
2. **Adicionar `ChecklistButton`** novo componente:
   - Detecta listas no conteúdo
   - Converte para formato `[ ] Item` ao copiar
   - Ícone: `ListChecks` do Lucide

3. **Melhorar apresentação de fontes** no backend:
   - O CLARA_SYSTEM_PROMPT já instrui citações no formato `[Manual SEI 4.0, p. X]`
   - Manter como está — o parsing no frontend pode extrair isso

### Critério de sucesso
Chips de fonte são elegantes e discretos. Copiar preserva formatação. Nova opção de checklist disponível.

---

## 1.3 Evolução do Modo de Resposta

### O que manter
- ResponseModeSelector existente (Rápido ⚡ / Análise Completa 🧠)
- Integração com localStorage
- Roteamento para diferentes modelos (flash vs pro)

### O que ajustar
Renomear para terminologia mais clara e conectar diretamente aos modelos:

| Modo Atual | Novo Nome | Modelo | Comportamento |
|------------|-----------|--------|---------------|
| Rápido | **Direto** | gemini-flash | Curto, citações diretas |
| Análise Completa | **Didático** | gemini-pro | Analogias, explicações |

### Implementação
1. **Atualizar labels** em `ResponseModeSelector.tsx`:
   - "Rápido" → "Direto" (ícone: Target)
   - "Análise Completa" → "Didático" (ícone: BookOpen)
   - Tooltips mais descritivos

2. **Ajustar CLARA_SYSTEM_PROMPT** no edge function:
   - Adicionar instrução condicional baseada no modo
   - Modo "Direto": priorizar bullets, citações, menos analogias
   - Modo "Didático": incluir analogias, explicações do "por quê"

3. **Passar modo para o sistema via contexto**:
   - Já existe `mode` no payload
   - Adicionar instrução dinâmica no prompt do usuário

### Critério de sucesso
Mesmo input produz saídas consistentemente diferentes conforme o modo selecionado.

---

## 1.4 Transparência Elegante para Cenários Especiais

### O que manter
- Web search grounding existente (funciona bem)
- Indicador de provedor de API (ApiProviderBadge)
- ThinkingIndicator com etapas

### O que ajustar
Criar respostas elegantes e padronizadas para cenários específicos, diretamente no prompt do sistema:

| Cenário | Resposta Elegante |
|---------|-------------------|
| **Base insuficiente → Web** | "Não encontrei referência específica na base interna. Consultei fontes oficiais para complementar..." |
| **Nenhuma resposta objetiva** | "Não localizei orientação normativa definitiva sobre este ponto específico. Sugiro..." |
| **Orientação geral sem especificidade setorial** | "A base normativa geral indica X, mas para especificidades do seu setor, recomendo consultar..." |
| **Assunto fora do escopo** | Recusa elegante (já existe no prompt) |
| **Dados pessoais detectados** | Solicitação de reformulação (já existe no prompt) |

### Implementação
1. **Expandir CLARA_SYSTEM_PROMPT** com seção "Cenários de Transparência":
   - Templates de resposta para cada situação
   - Instruções claras de quando usar cada um

2. **Adicionar evento SSE de "aviso"** no edge function:
   - Novo evento `event: notice` para avisos discretos
   - Frontend renderiza como badge/chip acima da resposta

3. **Criar componente `ResponseNotice`**:
   - Visual: chip discreto com ícone Info
   - Mensagens como "Consultando fontes web..." ou "Base limitada sobre este tema"

### Critério de sucesso
Usuário entende instantaneamente a origem e confiabilidade da resposta.

---

## Detalhamento Técnico

### Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/chat/ChatMessage.tsx` | Estilização de headers, nova seção de ações |
| `src/components/chat/ResponseModeSelector.tsx` | Novos labels e ícones |
| `src/components/chat/ChecklistButton.tsx` | **Novo arquivo** - botão copiar como checklist |
| `src/components/chat/ResponseNotice.tsx` | **Novo arquivo** - avisos de transparência |
| `src/index.css` | Classes para hierarquia visual |
| `supabase/functions/clara-chat/index.ts` | Expansão do prompt, evento de aviso |
| `src/hooks/useChat.ts` | Processar novo evento SSE `notice` |

### Ordem de Implementação

```text
Fase 1: Hierarquia Visual (CSS + ChatMessage)
   ↓
Fase 2: Evolução do Modo (ResponseModeSelector + Prompt)
   ↓
Fase 3: Ações Rápidas (ChecklistButton)
   ↓
Fase 4: Transparência (ResponseNotice + Eventos SSE)
```

### Estimativa de Esforço
- **Fase 1**: Baixo (estilização apenas)
- **Fase 2**: Médio (prompt + UI)
- **Fase 3**: Baixo (novo componente simples)
- **Fase 4**: Médio (backend + frontend)

---

## Resultado Esperado

O chat CLARA evolui de "assistente funcional" para **"consultoria premium acionável"**:

1. **Respostas visualmente escaneáveis** com hierarquia clara
2. **Fontes como chips premium** clicáveis e informativos
3. **Modo de resposta semântico** (Direto vs Didático) conectado aos modelos
4. **Transparência elegante** sobre origem e confiabilidade das informações
5. **Novas ações** (checklist) sem poluir a interface

Tudo isso mantendo a identidade visual premium estabelecida e zero regressão no comportamento atual.

