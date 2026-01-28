
# Plano de Refinamento Artístico - Fase de Ajustes Finos + Continuação

---

## Avaliação do Diretor de Arte

Após análise detalhada do código e do sistema visual atual, identifico três categorias de ação:

### Consolidar (Está Excelente)
- Sistema de tokens unificado em `index.css` (superfícies, bordas, texto)
- Header sticky com `backdrop-blur-xl` e transição suave
- Badge "PREVIEW" minimalista
- Micro-interações nos botões (`active:scale-[0.98]`)
- Classes semânticas `.text-body`, `.text-caption`, `.text-hint`

### Suavizar (Ajustes Finos)
1. **Feature cards hover**: `translateY(-4px)` é ligeiramente agressivo para o tom institucional. Reduzir para `-2px`.
2. **Floating elements no Hero**: Os pontos decorativos (`w-2 h-2 bg-primary/30 blur-sm`) são quase invisíveis e adicionam complexidade desnecessária ao DOM. Remover.
3. **H1 hover scale**: O `whileHover={{ scale: 1.02 }}` no texto "CLARA" pode parecer "jovial demais" para LegalTech. Remover.

### Expandir para Consistência (Próximas Etapas)
- Aplicar tokens semânticos aos componentes de Chat e Admin
- Padronizar opacidades inline (`text-muted-foreground/60`) para classes

---

## Fase 1: Ajustes Finos Imediatos

### 1.1 Feature Card Hover (Mais Sutil)

**Arquivo:** `src/index.css`

**Alteração:**
```css
/* Antes */
.feature-card:hover {
  transform: translateY(-4px);
}

/* Depois */
.feature-card:hover {
  transform: translateY(-2px);
}
```

**Justificativa:** Movimento mais contido, elegante, coerente com identidade institucional.

---

### 1.2 Remover Floating Elements Decorativos

**Arquivo:** `src/components/HeroSection.tsx`

**Alteração:** Remover completamente o bloco de elementos flutuantes (linhas 61-72).

**Justificativa:**
- Quase imperceptíveis visualmente
- Adicionam animações contínuas sem propósito claro
- Reduz complexidade do DOM e melhora performance

---

### 1.3 Remover Scale Hover do H1

**Arquivo:** `src/components/HeroSection.tsx`

**Alteração:**
```tsx
/* Antes */
<motion.span 
  className="..."
  whileHover={{ scale: 1.02 }}
  transition={{ type: "spring", stiffness: 300 }}
>
  CLARA
</motion.span>

/* Depois */
<span className="...">
  CLARA
</span>
```

**Justificativa:** Texto institucional não deve "pular" no hover. Mantém sobriedade.

---

## Fase 2: Componentes de Chat (Tokens Semânticos)

### 2.1 ChatMessage.tsx

**Alterações:**
1. Substituir `text-muted-foreground/60` por `text-caption`
2. Substituir `bg-muted/50` (code blocks) por `bg-surface-3`
3. Padronizar `border-border/50` para `border-border-subtle`

### 2.2 SourceCitation.tsx

**Alterações:**
1. Usar `bg-surface-3` em vez de `bg-muted/30`
2. Aplicar `text-caption` para labels de fonte
3. Hover states: `hover:bg-surface-4`

### 2.3 ThinkingIndicator.tsx

**Alterações:**
1. Já usa `.glass-card` - sem alterações necessárias
2. Apenas confirmar que cores dinâmicas (blue, purple, emerald) estão harmônicas

### 2.4 FeedbackModal.tsx

**Alterações:**
1. Substituir `bg-background/80` por `bg-surface-0/85 backdrop-blur-sm` (consistente com Sheet)
2. Usar `bg-surface-3` para hover em radio options

---

## Fase 3: Painel Admin (Tokens Semânticos)

### 3.1 Cards de Métricas (AnalyticsTab.tsx)

**Alterações:**
1. Cards já usam `.glass-card` - OK
2. Padronizar badges: usar tokens de cores ao invés de hardcoded `bg-green-500/20`
3. Refinar gráficos: usar `hsl(var(--text-muted))` em vez de inline HSL

### 3.2 ProcessingStatsTab.tsx

**Alterações:**
1. Badges de status: manter cores funcionais (verde/vermelho/amarelo) mas com opacidades consistentes
2. Cards de erro: usar `bg-destructive/10` já presente - OK

### 3.3 ReportFormModal.tsx e ReportViewModal.tsx

**Alterações:**
1. Usar `.text-body` para parágrafos
2. Usar `.text-caption` para metadata
3. Botões já usam `.btn-clara-primary` - OK

---

## Arquivos a Modificar

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/index.css` | Ajuste fino no hover do feature-card |
| `src/components/HeroSection.tsx` | Remover floating elements e scale hover |
| `src/components/chat/ChatMessage.tsx` | Migrar para tokens semânticos |
| `src/components/chat/SourceCitation.tsx` | Migrar para tokens semânticos |
| `src/components/chat/FeedbackModal.tsx` | Padronizar overlay e hovers |
| `src/components/admin/AnalyticsTab.tsx` | Pequenos ajustes de consistência |

---

## Critérios de Sucesso

1. **Hover mais sutil**: Feature cards sobem 2px (não 4px)
2. **Hero mais limpo**: Sem elementos decorativos invisíveis
3. **H1 estático**: "CLARA" não reage ao hover
4. **Tokens consistentes**: Chat e Admin usam mesmas classes semânticas
5. **Zero regressão visual**: Nenhuma quebra de layout

---

## Decisão Artística Final

**Elementos MANTIDOS por serem eficazes:**
- Staggered animations no Hero (15% delay entre itens)
- Badge chip com pulse no ponto verde
- Botão CTA com shadow-glow no hover
- Header blur transition no scroll

**Elementos REMOVIDOS por serem excessivos:**
- Floating decorative dots (imperceptíveis)
- Scale hover no título principal (desconexo do tom)

**Elementos SUAVIZADOS:**
- Feature card lift (de -4px para -2px)

Este plano equilibra refinamento visual com manutenção da identidade premium já estabelecida.
