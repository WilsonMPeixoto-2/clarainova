
# Correcao e Atualizacao Completa do CLARA

## Diagnostico Completo

Apos investigacao exaustiva de cada arquivo, funcao e servico, foram identificados **9 problemas** organizados por prioridade.

---

## PROBLEMA 1 - CRITICO: Modelo de Embedding Incompativel (causa raiz do erro)

O modelo antigo `text-embedding-004` foi descontinuado pelo Google (erro 404). O modelo substituto `gemini-embedding-001` gera vetores de **3072 dimensoes**, mas a coluna do banco armazena vetores de **768 dimensoes**. Isso causa o erro:

```
different vector dimensions 768 and 3072
```

Resultado: a busca na base de conhecimento falha 100% das vezes.

**Correcao:**
- Atualizar a Edge Function `clara-chat` para usar `gemini-embedding-001` com o parametro `outputDimensionality: 768`
- Criar uma Edge Function auxiliar `re-embed-chunks` que reprocessa os 47 chunks existentes com o novo modelo (mesmas 768 dimensoes, mesmo espaco vetorial)
- O usuario precisa executar a re-indexacao uma unica vez com sua nova chave Gemini

---

## PROBLEMA 2 - CRITICO: Ambos os provedores de IA sem credito

Os logs mostram:
- **Lovable AI Gateway**: Erro 402 "Not enough credits"
- **Gemini direto (fallback)**: Erro 429 "quota exceeded, limit: 0"

**Esclarecimento importante para o usuario:**
- O Lovable AI Gateway esta INCLUSO na assinatura Lovable, mas possui um limite de uso mensal. Ao exceder, e preciso adicionar creditos em Settings > Workspace > Usage. Nao e uma cobranca extra surpresa -- e um limite de consumo.
- A chave Gemini do Google tem cota gratuita limitada que tambem se esgotou.
- O usuario mencionou que pode gerar uma nova chave Gemini. Com isso, o fallback direto voltara a funcionar imediatamente.

**Correcao:**
- Manter a arquitetura atual: Lovable AI Gateway como primario, Gemini direto como fallback
- Melhorar as mensagens de erro para o usuario final, explicando claramente o que aconteceu
- Quando o usuario configurar a nova chave Gemini, o sistema voltara a funcionar via fallback

---

## PROBLEMA 3 - SEGURANCA: 20+ Politicas RLS com acesso anonimo

Tabelas que permitem acesso anonimo indevidamente:

| Tabela | Problema |
|---|---|
| chat_metrics | SELECT por anon |
| chat_sessions | CRUD por anon |
| development_reports | SELECT publico |
| document_access_log | SELECT por anon |
| document_chunks | SELECT publico |
| document_jobs | CRUD por anon |
| documents | SELECT publico |
| frontend_errors | SELECT por anon |
| processing_metrics | SELECT por anon |
| profiles | SELECT/UPDATE por anon |
| query_analytics | SELECT por anon |
| report_tag_relations | SELECT publico |
| report_tags | SELECT publico |
| response_feedback | SELECT por anon |
| search_metrics | SELECT por anon |
| trusted_domains | SELECT publico |
| user_roles | SELECT por anon |
| web_search_cache | ALL por anon |

**Nota importante:** A CLARA e um sistema publico (sem login de usuarios). As tabelas `documents`, `document_chunks`, `development_reports`, `report_tags` e `report_tag_relations` DEVEM ser lidas publicamente para o chat funcionar. As demais tabelas de metricas e administracao devem ser restritas a `service_role` apenas.

**Correcao:**
- Migrar as politicas de tabelas administrativas (metrics, logs, errors, cache) para aceitar apenas `service_role`
- Manter leitura publica nas tabelas de conteudo (documents, chunks) pois a Edge Function usa `service_role` internamente
- Corrigir funcoes de banco sem `search_path` definido

---

## PROBLEMA 4: Funcoes de Busca sem search_path

Duas funcoes do banco (`hybrid_search_chunks`, `search_document_chunks`) nao possuem `SET search_path = public`, gerando avisos de seguranca.

**Correcao:** Recriar as funcoes com `SET search_path = public`

---

## PROBLEMA 5: Relatorio Tecnico completamente desatualizado

O `RelatorioTecnico.tsx` referencia:
- "Manus Platform" (nao existe mais)
- "MySQL / TiDB" (o banco e PostgreSQL via Lovable Cloud)
- "Express + tRPC" (o backend usa Edge Functions)
- "Drizzle ORM" (nao e usado)
- "Node.js 22.13.0" (o runtime e Deno)
- Modelo "gemini-3-pro-preview" com "thinking level high" (o modelo real e gemini-3-flash-preview)
- "158 chunks indexados" (sao 47)
- Web Search como feature ativa (nao esta integrada na Edge Function)

