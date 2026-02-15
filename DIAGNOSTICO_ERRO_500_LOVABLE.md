# 🚨 Diagnóstico e Correção: Erro 500 "Ambos os Provedores Falharam"

**Projeto:** CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas  
**Plataforma:** Supabase (Edge Functions) + Vercel (frontend)  
**Data:** 28 de Janeiro de 2026  
**Status:** 🔴 CRÍTICO - Chat não funciona em produção  
**Autor:** Documento legado (gerado por agente automatizado)

> **Atualização (2026-02-15):** o projeto não depende mais do Lovable AI Gateway. O contrato do chat foi alinhado para SSE (`text/event-stream`) e o backend deve ser mantido via deploy das Edge Functions no Supabase. Use este documento como referência histórica para debug de erro 500, mas valide as variáveis/secrets e o contrato atual.

---

## 📋 Sumário Executivo

O chatbot CLARA está retornando **erro 500 "ambos os provedores falharam"** em produção, mesmo após 6 melhorias arquiteturais implementadas em 28/01/2026. Este documento apresenta diagnóstico sistemático em 3 camadas (Gemini API, Edge Function, Base de Conhecimento) com código pronto para testar e corrigir cada hipótese.

**Contexto Arquitetural:**
- **Stack:** Supabase (PostgreSQL + Edge Functions Deno) + Gemini 2.0 Flash
- **Fluxo do Chat:** Frontend → Edge Function `clara-chat` → Gemini API (via Lovable AI Gateway ou API direta) → PostgreSQL (busca vetorial) → Resposta
- **Limitações Conhecidas:** 
  - Edge Functions: 60s timeout, 150MB memória, 6MB payload
  - Gemini Free Tier: 15 RPM, 1M TPM, 1.500 RPD

---

## 🔍 Análise do Erro

### **Sintoma Reportado**

```
Erro 500: "Ambos os provedores falharam"
```

**Interpretação:** A mensagem "ambos os provedores" sugere que o sistema tentou duas rotas alternativas (provavelmente Lovable AI Gateway e API direta do Gemini) e ambas falharam.

### **Contexto Técnico do Relatório (28/01/2026)**

O relatório técnico mostra que foram implementadas melhorias em:

1. **Blindagem de Dependências:** Todas as Edge Functions agora usam `import_map.json` com versões padronizadas (`@google/generative-ai@0.21.0`)
2. **Segurança RLS:** Políticas endurecidas, URLs assinadas com log de auditoria
3. **Ingestão Idempotente:** Sistema de batches com hash SHA-256 para evitar duplicação
4. **Busca Vetorial Otimizada:** Índice HNSW recriado com parâmetros `m=16, ef_construction=64`
5. **Observabilidade:** Novas tabelas `search_metrics` e `processing_metrics`

**Porém, nenhuma dessas melhorias trata diretamente de:**
- Validação de API Keys do Gemini
- Tratamento de rate limits
- Fallback robusto entre provedores
- Logs detalhados de erro

---

## 🎯 Hipóteses Priorizadas

### **Hipótese 1: Gemini API Key Inválida ou Expirada** (Probabilidade: 70%)

**Evidências:**
- Erro menciona "ambos os provedores" → Lovable AI Gateway E API direta falharam
- Ambos dependem de `GOOGLE_GENERATIVE_AI_API_KEY`
- Relatório não menciona validação de API Key

**Como Testar:**

