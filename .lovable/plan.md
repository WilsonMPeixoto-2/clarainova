

# Plano: Duas Melhorias de Identidade Visual

## Resumo das Alterações

Duas modificações estratégicas que reforçam a identidade da marca CLARA:

---

## 1. Badge Chip: "Inteligência Administrativa"

**Localização:** Topo do Hero, acima do título CLARA

**Antes:**
```
[●] [✨] Assistente de Legislação
```

**Depois:**
```
[●] [✨] Inteligência Administrativa
```

**Justificativa do usuário:**
- "Inteligência Administrativa" reflete melhor o propósito da CLARA (sistemas, leis, procedimentos)
- Cria uma marca expandível para futuras soluções tecnológicas no setor público
- Posiciona a CLARA como parte de uma visão maior

---

## 2. Subtítulo: Destacar Letras do Acrônimo C-L-A-R-A

**Localização:** Abaixo do título CLARA

**Antes:**
```
Consultora de Legislação e Apoio a Rotinas Administrativas
```

**Depois (visualmente):**
```text
┌───────────────────────────────────────────────────────────┐
│  Consultora de Legislação e Apoio a Rotinas Administrativas│
│  ▲            ▲              ▲         ▲              ▲   │
│  C            L              A         R              A   │
│  (âmbar)   (âmbar)       (âmbar)   (âmbar)        (âmbar) │
└───────────────────────────────────────────────────────────┘
```

As iniciais **C**, **L**, **A**, **R**, **A** aparecem na cor primária (âmbar), enquanto o restante permanece na cor atual (`text-foreground`).

---

## Implementação Técnica

### Arquivo a Modificar
`src/components/HeroSection.tsx`

### Alteração 1: Badge Chip (linha 89)
Simples substituição de texto:
- De: `Assistente de Legislação`
- Para: `Inteligência Administrativa`

### Alteração 2: Subtítulo com Letras Destacadas (linhas 105-110)
Substituir o texto simples por spans com cores diferenciadas:

```tsx
<motion.p 
  variants={itemVariants}
  className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground tracking-tight text-glow max-w-xl"
>
  <span className="text-primary">C</span>onsultora de{' '}
  <span className="text-primary">L</span>egislação e{' '}
  <span className="text-primary">A</span>poio a{' '}
  <span className="text-primary">R</span>otinas{' '}
  <span className="text-primary">A</span>dministrativas
</motion.p>
```

---

## Resultado Visual Esperado

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [●] [✨] Inteligência Administrativa                   │
│                                                         │
│  ████  █      █     ████   █                           │
│ █      █     █ █    █   █  █ █                         │
│ █      █    █████   ████   █████    ← CLARA (âmbar)    │
│ █      █   █     █  █   █  █   █                       │
│  ████  █  █       █ █   █  █   █                       │
│                                                         │
│  Consultora de Legislação e Apoio a Rotinas Administrativas │
│  ▲            ▲              ▲         ▲              ▲     │
│  C            L              A         R              A     │
│  (letras âmbar destacadas)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Considerações

### Tipografia Mantida
- Nenhuma alteração em fonte, tamanho ou espaçamento
- Apenas a cor das iniciais muda para `text-primary` (âmbar)

### Acessibilidade
- O destaque em cor não afeta leitores de tela (o texto permanece legível como frase completa)
- Contraste adequado mantido (âmbar sobre navy)

### Consistência de Marca
- Usa a mesma cor primária já estabelecida no design system
- Reforça visualmente o significado do acrônimo sem ser excessivo

---

## Seção Técnica

### Arquivo Modificado
| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `src/components/HeroSection.tsx` | 89 | Texto do badge |
| `src/components/HeroSection.tsx` | 105-110 | Subtítulo com spans coloridos |

### Impacto
- Nenhuma nova dependência
- Nenhum novo arquivo
- Alteração mínima e cirúrgica

