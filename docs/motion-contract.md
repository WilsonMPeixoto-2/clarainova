# Motion Contract - Hero and Sections

## Escopo
- Objetivo: adicionar movimento cinematográfico sem alterar o Layout Contract do Hero.
- Restrições aplicadas:
  - sem mudanças de `width/height/flow` para motion;
  - apenas `transform`, `opacity` e animações de gradiente;
  - fallback com `js-enabled` para evitar conteúdo invisível;
  - `prefers-reduced-motion` com motion reduzido/estático.

## Nível 1 (CSS)

### Aurora breathing
- Camada: `.hero-shell::before` + `.hero-shell::after`
- Keyframes:
  - `hero-aurora-breathe` (22s, `ease-in-out`, infinito)
  - `hero-aurora-veil` (26s, `ease-in-out`, infinito)
- Intensidade mobile reduzida via `@media (max-width: 899px)`.

### Energy glow (área da Clara)
- Camada: `.hero-art-stage::before`
- Keyframe: `hero-energy-glow` (30s, `ease-in-out`, infinito)
- Opacidade baixa para preservar rosto.
- Mobile: opacidade e velocidade reduzidas.

### Grain/noise
- Camada global: `body::before`
- Opacidade refinada: `--noise-opacity: 0.034`.

## Nível 2 (Framer Motion + fallback)

### Estratégia `js-enabled`
- `src/App.tsx`: `useEffect` adiciona/remove classe `js-enabled` no `<body>`.
- `src/components/animations/ScrollReveal.tsx`:
  - sem `js-enabled` => render estático (`div`);
  - com `js-enabled` => `motion.div` com `whileInView`.
- `src/components/HeroSection.tsx`:
  - `initial="hidden"` só quando `js-enabled && !prefers-reduced-motion`;
  - sem JS/motion => estado visível.

### Stagger de entrada (Hero)
- Container:
  - hidden: `opacity 0`, `y 16`
  - visible: `opacity 1`, `y 0`
  - `staggerChildren`: 0.10-0.12
- Itens:
  - duração: 0.55-0.75
  - easing: `[0.16, 1, 0.3, 1]`

### Reveal do título CLARA
- Máscara via `clipPath` + fade + blur máximo 2px.
- Duração: 0.68s.

### Parallax mínimo
- Implementado com `useScroll` + `useTransform` (Framer Motion):
  - arte (`hero-media-layer`): até `22px`
  - aurora/overlay/energia: até `28px`
  - texto (`hero-content-wrap`): até `7px`
- Vinculado ao progresso do próprio Hero (`start start` -> `end start`).

### Microinterações
- CTA hover com elevação leve e glow já existente.
- Magnetic cursor desktop-only em CTAs:
  - deslocamento máx ~6px por eixo;
  - atualização via `requestAnimationFrame`;
  - desligado em mobile/reduced-motion.

## Regras de Reduce Motion
- `ScrollReveal`: render estático sem animação.
- Hero orchestration: desativada via `shouldAnimate = js-enabled && !prefersReducedMotion`.
- CSS:
  - aurora/energy glow: `animation: none` no hero em `prefers-reduced-motion`;
  - ribbons/beams/streams e pseudo-camadas de energia: `animation: none !important`, `transform: none !important`;
  - transições de CTA/microinteração neutralizadas.

## Checklist de Validação
- [x] Clara permanece visível (sem sumir por overlay/motion).
- [x] Conteúdo não depende de JS para ficar legível.
- [x] Entrada escalonada do Hero com easing cinematográfico.
- [x] Mobile com motion discreto.
- [x] `build`, `lint`, `test` passando.
