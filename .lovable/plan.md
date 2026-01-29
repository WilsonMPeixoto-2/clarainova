
# Plano: Relatório "Chat Premium" + Sistema de Tags e Templates

## Resumo Executivo
Implementar a inserção do relatório consolidado "Chat Premium — Etapa 1" no banco de dados e adicionar funcionalidades de **tags/categorias** e **templates** para organização e agilidade na criação de relatórios futuros.

---

## Parte 1: Inserir Relatório "Chat Premium — Etapa 1"

### Ação
Usar uma migração SQL para inserir o relatório diretamente na tabela `development_reports` com todo o conteúdo formatado em Markdown.

### Conteúdo do Relatório
O relatório completo que você forneceu será formatado e inserido, incluindo:
- Visão geral das mudanças
- Novos componentes criados (ChecklistButton, ResponseNotice)
- Arquivos modificados (ChatMessage, ResponseModeSelector, useChat, index.css, clara-chat)
- Funcionalidades técnicas (Dual-Provider, Web Search Grounding, Rate Limiting)
- Checklist de implementação confirmado
- Logs confirmados
- Próximos passos recomendados

---

## Parte 2: Sistema de Tags/Categorias

### Alterações no Banco de Dados
Criar nova tabela `report_tags` e tabela de relacionamento `report_tag_relations`:

```text
+-------------------+       +------------------------+       +------------------+
| development_      |       | report_tag_relations   |       | report_tags      |
| reports           |       |------------------------|       |------------------|
|-------------------|       | id                     |       | id               |
| id (PK)           |<----->| report_id (FK)         |       | name             |
| title             |       | tag_id (FK)            |<----->| color            |
| content           |       | created_at             |       | created_at       |
| summary           |       +------------------------+       +------------------+
| created_at        |
| updated_at        |
+-------------------+
```

### Tags Pré-definidas
| Tag | Cor | Uso |
|-----|-----|-----|
| `chat` | Azul | Funcionalidades do chat |
| `ux` | Verde | Melhorias de experiência |
| `premium` | Âmbar | Features premium |
| `observabilidade` | Roxo | Monitoramento/logs |
| `seguranca` | Vermelho | Security hardening |
| `performance` | Ciano | Otimizações |
| `database` | Laranja | Alterações no banco |

### Componentes Afetados
1. **ReportsTab.tsx**: Adicionar filtro por tags na busca
2. **ReportFormModal.tsx**: Adicionar seletor de tags com multi-select
3. **ReportViewModal.tsx**: Exibir tags como badges coloridos
4. **Novo arquivo**: `ReportTagSelector.tsx` - componente reutilizável

---

## Parte 3: Sistema de Templates

### Objetivo
Permitir criar relatórios a partir de templates pré-definidos para acelerar a documentação.

### Templates Disponíveis
| Template | Descrição |
|----------|-----------|
| **Etapa de Desenvolvimento** | Estrutura para documentar features completas |
| **Hotfix/Correção** | Template rápido para bugs corrigidos |
| **Relatório de Sprint** | Resumo de período de trabalho |
| **Análise Técnica** | Template para decisões arquiteturais |

### Implementação
1. **Novo arquivo**: `ReportTemplates.tsx` - lista de templates com preview
2. **ReportFormModal.tsx**: Adicionar botão "Usar Template" que preenche o conteúdo
3. **Templates armazenados localmente** (constantes) - não precisa de tabela no banco

### Exemplo de Template "Etapa de Desenvolvimento"
```markdown
# Relatório de Desenvolvimento — CLARA

## Etapa: "[NOME DA ETAPA]"
**Status:** ⏳ Em andamento | ✅ Concluído
**Data:** [DATA]

---

## 1. Visão Geral
[Descreva as principais mudanças e objetivos]

## 2. Componentes Criados
- **ComponenteX.tsx**: [descrição]

## 3. Arquivos Modificados
- **arquivo.tsx**: [mudanças]

## 4. Próximos Passos
- [ ] Item 1
- [ ] Item 2
```

---

## Arquivos a Serem Criados/Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_report_tags.sql` | Criar | Tabelas de tags |
| `supabase/migrations/xxx_insert_chat_premium_report.sql` | Criar | Inserir relatório |
| `src/components/admin/ReportTagSelector.tsx` | Criar | Componente de seleção de tags |
| `src/components/admin/ReportTemplates.tsx` | Criar | Modal/lista de templates |
| `src/components/admin/ReportsTab.tsx` | Modificar | Filtro por tags, exibição de tags |
| `src/components/admin/ReportFormModal.tsx` | Modificar | Seletor de tags + botão template |
| `src/components/admin/ReportViewModal.tsx` | Modificar | Exibir tags como badges |
| `src/integrations/supabase/types.ts` | Auto-atualizado | Tipos das novas tabelas |

---

## Detalhes Técnicos

### Migração SQL - Tags
```sql
-- Tabela de tags
CREATE TABLE report_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'gray',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Relação many-to-many
CREATE TABLE report_tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES development_reports(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES report_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_id, tag_id)
);

-- Tags iniciais
INSERT INTO report_tags (name, color) VALUES
  ('chat', 'blue'),
  ('ux', 'green'),
  ('premium', 'amber'),
  ('observabilidade', 'purple'),
  ('seguranca', 'red'),
  ('performance', 'cyan'),
  ('database', 'orange');
```

### RLS Policies
Ambas as tabelas terão políticas públicas de leitura/escrita já que são tabelas administrativas internas.

---

## Resultado Esperado

1. **Relatório "Chat Premium — Etapa 1"** visível no Admin → Relatórios
2. **Tags coloridas** nos cards de relatório para fácil identificação
3. **Filtro por tag** na busca de relatórios
4. **Botão "Usar Template"** no modal de criação com opções pré-formatadas
5. **Experiência mais ágil** para documentar futuras etapas

---

## Ordem de Execução

1. Criar migração para inserir o relatório Chat Premium
2. Criar migração para sistema de tags
3. Criar componente ReportTagSelector
4. Criar componente ReportTemplates
5. Atualizar ReportsTab com filtro por tags
6. Atualizar ReportFormModal com tags + templates
7. Atualizar ReportViewModal com exibição de tags
