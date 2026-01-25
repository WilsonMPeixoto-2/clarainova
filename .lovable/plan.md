
# Plano: Atualização Completa de Branding - CLARA Independente

## Contexto

A CLARA está evoluindo de uma ferramenta específica da 4ª CRE para uma **plataforma independente** que pode ser usada por todos os servidores da prefeitura. Isso requer remover referências institucionais específicas (4ª CRE, SME) e também a referência exclusiva ao SDP, já que a CLARA abordará diversos assuntos administrativos.

---

## Elementos Identificados para Atualização

### 1. Arquivos de Metadados e SEO (Alta Prioridade)

| Arquivo | Referências a Remover |
|---------|----------------------|
| `index.html` | "4ª CRE", "SDP" nas meta tags, author |
| `src/components/SEOHead.tsx` | "4ª CRE", "SDP" na description e keywords |
| `src/pages/Index.tsx` | "4ª CRE", "SDP" nas keywords |
| `src/pages/Chat.tsx` | "4ª CRE" na description |

**Novo texto padrão:**
- Description: "Consultora de Legislação e Apoio a Rotinas Administrativas. Sua assistente especializada em sistemas eletrônicos de informação e procedimentos administrativos."
- Keywords: ["legislação", "administração pública", "SEI", "assistente virtual", "CLARA", "inteligência administrativa", "procedimentos administrativos"]
- Author: "CLARA"

---

### 2. Interface do Chat (Alta Prioridade)

| Arquivo | Linha | Texto Atual | Novo Texto |
|---------|-------|-------------|------------|
| `Chat.tsx` | 157 | "Assistente SEI & SDP" | "Inteligência Administrativa" |
| `ChatPanel.tsx` | 153 | "Assistente SEI & SDP" | "Inteligência Administrativa" |
| `ChatPanel.tsx` | 220 | "procedimentos da 4ª CRE" | "procedimentos administrativos" |
| `ChatInput.tsx` | 89 | "procedimentos da 4ª CRE" | "rotinas administrativas" |

---

### 3. System Prompt da IA (Alta Prioridade)

**Arquivo:** `supabase/functions/clara-chat/index.ts`

Este é o **mais crítico** porque define o comportamento da IA. Precisa ser atualizado para:
- Remover referência à "4ª CRE" como escopo principal
- Manter SEI como foco, mas expandir para "sistemas eletrônicos de informação"
- Remover SDP como escopo obrigatório (pode ser uma área de conhecimento, não limitação)
- Ampliar para "procedimentos administrativos em geral"

**Alterações específicas:**
- Linha 36-41: Atualizar escopo de especialização
- Linha 72: Remover "Procedimentos específicos da 4ª CRE"
- Linha 82: Atualizar tratamento de queries fora do escopo
- Linha 91: Remover referência específica à 4ª CRE

---

### 4. Arquivos Públicos HTML (Média Prioridade)

| Arquivo | Seções a Atualizar |
|---------|-------------------|
| `public/sobre.html` | Múltiplas referências à 4ª CRE e SME |
| `public/termos.html` | Linha 147: "rotinas administrativas da 4ª CRE" |
| `public/privacidade.html` | Linha 123: "procedimentos administrativos da 4ª CRE" |
| `public/llm.txt` | Linhas 11-13: Referências à 4ª CRE |

---

### 5. Páginas React Legais (Média Prioridade)

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/pages/Termos.tsx` | 73 | Remover "4ª CRE" |
| `src/pages/Privacidade.tsx` | 54 | Remover "4ª CRE" |

---

### 6. Documentação e Utilitários (Baixa Prioridade)

| Arquivo | Alteração |
|---------|-----------|
| `DOCUMENTATION.md` | Linha 6: Remover "4ª CRE" |
| `supabase/functions/documents/index.ts` | Linha 67: Remover pattern `/4ª\s*CRE/gi` do extrator de keywords |

---

## Nova Identidade de Marca

### Taglines Consistentes

| Contexto | Texto |
|----------|-------|
| **Header/Subtitle** | "Inteligência Administrativa" |
| **Description longa** | "Consultora de Legislação e Apoio a Rotinas Administrativas" |
| **Placeholder input** | "Digite sua pergunta sobre legislação ou rotinas administrativas..." |
| **Welcome message** | "Sua assistente especializada em legislação e procedimentos administrativos." |

### Escopo Atualizado (System Prompt)

```text
Você é a CLARA (Consultora de Legislação e Apoio a Rotinas Administrativas), 
uma assistente virtual especializada em:

1. SEI (Sistema Eletrônico de Informações) - versões SEI!Rio e SEI 4.0
2. Legislação administrativa e normas aplicáveis
3. Procedimentos e rotinas administrativas

Posso ajudar com:
- Criação e tramitação de processos no SEI
- Upload e assinatura de documentos
- Gestão de blocos de assinatura
- Legislação e normativas
- Procedimentos administrativos gerais
- Sistemas de gestão pública
```

---

## Resumo de Alterações por Tipo

| Tipo | Quantidade | Arquivos |
|------|------------|----------|
| **Frontend React** | 7 arquivos | SEOHead, Index, Chat, ChatPanel, ChatInput, Termos, Privacidade |
| **Edge Functions** | 2 arquivos | clara-chat, documents |
| **HTML Públicos** | 3 arquivos | sobre.html, termos.html, privacidade.html |
| **Metadados** | 2 arquivos | index.html, llm.txt |
| **Documentação** | 1 arquivo | DOCUMENTATION.md |

**Total: 15 arquivos**

---

## Ordem de Implementação

1. **index.html** - Meta tags SEO (crítico para Google)
2. **SEOHead.tsx** - Defaults de SEO
3. **clara-chat/index.ts** - System prompt da IA
4. **Chat.tsx** + **ChatPanel.tsx** + **ChatInput.tsx** - Interface do chat
5. **Index.tsx** - SEO da homepage
6. **Termos.tsx** + **Privacidade.tsx** - Páginas legais React
7. **public/*.html** - Páginas estáticas legais
8. **llm.txt** - Documentação para LLMs
9. **documents/index.ts** - Extração de keywords
10. **DOCUMENTATION.md** - Documentação técnica

---

## Benefícios

- **Universalidade**: CLARA pode ser usada por qualquer servidor da prefeitura
- **Flexibilidade**: Não limitada a SEI/SDP - pode expandir para outros sistemas
- **Identidade própria**: Marca independente com estética e cores personalizadas
- **Escalabilidade**: Facilita parcerias com outras secretarias
