

# Plano: Corrigir Upload de PDFs na Edge Function

## Resumo do Problema

O upload de documentos PDF está falhando porque a biblioteca `pdf-parse` utiliza `fs.readFileSync`, uma API do Node.js que não está disponível no ambiente Deno das Edge Functions. Isso causa um erro fatal em qualquer tentativa de processar PDFs.

## Solução Proposta

Substituir `pdf-parse` por `pdf-lib`, uma biblioteca moderna e compatível com Deno/browsers que não depende de APIs do Node.js.

---

## Etapas de Implementação

### 1. Atualizar a Edge Function `documents`

**Arquivo:** `supabase/functions/documents/index.ts`

**Mudanças:**
- Remover import do `pdf-parse`
- Adicionar import do `pdf-lib` (compatível com Deno)
- Implementar extração de texto usando `pdf-lib`

**Nova lógica de extração de PDF:**
```text
+-----------------------------+
|   Recebe arquivo PDF        |
+-----------------------------+
             |
             v
+-----------------------------+
|   Carrega com pdf-lib       |
|   (PDFDocument.load)        |
+-----------------------------+
             |
             v
+-----------------------------+
|   Itera páginas e extrai    |
|   texto de cada uma         |
+-----------------------------+
             |
             v
+-----------------------------+
|   Concatena texto extraído  |
|   e continua processamento  |
+-----------------------------+
```

### 2. Limitar tamanho de arquivo no frontend

**Arquivo:** `src/pages/Admin.tsx`

**Mudanças:**
- Adicionar validação de tamanho máximo (20MB)
- Exibir mensagem clara quando arquivo exceder o limite
- Sugerir alternativa (dividir documento ou usar versão mais leve)

### 3. Adicionar melhor tratamento de erros

- Mensagens mais descritivas quando ocorrer falha de rede
- Timeout mais longo para arquivos grandes
- Retry automático em caso de falha temporária

---

## Limitações Conhecidas

1. **Extração de texto de PDFs**: A biblioteca `pdf-lib` extrai texto incorporado no PDF. PDFs escaneados (imagens) não terão texto extraído corretamente.

2. **Tamanho máximo**: Edge Functions têm limite de ~6MB de payload. Para arquivos maiores, seria necessário:
   - Fazer upload direto para o Storage primeiro
   - Processar em background

---

## Resultado Esperado

Após a implementação:
- Upload de PDFs até 20MB funcionará corretamente
- Arquivos DOCX e TXT continuarão funcionando
- Mensagens de erro serão mais claras
- Interface indicará limitações de tamanho

---

## Detalhes Técnicos

### Bibliotecas Afetadas

| Biblioteca Atual | Problema | Substituta |
|------------------|----------|------------|
| `pdf-parse@1.1.1` | Usa `fs.readFileSync` (Node.js) | `pdf-lib` (Deno compatível) |
| `mammoth@1.6.0` | Funciona ✓ | Manter |

### Arquivos a Modificar

1. `supabase/functions/documents/index.ts` - Trocar biblioteca de PDF
2. `src/pages/Admin.tsx` - Adicionar validação de tamanho

### Código de Exemplo (pdf-lib)

```typescript
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

// Carregar PDF
const pdfDoc = await PDFDocument.load(arrayBuffer);
const pages = pdfDoc.getPages();

// Extrair texto (limitado - apenas texto embutido)
let text = "";
for (const page of pages) {
  const content = await page.getTextContent();
  text += content.items.map(item => item.str).join(" ");
}
```

> **Nota importante**: `pdf-lib` é excelente para manipular PDFs, mas sua capacidade de extração de texto é limitada. Para extração robusta de texto de PDFs complexos, uma alternativa seria usar a Google Document AI ou processar via Lovable AI.

