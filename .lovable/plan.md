

# Plano de Correção: CLARA Funcional de Ponta a Ponta

## Diagnóstico Real

Apos investigacao exaustiva, encontrei que:

- A Edge Function `clara-chat` **funciona corretamente** (testei diretamente e obtive resposta 200 com conteudo valido)
- O **preview nao carrega** (erro 502), indicando falha no processo de build
- O script de build tenta compilar o servidor Express legado (`esbuild server/_core/index.ts`), que nao e mais necessario com Lovable Cloud
- Os erros que voce viu ("nao consegui gerar uma resposta") ocorreram antes da correcao das chaves de API

## Correções Planejadas

### 1. Simplificar o Build (Causa Raiz do 502)

O `package.json` tem um build script que tenta compilar um servidor Express legado:

```text
"build": "vite build && esbuild server/_core/index.ts ..."
```

Como o projeto usa Lovable Cloud, o servidor Express nao e necessario. O build sera simplificado para apenas:

```text
"build": "vite build"
```

### 2. Tornar a Edge Function Mais Robusta

Adicionar ao `clara-chat`:
- Constante de versao para rastreamento (`VERSION = "v3.0.0"`)
- Validacao de resposta vazia do LLM (tratar `answer === ""` como erro e tentar fallback)
- Logs mais detalhados em cada etapa
- Tratamento especifico para falhas de embedding (continua sem contexto)

### 3. Melhorar o Tratamento de Erros no Frontend

No `Home.tsx`:
- Mostrar mensagens de erro mais descritivas, incluindo detalhes quando disponiveis
- Adicionar botao "Tentar Novamente" nas mensagens de erro
- Tratar especificamente erros 429 (rate limit) e 402 (creditos)
- Mostrar toast com informacao do erro real

### 4. Limpar Codigo Legado

Remover arquivos que nao sao mais usados e causam problemas de build:
- `server/_core/env.ts` (nao importado por nada)
- `server/_core/types/` (tipo legado de OAuth)
- `shared/` (importa de `drizzle/schema` que usa MySQL, nao mais em uso)
- `drizzle/` (schema MySQL legado, o projeto usa Lovable Cloud/PostgreSQL)

## Detalhes Tecnicos

### Build Simplificado (`package.json`)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "vite preview",
    "check": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

### Edge Function com Versionamento e Robustez
```typescript
const VERSION = "v3.0.0";

// Na resposta de sucesso
if (!answer || answer.trim() === "") {
  // Se Lovable AI retornou vazio, tentar Gemini direto
  if (provider === "lovable-ai" && googleApiKey) {
    answer = await generateAnswerGeminiDirect(prompt, googleApiKey);
    provider = "gemini-direct-fallback";
  }
  // Se ainda vazio, retornar mensagem informativa
  if (!answer || answer.trim() === "") {
    answer = "Nao encontrei informacoes suficientes para responder. Reformule sua pergunta.";
  }
}
```

### Frontend com Retry e Mensagens Claras
```typescript
// Ao receber resposta, verificar provider e metricas
if (data.metrics) {
  console.log(`Provider: ${data.metrics.provider}, Tempo: ${data.metrics.total_time_ms}ms`);
}

// Erro com opcao de retry
if (error) {
  // Mostrar toast com detalhes
  // Adicionar botao "Tentar novamente" na mensagem de erro
}
```

### Arquivos a Remover
- `server/_core/env.ts`
- `server/_core/types/cookie.d.ts`
- `server/_core/types/manusTypes.ts`
- `shared/types.ts`
- `shared/_core/errors.ts`
- `shared/const.ts`
- `drizzle/schema.ts`
- `drizzle/relations.ts`
- `drizzle/0000_lovely_mystique.sql`
- `drizzle/0001_tiny_betty_ross.sql`
- `drizzle/meta/` (diretorio inteiro)

## Resultado Esperado

Apos essas correcoes:
1. O preview vai carregar sem erro 502
2. A CLARA vai responder com respostas validas
3. Se houver erro, o usuario vera uma mensagem clara com opcao de tentar novamente
4. O build sera rapido e confiavel

