
# Plano: Melhorar Visibilidade da Política de Privacidade

## Problema Identificado

O Google OAuth requer que o link para a Política de Privacidade esteja **claramente visível** na página inicial, sem necessidade de scroll ou login. Atualmente:

| Local | Status |
|-------|--------|
| Página `/login` | Link visível antes do botão Google |
| Página `/` (homepage) | Link apenas no Footer (abaixo da dobra) |
| Header | Sem link para privacidade |

## Solução Proposta

Adicionar o link de Política de Privacidade em **dois locais estratégicos**:

### 1. Header do Site
Adicionar "Política de Privacidade" nos links de navegação do Header, garantindo visibilidade imediata.

```text
Antes:
CLARA | Base de Conhecimento | Dúvidas Frequentes | Termos de Uso

Depois:
CLARA | Base de Conhecimento | Dúvidas Frequentes | Política de Privacidade | Termos de Uso
```

### 2. Seção Hero (Opcional mas Recomendado)
Adicionar um pequeno texto com link abaixo do botão "Experimentar CLARA" na HeroSection, similar ao que já existe na página de login.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Header.tsx` | Adicionar link `/privacidade` no array `navLinks` |
| `src/components/HeroSection.tsx` | (Opcional) Adicionar texto com link de privacidade |

## Detalhes Técnicos

### Header.tsx
Modificar o array `navLinks` (linha 9-13):

```tsx
const navLinks = [
  { label: 'Base de Conhecimento', href: '#conhecimento' },
  { label: 'Dúvidas Frequentes', href: '#faq' },
  { label: 'Política de Privacidade', href: '/privacidade' },
  { label: 'Termos de Uso', href: '/termos' },
];
```

Nota: Mudar `#termos` para `/termos` também, já que existe uma página dedicada.

## Resultado Esperado

Após implementação e publicação:
- Link de privacidade visível no topo de TODAS as páginas
- Google conseguirá identificar o link na homepage sem scroll
- Conformidade total com requisitos OAuth

## Checklist para Verificação Google

Após publicar, confirmar que:
1. URL `https://clarainova.lovable.app/privacidade` carrega corretamente
2. Link está visível sem scroll na homepage
3. URL no Google Cloud Console é exatamente `/privacidade` ou URL completa
