

# Plano: Aumentar Espaço do Chat na Versão Desktop

## Contexto

O painel de chat lateral (`ChatPanel.tsx`) está limitado a **450px** de largura, o que dificulta a leitura das respostas da CLARA em telas grandes. A página dedicada `/chat` também usa `max-w-4xl` (896px), mas há espaço para expandir em monitores widescreen.

---

## Mudanças Propostas

### 1. Expandir ChatPanel (Painel Lateral)

**Arquivo:** `src/components/chat/ChatPanel.tsx`

| Estado Atual | Proposta |
|--------------|----------|
| `w-[450px] sm:max-w-[450px]` | `w-[550px] lg:w-[600px] sm:max-w-[600px]` |

Isso aumenta a largura do painel de 450px para 550px (desktop) e 600px (telas grandes), sem afetar mobile que continua `w-full`.

### 2. Expandir Página /chat 

**Arquivo:** `src/pages/Chat.tsx`

| Estado Atual | Proposta |
|--------------|----------|
| `max-w-4xl` (896px) | `max-w-5xl` (1024px) ou `max-w-6xl` (1152px) |

Isso dá mais espaço horizontal para as mensagens, mantendo boa legibilidade em telas grandes.

---

## Implementação Técnica

### Alteração 1: ChatPanel.tsx (linha 311-312)

```typescript
// ANTES
className={`flex flex-col p-0 gap-0 ${
  isMobile ? 'w-full max-w-full' : 'w-[450px] sm:max-w-[450px]'
}`}

// DEPOIS
className={`flex flex-col p-0 gap-0 ${
  isMobile ? 'w-full max-w-full' : 'w-[550px] lg:w-[600px] sm:max-w-[600px]'
}`}
```

### Alteração 2: Chat.tsx (linha 215 e 320)

```typescript
// Header container
// ANTES
<div className="container max-w-4xl mx-auto px-4 h-16 ...">

// DEPOIS
<div className="container max-w-5xl mx-auto px-4 h-16 ...">

// Messages area
// ANTES
className="flex-1 container max-w-4xl mx-auto px-4 py-6 ...">

// DEPOIS
className="flex-1 container max-w-5xl mx-auto px-4 py-6 ...">

// Footer
// ANTES
<div className="container max-w-4xl mx-auto px-4 py-4">

// DEPOIS
<div className="container max-w-5xl mx-auto px-4 py-4">
```

---

## Resultado Visual

| Componente | Antes | Depois | Ganho |
|------------|-------|--------|-------|
| ChatPanel (desktop) | 450px | 550-600px | +22-33% |
| Página /chat | 896px | 1024px | +14% |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/chat/ChatPanel.tsx` | Aumentar largura do Sheet |
| `src/pages/Chat.tsx` | Mudar `max-w-4xl` para `max-w-5xl` |

---

## Considerações

- **Legibilidade:** Linhas muito longas dificultam leitura. O `max-w-5xl` (1024px) é um bom equilíbrio
- **Mobile:** Não afetado - continua usando `w-full`
- **Responsivo:** As classes Tailwind garantem ajuste automático para diferentes breakpoints

