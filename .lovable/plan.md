
# Plano: Processamento de PDFs Grandes via URL

## Resumo do Problema
Quando você tenta fazer upload de PDFs grandes (acima de ~15MB), o sistema trava porque o servidor precisa baixar o arquivo inteiro e converter para um formato especial (base64), o que usa muita memória.

## Solução Proposta
Em vez de baixar o PDF para o servidor, vamos **enviar apenas o link do arquivo** para o serviço de inteligência artificial. Assim, o próprio serviço de IA baixa e processa o arquivo diretamente, sem sobrecarregar o servidor.

**Benefícios:**
- PDFs de até **50MB** poderão ser processados (antes era 15MB)
- Processamento mais rápido (menos etapas)
- Servidor não precisa carregar o arquivo na memória

## O que será alterado

### 1. Função de processamento de documentos
- Ao receber um PDF, gerar um link temporário (válido por 5 minutos)
- Enviar esse link diretamente para o Gemini processar
- Remover o código que baixa e converte o arquivo

### 2. Atualização dos limites no painel Admin
- Aumentar o limite de PDFs de 15MB para 50MB
- Manter validação para outros formatos

### 3. Mensagens de erro mais claras
- Se o PDF for maior que 50MB, orientar a dividir o documento

---

## Detalhes Técnicos

### Mudanças no arquivo `supabase/functions/documents/index.ts`

```text
┌─────────────────────────────────────────────────────────────┐
│ ANTES (método atual)                                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Download do PDF para memória do servidor                 │
│ 2. Converter bytes para base64 (dobra o uso de memória)     │
│ 3. Enviar base64 para Gemini                                │
│ 4. LIMITE: ~15MB (memória estoura com arquivos maiores)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEPOIS (novo método)                                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Gerar URL assinada do arquivo no Storage                 │
│ 2. Enviar URL diretamente para Gemini                       │
│ 3. Gemini acessa e processa o arquivo                       │
│ 4. LIMITE: ~50MB (sem uso de memória do servidor)           │
└─────────────────────────────────────────────────────────────┘
```

### Código principal a ser modificado

**Gerar URL assinada:**
```typescript
const { data: signedUrlData } = await supabase.storage
  .from("knowledge-base")
  .createSignedUrl(filePath, 300); // 5 minutos

const signedUrl = signedUrlData?.signedUrl;
```

**Enviar URL para o Gemini (em vez de base64):**
```typescript
const result = await model.generateContent([
  {
    fileData: {
      mimeType: "application/pdf",
      fileUri: signedUrl  // URL em vez de base64
    }
  },
  { text: "Extraia TODO o texto deste documento..." }
]);
```

### Mudanças no arquivo `src/pages/Admin.tsx`

- Atualizar `MAX_PDF_SIZE` de 15MB para 50MB
- Ajustar mensagens de validação

### Compatibilidade

- **TXT e DOCX**: Continuam funcionando como antes (já são leves)
- **PDFs**: Passam a usar o novo método via URL
- **Fallback**: Se a URL assinada falhar, tentar o método antigo como backup

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/documents/index.ts` | Processar PDF via URL assinada em vez de base64 |
| `src/pages/Admin.tsx` | Aumentar limite de PDF para 50MB |

## Resultado Esperado
Após a implementação, você poderá fazer upload de PDFs de até 50MB sem erros de memória ou timeout.
