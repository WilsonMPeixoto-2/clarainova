# CLARA Design System

**Version:** 3.0 — Premium Craft Edition  
**Updated:** 2026-01-29  
**Brand Identity:** Premium LegalTech AI Assistant

## ⚠️ Regras-Mãe (antes de mexer)

1. **Não adicionar ruído**: cada elemento novo justifica "ganho de legibilidade" ou "ganho de produtividade"
2. **Uma só linguagem**: tudo segue os mesmos tokens (surface, border, text, motion). Sem cores "soltas"
3. **Ritmo**: padding/margens em múltiplos de 4/8px
4. **Estados completos**: nenhum componente existe sem loading / empty / error / success

## ❌ Anti-Patterns (o que NÃO fazer)

- Brilho/glow excessivo
- Bordas fortes demais (use `--border-subtle`)
- Animações longas (>350ms) ou em layout principal
- Cores hardcoded (`text-white`, `bg-black`)
- Sombras agressivas (use `--shadow-sm` ou `--shadow-md`)
- Glass/blur em todos os elementos (só onde faz sentido)

---

## 🎨 Core Identity

### Visual Signature (DO NOT CHANGE)
- **Dark Navy Base**: Deep, sophisticated background
- **Amber/Gold Accents**: Primary interaction color
- **Tech Circuit Imagery**: Subtle background patterns
- **Glassmorphism**: Cards with backdrop blur and subtle borders

### Typography
- **Font Family**: Inter (system fallback: system-ui, -apple-system, sans-serif)
- **Brand Tracking**: `tracking-tighter` for "CLARA" wordmark
- **Body Tracking**: Standard for readability

---

## 🎯 Design Tokens

### Color Palette

#### Surfaces (5-level scale)
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--surface-0` | 216 45% 7% | Base background |
| `--surface-1` | 216 40% 9% | Header, elevated surfaces |
| `--surface-2` | 216 40% 12% | Cards |
| `--surface-3` | 216 35% 15% | Inputs, hover states |
| `--surface-4` | 216 35% 18% | Active interactive elements |

#### Text (4 semantic levels - AA compliant)
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--text-primary` | 210 40% 98% | Headlines, primary content |
| `--text-secondary` | 210 20% 75% | Body text, descriptions |
| `--text-muted` | 210 20% 65% | Captions, secondary info |
| `--text-disabled` | 210 15% 45% | Hints, disabled states |

#### Borders (3 levels)
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--border-subtle` | 216 30% 18% | Glass cards, light separation |
| `--border-default` | 216 30% 22% | Standard borders |
| `--border-strong` | 216 30% 28% | Emphasis, focus states |

#### Accent Colors
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--primary` | 30 45% 64% | Primary amber (buttons, links) |
| `--accent` | 24 100% 63% | Bright orange accent |
| `--accent-amber-glow` | 30 45% 64% | Glow effects |

---

## 📐 Spacing & Radius

### Spacing Scale (8-point grid)
```
8px  → Gap-2, p-2
12px → Gap-3, p-3  
16px → Gap-4, p-4
24px → Gap-6, p-6
32px → Gap-8, p-8
48px → Gap-12, p-12
```

### Border Radius Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 8px | Small chips, badges |
| `--radius-md` | 12px | Buttons, inputs |
| `--radius-lg` | 16px | Cards |
| `--radius-xl` | 20px | Search bar, modals |
| `--radius-2xl` | 24px | Feature cards |

---

## 🌫️ Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Buttons, subtle elevation |
| `--shadow-md` | Cards, dropdowns |
| `--shadow-lg` | Modals, popovers |
| `--shadow-glow` | Primary button hover, CTAs |

---

## ⏱️ Motion

### Duration Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 150ms | Hovers, micro-interactions |
| `--duration-normal` | 220ms | Transitions, card effects |
| `--duration-slow` | 350ms | Page transitions, reveals |

### Motion Guidelines
- **Always** use tokens for consistent timing
- **Prefer** transform over layout changes
- **Honor** `prefers-reduced-motion` preference
- **Limit** simultaneous animations to 1-2

---

## 📝 Typography Classes

### Formal Scale
```css
.text-h1   /* 4xl-6xl, bold, tracking-tighter, line-height: 1.1 */
.text-h2   /* 2xl-4xl, semibold, tracking-tight, line-height: 1.2 */
.text-h3   /* xl-2xl, semibold, line-height: 1.3 */
```

### Semantic Classes
```css
.text-display   /* Headlines, hero text */
.text-heading   /* Section titles */
.text-body      /* Paragraphs, line-height: 1.7 */
.text-body-snug /* Compact paragraphs, leading-snug */
.text-caption   /* Small labels, metadata */
.text-hint      /* Disclaimers, fine print */
```

---

## 🔘 Component Classes

### Buttons
```css
.btn-clara-primary    /* Amber filled, shadow, hover glow */
.btn-clara-secondary  /* Outline, transparent bg */
```

Both include:
- `:hover` → elevation + glow
- `:active` → scale(0.98)
- `:focus-visible` → ring
- `:disabled` → opacity 0.5, no transforms

### Cards
```css
.glass-card          /* Backdrop blur, subtle border */
.glass-card-elevated /* Higher elevation variant */
.feature-card        /* For feature grid with hover effects */
```

### Inputs
```css
.search-input-clara  /* Premium search with focus glow */
.input-focus         /* Focus ring style */
```

### Chips & Badges
```css
.badge-chip      /* Amber accent chip */
.suggestion-chip /* Interactive suggestion */
.test-badge      /* Small status indicator */
```

### Links
```css
.footer-link /* Animated underline on hover */
```

---

## ♿ Accessibility

### Contrast Requirements
- **Text on backgrounds**: Minimum AA (4.5:1)
- `--text-muted` at 65% luminance ensures AA compliance
- All interactive elements have visible focus states

### Focus States
```css
.focus-ring   /* Standard focus ring */
.focus-amber  /* Primary color focus ring */
```

### Reduced Motion
All animations respect `prefers-reduced-motion: reduce`

---

## 📋 Usage Guidelines

### DO ✅
- Use semantic token classes (`text-h1`, `text-body`)
- Apply surface tokens for backgrounds
- Use `hsl(var(--token))` syntax in custom CSS
- Maintain consistent radius per component type
- Test on both light and dark modes (dark is primary)

### DON'T ❌
- Use hardcoded colors (`text-white`, `bg-black`)
- Mix pixel values outside the 8-point grid
- Create new shadow values (use tokens)
- Skip focus states on interactive elements
- Use `!important` to override tokens

---

## 🔧 Implementation

### Tailwind Config
All tokens are registered in `tailwind.config.ts` for class usage:
```tsx
colors: {
  surface: {
    0: "hsl(var(--surface-0))",
    1: "hsl(var(--surface-1))",
    // ...
  },
  "text-primary": "hsl(var(--text-primary))",
  // ...
}
```

### CSS Variables
Defined in `src/index.css` under `:root` and `.dark` selectors.

### Component Examples
See `src/components/HeroSection.tsx` and `src/components/ui/button.tsx` for reference implementations.

---

## 📚 File Structure

```
src/
├── index.css              # Token definitions & component classes
├── components/
│   ├── ui/                # shadcn primitives (customized)
│   ├── HeroSection.tsx    # Hero reference implementation
│   ├── Header.tsx         # Navigation patterns
│   └── Footer.tsx         # Footer patterns
└── tailwind.config.ts     # Token registration
```

---

*This design system ensures visual consistency across all CLARA pages and components.*
