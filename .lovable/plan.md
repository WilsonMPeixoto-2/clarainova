
# Plano de Refinamento Estético CLARA (High-End)
## Etapa 1: Diagnóstico e Design Tokens

---

## Inventario Atual do Sistema de Design

### 1. Cores (Paleta Existente)

| Token CSS | Valor HSL | Uso Atual |
|-----------|-----------|-----------|
| `--background` | `216 45% 7%` | Fundo profundo (navy escuro) |
| `--foreground` | `210 40% 98%` | Texto principal (quase branco) |
| `--card` | `216 40% 12%` | Superfícies de cards |
| `--muted` | `216 30% 15%` | Áreas secundárias |
| `--muted-foreground` | `210 20% 70%` | Texto secundário |
| `--primary` | `30 45% 64%` | Amber/dourado principal |
| `--accent` | `24 100% 63%` | Laranja vibrante (destaque) |
| `--secondary` | `216 35% 18%` | Superfície intermediária |
| `--border` | `216 30% 22%` | Bordas sutis |
| `--input` | `216 30% 18%` | Background de inputs |

**Tokens customizados CLARA:**
- `--clara-deep`, `--clara-navy`, `--clara-navy-light`
- `--clara-amber`, `--clara-amber-bright`
- `--clara-text-primary`, `--clara-text-secondary`
- `--clara-glass`

### 2. Tipografia

| Elemento | Estilo Atual |
|----------|--------------|
| Fonte | Inter (preload) |
| H1 (CLARA) | `text-6xl → text-9xl`, `font-bold`, `tracking-tight` |
| H2 | `text-3xl → text-4xl`, `font-bold` |
| H3 | `text-xl`, `font-semibold` |
| Body | `text-base → text-lg`, `leading-relaxed` |
| Caption | `text-xs → text-sm`, `text-muted-foreground` |

### 3. Radius (Arredondamentos)

| Token | Valor |
|-------|-------|
| `--radius` | `0.75rem` (12px) |
| `rounded-lg` | 12px |
| `rounded-xl` | 16px |
| `rounded-2xl` | 20px |
| `rounded-full` | Circular |

### 4. Sombras e Efeitos

| Classe | Descrição |
|--------|-----------|
| `.glass-card` | `bg-card/60 backdrop-blur-xl border border-border/50 shadow-xl` |
| `.amber-glow` | `text-shadow: 0 0 40px hsl(30 45% 64% / 0.3)` |
| `.text-glow` | `text-shadow: 0 2px 20px hsl(0 0% 0% / 0.5)` |

### 5. Animações/Motion

| Animação | Duração | Easing |
|----------|---------|--------|
| `fade-in` | 600ms | ease-out |
| `slide-up` | 700ms | ease-out |
| Hover transitions | 200-300ms | ease-out |
| Framer stagger | 150ms delay |

---

## Diagnóstico: Pontos de Fricção Visual

### Fricção Leve (Ajustes Rápidos)
1. **Border opacity inconsistente**: Varia entre `/40`, `/50`, `/60` sem padrão claro
2. **Spacing vertical**: Algumas seções usam `py-12`, outras `py-20`, `py-28` - sem escala definida
3. **Card shadows**: `.glass-card` tem `shadow-xl` muito forte para algumas aplicações
4. **Button hover**: `hover:bg-primary/90` é sutil demais, pouco feedback visual

### Fricção Média (Refinamento Necessário)
5. **Input focus states**: Ring colors variam (`ring-primary/40`, `ring-primary/50`, `ring-foreground/30`)
6. **Text opacity hierarchy**: `text-muted-foreground/60`, `/70`, sem escala semântica
7. **Badge chip**: `bg-primary/15 border border-primary/30` pode parecer "lavado" em alguns contextos
8. **Sheet overlay**: `bg-black/80` é muito escuro, compete com identidade navy

### Fricção Maior (Oportunidade Premium)
9. **Micro-interações faltando**: Botões não têm feedback visual suficiente no clique
10. **Hierarquia de elevação**: Cards e modais usam mesma sombra, sem camadas visuais claras
11. **Gradientes hero**: Hardcoded em HSL inline, dificulta manutenção

---

## Proposta: Sistema de Tokens Unificado

### Cores (Consolidação)

```css
:root {
  /* Superfícies - Escala de 5 níveis */
  --surface-0: 216 45% 7%;      /* Fundo base (background) */
  --surface-1: 216 40% 10%;     /* Cards elevados */
  --surface-2: 216 40% 12%;     /* Cards secundários (atual --card) */
  --surface-3: 216 35% 15%;     /* Inputs, hover states */
  --surface-4: 216 35% 18%;     /* Elementos interativos ativos */

  /* Texto - 4 níveis semânticos */
  --text-primary: 210 40% 98%;      /* Títulos, texto principal */
  --text-secondary: 210 20% 75%;    /* Parágrafos, descrições */
  --text-muted: 210 20% 60%;        /* Captions, hints */
  --text-disabled: 210 15% 45%;     /* Desabilitado */

  /* Bordas - 3 níveis */
  --border-subtle: 216 30% 18%;     /* Divisórias leves */
  --border-default: 216 30% 22%;    /* Bordas padrão */
  --border-strong: 216 30% 28%;     /* Bordas em foco/hover */

  /* Accent (inalterado, já está bom) */
  --accent-amber: 30 45% 64%;
  --accent-amber-bright: 24 100% 63%;
  --accent-amber-glow: 30 45% 64% / 0.25;
}
```

### Radius (Escala Consistente)

```css
:root {
  --radius-sm: 8px;   /* Badges, chips pequenos */
  --radius-md: 12px;  /* Buttons, inputs */
  --radius-lg: 16px;  /* Cards */
  --radius-xl: 20px;  /* Modals, panels */
  --radius-2xl: 24px; /* Feature cards, hero elements */
}
```

