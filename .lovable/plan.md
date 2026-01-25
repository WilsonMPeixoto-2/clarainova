

# Plano: Sistema de Feedback e Analytics Anônimo para CLARA

## Objetivo Principal
Coletar dados **100% anônimos** para entender:
1. **Quais tópicos são mais pesquisados** (insights valiosos!)
2. **Por que algumas respostas recebem avaliação negativa** (para melhorar a base)
3. **Taxa geral de satisfação** (métrica de qualidade)

---

## 1. Banco de Dados

### Nova Tabela: `query_analytics`
Armazena **todas as consultas** feitas à CLARA (para análise de tópicos).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Chave primária |
| `user_query` | text | Pergunta do usuário |
| `assistant_response` | text | Resposta da CLARA |
| `sources_cited` | text[] | Fontes citadas (se houver) |
| `created_at` | timestamptz | Data/hora da consulta |

### Nova Tabela: `response_feedback`
Armazena **apenas feedbacks** (positivos ou negativos).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Chave primária |
| `query_id` | uuid | FK para query_analytics |
| `rating` | boolean | true = positivo, false = negativo |
| `feedback_category` | text | Categoria do problema (só negativos) |
| `feedback_text` | text | Comentário livre (só negativos) |
| `created_at` | timestamptz | Data/hora do feedback |

### Políticas RLS
- **Qualquer pessoa pode inserir** (anônimos e logados)
- **Apenas admins podem ler** (via função `has_role` já existente)
- **Ninguém pode atualizar ou deletar** (integridade dos dados)

---

## 2. Frontend - Botões de Feedback

### Novo Componente: `FeedbackButtons.tsx`
Aparece após cada resposta da CLARA (quando não está em streaming).

```text
┌─────────────────────────────────────────────────┐
│  [Resposta da CLARA aqui...]                    │
│                                                 │
│  📋 2 fontes  [Copiar]  [👍] [👎]               │
└─────────────────────────────────────────────────┘
```

**Comportamento:**
- **Clique em 👍**: Salva feedback positivo + Toast "Obrigado!"
- **Clique em 👎**: Abre modal com categorias

### Modal de Feedback Negativo

```text
┌──────────────────────────────────────────┐
│  O que estava errado?                    │
│                                          │
│  ○ Informação incorreta                  │
│  ○ Desatualizado                         │
│  ○ Incompleto                            │
│  ○ Confuso/difícil de entender           │
│  ○ Não respondeu à pergunta              │
│  ○ Outro                                 │
│                                          │
│  [Comentário opcional...]                │
│  ________________________________________│
│                                          │
│         [Pular]      [Enviar]            │
└──────────────────────────────────────────┘
```

**Categorias:**
- `incorrect` - Informação incorreta
- `outdated` - Desatualizado
- `incomplete` - Incompleto
- `confusing` - Confuso/difícil de entender
- `off_topic` - Não respondeu à pergunta
- `other` - Outro

---

## 3. Modificação do Hook useChat

Para rastrear consultas, o `useChat.ts` será modificado para:
1. Salvar cada par pergunta/resposta em `query_analytics` após streaming completo
2. Retornar o `query_id` junto com cada mensagem para uso no feedback

---

## 4. Dashboard Analytics (Aba no Admin)

O `Admin.tsx` receberá um sistema de **Tabs** com duas abas:
- **Documentos** (atual)
- **Analytics** (nova)

### Aba Analytics - Seções

#### A) Métricas Rápidas (Cards)
```text
┌──────────────────┬──────────────────┬──────────────────┐
│  Total Consultas │  Taxa Satisfação │  Negativos       │
│     1.234        │      87%         │     42           │
└──────────────────┴──────────────────┴──────────────────┘
```

#### B) Top 10 Tópicos Mais Pesquisados
Baseado em análise simples de palavras-chave das queries.

```text
┌─────┬────────────────────────┬─────────┐
│ #   │ Tópico                 │ Qtd     │
├─────┼────────────────────────┼─────────┤
│ 1   │ diárias                │ 156     │
│ 2   │ SEI                    │ 134     │
│ 3   │ processo               │ 98      │
│ 4   │ SDP                    │ 87      │
│ 5   │ passagens              │ 76      │
└─────┴────────────────────────┴─────────┘
```