```typescript
// Criar arquivo: supabase/functions/test-gemini-key/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req: Request) => {
  const apiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API Key não configurada" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[TEST] API Key presente: ${apiKey.slice(0, 10)}...`);

  try {
    // Teste 1: Validar formato da API Key
    if (!apiKey.startsWith("AIza")) {
      return new Response(
        JSON.stringify({ 
          error: "API Key com formato inválido",
          expected: "AIza...",
          actual: apiKey.slice(0, 10)
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Teste 2: Fazer requisição simples ao Gemini
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Responda apenas 'OK' se você estiver funcionando." }],
            },
          ],
        }),
      }
    );

    const responseText = await response.text();
    console.log(`[TEST] Gemini response status: ${response.status}`);
    console.log(`[TEST] Gemini response body: ${responseText}`);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Gemini API rejeitou a requisição",
          status: response.status,
          body: responseText,
          possibleCauses: [
            response.status === 401 ? "API Key inválida" : null,
            response.status === 403 ? "API Key sem permissão para gemini-2.0-flash-exp" : null,
            response.status === 429 ? "Rate limit atingido (15 RPM no free tier)" : null,
            response.status === 404 ? "Modelo não existe ou não disponível" : null,
          ].filter(Boolean),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(responseText);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(
      JSON.stringify({
        success: true,
        message: "✅ Gemini API está funcionando",
        apiKeyPrefix: apiKey.slice(0, 10),
        model: "gemini-2.0-flash-exp",
        response: text,
        fullResponse: result,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[TEST] Error:`, err);
    return new Response(
      JSON.stringify({
        error: "Exceção ao chamar Gemini API",
        message: (err as Error).message,
        stack: (err as Error).stack,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

**Como Executar:**

```bash
# 1. Deploy da Edge Function de teste
supabase functions deploy test-gemini-key

# 2. Chamar endpoint
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/test-gemini-key

# 3. Verificar logs
supabase functions logs test-gemini-key
```

**Possíveis Resultados:**

| Status | Mensagem | Causa | Solução |
|--------|----------|-------|---------|
| 401 | "API Key inválida" | Key expirada ou digitada errado | Gerar nova key em [Google AI Studio](https://aistudio.google.com/apikey) |
| 403 | "Sem permissão para gemini-2.0-flash-exp" | Modelo não disponível na região | Trocar para `gemini-1.5-flash` ou `gemini-2.0-flash-thinking-exp` |
| 404 | "Modelo não existe" | Nome do modelo errado | Verificar modelos disponíveis na [documentação](https://ai.google.dev/gemini-api/docs/models) |
| 429 | "Rate limit atingido" | Mais de 15 requisições/minuto | Implementar fila ou usar Gemini Pro (pago) |
| 500 | "Exceção ao chamar API" | Timeout ou erro de rede | Aumentar timeout ou usar retry logic |

---

### **Hipótese 2: Edge Function clara-chat Está com Timeout ou Erro de Memória** (Probabilidade: 20%)

**Evidências:**
- Edge Functions têm limite de 60s de execução
- Busca vetorial + geração de embedding + chamada ao Gemini pode exceder 60s
- Relatório menciona otimização HNSW mas não menciona timeout

**Como Testar:**

```typescript
// Adicionar logs detalhados em: supabase/functions/clara-chat/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

serve(async (req: Request) => {
  const startTime = Date.now();
  const logTiming = (step: string) => {
    const elapsed = Date.now() - startTime;
    console.log(`[TIMING] ${step}: ${elapsed}ms`);
    
    // Alerta se estiver perto do timeout
    if (elapsed > 50000) {
      console.warn(`[TIMEOUT RISK] ${step} levou ${elapsed}ms (limite: 60000ms)`);
    }
  };

  try {
    logTiming("START");

    // 1. Parse do body
    const { message, conversationHistory } = await req.json();
    logTiming("PARSE_BODY");

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[CLARA] Received message: ${message.slice(0, 100)}...`);

    // 2. Gerar embedding da pergunta
    logTiming("START_EMBEDDING");
    const embeddingRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || "",
        },
        body: JSON.stringify({
          content: { parts: [{ text: message }] },
        }),
      }
    );

    if (!embeddingRes.ok) {
      const errorText = await embeddingRes.text();
      console.error(`[CLARA] Embedding error: ${embeddingRes.status} - ${errorText}`);
      throw new Error(`Embedding failed: ${embeddingRes.status}`);
    }

    const embeddingData = await embeddingRes.json();
    const embedding = embeddingData.embedding?.values;

    if (!embedding || embedding.length === 0) {
      throw new Error("Empty embedding returned");
    }

    logTiming("EMBEDDING_COMPLETE");

    // 3. Busca vetorial
    logTiming("START_VECTOR_SEARCH");
    const { data: chunks, error: searchError } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 10,
      }
    );

    if (searchError) {
      console.error(`[CLARA] Vector search error:`, searchError);
      throw new Error(`Vector search failed: ${searchError.message}`);
    }

    logTiming("VECTOR_SEARCH_COMPLETE");
    console.log(`[CLARA] Found ${chunks?.length || 0} relevant chunks`);

    // 4. Construir contexto
    const context = chunks
      ?.map((c: any) => `[${c.document_title}] ${c.content}`)
      .join("\n\n") || "";

    logTiming("CONTEXT_BUILT");

    // 5. Chamar Gemini para gerar resposta
    logTiming("START_GEMINI_GENERATION");
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Você é CLARA, assistente de legislação do SEI!RIO.\n\nContexto dos documentos:\n${context}\n\nPergunta: ${message}\n\nResponda de forma clara e cite as fontes.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error(`[CLARA] Gemini generation error: ${geminiRes.status} - ${errorText}`);
      throw new Error(`Gemini generation failed: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    logTiming("GEMINI_GENERATION_COMPLETE");

    // 6. Retornar resposta
    const totalTime = Date.now() - startTime;
    console.log(`[CLARA] ✅ Request completed in ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        answer,
        sources: chunks?.map((c: any) => ({
          title: c.document_title,
          similarity: c.similarity,
        })),
        metrics: {
          total_time_ms: totalTime,
          chunks_found: chunks?.length || 0,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`[CLARA] ❌ Error after ${totalTime}ms:`, err);

    return new Response(
      JSON.stringify({
        error: "Ambos os provedores falharam",
        details: (err as Error).message,
        time_elapsed_ms: totalTime,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

**Como Analisar Logs:**

```bash
# Visualizar logs em tempo real
supabase functions logs clara-chat --follow

# Buscar por timeouts
supabase functions logs clara-chat | grep "TIMEOUT RISK"

# Buscar por erros
supabase functions logs clara-chat | grep "❌"
```

**Interpretação dos Logs:**

| Etapa | Tempo Normal | Tempo Crítico | Ação |
|-------|--------------|---------------|------|
| PARSE_BODY | < 10ms | > 100ms | Reduzir tamanho do payload |
| EMBEDDING_COMPLETE | 200-500ms | > 2000ms | API do Gemini lenta ou rate limit |
| VECTOR_SEARCH_COMPLETE | 50-200ms | > 1000ms | Índice HNSW precisa ser reconstruído |
| CONTEXT_BUILT | < 50ms | > 500ms | Muitos chunks (reduzir `match_count`) |
| GEMINI_GENERATION_COMPLETE | 1000-3000ms | > 10000ms | Contexto muito grande ou modelo lento |
| **TOTAL** | **2000-5000ms** | **> 50000ms** | **RISCO DE TIMEOUT** |

---

### **Hipótese 3: Base de Conhecimento Vazia (0 Documentos Indexados)** (Probabilidade: 10%)

**Evidências:**
- Relatório menciona melhorias em ingestão mas não confirma que documentos foram processados
- Se `document_chunks` estiver vazia, busca vetorial retorna 0 resultados
- Gemini sem contexto pode recusar responder ou dar erro

**Como Testar:**

```sql
-- Executar no Supabase SQL Editor

-- 1. Verificar quantos documentos existem
SELECT COUNT(*) as total_documents FROM public.documents;

-- 2. Verificar quantos chunks existem
SELECT COUNT(*) as total_chunks FROM public.document_chunks;

-- 3. Verificar se embeddings foram gerados
SELECT 
  COUNT(*) as chunks_with_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NULL) as chunks_without_embeddings
FROM public.document_chunks;

-- 4. Verificar documentos por status
SELECT 
  status,
  COUNT(*) as count
FROM public.documents
GROUP BY status;

-- 5. Verificar últimos erros de processamento
SELECT 
  document_id,
  step,
  error_message,
  created_at
FROM public.processing_metrics
WHERE success = false
ORDER BY created_at DESC
LIMIT 10;
```

**Resultados Esperados:**

| Cenário | total_documents | total_chunks | chunks_with_embeddings | Diagnóstico |
|---------|-----------------|--------------|------------------------|-------------|
| ✅ OK | > 0 | > 100 | = total_chunks | Base de conhecimento populada |
| ⚠️ Parcial | > 0 | > 0 | < total_chunks | Alguns embeddings falharam |
| 🔴 Vazio | 0 | 0 | 0 | **Nenhum documento foi indexado** |
| 🔴 Sem Embeddings | > 0 | > 100 | 0 | **Embeddings não foram gerados** |

**Solução se Base Estiver Vazia:**

```typescript
// Criar script de seed: scripts/seed-knowledge-base.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAMPLE_DOCUMENTS = [
  {
    title: "Manual do SEI - Tramitação de Processos",
    content: `
# Tramitação de Processos no SEI

## 1. Como tramitar um processo

Para tramitar um processo no SEI, siga os passos:

1. Abra o processo desejado
2. Clique em "Enviar Processo"
3. Selecione a unidade de destino
4. Adicione observações se necessário
5. Clique em "Enviar"

## 2. Tipos de tramitação

- **Tramitação simples:** Envia o processo para outra unidade
- **Tramitação externa:** Envia para órgão externo
- **Tramitação em bloco:** Envia múltiplos processos de uma vez
    `,
  },
  {
    title: "Manual do SEI - Criação de Documentos",
    content: `
# Criação de Documentos no SEI

## 1. Tipos de documentos

O SEI permite criar diversos tipos de documentos:

- Ofício
- Memorando
- Despacho
- Parecer
- Declaração

## 2. Como criar um documento

1. Abra o processo
2. Clique em "Incluir Documento"
3. Escolha o tipo de documento
4. Preencha os campos obrigatórios
5. Clique em "Salvar"
    `,
  },
];

async function seedKnowledgeBase() {
  console.log("🌱 Iniciando seed da base de conhecimento...");

  for (const doc of SAMPLE_DOCUMENTS) {
    console.log(`\n📄 Processando: ${doc.title}`);

    // 1. Criar documento
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        title: doc.title,
        file_path: `seed/${doc.title.toLowerCase().replace(/\s+/g, "-")}.txt`,
        status: "completed",
      })
      .select()
      .single();

    if (docError) {
      console.error(`❌ Erro ao criar documento: ${docError.message}`);
      continue;
    }

    console.log(`✅ Documento criado: ${document.id}`);

    // 2. Dividir em chunks
    const chunkSize = 500;
    const chunks: string[] = [];
    for (let i = 0; i < doc.content.length; i += chunkSize) {
      chunks.push(doc.content.slice(i, i + chunkSize));
    }

    console.log(`📦 Criando ${chunks.length} chunks...`);

    // 3. Gerar embeddings e inserir chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Gerar embedding
      const embeddingRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
          },
          body: JSON.stringify({
            content: { parts: [{ text: chunk }] },
          }),
        }
      );

      if (!embeddingRes.ok) {
        console.error(`❌ Erro ao gerar embedding para chunk ${i}`);
        continue;
      }

      const embeddingData = await embeddingRes.json();
      const embedding = embeddingData.embedding?.values;

      // Inserir chunk
      const { error: chunkError } = await supabase
        .from("document_chunks")
        .insert({
          document_id: document.id,
          content: chunk,
          chunk_index: i,
          embedding: embedding,
        });

      if (chunkError) {
        console.error(`❌ Erro ao inserir chunk ${i}: ${chunkError.message}`);
      } else {
        console.log(`✅ Chunk ${i + 1}/${chunks.length} inserido`);
      }
    }
  }

  console.log("\n🎉 Seed concluído!");
}

