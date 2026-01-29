
# Plano de Otimização de Responsividade e Mobile

## Resumo Executivo

Este plano aborda melhorias de diagramação e proporção em todas as versões (desktop e mobile), com foco especial na usabilidade em dispositivos móveis. O objetivo é garantir uma experiência "Premium" fluida e sem quebras visuais, seguindo as diretrizes do Design System v3.0 estabelecido.

---

## Diagnóstico Atual

### Pontos Fortes Identificados
- Design System bem estruturado com tokens semânticos
- PWA já configurada com manifest.json e Service Worker
- Componentes já utilizam `useIsMobile` para otimizações condicionais
- Botões de ação já ocultam labels no mobile (`hidden sm:inline`)
- Hero image otimizada com WebP responsivo

### Gaps Identificados

| Categoria | Problema | Impacto |
|-----------|----------|---------|
| **Overflow** | Falta regras anti-overflow globais para chat | URLs longas e código podem quebrar layout |
| **Source Chips** | Sem scroll horizontal suave no mobile | Chips "empurram" conteúdo para fora |
| **Input Area** | Sem `safe-area-inset-bottom` para iPhone | Input fica colado na barra inferior |
| **ResponseNotice** | Largura não limitada | Pode estourar em telas estreitas |
| **Auto-scroll** | Sempre força scroll para o final | Frustra usuário que quer reler durante streaming |
| **Touch Targets** | Alguns botões menores que 44px | Dificuldade de toque em mobile |
| **PWA** | Falta ícone maskable dedicado | Ícone Android pode ficar cortado |

---

## Implementação em 4 Fases

### Fase 1: CSS Global Anti-Overflow (Crítico)

**Arquivo:** `src/index.css`

Adicionar regras globais para prevenir overflow horizontal em mensagens de chat:

```css
/* Anti-overflow para mensagens de chat */
.chat-content-container,
.chat-content-container * {
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Código/trechos longos */
.chat-content-container pre,
.chat-content-container code {
  max-width: 100%;
  overflow-x: auto;
}

/* Imagens/iframes (segurança) */
.chat-content-container img,
.chat-content-container video,
.chat-content-container iframe {
  max-width: 100%;
  height: auto;
}
```

---

### Fase 2: Source Chips Mobile Premium

**Arquivo:** `src/components/chat/ChatMessage.tsx` (SourcesSection)

Implementar scroll horizontal com snap no mobile:

```css
/* Em index.css */
.sources-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 520px) {
  .sources-row {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x mandatory;
    padding-bottom: 6px;
    scrollbar-width: none;
  }
  
  .sources-row::-webkit-scrollbar {
    display: none;
  }
  
  .sources-row > * {
    scroll-snap-align: start;
    flex: 0 0 auto;
  }
}
```

**Mudança no componente:**
- Adicionar className `sources-row` ao container de chips
- Garantir touch target mínimo de 44px altura

---

### Fase 3: Input Area Seguro para Mobile

**Arquivo:** `src/pages/Chat.tsx` e `src/components/chat/ChatPanel.tsx`

Adicionar safe-area para iPhones modernos:

```css
/* Em index.css */
.chat-input-footer {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
}
```

**Mudanças nos componentes:**
- Chat.tsx: Adicionar classe `chat-input-footer` ao footer
- ChatPanel.tsx: Aplicar mesma classe ao footer do Sheet

---

### Fase 4: ResponseNotice Compacto

**Arquivo:** `src/components/chat/ResponseNotice.tsx`

Ajustar para limitar largura e melhorar legibilidade no mobile:

```tsx
<motion.div
  className={`
    inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
    border backdrop-blur-sm mb-2
    max-w-full sm:max-w-[90%]  /* Limitar largura */
    ${config.className}
  `}
>
  <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
  <span className="truncate">{message}</span>  {/* Truncar texto longo */}
</motion.div>
```

---

## Melhorias Adicionais

### Auto-scroll Inteligente

**Arquivo:** `src/pages/Chat.tsx` e `src/components/chat/ChatPanel.tsx`

Implementar lógica que só faz auto-scroll se o usuário estiver no final:

```tsx
const scrollAreaRef = useRef<HTMLElement>(null);
const isUserAtBottom = useRef(true);

// Detectar posição do scroll
const handleScroll = () => {
  const el = scrollAreaRef.current;
  if (el) {
    const threshold = 100;
    isUserAtBottom.current = 
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }
};

// Auto-scroll condicional
useEffect(() => {
  if (isUserAtBottom.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
}, [messages, thinking.isThinking]);
```

### Touch Targets Adequados

**Arquivo:** `src/index.css`

Garantir tamanho mínimo para interação:

```css
.action-btn {
  min-height: 44px;
  min-width: 44px;
}

@media (min-width: 640px) {
  .action-btn {
    min-height: auto;
    min-width: auto;
  }
}
```

### PWA: Ícone Maskable

**Arquivos necessários:**
- Criar `public/icon-512-maskable.png` (ícone com padding interno de 20%)

**Atualizar:** `public/manifest.json`
```json
{
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/index.css` | Adicionar regras anti-overflow, sources-row, input-footer, touch targets |
| `src/components/chat/ChatMessage.tsx` | Aplicar classe sources-row, ajustar touch targets |
| `src/components/chat/ResponseNotice.tsx` | Adicionar max-width e truncate |
| `src/pages/Chat.tsx` | Adicionar classe input-footer, implementar smart scroll |
| `src/components/chat/ChatPanel.tsx` | Adicionar classe input-footer, implementar smart scroll |
| `public/manifest.json` | Adicionar ícone maskable (quando disponível) |

---

## Critérios de Aceite

- [x] Mobile 360×800: Sem overflow horizontal em nenhuma resposta
- [x] Input sempre visível acima do teclado (Android e iOS)
- [x] Chips de fontes funcionam no toque (scroll suave, sem misclick)
- [x] ResponseNotice não estoura largura
- [x] Auto-scroll respeita a posição do usuário durante streaming
- [x] Touch targets >= 44px em elementos interativos mobile
- [x] Desktop 1440px: Layout com largura controlada (max-width 680px no chat)
- [x] PWA instala corretamente com ícone adequado

---

## Notas Técnicas

- Todas as mudanças CSS utilizam os tokens existentes do Design System v3.0
- As animações respeitam `prefers-reduced-motion` já implementado
- Transições mantêm 150-220ms conforme padrão estabelecido
- Nenhuma mudança afeta a lógica de negócio ou fluxo de dados
