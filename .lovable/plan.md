

# Plano: Sistema Robusto de Extração de PDF Multi-Origem

## Problema Raiz Identificado

A diferença de sucesso entre PDFs gerados pelo Adobe e PDFs gerados pelo Edge/Chrome revela uma fragilidade arquitetural crítica:

**PDFs de diferentes origens têm estruturas de texto internas completamente diferentes:**
- **Adobe Acrobat**: Gera PDFs com camadas de texto nativas bem estruturadas (text layer)
- **Edge/Chrome "Print to PDF"**: Frequentemente converte texto em paths/outlines ou usa encodings de fontes que PDF.js não consegue mapear corretamente
- **Scanners**: Geram imagens sem camada de texto

O sistema atual apenas detecta "PDFs escaneados" (sem texto) vs "PDFs com texto", mas **não detecta PDFs com texto corrompido/gibberish**.

---

## Arquitetura Atual (Diagnóstico)

```text
PDF Upload
    │
    ▼
┌─────────────────────────────────────┐
│  extractPdfTextClient() [PDF.js]   │
│  - Extrai texto via getTextContent │
│  - detectNeedsOcr() verifica:      │
│    • avgCharsPerPage < 50?         │
│    • totalChars < 200?             │
│    • emptyPageRatio > 50%?         │
└─────────────────────────────────────┘
    │
    ├── needsOcr = true ──► Mostra diálogo OCR ──► handleOcrUpload()
    │
    └── needsOcr = false ──► Envia texto para backend
                             (PODE SER GIBBERISH!)
```

**Problema**: Um PDF do Edge pode passar por `detectNeedsOcr()` com texto aparentemente válido (muitos caracteres), mas o conteúdo é ilegível (símbolos estranhos, códigos de fonte, etc.).

---

## Solução Proposta: Pipeline de 3 Camadas

```text
PDF Upload
    │
    ▼
┌─────────────────────────────────────┐
│ CAMADA 1: Extração Primária        │
│ extractPdfTextClient() [PDF.js]    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ CAMADA 2: Validação de Qualidade   │ ◄── NOVA!
│ validateTextQuality()              │
│ - Detecção de gibberish            │
│ - Análise de entropia              │
│ - Contagem de palavras válidas     │
│ - Verificação de patterns comuns   │
└─────────────────────────────────────┘
    │
    ├── qualityOk = true ──► Envia texto para backend
    │
    └── qualityOk = false ──► CAMADA 3
                              │
                              ▼
                  ┌─────────────────────────────┐
                  │ CAMADA 3: OCR Automático    │
                  │ Fallback transparente via   │
                  │ Gemini Vision (sem diálogo) │
                  └─────────────────────────────┘
```

---

## Implementação Detalhada

### Fase 1: Detecção de Qualidade do Texto (Frontend)

**Novo arquivo**: `src/utils/textQualityValidator.ts`

```typescript
interface TextQualityResult {
  isValid: boolean;
  confidence: number; // 0-1
  issues: string[];
  metrics: {
    validWordRatio: number;
    avgWordLength: number;
    alphanumericRatio: number;
    entropyScore: number;
    suspiciousPatterns: number;
  };
  recommendation: 'use_text' | 'try_ocr' | 'ask_user';
}
```

**Heurísticas de detecção:**

1. **Ratio de palavras válidas**: Palavras com 2+ letras consecutivas vs total
2. **Entropia do texto**: Texto normal tem entropia ~4.0-5.0, gibberish tem valores extremos
3. **Patterns suspeitos**: Sequências de caracteres Unicode incomuns (fontes mal mapeadas)
4. **Ratio alfanumérico**: Texto normal tem 70%+ de caracteres alfanuméricos
5. **Tamanho médio de palavras**: Português tem média ~5-6 chars, gibberish varia muito

### Fase 2: Fallback Automático para OCR

**Modificação**: `src/pages/Admin.tsx` - fluxo de upload

```text
Antes:
if (result.needsOcr) → Mostrar diálogo OCR

Depois:
if (result.needsOcr || !textQuality.isValid) {
  if (textQuality.recommendation === 'ask_user') {
    → Mostrar diálogo com preview do problema
  } else {
    → OCR automático transparente (sem intervenção)
  }
}
```

### Fase 3: OCR Híbrido Inteligente

**Modificação**: `supabase/functions/documents/index.ts`

Novo endpoint: `POST /documents/smart-extract`

```typescript
// Estratégia de extração em cascata:
1. Tentar pdfjs-serverless (rápido, gratuito)
2. Validar qualidade do texto extraído
3. Se qualidade baixa → Fallback para Gemini Vision OCR
4. Retornar texto + metadata sobre método usado
```

### Fase 4: Logging e Diagnóstico Avançado

**Novo campo no banco**: `documents.extraction_metadata`