**Correcao:** Reescrever completamente com a arquitetura real:
- Frontend: React 19 + Vite + Tailwind CSS 4 + Wouter + shadcn/ui
- Backend: Lovable Cloud (Edge Functions em Deno)
- Banco: PostgreSQL com pgvector
- IA: Lovable AI Gateway (gemini-3-flash-preview) + Gemini Embeddings
- RAG: Busca hibrida vetorial + full-text com RRF scoring
- 47 chunks indexados em 4 documentos

---

## PROBLEMA 6: Codigo legado do servidor nao utilizado

O diretorio `server/` contem codigo Express/tRPC/MySQL que NAO e mais utilizado. O sistema real usa Edge Functions. Arquivos a remover:

- `server/routers.ts` - Rotas tRPC (substituido pela Edge Function)
- `server/rag.ts` - Logica RAG antiga em Node.js
- `server/rag.test.ts` - Testes do RAG antigo
- `server/db.ts` - Conexao MySQL/Drizzle
- `server/storage.ts` - Storage antigo
- `server/webSearch.ts` - Busca web nao integrada
- `server/auth.logout.test.ts` - Teste de auth antigo
- `api/index.ts`, `api/trpc/[trpc].ts`, `api/tsconfig.json` - API Vercel nao usada
- `drizzle.config.ts` - Config Drizzle nao usada
- `docker-compose.yml` - MySQL Docker nao usado
- `.env.example` - Variaveis do sistema antigo

---

## PROBLEMA 7: Sidebar menciona "busca externa" inexistente

O `KnowledgeBaseSidebar.tsx` tem uma secao "Busca externa" que descreve funcionalidade de busca na internet. Essa funcionalidade NAO existe na Edge Function atual.

**Correcao:** Remover a secao de "Busca externa" e o icone Globe nao utilizado.

---

## PROBLEMA 8: Estilo do Relatorio Tecnico inconsistente

O `RelatorioTecnico.tsx` usa estilo claro (bg-slate-50, text-[#1e3a5f]) enquanto todo o resto do sistema usa o tema escuro GovTech Premium. Sera redesenhado para seguir o design system.

---

## PROBLEMA 9: Preview nao aparece

O preview provavelmente nao aparece porque o build falhou anteriormente (script `build:dev` ausente no package.json). Se o usuario ja corrigiu manualmente, o build deveria passar agora. Nao ha erro no codigo React em si.

---

## Detalhes Tecnicos

### Arquivos a Criar

**`supabase/functions/re-embed-chunks/index.ts`**
- Edge Function que le todos os 47 chunks do banco
- Re-gera embeddings com `gemini-embedding-001` (outputDimensionality: 768)
- Atualiza cada chunk com o novo embedding
- Usa a chave Gemini configurada nos secrets
- Endpoint protegido por x-admin-key

### Arquivos a Modificar

**`supabase/functions/clara-chat/index.ts`**
- Adicionar `outputDimensionality: 768` na chamada de embedding
- Melhorar mensagens de erro para 402 e 429
- Adicionar tratamento para embedding vazio (graceful degradation)

**`src/components/chat/KnowledgeBaseSidebar.tsx`**
- Remover secao "Busca externa"
- Remover import do icone Globe

**`src/pages/RelatorioTecnico.tsx`**
- Reescrita completa com informacoes corretas da arquitetura atual
- Aplicar design system GovTech Premium (tema escuro)

### Arquivos a Deletar

```
server/routers.ts
server/rag.ts
server/rag.test.ts
server/db.ts
server/storage.ts
server/webSearch.ts
server/auth.logout.test.ts
api/index.ts
api/trpc/[trpc].ts
api/tsconfig.json
drizzle.config.ts
docker-compose.yml
.env.example
```

### Migracoes de Banco de Dados

1. Recriar funcoes `hybrid_search_chunks` e `search_document_chunks` com `SET search_path = public`
2. Corrigir politicas RLS em tabelas administrativas (restringir a service_role)

### Arquivos Protegidos (NAO serao tocados)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`
- `supabase/config.toml`
- `package.json`

### Ordem de Execucao
1. Corrigir Edge Function `clara-chat` (embedding + erros)
2. Criar Edge Function `re-embed-chunks`
3. Aplicar migracoes de seguranca (RLS + funcoes)
4. Limpar codigo legado (deletar arquivos)
5. Atualizar KnowledgeBaseSidebar
6. Reescrever RelatorioTecnico
7. Testar o sistema completo

### Sobre custos
- O Lovable AI Gateway e parte da assinatura, com limite de uso mensal incluso
- Apos o limite, creditos adicionais podem ser adicionados em Settings > Workspace
- A chave Gemini e usada APENAS para gerar embeddings (consumo muito baixo, ~47 chamadas para indexar toda a base)
- Com uma nova chave Gemini, o fallback direto do LLM tambem volta a funcionar
- NAO ha busca na internet ativa -- nenhum consumo extra

