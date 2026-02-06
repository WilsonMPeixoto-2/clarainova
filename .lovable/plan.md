

# Plano de Correção e Atualização Completa do CLARA

## Resumo

Foram identificados **5 problemas** a corrigir e **2 melhorias** a aplicar. A maioria envolve limpeza de arquivos legados, correção de componentes e padronização visual.

---

## 1. Remover Componentes Legados Nao Utilizados

Os seguintes arquivos existem no projeto mas **nao sao referenciados** em nenhuma rota ou componente ativo. Eles sao restos da versao anterior (Manus Platform) e devem ser removidos para manter o projeto limpo:

- `src/components/AIChatBox.tsx` -- Substituido pelo sistema de chat customizado
- `src/components/DashboardLayout.tsx` -- Layout de dashboard autenticado, nao usado
- `src/components/DashboardLayoutSkeleton.tsx` -- Skeleton do dashboard, nao usado
- `src/components/ManusDialog.tsx` -- Dialog de login Manus, nao usado
- `src/components/Map.tsx` -- Componente Google Maps, nao usado

**Impacto**: Reduz o tamanho do bundle e elimina dependencias mortas (useAuth, usePersistFn legados).

---

## 2. Padronizar a Pagina 404 com o Design System

A pagina `NotFound.tsx` usa um estilo completamente diferente (fundo branco/slate, botao azul) que nao combina com o design "GovTech Premium" do resto da aplicacao. Sera atualizada para usar:

- Fundo escuro com mesh gradient (consistente com o tema)
- Cores do design system (primary amber, foreground correto)
- Textos em portugues
- Tipografia Plus Jakarta Sans

---

## 3. Padronizar o ErrorBoundary com Textos em Portugues

O componente `ErrorBoundary.tsx` exibe textos em ingles ("An unexpected error occurred", "Reload Page"). Sera traduzido para portugues para consistencia.

---

## 4. Remover o Diretorio Duplicado `client/src/`

O diretorio `client/src/` contem copias duplicadas dos mesmos arquivos que estao em `src/`. O Vite esta configurado para usar `src/` como raiz, entao `client/src/` e redundante. Esses arquivos duplicados serao removidos para evitar confusao.

---

## 5. Limpar Imports Nao Utilizados

O arquivo `Home.tsx` e o `KnowledgeBaseSidebar.tsx` possuem imports de icones que nao sao utilizados. Serao limpos.

---

## 6. Melhorar o Tratamento de Erro no Chat

Atualmente, quando a Edge Function retorna um erro no campo `error` (em vez de `answer`), o frontend nao trata esse caso explicitamente. Sera adicionada verificacao para exibir a mensagem de erro da API quando presente.

---

## 7. Garantir que a Conversation History e Enviada

Atualmente, o `Home.tsx` nao envia o historico de conversa para a Edge Function, o que significa que a CLARA nao tem contexto das mensagens anteriores. Sera adicionado o envio do array de conversationHistory para manter continuidade entre mensagens.

---

## Detalhes Tecnicos

### Arquivos a Deletar
```text
src/components/AIChatBox.tsx
src/components/DashboardLayout.tsx
src/components/DashboardLayoutSkeleton.tsx
src/components/ManusDialog.tsx
src/components/Map.tsx
client/src/ (diretorio inteiro -- duplicatas)
```

### Arquivos a Modificar

**src/pages/Home.tsx**
- Adicionar envio de `conversationHistory` no body da chamada a Edge Function
- Tratar resposta de erro da API (`data.error`)
- Limpar imports nao usados

**src/pages/NotFound.tsx**
- Redesign completo seguindo o design system GovTech Premium
- Textos em portugues

**src/components/ErrorBoundary.tsx**
- Traduzir textos para portugues
- Ajustar estilo para o design system

### Arquivos que NAO serao tocados (protegidos)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`
- `supabase/config.toml`
- `package.json`

### Ordem de Execucao
1. Deletar componentes legados e diretorio duplicado
2. Atualizar `Home.tsx` (historico + tratamento de erro)
3. Redesenhar `NotFound.tsx`
4. Traduzir `ErrorBoundary.tsx`

