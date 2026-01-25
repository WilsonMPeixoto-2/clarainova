

# Plano: Resolver Problemas de Verificação do Google OAuth

## Problemas Identificados

O Google encontrou 3 problemas na verificação de branding:

| Problema | Descrição | Tipo de Solução |
|----------|-----------|-----------------|
| 1. Domínio não verificado | Google precisa confirmar propriedade do domínio | Configuração no Google Search Console |
| 2. Link de Privacidade ausente | Página inicial precisa ter link visível para Política de Privacidade | Modificação de código |
| 3. Nome inconsistente | Nome do app no OAuth diferente do nome na página | Modificação de código + configuração Google |

---

## Solução para Cada Problema

### Problema 1: Verificar Propriedade do Domínio

Isso precisa ser feito no **Google Search Console**:

1. Acesse [Google Search Console](https://search.google.com/search-console)
2. Adicione a propriedade `https://clarainova.lovable.app`
3. Escolha verificação por **meta tag HTML** (mais simples)
4. Adicione a meta tag fornecida pelo Google ao componente SEOHead

Eu posso preparar o código para adicionar a meta tag de verificação, mas você precisará me informar o código que o Google fornecer.

---

### Problema 2: Adicionar Link de Privacidade na Página Inicial

O Footer já tem o link `/privacidade`, mas o Google pode não estar detectando corretamente. Vamos torná-lo mais explícito:

**Modificações propostas:**

| Arquivo | Modificação |
|---------|-------------|
| `src/components/Footer.tsx` | Tornar o link de privacidade mais destacado com texto "Política de Privacidade" e schema markup |
| `src/pages/Index.tsx` | Adicionar link direto para privacidade no SEOHead |
| `src/components/SEOHead.tsx` | Adicionar meta tags para indicar página de privacidade |

---

### Problema 3: Alinhar Nome do App

O nome no Google OAuth é "CLARA INTELIGÊNCIA ADMINISTRATIVA", mas na página:
- Título SEO: "CLARA - Assistente de Legislação e Apoio Administrativo"
- H1: "CLARA"
- Badge: "Inteligência Administrativa"

**Opções:**

**Opção A**: Alterar o título SEO para corresponder ao OAuth
- Mudar de "CLARA - Assistente de Legislação e Apoio Administrativo"
- Para "CLARA Inteligência Administrativa"

**Opção B**: Alterar o nome no Google OAuth Console
- Mudar de "CLARA INTELIGÊNCIA ADMINISTRATIVA"
- Para "CLARA - Assistente de Legislação e Apoio Administrativo"

**Recomendação**: Opção A - Alinhar o código ao OAuth é mais simples e mantém consistência.

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Index.tsx` | Alterar título SEO para "CLARA Inteligência Administrativa" |
| `src/components/SEOHead.tsx` | Adicionar suporte para meta tag de verificação do Google |
| `src/components/Footer.tsx` | Reforçar link de privacidade com schema markup |

---

## Ação Manual Necessária

Você precisará verificar a propriedade do domínio no **Google Search Console**:

1. Acesse: https://search.google.com/search-console
2. Clique em "Adicionar propriedade"
3. Escolha "Prefixo do URL"
4. Digite: `https://clarainova.lovable.app`
5. Selecione verificação por **meta tag HTML**
6. Copie o código `content` da meta tag (ex: `content="abc123xyz"`)
7. Me informe esse código para eu adicionar ao código

---

## Seção Técnica

### Mudanças no SEOHead

Adicionaremos suporte para:
- Meta tag de verificação do Google (`google-site-verification`)
- Link rel="privacy-policy" apontando para `/privacidade`

### Alinhamento de Título

O título será padronizado em todos os lugares:
- SEO title: "CLARA Inteligência Administrativa"
- Isso corresponde exatamente ao nome configurado no Google OAuth

### Schema Markup

Garantir que o JSON-LD schema inclua referência explícita à política de privacidade.

