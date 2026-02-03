
# Plano: Modo Claro para CLARA

## Análise da Situação Atual

O projeto CLARA possui uma identidade visual **Premium LegalTech** fortemente orientada ao modo escuro:
- **Paleta navy/amber**: fundos escuros (HSL 216 45% 7%) com acentos âmbar
- **Glassmorphism**: cards com backdrop-blur sobre fundos escuros
- **Overlays de hero**: gradientes hardcoded para composição com imagem de fundo escura
- **Design System documentado** em `DESIGN_SYSTEM.md` com tokens específicos para escuro

### Infraestrutura Disponível
- ✅ `next-themes` já instalado (v0.3.0)
- ✅ Classe `.dark` já definida em `index.css` (mas idêntica ao `:root`)
- ❌ `ThemeProvider` não configurado
- ❌ Toggle de tema não existe

---

## Considerações de Design

### Prós do Modo Claro
1. **Acessibilidade**: Alguns usuários preferem fundos claros
2. **Ambiente de escritório**: Administração pública frequentemente em salas bem iluminadas
3. **Economia de tinta**: Se o usuário precisar imprimir alguma tela

### Contras / Riscos
1. **Imagem hero**: A foto atual foi composta para fundo escuro — precisará de tratamento ou imagem alternativa para modo claro
2. **Glows e sombras**: Efeitos como `amber-glow` e `text-glow` não funcionam bem em fundos claros
3. **Esforço de design**: Criar uma paleta clara coesa que mantenha a sofisticação exige cuidado
4. **Manutenção**: Qualquer novo componente precisará de variantes para ambos os modos

---

## Implementação Proposta

### Fase 1: Infraestrutura do Tema
1. **Configurar ThemeProvider** em `App.tsx` usando `next-themes`
2. **Criar toggle de tema** no Header (ícone Sol/Lua)
3. **Persistir preferência** via localStorage (automático do next-themes)

### Fase 2: Paleta de Cores Clara
Definir variáveis CSS para modo claro em `index.css`:

```text
┌─────────────────────────────────────────────────────────┐
│  :root (Light Mode - Padrão após implementação)        │
├─────────────────────────────────────────────────────────┤
│  --background: 0 0% 100%        (branco)               │
│  --foreground: 216 40% 15%      (navy escuro)          │
│  --surface-0: 0 0% 98%          (off-white)            │
│  --surface-1: 0 0% 96%          (cinza sutil)          │
│  --surface-2: 0 0% 94%          (cards)                │
│  --surface-3: 0 0% 90%          (inputs)               │
│  --surface-4: 0 0% 86%          (hover)                │
│  --primary: 30 45% 45%          (âmbar ajustado)       │
│  --text-primary: 216 40% 15%    (navy)                 │
│  --text-muted: 216 20% 45%      (cinza médio)          │
│  --border-subtle: 216 15% 88%   (bordas suaves)        │
└─────────────────────────────────────────────────────────┘
```

### Fase 3: Ajustes Visuais Específicos
1. **Hero overlay**: Criar `.hero-overlay-light` com gradiente branco/transparente
2. **Glass cards**: Ajustar opacidade para fundos claros
3. **Sombras**: Criar variantes de shadow mais sutis
4. **Glow effects**: Desabilitar ou ajustar para modo claro

### Fase 4: Toggle no Header
- Botão com ícone `Sun`/`Moon` do Lucide
- Posicionado junto aos links de navegação
- Transição suave entre modos

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar `ThemeProvider` do next-themes |
| `src/index.css` | Definir variáveis do modo claro em `:root`, mover escuro para `.dark` |
| `src/components/Header.tsx` | Adicionar botão toggle de tema |
| `index.html` | Ajustar critical CSS para suportar ambos os modos |
| `src/components/HeroSection.tsx` | Adicionar classe condicional para overlays |

---

## Alternativa: Sistema Opcional

Se preferir, podemos implementar apenas o **toggle** e deixar o modo claro como "beta", exibindo um aviso de que ainda está em refinamento. Isso permite coletar feedback dos usuários antes de polir todos os detalhes.

---

## Recomendação

Dado que a identidade visual foi cuidadosamente construída para o modo escuro, recomendo:

1. **Implementar a infraestrutura completa** (ThemeProvider + toggle)
2. **Criar uma paleta clara básica** funcional
3. **Testar com usuários reais** antes de polir detalhes

Isso permite lançar rapidamente e iterar com base em feedback real.
