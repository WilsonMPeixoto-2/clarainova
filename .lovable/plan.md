

# Plano: Salvar Relatório de Auditoria Completo no Admin

## Objetivo
Inserir o relatório técnico de auditoria completo na tabela `development_reports` e criar as tags necessárias para categorização.

---

## Análise Atual

### Tags Existentes
| Tag | ID | Usar? |
|-----|-----|-------|
| dev | `7545f2e9-79c6-42bb-b0db-8b8ce6f36bb2` | Sim |

### Tags a Criar
| Tag | Cor Sugerida |
|-----|--------------|
| auditoria | `#dc2626` (vermelho escuro - importância) |
| arquitetura | `#6366f1` (índigo - técnico) |
| documentação | `#14b8a6` (teal - informativo) |

---

## Passos de Implementação

### Passo 1: Criar Tags Faltantes
Inserir 3 novas tags na tabela `report_tags`:
- auditoria (cor: #dc2626)
- arquitetura (cor: #6366f1)  
- documentação (cor: #14b8a6)

### Passo 2: Inserir Relatório
Inserir na tabela `development_reports` com:
- **Título**: "Relatório de Auditoria Completo — CLARA v2.1.0 (01/02/2026)"
- **Conteúdo**: Relatório completo em Markdown (todas as 12 seções)
- **Summary**: Primeiros 150 caracteres para preview

### Passo 3: Vincular Tags
Criar relações na tabela `report_tag_relations` para:
- auditoria
- arquitetura
- dev (existente)
- documentação

---

## Conteúdo do Relatório

O relatório incluirá todas as 12 seções documentadas:

1. Visão Geral do Produto
2. Arquitetura Geral (diagrama textual)
3. Frontend — Inventário Completo
4. Backend — Supabase (Schema, RLS, RPCs, Storage)
5. Edge Functions — Lista Completa
6. Pipeline do Conhecimento
7. Web Search: Escopo e Limitações
8. Observabilidade e Governança
9. Segurança (Threat Model)
10. PWA e Mobile
11. Lista de Pendências e Backlog
12. Mapa de Testes e Critérios de Aceite

Tamanho estimado: ~25.000 caracteres de Markdown

---

## Critérios de Aceite

- Relatório aparece na aba "Relatórios" do Admin
- 4 tags vinculadas visíveis (auditoria, arquitetura, dev, documentação)
- Preview (summary) legível na listagem
- Botão "Visualizar" abre modal com Markdown renderizado
- Botão "Exportar PDF" gera documento sem overflow

---

## Estimativa
- Tempo: ~5 minutos (queries SQL diretas)
- Risco: Zero (apenas inserção de dados)