### Sombras (Elevação por Camada)

```css
:root {
  /* Sombra sutil para cards leves */
  --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.1),
               0 1px 3px hsl(0 0% 0% / 0.05);
  
  /* Sombra padrão para cards */
  --shadow-md: 0 4px 6px hsl(0 0% 0% / 0.1),
               0 2px 4px hsl(0 0% 0% / 0.05);
  
  /* Sombra elevada para modais */
  --shadow-lg: 0 10px 25px hsl(0 0% 0% / 0.15),
               0 5px 10px hsl(0 0% 0% / 0.08);
  
  /* Sombra de destaque com amber glow */
  --shadow-glow: 0 10px 30px hsl(var(--accent-amber) / 0.15),
                 0 4px 12px hsl(0 0% 0% / 0.1);
}
```

### Motion (Padrões Uniformes)

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 220ms;
  --duration-slow: 350ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Alterações Específicas por Componente

### 1. Botões (`src/components/ui/button.tsx`)

**Antes:**
```tsx
"bg-primary text-primary-foreground hover:bg-primary/90"
```

**Depois:**
```tsx
"bg-primary text-primary-foreground 
 hover:bg-primary/90 hover:shadow-md
 active:scale-[0.98] active:shadow-sm
 transition-all duration-150"
```

### 2. Glass Card (`.glass-card` em `src/index.css`)

**Antes:**
```css
.glass-card {
  @apply bg-card/60 backdrop-blur-xl border border-border/50 shadow-xl;
}
```

**Depois:**
```css
.glass-card {
  @apply bg-card/70 backdrop-blur-lg border border-border/40;
  box-shadow: var(--shadow-md);
}
.glass-card:hover {
  border-color: hsl(var(--border-strong));
}
```

### 3. Sheet Overlay (`src/components/ui/sheet.tsx`)

**Antes:**
```tsx
"bg-black/80"
```

**Depois:**
```tsx
"bg-background/85 backdrop-blur-sm"
```
*(Mantém identidade navy em vez de preto puro)*

### 4. Input Focus States (Unificar)

**Padrão único para todos os inputs:**
```css
.input-focus {
  @apply focus:outline-none 
         focus:ring-2 focus:ring-primary/30 
         focus:border-primary/50
         focus:shadow-[0_0_0_4px_hsl(var(--accent-amber-glow))];
}
```

### 5. Hierarquia de Texto (Classes Semânticas)

```css
.text-display { @apply text-foreground font-bold tracking-tight; }
.text-heading { @apply text-foreground font-semibold; }
.text-body { @apply text-muted-foreground leading-relaxed; }
.text-caption { @apply text-muted-foreground/70 text-sm; }
.text-hint { @apply text-muted-foreground/50 text-xs; }
```

### 6. Badge Chip (Mais Contraste)

**Antes:**
```css
.badge-chip {
  @apply bg-primary/15 border border-primary/30 text-primary;
}
```

**Depois:**
```css
.badge-chip {
  @apply bg-primary/20 border border-primary/40 text-primary;
  box-shadow: inset 0 1px 0 hsl(var(--primary) / 0.1);
}
```

---

## Arquivos a Serem Modificados

| Arquivo | Alterações |
|---------|------------|
| `src/index.css` | Adicionar tokens de superfície, texto, sombra; refinar classes utilitárias |
| `tailwind.config.ts` | Mapear novos tokens para classes Tailwind |
| `src/components/ui/button.tsx` | Adicionar micro-interações (active:scale) |
| `src/components/ui/sheet.tsx` | Overlay com blur navy em vez de preto |
| `src/components/ui/card.tsx` | Usar nova escala de sombras |
| `src/components/chat/ChatInput.tsx` | Padronizar focus ring |
| `src/components/chat/ChatPanel.tsx` | Padronizar opacidades |
| `src/components/Header.tsx` | Usar novos tokens de borda |
| `src/components/FeaturesSection.tsx` | Feature cards com nova elevação |

---

## Critérios de Sucesso

1. **Uniformidade**: Todas as bordas usam escala de 3 níveis (subtle/default/strong)
2. **Hierarquia clara**: Texto segue 4 níveis semânticos
3. **Micro-feedback**: Botões têm resposta tátil (scale) no clique
4. **Elevação visual**: Cards, modais e sheets têm camadas de sombra distintas
5. **Motion consistente**: Todas as transições usam 150-220ms com ease-out suave
6. **Zero regressão**: Nenhuma alteração quebra o layout existente

---

## Seção Técnica: Implementação em 3 Fases

### Fase 1: Tokens Base (index.css + tailwind.config.ts)
- Adicionar variáveis CSS novas
- Mapear para Tailwind
- NÃO alterar componentes ainda

### Fase 2: Componentes Core (button, card, input, sheet)
- Aplicar novos tokens
- Adicionar micro-interações
- Testar em desktop e mobile

### Fase 3: Componentes de Página (Header, Hero, Features, Chat)
- Migrar para classes semânticas
- Remover opacidades inline inconsistentes
- Validar harmonia visual final

---

## Visualização: Antes vs Depois

```text
ANTES (Inconsistente)                    DEPOIS (Sistema)
─────────────────────                    ─────────────────
border-border/40                    →    border-subtle
border-border/50                    →    border-default  
border-border/60                    →    border-strong

text-muted-foreground/60            →    text-caption
text-muted-foreground/70            →    text-body
text-muted-foreground               →    text-secondary

shadow-xl (tudo igual)              →    shadow-sm/md/lg (elevação)

hover:bg-primary/90 (só cor)        →    hover:bg-primary/90 + shadow + scale
```
