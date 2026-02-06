

# Plano: Reestruturar Home + Melhorias no Chat + Correções de Build

## Contexto
A partir da imagem de referência, a Home atual tem dois caminhos redundantes para o chat: o botão "Iniciar conversa" e um box de texto abaixo. O plano elimina essa redundância, destaca o CTA principal e melhora a experiência do chat.

---

## 1. Corrigir Erros de Build (Prioridade Critica)

### 1.1 Erro de importação em `server/_core/imageGeneration.ts`
- Linha 18: `import { storagePut } from "server/storage"` precisa ser corrigido para `import { storagePut } from "../storage"`
- O tsconfig nao tem path alias para `server/`, apenas para `@/` e `@shared/`

### 1.2 Adicionar porta 8080 ao `vite.config.ts`
- Adicionar `port: 8080` ao bloco `server` existente (linha 28)

### 1.3 Script `build:dev` ausente no `package.json`
- O Lovable nao pode editar `package.json` diretamente
- Sera necessario que voce adicione manualmente o script: `"build:dev": "vite build --mode development"`

---

## 2. Reestruturar a Home Page (Prioridade Alta)

### Problema identificado (screenshot)
A Home tem duas entradas para o chat: o botao "Iniciar conversa" e um campo de texto "Descreva sua duvida..." com chips de sugestao. Isso e redundante e dispersa a atencao.

### Solucao: Landing Page focada com CTA unico

**Arquivo:** `client/src/pages/Home.tsx` (reescrever)

A nova Home tera:

1. **Header** -- manter o header premium atual (CLARA + badge Beta)
2. **Hero Section** -- titulo, subtitulo e botao "Iniciar Conversa" com glow premium (sem campo de texto)
3. **Secao de Beneficios** -- 3 cards glass morphism:
   - "Respostas com Fontes Documentais" (icone FileText)
   - "Busca Inteligente" (icone Search)
   - "Exportacao PDF Institucional" (icone FileDown)
4. **Secao de Confianca** -- badges: "Fontes Oficiais", "Atualizacao Continua", "Uso Institucional"
5. **Footer** -- manter footer atual + adicionar disclaimer obrigatorio

**CTA "Iniciar Conversa":** Botao grande com `bg-primary`, `glow-primary`, animacao `hover:scale-105` e `shadow-[0_0_30px_var(--primary-glow)]`. Ao clicar, navega para `/chat`.

### Nova rota `/chat`

**Arquivo:** `client/src/pages/Chat.tsx` (novo)

Move toda a logica de chat atual (estado, mutations, mensagens) para esta pagina dedicada, incluindo:
- Header com botao "Nova Conversa"
- Area de mensagens com WelcomeScreen
- ChatInput
- KnowledgeBaseSidebar (como accordion ou colapsavel)

### Atualizar rotas

**Arquivo:** `client/src/App.tsx`
- Adicionar: `<Route path="/chat" component={Chat} />`

---

## 3. Disclaimer no Rodape do Chat (Prioridade Alta)

**Arquivo:** `client/src/pages/Chat.tsx`

Adicionar ao final da pagina de chat, abaixo do input:

```text
"A CLARA e uma ferramenta de apoio e suas orientacoes nao substituem
a consulta direta as normas oficiais ou assessoria juridica especializada."
```

Estilizado com:
- `text-xs text-muted-foreground/70`
- Icone `AlertTriangle` (lucide)
- Fundo sutil `bg-primary/5` com borda `border-primary/10`
- Padding e border-radius consistentes

---

## 4. Destaque do Botao PDF no Chat (Prioridade Media)

**Arquivo:** `client/src/components/chat/MessageActions.tsx`

Mudancas no botao PDF:
- Aumentar tamanho: de `px-3.5 py-2 text-xs` para `px-4 py-2.5 text-sm`
- Adicionar borda: `border border-primary/30`
- Glow mais intenso: `hover:shadow-[0_0_24px_var(--primary-glow)]`
- Icone maior: de `size-4` para `size-5`
- Label mais descritivo: "Baixar PDF" em vez de "PDF"
- Posicionar como primeiro botao da lista (antes de Copiar)

---

## 5. Resumo dos Arquivos Modificados

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `server/_core/imageGeneration.ts` | Editar | Corrigir import path |
| `vite.config.ts` | Editar | Adicionar porta 8080 |
| `client/src/pages/Home.tsx` | Reescrever | Landing page com Hero + Cards + CTA |
| `client/src/pages/Chat.tsx` | Criar | Pagina dedicada de chat (logica atual) |
| `client/src/App.tsx` | Editar | Adicionar rota `/chat` |
| `client/src/components/chat/MessageActions.tsx` | Editar | Destacar botao PDF |

---

## 6. Nota sobre `package.json`

O Lovable nao pode editar o `package.json` diretamente. Voce precisara adicionar manualmente:

```json
"build:dev": "vite build --mode development"
```

dentro do bloco `"scripts"` do `package.json`.

---

## Fluxo do Usuario Apos Implementacao

```text
Home (/)
  |
  +-- Hero: "CLARA - Inteligencia Administrativa"
  +-- Subtitulo descritivo
  +-- [Iniciar Conversa] (botao premium com glow)
  +-- 3 Cards de beneficios
  +-- Secao de confianca
  +-- Footer com disclaimer
  |
  v
Chat (/chat)
  |
  +-- Header com "Nova Conversa"
  +-- WelcomeScreen (cards de exemplo)
  +-- Area de mensagens
  +-- Botoes: [Baixar PDF] [Copiar] [Compartilhar]
  +-- ChatInput
  +-- Disclaimer legal no rodape
```

