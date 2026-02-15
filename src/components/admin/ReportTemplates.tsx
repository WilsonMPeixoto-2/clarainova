import { FileText, Wrench, Calendar, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  title: string;
  content: string;
}

const today = new Date().toLocaleDateString("pt-BR");

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "development-stage",
    name: "Etapa de Desenvolvimento",
    description: "Estrutura completa para documentar features e melhorias",
    icon: FileText,
    title: "[Nome da Etapa]",
    content: `# Relatório de Desenvolvimento — CLARA

## Etapa: "[NOME DA ETAPA]"
**Status:** ⏳ Em andamento | ✅ Concluído
**Data:** ${today}

---

## 1. Visão Geral
[Descreva as principais mudanças e objetivos desta etapa]

---

## 2. Componentes Criados

### 2.1 [NomeComponente.tsx]
**Caminho:** \`src/components/...\`

**Função:**
- [Descrição da funcionalidade principal]
- [Recursos adicionais]

**Tecnologia:** [React Hooks, APIs utilizadas, etc.]

---

## 3. Arquivos Modificados

### 3.1 [arquivo.tsx]
- [Mudança 1]
- [Mudança 2]

### 3.2 [outro-arquivo.tsx]
- [Mudança 1]

---

## 4. Funcionalidades Técnicas

| Feature | Detalhes |
|---------|----------|
| [Feature 1] | [Descrição] |
| [Feature 2] | [Descrição] |

---

## 5. Checklist de Implementação

| Item | Status | Arquivo |
|------|--------|---------|
| [Item 1] | ✅ | [arquivo] |
| [Item 2] | ⏳ | [arquivo] |

---

## 6. Próximos Passos

- [ ] [Próximo passo 1]
- [ ] [Próximo passo 2]
- [ ] [Próximo passo 3]`,
  },
  {
    id: "hotfix",
    name: "Hotfix / Correção",
    description: "Template rápido para documentar bugs corrigidos",
    icon: Wrench,
    title: "Hotfix: [Descrição breve]",
    content: `# Hotfix — CLARA

## Problema: [Descrição breve do bug]
**Severidade:** 🔴 Crítico | 🟠 Alto | 🟡 Médio | 🟢 Baixo
**Data:** ${today}

---

## 1. Descrição do Problema
[Descreva o comportamento incorreto observado]

### Passos para Reproduzir
1. [Passo 1]
2. [Passo 2]
3. [Resultado incorreto]

### Comportamento Esperado
[O que deveria acontecer]

---

## 2. Causa Raiz
[Explique a causa técnica do problema]

---

## 3. Solução Implementada

### Arquivos Modificados
- **[arquivo.tsx]**: [descrição da mudança]

### Código Alterado
\`\`\`typescript
// Antes
[código antigo]

// Depois
[código novo]
\`\`\`

---

## 4. Testes Realizados
- [x] [Teste 1]
- [x] [Teste 2]

---

## 5. Impacto
[Descreva se há impacto em outras funcionalidades]`,
  },
  {
    id: "sprint-report",
    name: "Relatório de Sprint",
    description: "Resumo de período de trabalho com métricas",
    icon: Calendar,
    title: "Sprint [Número] — [Data Início] a [Data Fim]",
    content: `# Relatório de Sprint — CLARA

## Sprint [Número]
**Período:** [Data Início] a [Data Fim]
**Status:** ✅ Concluído | ⏳ Em andamento

---

## 1. Resumo Executivo
[Visão geral do que foi realizado nesta sprint]

---

## 2. Objetivos da Sprint

| Objetivo | Status | Observações |
|----------|--------|-------------|
| [Objetivo 1] | ✅ | [Notas] |
| [Objetivo 2] | ⏳ | [Notas] |
| [Objetivo 3] | ❌ | [Motivo] |

---

## 3. Features Implementadas

### 3.1 [Feature 1]
- **Descrição:** [breve descrição]
- **Arquivos:** [lista de arquivos]
- **Impacto:** [benefício para o usuário]

### 3.2 [Feature 2]
- **Descrição:** [breve descrição]
- **Arquivos:** [lista de arquivos]
- **Impacto:** [benefício para o usuário]

---

## 4. Bugs Corrigidos
- [Bug 1] - [arquivo afetado]
- [Bug 2] - [arquivo afetado]

---

## 5. Métricas

| Métrica | Valor |
|---------|-------|
| Commits | [número] |
| Arquivos alterados | [número] |
| Linhas adicionadas | [número] |
| Linhas removidas | [número] |

---

## 6. Débitos Técnicos
- [ ] [Débito 1]
- [ ] [Débito 2]

---

## 7. Próxima Sprint
[Objetivos planejados para a próxima sprint]`,
  },
  {
    id: "technical-analysis",
    name: "Análise Técnica",
    description: "Template para decisões arquiteturais e trade-offs",
    icon: Microscope,
    title: "Análise: [Título da Decisão]",
    content: `# Análise Técnica — CLARA

## Decisão: [Título da Decisão Arquitetural]
**Data:** ${today}
**Status:** 📝 Proposta | ✅ Aprovada | ❌ Rejeitada

---

## 1. Contexto
[Descreva o contexto e a necessidade que levou a esta análise]

---

## 2. Problema
[Qual problema estamos tentando resolver?]

---

## 3. Opções Consideradas

### Opção A: [Nome da Opção]
**Descrição:** [Como funcionaria]

**Prós:**
- [Vantagem 1]
- [Vantagem 2]

**Contras:**
- [Desvantagem 1]
- [Desvantagem 2]

**Complexidade:** 🟢 Baixa | 🟡 Média | 🔴 Alta

---

### Opção B: [Nome da Opção]
**Descrição:** [Como funcionaria]

**Prós:**
- [Vantagem 1]
- [Vantagem 2]

**Contras:**
- [Desvantagem 1]
- [Desvantagem 2]

**Complexidade:** 🟢 Baixa | 🟡 Média | 🔴 Alta

---

## 4. Decisão Recomendada
**Opção escolhida:** [Opção X]

**Justificativa:**
[Por que esta opção foi escolhida]

---

## 5. Consequências
[Quais são as implicações desta decisão?]

### Positivas
- [Consequência 1]

### Negativas / Trade-offs
- [Trade-off 1]

---

## 6. Plano de Implementação
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]`,
  },
];

interface ReportTemplatesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: ReportTemplate) => void;
}

export function ReportTemplates({
  open,
  onOpenChange,
  onSelectTemplate,
}: ReportTemplatesProps) {
  const handleSelect = (template: ReportTemplate) => {
    onSelectTemplate(template);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Escolher Template</DialogTitle>
          <DialogDescription>
            Selecione um template para começar seu relatório
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {REPORT_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <Button
                  key={template.id}
                  variant="outline"
                  className="w-full h-auto p-4 flex items-start gap-3 text-left hover:border-primary/50 transition-colors"
                  onClick={() => handleSelect(template)}
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {template.name}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {template.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
