

# Plano: Corrigir Bug na Função isDocumentStuck

## Problema Identificado

A função `isDocumentStuck` (linha 111-122) usa incorretamente `doc.created_at` para calcular há quanto tempo o documento está em processamento:

```typescript
// BUG - linha 117
const updatedAt = new Date(doc.created_at);  // ❌ Deveria ser updated_at
```

Isso significa que o sistema nunca detecta corretamente quando um documento está "travado", pois compara com a data de criação em vez da última atualização.

---

## Correção Necessária

### 1. Adicionar `updated_at` à Interface Document

**Arquivo**: `src/pages/Admin.tsx` (linhas 40-55)

```typescript
interface Document {
  id: string;
  title: string;
  category: string;
  file_path: string;
  created_at: string;
  updated_at: string;  // ← ADICIONAR
  chunk_count?: number;
  status?: string;
  // ... resto igual
}
```

### 2. Corrigir a Função isDocumentStuck

**Arquivo**: `src/pages/Admin.tsx` (linha 117)

```typescript
// ANTES (bug):
const updatedAt = new Date(doc.created_at);

// DEPOIS (correto):
const updatedAt = new Date(doc.updated_at || doc.created_at);
```

O fallback para `created_at` garante compatibilidade caso algum documento antigo não tenha `updated_at`.

---

## Impacto da Correção

| Antes | Depois |
|-------|--------|
| Documentos travados não são detectados | Documentos sem atualização por 5+ minutos mostram botão "Retry" |
| Botão Retry não aparece | UI exibe corretamente status "Travado" |
| Administrador não pode reprocessar | Possível reprocessar documentos problemáticos |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Admin.tsx` | Adicionar `updated_at` à interface + corrigir função |

---

## Validação

Após a correção:
1. O documento "SEI-Guia-do-usuario-Versao-final" deve mostrar badge "Travado" (amarelo/laranja)
2. O botão "Retry" deve aparecer para esse documento
3. Clicar em Retry deve reiniciar o processamento