seedKnowledgeBase();
```

**Como Executar:**

```bash
# 1. Instalar dependências
npm install @supabase/supabase-js

# 2. Configurar variáveis de ambiente
export SUPABASE_URL="https://seu-projeto.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
export GOOGLE_GENERATIVE_AI_API_KEY="sua-gemini-api-key"

# 3. Executar seed
npx tsx scripts/seed-knowledge-base.ts
```

---

## 🛠️ Plano de Ação Imediato

### **Passo 1: Validar API Key do Gemini** (5 minutos)

```bash
# Deploy da função de teste
supabase functions deploy test-gemini-key

# Testar
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/test-gemini-key

# Se falhar com 401/403: Gerar nova API Key em https://aistudio.google.com/apikey
# Se falhar com 429: Aguardar 1 minuto ou implementar rate limiting
```

---

### **Passo 2: Adicionar Logs Detalhados no clara-chat** (10 minutos)

1. Copiar código da **Hipótese 2** acima
2. Substituir conteúdo de `supabase/functions/clara-chat/index.ts`
3. Deploy: `supabase functions deploy clara-chat`
4. Testar chat e verificar logs: `supabase functions logs clara-chat --follow`

**Interpretar logs:**
- Se parar em `START_EMBEDDING`: Problema com Gemini API
- Se parar em `VECTOR_SEARCH_COMPLETE`: Problema com PostgreSQL ou índice HNSW
- Se parar em `GEMINI_GENERATION_COMPLETE`: Problema com geração de resposta

---

### **Passo 3: Verificar Base de Conhecimento** (2 minutos)

```sql
-- Executar no Supabase SQL Editor
SELECT 
  (SELECT COUNT(*) FROM public.documents) as total_documents,
  (SELECT COUNT(*) FROM public.document_chunks) as total_chunks,
  (SELECT COUNT(*) FROM public.document_chunks WHERE embedding IS NOT NULL) as chunks_with_embeddings;
