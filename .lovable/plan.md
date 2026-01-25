
# Plano: Botões de "Copiar Resposta" e "Baixar como PDF"

## Contexto

O botão de **Copiar** já existe e funciona bem! Vamos apenas:
1. Melhorar sua visibilidade
2. Adicionar o botão **Baixar como PDF** ao lado

---

## 1. Dependência a Instalar

```bash
npm install jspdf
```

`jspdf` é a biblioteca mais popular e leve (~280KB gzipped) para gerar PDFs no browser.

---

## 2. Novo Componente: DownloadPdfButton.tsx

Um botão similar ao CopyButton, mas que gera e baixa um PDF com:
- Cabeçalho: "CLARA - Assistente SEI & SDP"
- Data e hora da consulta
- Pergunta do usuário
- Resposta da CLARA (formatada)
- Rodapé: "Gerado automaticamente pela CLARA - 4ª CRE"

### Estrutura do PDF

```text
┌──────────────────────────────────────────────────────┐
│  CLARA - Assistente SEI & SDP                        │
│  Data: 25/01/2026 às 14:32                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Sua pergunta:                                       │
│  "Como criar um despacho de férias no SEI?"         │
│                                                      │
│  Resposta:                                           │
│  Para criar um despacho de férias no SEI, siga      │
│  os passos:                                          │
│  1. Acesse o processo de férias                     │
│  2. Clique em "Incluir Documento"                   │
│  3. Selecione "Despacho"                            │
│  ...                                                 │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Gerado automaticamente pela CLARA - 4ª CRE         │
└──────────────────────────────────────────────────────┘
```

---

## 3. Modificações em ChatMessage.tsx

Atualizar a seção de ações (linha 380-390) para incluir:
- CopyButton (já existe)
- **DownloadPdfButton** (novo)
- FeedbackButtons (já existe)

Também precisamos passar a `userQuery` (pergunta original) para o componente, para incluir no PDF.

---

## 4. Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/chat/DownloadPdfButton.tsx` | Botão para baixar resposta como PDF |

## 5. Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/chat/ChatMessage.tsx` | Adicionar DownloadPdfButton e passar userQuery |
| `src/hooks/useChat.ts` | Expor userQuery junto com cada mensagem |
| `package.json` | Adicionar dependência jspdf |

---

## 6. Interface dos Botões

```text
[Resposta da CLARA...]

[📋 Copiar]  [📄 PDF]  [👍] [👎]
```

### Comportamento do Botão PDF

1. Usuário clica no ícone 📄 (FileDown do Lucide)
2. Mostra animação de loading breve
3. Gera PDF com a biblioteca jspdf
4. Download automático: `clara-resposta-2026-01-25.pdf`
5. Toast: "PDF baixado com sucesso!"

---

## 7. Código do DownloadPdfButton (Resumo)

```typescript
import { jsPDF } from "jspdf";
import { FileDown, Check } from "lucide-react";

interface DownloadPdfButtonProps {
  userQuery: string;
  assistantResponse: string;
  timestamp: Date;
}

export function DownloadPdfButton({ userQuery, assistantResponse, timestamp }: DownloadPdfButtonProps) {
  const handleDownload = useCallback(() => {
    const doc = new jsPDF();
    
    // Cabeçalho
    doc.setFontSize(18);
    doc.text("CLARA - Assistente SEI & SDP", 20, 20);
    
    // Data
    doc.setFontSize(10);
    doc.text(`Gerado em: ${timestamp.toLocaleString("pt-BR")}`, 20, 28);
    
    // Pergunta
    doc.setFontSize(12);
    doc.text("Sua pergunta:", 20, 40);
    doc.setFontSize(11);
    const queryLines = doc.splitTextToSize(userQuery, 170);
    doc.text(queryLines, 20, 48);
    
    // Resposta
    const startY = 48 + (queryLines.length * 6) + 10;
    doc.setFontSize(12);
    doc.text("Resposta:", 20, startY);
    doc.setFontSize(11);
    
    // Limpar markdown para texto puro
    const cleanText = assistantResponse
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .replace(/#{1,6}\s/g, "");
    
    const responseLines = doc.splitTextToSize(cleanText, 170);
    doc.text(responseLines, 20, startY + 8);
    
    // Rodapé
    doc.setFontSize(8);
    doc.text("Gerado automaticamente pela CLARA - 4ª CRE", 20, 285);
    
    // Download
    doc.save(`clara-resposta-${timestamp.toISOString().split("T")[0]}.pdf`);
  }, [userQuery, assistantResponse, timestamp]);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button onClick={handleDownload}>
          <FileDown className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Baixar como PDF</TooltipContent>
    </Tooltip>
  );
}
```

---

## 8. Passando userQuery para ChatMessage

Atualmente, cada mensagem não sabe qual foi a pergunta original. Precisamos:

1. No `useChat.ts`, ao adicionar uma resposta do assistant, guardar também a `userQuery` da mensagem anterior
2. No tipo `ChatMessage`, adicionar campo opcional `userQuery?: string`
3. No `ChatMessage.tsx`, passar para o `DownloadPdfButton`

---

## 9. Cenário de Uso

```text
Usuário: "Como redigir um despacho de férias?"

CLARA: "Para redigir um despacho de férias no SEI, siga os passos:
1. Acesse o processo de férias do servidor
2. Clique em 'Incluir Documento'
3. Selecione o tipo 'Despacho'
..."

[📋 Copiar]  [📄 PDF]  [👍] [👎]

→ Clica em 📋: Copia o texto para colar no SEI
→ Clica em 📄: Baixa PDF formatado para arquivar
```

---

## 10. Resumo de Alterações

| Camada | Tipo | Descrição |
|--------|------|-----------|
| Dependência | Instalar | `jspdf` para geração de PDF |
| Frontend | Criar | `DownloadPdfButton.tsx` |
| Frontend | Modificar | `ChatMessage.tsx` - adicionar botão PDF |
| Frontend | Modificar | `useChat.ts` - incluir userQuery nas mensagens |
| Tipos | Modificar | `ChatMessage` type - adicionar campo userQuery |

---

## 11. Benefícios para os Servidores

- **Copiar**: Cola direto no SEI para redigir documentos
- **PDF**: Arquiva a orientação para referência futura
- **Formalização**: Documento com data e hora para comprovar consulta
- **Auditoria**: Registro da orientação recebida