```json
{
  "method": "pdfjs-client" | "pdfjs-server" | "gemini-ocr" | "hybrid",
  "quality_score": 0.85,
  "fallback_used": true,
  "original_chars": 5000,
  "final_chars": 4800,
  "pdf_producer": "Microsoft Print to PDF",
  "pdf_creator": "Microsoft Edge",
  "issues_detected": ["low_word_ratio", "unusual_encoding"]
}
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/utils/textQualityValidator.ts` | CRIAR | Validador de qualidade de texto extraído |
| `src/utils/extractPdfText.ts` | MODIFICAR | Integrar validação de qualidade |
| `src/pages/Admin.tsx` | MODIFICAR | Fallback automático para OCR |
| `supabase/functions/documents/index.ts` | MODIFICAR | Endpoint smart-extract + logging |
| Migração SQL | CRIAR | Campo extraction_metadata na tabela documents |

---

## Detalhamento Técnico

### 1. textQualityValidator.ts

```typescript
// Constantes calibradas para português brasileiro
const QUALITY_THRESHOLDS = {
  MIN_VALID_WORD_RATIO: 0.6,      // 60% das "palavras" devem ser válidas
  MIN_ALPHANUMERIC_RATIO: 0.65,  // 65% de caracteres alfanuméricos
  MAX_AVG_WORD_LENGTH: 15,       // Palavras muito longas = encoding errado
  MIN_AVG_WORD_LENGTH: 2,        // Palavras muito curtas = fragmentação
  ENTROPY_LOW: 3.0,              // Muito baixa = repetição/erro
  ENTROPY_HIGH: 6.0,             // Muito alta = dados binários/lixo
};

// Lista de palavras comuns em PT-BR para validação
const COMMON_WORDS_PT = new Set([
  'de', 'da', 'do', 'que', 'e', 'em', 'um', 'para', 'com', 'não',
  'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como',
  'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou',
  // ... mais palavras
]);

// Detecta patterns de fontes mal mapeadas
const SUSPICIOUS_PATTERNS = [
  /[]{3,}/,              // Sequências de caracteres de controle
  /[\uFFFD]{2,}/,               // Caracteres de substituição
  /[a-zA-Z]{20,}/,              // Palavras absurdamente longas
  /[^\x00-\x7F\xC0-\xFF]{5,}/,  // Sequências de caracteres não-latinos
];
```

### 2. Fluxo de Upload Modificado

```typescript
// Em handleFileUpload()
if (isPdfFile(file)) {
  const extractionResult = await extractPdfTextClient(file, onProgress);
  
  // NOVA VALIDAÇÃO
  const qualityResult = validateTextQuality(extractionResult.fullText, {
    expectedLanguage: 'pt-BR',
    minConfidence: 0.7
  });
  
  console.log(`[Admin] Quality validation:`, {
    isValid: qualityResult.isValid,
    confidence: qualityResult.confidence,
    recommendation: qualityResult.recommendation,
    issues: qualityResult.issues
  });
  
  if (extractionResult.needsOcr || !qualityResult.isValid) {
    if (qualityResult.recommendation === 'ask_user') {
      // Caso ambíguo - mostrar diálogo com preview
      setQualityIssues(qualityResult.issues);
      setShowQualityDialog(true);
    } else {
      // OCR automático (scanned ou texto muito ruim)
      await handleAutomaticOcr(file);
    }
    return;
  }
  
  // Texto válido - continuar fluxo normal
  fullText = extractionResult.fullText;
}
```

### 3. Novo Diálogo de Qualidade

```text
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Problemas Detectados no PDF                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  O texto extraído pode estar corrompido.               │
│                                                         │
│  Problemas encontrados:                                │
│  • Baixa proporção de palavras válidas (45%)           │
│  • Caracteres estranhos detectados                     │
│                                                         │
│  Preview do texto extraído:                            │
│  ┌───────────────────────────────────────────────────┐ │
│  │ "GHI#$%  wqerz asdf ZXCV ..."                     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Recomendação: Usar OCR para extrair texto das         │
│  imagens das páginas.                                  │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  Usar OCR        │  │  Tentar texto extraído  │   │
│  │  (recomendado)   │  │  (pode ter erros)       │   │
│  └──────────────────┘  └──────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4. Migração SQL

```sql
-- Adicionar campo de metadata de extração
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}';

-- Índice para queries de diagnóstico
CREATE INDEX IF NOT EXISTS idx_documents_extraction_method 
ON documents ((extraction_metadata->>'method'));
```

---

## Benefícios

1. **Compatibilidade Universal**: PDFs de qualquer origem (Adobe, Edge, Chrome, LibreOffice, scanners) serão processados corretamente

2. **Transparência para o Usuário**: Na maioria dos casos, o fallback OCR acontece automaticamente sem intervenção

3. **Diagnóstico Avançado**: Metadados de extração permitem identificar padrões de problemas e melhorar o sistema

4. **Custo-Eficiente**: OCR via Gemini só é usado quando necessário (não em todos os PDFs)

5. **Resiliência**: Múltiplas camadas de fallback garantem que algum método sempre funcionará

---

## Estimativa de Esforço

| Fase | Complexidade | Arquivos |
|------|--------------|----------|
| Validador de qualidade | Média | 1 novo |
| Integração no upload | Média | 2 modificados |
| Diálogo de qualidade | Baixa | 1 modificado |
| Logging/metadata | Baixa | 1 migração + 1 modificado |
| Testes end-to-end | Alta | Validação manual |

**Total estimado**: 4-6 iterações de desenvolvimento

