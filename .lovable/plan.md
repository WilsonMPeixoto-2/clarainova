
# Plano: Sistema de Histórico de Relatórios de Desenvolvimento

## O Problema

Quando os relatórios de progresso do projeto (como os resumos das melhorias que fazemos no chat) são muito longos, fica difícil copiar e colar pelo celular. Você precisa de uma forma de **armazenar** e **baixar** esses relatórios posteriormente.

---

## A Solução

Criar um sistema no painel administrativo onde você pode:

1. **Salvar relatórios de desenvolvimento** - Colar ou digitar o conteúdo do relatório
2. **Visualizar histórico** - Ver todos os relatórios salvos organizados por data
3. **Baixar em PDF** - Exportar qualquer relatório individual com branding CLARA
4. **Editar/Excluir** - Gerenciar os relatórios salvos

---

## Como Funcionará

### Fluxo do Administrador

1. Acesse o painel admin (`/admin`)
2. Uma nova aba **"Relatórios"** aparecerá ao lado de "Documentos" e "Analytics"
3. Para salvar um relatório:
   - Clique em "Novo Relatório"
   - Cole o conteúdo do chat (relatório de progresso)
   - Dê um título (ex: "Melhorias de Performance - Janeiro 2026")
   - Clique em "Salvar"
4. Para baixar:
   - Encontre o relatório na lista
   - Clique no ícone de download PDF

---

## Interface Visual

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ← Voltar                    CLARA Admin                            │
├─────────────────────────────────────────────────────────────────────┤
│  [Documentos]    [Analytics]    [📋 Relatórios]                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Relatórios de Desenvolvimento                    [+ Novo Relatório] │
│  ──────────────────────────────────────────────                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📄 Melhorias de Performance Mobile          26/01/2026       │    │
│  │    Otimizações de animação, OG tags, segurança...           │    │
│  │                                         [👁] [📥] [🗑]       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📄 Sistema de Analytics v2                   25/01/2026       │    │
│  │    Dashboard de métricas, gráficos de feedback...           │    │
│  │                                         [👁] [📥] [🗑]       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📄 Implementação de Segurança               24/01/2026       │    │
│  │    Rate limiting, upload robusto, validação admin...        │    │
│  │                                         [👁] [📥] [🗑]       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Modal de Novo Relatório

```text
┌────────────────────────────────────────────────────┐
│  Novo Relatório de Desenvolvimento            [X]  │
├────────────────────────────────────────────────────┤
│                                                     │
│  Título:                                            │
│  ┌────────────────────────────────────────────┐    │
│  │ Melhorias de Performance - Jan 2026        │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  Conteúdo do Relatório:                            │
│  ┌────────────────────────────────────────────┐    │
│  │ Cole aqui o relatório de progresso...      │    │
│  │                                             │    │
│  │ # Resumo das Melhorias                      │    │
│  │                                             │    │
│  │ ## 1. Otimização Mobile                     │    │
│  │ - Animações simplificadas                   │    │
│  │ - Elementos decorativos condicionais        │    │
│  │                                             │    │
│  │ ## 2. OG Tags                               │    │
│  │ - Imagem de compartilhamento                │    │
│  │ ...                                         │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│                            [Cancelar]  [💾 Salvar] │
└────────────────────────────────────────────────────┘
```

---

## Estrutura do PDF Gerado

```text
┌─────────────────────────────────────────────┐
│  [C] CLARA                                   │
│  Relatório de Desenvolvimento                │
│  26/01/2026                                  │
├─────────────────────────────────────────────┤
│                                              │
│  MELHORIAS DE PERFORMANCE - JANEIRO 2026     │
│  ─────────────────────────────────────────   │
│                                              │
│  1. Otimização Mobile                        │
│     • Animações simplificadas para           │
│       dispositivos de baixo desempenho       │
│     • Elementos decorativos condicionais     │
│     • Toque otimizado para botões            │
│                                              │
│  2. OG Tags para Redes Sociais               │
│     • Imagem de compartilhamento 1200x630    │
│     • Metadados Open Graph completos         │
│     • Suporte a Twitter Cards                │
│                                              │
│  3. Segurança Aprimorada                     │
│     • Rate limiting no endpoint admin        │
│     • Upload robusto para mobile             │
│     • Validação de arquivo antes do envio    │
│                                              │
├─────────────────────────────────────────────┤
│  Gerado pela CLARA | Página 1 de 1          │
└─────────────────────────────────────────────┘
```

---

## Implementação Técnica

### 1. Nova Tabela no Banco de Dados

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `title` | TEXT | Título do relatório |
| `content` | TEXT | Conteúdo completo (suporta markdown) |
| `summary` | TEXT | Resumo curto (primeiros 150 caracteres) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

**Políticas RLS**: Acesso público para leitura/escrita (validação feita via admin key no frontend)

### 2. Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/admin/ReportsTab.tsx` | Componente principal da aba de relatórios |
| `src/components/admin/ReportFormModal.tsx` | Modal para criar/editar relatórios |
| `src/components/admin/ReportViewModal.tsx` | Modal para visualizar relatório completo |
| `src/utils/generateReportPdf.ts` | Função de geração de PDF (reutiliza padrões existentes) |

### 3. Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Admin.tsx` | Adicionar nova aba "Relatórios" no TabsList |

### 4. Funcionalidades

- **CRUD Completo**: Criar, Ler, Atualizar e Deletar relatórios
- **Suporte a Markdown**: O conteúdo pode incluir formatação markdown
- **Geração de PDF**: Mesmo estilo visual do `DownloadPdfButton` existente
- **Busca**: Campo de busca para encontrar relatórios antigos
- **Ordenação**: Lista ordenada por data (mais recentes primeiro)
- **Confirmação de Exclusão**: Dialog de confirmação antes de deletar

---

## Resumo

Com essa funcionalidade, você poderá:
1. Copiar os relatórios de progresso do chat
2. Colar no painel admin e salvar com um título
3. Acessar quando quiser, de qualquer dispositivo
4. Baixar em PDF profissional com branding CLARA

Perfeito para documentar o histórico de desenvolvimento do projeto!
