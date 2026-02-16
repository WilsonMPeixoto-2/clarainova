# Checkpoint de Projeto - Backend CLARA

Data: 16/02/2026  
Repositório: `clarainova`  
Branch: `prod`  
Último commit local: `941eaea` (`chore(vercel): ignore local project metadata`)  
Status do git: limpo (sem alterações pendentes no momento deste checkpoint)

## 1) Objetivo da fase atual
Preparar e reconstruir o backend no Supabase em conta própria, sem dependência do Lovable, mantendo compatibilidade com o frontend atual.

## 2) Decisões já tomadas
1. Reconstrução 100% independente (Supabase em conta pessoal).
2. Manter compatibilidade com o contrato real do frontend já existente.
3. Não usar login/autenticação para usuário final nesta fase.
4. Reduzir coleta de dados: manter somente analytics úteis para melhoria de conteúdo.
5. Preservar o "cérebro pedagógico" da CLARA (prompt didático, empatia, passo a passo, explicação do "porquê").

## 3) O que já foi confirmado no código
1. Estrutura Supabase existente:
   - `supabase/config.toml`
   - `supabase/migrations/`
   - `supabase/functions/`
2. Funções existentes:
   - `clara-chat`
   - `documents`
   - `admin-auth`
   - `admin_get_upload_url`
   - `admin-analytics`
   - `log-frontend-error`
   - `search`
   - `web-search`
3. Bucket de storage usado pelo frontend/admin: `knowledge-base`.
4. Variáveis do frontend:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (fallback: `VITE_SUPABASE_PUBLISHABLE_KEY`)
5. Base de analytics útil (manter):
   - `query_analytics`
   - `response_feedback`
6. RPCs críticos para chat/RAG:
   - `check_rate_limit`
   - `hybrid_search_chunks`

## 4) Ajustes recomendados antes de conectar o novo Supabase
1. Padronizar chave administrativa para `ADMIN_KEYS` em todas as funções (inclusive `admin_get_upload_url`).
2. Remover/ajustar entrada obsoleta de função em `supabase/config.toml` (`re-embed-chunks` sem pasta correspondente).
3. Decidir se `web-search` entra já na Fase 1 (recomendação: desativado no início para simplificar).
4. Confirmar taxonomia mínima de tópicos (ex.: SEI, SDP, Férias, Prestação de Contas etc.).
5. Definir critérios de classificação da resposta para analytics:
   - `respondida`
   - `parcial`
   - `nao_respondida`

## 5) Escopo mínimo da Fase 1 (recomendado)
1. Chat com RAG híbrido funcionando.
2. Ingestão de documentos e embeddings.
3. Analytics enxuto para melhoria contínua:
   - tópicos recorrentes
   - dúvidas não respondidas
   - feedback negativo com motivo
4. Sem autenticação de usuário final.

## 6) Próximo passo quando retomar
1. Você cria o projeto Supabase novo.
2. Eu preparo o "pacote de conexão limpa":
   - revisão final de migrations essenciais
   - padronização de secrets/env
   - checklist de deploy das funções
3. Conectamos Vercel ao Supabase novo e executamos smoke test do fluxo:
   - chat
   - upload/ingestão
   - analytics básico

## 7) Referências internas úteis
1. `docs/CONTRATO_ATUAL.md` (contrato atual de endpoints/env do frontend)
2. `supabase/functions/` (implementações das Edge Functions)
3. `supabase/migrations/` (schema e RPCs)