#### C) Feedbacks Negativos Recentes
Tabela para auditoria com contexto completo.

```text
┌───────────────────────────┬─────────────┬───────────────────┬────────┐
│ Pergunta                  │ Categoria   │ Comentário        │ Data   │
├───────────────────────────┼─────────────┼───────────────────┼────────┤
│ Como criar diária no SDP? │ Incompleto  │ Faltou explicar.. │ 25/01  │
│ Qual prazo do processo?   │ Desatualizado│ O prazo mudou...  │ 24/01  │
└───────────────────────────┴─────────────┴───────────────────┴────────┘
                                                    [Ver detalhes]
```

#### D) Modal "Ver Detalhes"
Ao clicar, mostra:
- Pergunta completa do usuário
- Resposta completa da CLARA
- Fontes que foram citadas
- Categoria do problema
- Comentário do usuário

#### E) Exportar Dados (CSV)
Botão para baixar todos os dados em CSV para análise em Excel/Sheets.

---

## 5. Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/chat/FeedbackButtons.tsx` | Botões 👍👎 discretos |
| `src/components/chat/FeedbackModal.tsx` | Modal para feedback negativo |
| `src/hooks/useFeedback.ts` | Hook para salvar feedback |
| `src/hooks/useQueryTracking.ts` | Hook para rastrear consultas |
| `src/components/admin/AnalyticsTab.tsx` | Dashboard com métricas |
| `src/components/admin/FeedbackDetailModal.tsx` | Modal de detalhes |

## 6. Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/chat/ChatMessage.tsx` | Adicionar FeedbackButtons |
| `src/hooks/useChat.ts` | Integrar rastreamento de queries |
| `src/pages/Admin.tsx` | Adicionar Tabs com aba Analytics |

---

## 7. Fluxo de Dados

```text
Usuário faz pergunta
        │
        ▼
┌─────────────────────────────────────┐
│  CLARA responde via clara-chat      │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  Salva em query_analytics           │
│  (pergunta, resposta, fontes)       │
└──────────────────┬──────────────────┘
                   │
                   ▼
        Exibe botões 👍 👎
                   │
        ┌──────────┴──────────┐
        │                     │
       👍                    👎
        │                     │
        ▼                     ▼
   Salva em              Modal abre
   response_feedback        │
   (rating=true)            ▼
        │             Usuário escolhe
        │             categoria + texto
        │                     │
        ▼                     ▼
                        Salva em
                        response_feedback
                        (rating=false)
```

---

## 8. Insights que Você Terá

### A) Tópicos Mais Pesquisados
- Quais são as maiores dúvidas dos usuários?
- Onde investir em melhorar a documentação?
- Quais procedimentos precisam de mais material?

### B) Problemas nas Respostas
- Quais tipos de pergunta geram mais feedback negativo?
- A CLARA está desatualizada em algum tema?
- Quais respostas estão incompletas?

### C) Satisfação Geral
- Tendência ao longo do tempo
- Comparativo por período
- Impacto de melhorias na base

### D) Dados Exportáveis
- CSV com todas as queries
- CSV com todos os feedbacks
- Análise externa em Excel/Sheets/BI

---

## 9. Segurança e Privacidade

- **Zero identificação de usuários** - nenhum user_id, email ou IP
- **Dados agregados** - foco em padrões, não indivíduos
- **Conformidade LGPD** - dados anônimos por design
- **RLS restritivo** - apenas admins acessam dados

---

## 10. Resumo de Alterações

| Camada | Tipo | Descrição |
|--------|------|-----------|
| Database | Nova tabela | `query_analytics` |
| Database | Nova tabela | `response_feedback` |
| Database | RLS | Políticas de acesso anônimo/admin |
| Frontend | Componente | FeedbackButtons + Modal |
| Frontend | Hook | useFeedback + useQueryTracking |
| Frontend | Modificação | ChatMessage com botões |
| Admin | Nova aba | Analytics com métricas |
| Admin | Componente | Gráficos + tabelas + export |