```

**Se retornar 0 em qualquer coluna:**
- Executar script de seed da **Hipótese 3**
- Ou fazer upload manual de PDFs via Admin

---

### **Passo 4: Implementar Fallback Robusto** (30 minutos)

```typescript
// Adicionar em: supabase/functions/clara-chat/index.ts

async function callGeminiWithFallback(
  prompt: string,
  apiKey: string
): Promise<string> {
  const models = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      console.log(`[FALLBACK] Tentando modelo: ${model}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log(`[FALLBACK] ✅ Sucesso com modelo: ${model}`);
        return text;
      }

      // Se 429 (rate limit), aguardar e tentar próximo modelo
      if (response.status === 429) {
        console.warn(`[FALLBACK] Rate limit no modelo ${model}, tentando próximo...`);
        continue;
      }

      // Se 404 (modelo não existe), tentar próximo
      if (response.status === 404) {
        console.warn(`[FALLBACK] Modelo ${model} não disponível, tentando próximo...`);
        continue;
      }

      // Outros erros: lançar exceção
      const errorText = await response.text();
      throw new Error(`${model} falhou: ${response.status} - ${errorText}`);
    } catch (err) {
      lastError = err as Error;
      console.error(`[FALLBACK] Erro no modelo ${model}:`, lastError.message);
    }
  }

  // Se chegou aqui, todos os modelos falharam
  throw new Error(
    `Ambos os provedores falharam. Último erro: ${lastError?.message}`
  );
}
```

---

## 📊 Checklist de Validação

Após implementar as correções, validar:

| Item | Teste | Resultado Esperado |
|------|-------|-------------------|
| ✅ API Key | `curl test-gemini-key` | Status 200, "✅ Gemini API está funcionando" |
| ✅ Logs Detalhados | `supabase functions logs clara-chat` | Logs [TIMING] aparecem |
| ✅ Base de Conhecimento | Query SQL acima | total_documents > 0, total_chunks > 100 |
| ✅ Chat End-to-End | Enviar mensagem no frontend | Resposta em < 10s com citações |
| ✅ Fallback | Desabilitar gemini-2.0-flash-exp | Sistema usa gemini-1.5-flash automaticamente |
| ✅ Rate Limit | Enviar 20 mensagens em 1 minuto | Sistema aguarda ou usa modelo alternativo |

---

## 🚀 Melhorias de Longo Prazo

### **1. Implementar Fila de Requisições**

```typescript
// Criar tabela de fila
CREATE TABLE public.chat_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

// Criar worker que processa fila
// supabase/functions/chat-worker/index.ts
// Processa 1 requisição por vez, respeitando rate limit de 15 RPM
```

### **2. Implementar Cache de Respostas**

```sql
CREATE TABLE public.chat_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT UNIQUE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources JSONB,
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_cache_hash ON public.chat_cache(question_hash);
```

### **3. Implementar Circuit Breaker**

```typescript
// Parar de chamar Gemini se taxa de erro > 50% em 5 minutos
// Retornar mensagem amigável: "Sistema temporariamente indisponível"
```

### **4. Migrar para Gemini Pro (Pago)**

| Plano | RPM | TPM | RPD | Custo |
|-------|-----|-----|-----|-------|
| Free | 15 | 1M | 1.500 | $0 |
| Pro | 1.000 | 4M | Ilimitado | $7/1M tokens |

**ROI:** Se chat receber > 1.000 mensagens/dia, vale a pena migrar para Pro.

---

## 📞 Suporte e Próximos Passos

### **Se Erro Persistir Após Todas as Correções:**

1. **Exportar logs completos:**
   ```bash
   supabase functions logs clara-chat --limit 1000 > logs.txt
   ```

2. **Verificar status do Supabase:**
   - https://status.supabase.com/

3. **Verificar status do Google AI:**
   - https://status.cloud.google.com/

4. **Abrir ticket no Supabase:**
   - https://supabase.com/support

### **Contato para Análise Detalhada:**

Se precisar de análise mais profunda, compartilhe:
- Logs da Edge Function `clara-chat` (últimas 100 linhas)
- Screenshot do erro no frontend
- Resultado da query SQL de validação da base de conhecimento
- Resultado do teste de API Key

---

## 📚 Referências

1. [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
2. [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
3. [PostgreSQL pgvector HNSW Index](https://github.com/pgvector/pgvector#hnsw)
4. [Google AI Studio - API Keys](https://aistudio.google.com/apikey)

---

**Última atualização:** 28 de Janeiro de 2026  
**Status:** 🟢 Pronto para Implementação  
**Tempo Estimado de Correção:** 1-2 horas
