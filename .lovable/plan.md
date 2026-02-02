
# Plano: Busca Web Focada para SEI

## Resumo

Sua ideia está excelente! Vamos restringir a busca web a 2-3 sites específicos sobre o SEI, economizando API e acelerando respostas.

---

## Situação Atual

A busca web usa query genérica muito ampla (linha 189 do web-search):
```
query + site:prefeitura.rio OR site:gov.br OR site:leismunicipais.com.br
```

O domínio `gov.br` é enorme, causando:
- Buscas lentas (muitos resultados para filtrar)
- Consumo alto de API
- Resultados menos precisos sobre SEI

---

## Solução Proposta

### 1. Adicionar Domínios SEI ao Banco

Inserir na tabela `trusted_domains` (já existente):

| Domínio | Categoria | Prioridade | Descrição |
|---------|-----------|------------|-----------|
| manuais.processoeletronico.gov.br | primary | 98 | Manual oficial SEI 4.0+ (PEN) |
| processoeletronico.gov.br | primary | 96 | Portal federal PEN/SEI |
| wiki.processoeletronico.gov.br | official_mirror | 94 | Wiki colaborativa SEI |
| portalsei.rs.gov.br | official_mirror | 90 | Portal SEI Rio Grande do Sul |

### 2. Detecção Automática de Contexto SEI

Nova constante com padrões que indicam perguntas sobre SEI:

```text
Padrões SEI detectados:
- "SEI", "processo eletrônico", "PEN"
- "tramitar", "bloco assinatura", "dar ciência"
- "número SEI", "NUP", "protocolo eletrônico"
- "despacho", "minutar", "assinar documento"
- "unidade geradora", "sobrestamento"
```

### 3. Modificar a Busca Web

Alterar a função `searchWithFirecrawl()` para:
- Aceitar parâmetro opcional `domains?: string[]`
- Quando contexto SEI: usar apenas domínios SEI
- Quando contexto geral: manter comportamento atual

**Antes:**
```
query + site:prefeitura.rio OR site:gov.br OR site:leismunicipais.com.br
```

**Depois (contexto SEI):**
```
query + site:manuais.processoeletronico.gov.br OR site:processoeletronico.gov.br OR site:wiki.processoeletronico.gov.br
```

---

## Fluxo de Decisão

```text
Pergunta do usuario
        |
        v
+------------------------+
| Detecta contexto SEI?  |
| (padroes reconhecidos) |
+------------------------+
        |
   SIM  |   NAO
        v        v
+---------------+  +------------------+
| Busca FOCADA  |  | Busca AMPLA      |
| 3 dominios    |  | (comportamento   |
| SEI oficiais  |  |  atual)          |
+---------------+  +------------------+
        |                   |
        v                   v
   Resposta rapida    Resposta normal
   (1-2 segundos)     (3-5 segundos)
```

---

## Arquivos a Modificar

### 1. Migration SQL
Inserir 4 novos domínios SEI na tabela `trusted_domains`

### 2. `supabase/functions/web-search/index.ts`

Adicionar:
- Constante `SEI_PATTERNS` com regex de detecção
- Constante `SEI_DOMAINS` com lista de domínios focados
- Função `detectSEIContext(query)` que retorna `true` se query é sobre SEI
- Modificar `searchWithFirecrawl()` para aceitar domínios customizados
- Modificar `performWebSearch()` para aplicar lógica de contexto

---

## Benefícios Esperados

| Metrica | Antes | Depois |
|---------|-------|--------|
| Latencia busca SEI | 3-5s | 1-2s |
| Chamadas API/mes | Alta | -50% |
| Precisao respostas SEI | Media | Alta |

---

## PDFs do Manual SEI

Os PDFs que você compartilhou (PF e RS) estão bloqueados para scraping, mas podem ser adicionados manualmente:

1. **Baixe os PDFs** no navegador:
   - Manual SEI PF: gov.br/pf/.../manual_do_usuario_sei.pdf
   - Manual SEI RS: portalsei.rs.gov.br/.../manual-sei-v2.pdf

2. **Faça upload via Admin** (/admin → Base de Conhecimento)

3. **O sistema ira:**
   - Extrair texto automaticamente
   - Dividir em chunks semanticos
   - Gerar embeddings para busca

---

## Secao Tecnica

### Constantes a adicionar:

```typescript
// Padroes que indicam contexto SEI
const SEI_PATTERNS = [
  /\bSEI\b/i,
  /processo eletr[oô]nico/i,
  /\bPEN\b/,
  /tramitar|tramita[çc][aã]o/i,
  /bloco.*assinatura|assinatura.*bloco/i,
  /dar ci[eê]ncia|ciencia/i,
  /\bNUP\b/i,
  /minutar|minuta/i,
  /sobrestamento|sobrestar/i,
  /unidade geradora/i,
];

// Dominios focados para busca SEI
const SEI_DOMAINS = [
  "manuais.processoeletronico.gov.br",
  "processoeletronico.gov.br", 
  "wiki.processoeletronico.gov.br",
];
```

### Funcao de deteccao:

```typescript
function detectSEIContext(query: string): boolean {
  return SEI_PATTERNS.some((p) => p.test(query));
}
```

### Modificacao na busca Firecrawl:

```typescript
async function searchWithFirecrawl(
  query: string,
  limit: number,
  domains?: string[]  // NOVO parametro opcional
): Promise<...> {
  // Construir query com dominios especificos
  const siteFilter = domains 
    ? domains.map(d => `site:${d}`).join(" OR ")
    : "site:prefeitura.rio OR site:gov.br OR site:leismunicipais.com.br";
    
  const searchQuery = `${query} ${siteFilter}`;
  // ... resto da funcao
}
```
