
# Plano: Análise de Maturidade e Próximos Passos do Projeto CLARA

## Resumo Executivo

O projeto CLARA está em estágio **MVP+ Avançado** com 85% de maturidade geral. O core funcional (chat IA, gestão de documentos, dashboard) está completo e em produção. As próximas ações focam em segurança, qualidade e expansão.

---

## Matriz de Maturidade Detalhada

| Área | Nível | Arquivos Principais | Observações |
|------|-------|---------------------|-------------|
| Motor IA/RAG | Produção (95%) | `supabase/functions/clara-chat/index.ts` (779 linhas) | Streaming SSE, busca híbrida, RRF, 2 modelos |
| Interface Chat | Produção (90%) | `src/components/chat/ChatPanel.tsx`, `useChat.ts` | Feedback, PDF, histórico, atalhos |
| Documentos | Produção (85%) | `supabase/functions/documents/index.ts` (532 linhas) | OCR Gemini, chunking, embeddings 768d |
| Autenticação | Produção (80%) | `src/contexts/AuthContext.tsx`, RLS policies | Google OAuth, sessões persistentes |
| Analytics | Funcional (75%) | `src/components/admin/AnalyticsTab.tsx` (522 linhas) | Métricas, gráficos, exportação CSV |
| Segurança | Requer Ajustes (70%) | Políticas RLS, rate limiting | 15 warnings do linter |
| SEO | Produção (85%) | `src/components/SEOHead.tsx`, `public/*` | Meta dinâmico, Schema.org |
| Testes | Inicial (10%) | `src/test/example.test.ts` | Apenas teste de exemplo |
| PWA | Não Iniciado (5%) | - | Sem Service Worker |

---

## Estrutura Atual do Backend

```text
supabase/functions/
├── clara-chat/      # Motor principal RAG + Streaming
├── documents/       # CRUD + Processamento de documentos
├── search/          # Busca híbrida isolada
├── admin-auth/      # Autenticação administrativa
├── admin-upload/    # Upload legacy (deprecated)
└── admin_get_upload_url/  # URLs assinadas para upload
```

**Banco de Dados (9 tabelas):**
- `documents` - Metadados dos documentos
- `document_chunks` - Chunks com embeddings (768d)
- `query_analytics` - Histórico de consultas
- `response_feedback` - Avaliações dos usuários
- `chat_sessions` - Histórico por usuário
- `profiles` - Dados de usuário
- `user_roles` - Permissões
- `rate_limits` - Controle de requisições
- `development_reports` - Relatórios de desenvolvimento

---

## Problemas de Segurança Identificados

O linter do banco de dados identificou 15 warnings:

1. **Políticas RLS Permissivas (6 ocorrências)**
   - `development_reports`: INSERT/UPDATE/DELETE com `WITH CHECK (true)`
   - `query_analytics`: INSERT com `WITH CHECK (true)`
   - `response_feedback`: INSERT com `WITH CHECK (true)`

2. **Acesso Anônimo (8 ocorrências)**
   - Tabelas `chat_sessions`, `documents`, `document_chunks` acessíveis sem autenticação

3. **Extensão no Schema Public**
   - `pgvector` instalada no schema `public` (deveria estar em `extensions`)

---

## Próximas Ações (Ordenadas por Prioridade)

### Fase 1: Segurança (Urgente)

**Ação 1.1: Restringir Políticas RLS**
- Alterar políticas de INSERT/UPDATE/DELETE para exigir autenticação
- Manter SELECT público apenas onde necessário
- Tabelas afetadas: `development_reports`, `query_analytics`, `response_feedback`

**Ação 1.2: Mover Extensão pgvector**
- Migrar para schema dedicado `extensions`
- Atualizar referências nas funções

### Fase 2: Qualidade (Importante)

**Ação 2.1: Testes para Edge Functions**
- Criar testes Deno para `clara-chat`, `documents`, `search`
- Foco: validação de input, fluxos de erro, rate limiting
- Ferramenta: `Deno.test()`

**Ação 2.2: Testes React**
- Testar componentes críticos: `ChatMessage`, `ChatInput`, `AnalyticsTab`
- Ferramenta: Vitest + Testing Library

### Fase 3: Expansão (Desejável)

**Ação 3.1: Web Search Grounding**
- Implementar fallback quando base local não tiver resposta
- Validar fontes: `.gov.br`, `prefeitura.rio`, `leismunicipais.com.br`
- Adicionar disclaimer obrigatório

**Ação 3.2: PWA com Service Worker**
- Criar `manifest.json` com ícones e cores
- Implementar Service Worker para cache de assets
- Adicionar fallback offline

**Ação 3.3: Analytics Avançado**
- Adicionar heatmap de horários de pico
- Análise de lacunas de conhecimento
- Alertas automáticos para quedas de satisfação

---

## Estimativa de Esforço

| Ação | Complexidade | Tempo Estimado |
|------|--------------|----------------|
| Corrigir RLS | Média | 2-3 horas |
| Mover pgvector | Baixa | 30 min |
| Testes Edge Functions | Alta | 4-6 horas |
| Testes React | Alta | 4-6 horas |
| Web Search Grounding | Alta | 6-8 horas |
| PWA completo | Média | 3-4 horas |
| Analytics avançado | Média | 4-5 horas |

---

## Conclusão

O projeto CLARA está **pronto para uso em produção** com as funcionalidades atuais. As melhorias prioritárias são:

1. **Segurança**: Corrigir políticas RLS permissivas
2. **Qualidade**: Adicionar testes automatizados
3. **Expansão**: Web Search Grounding e PWA

Após essas implementações, o projeto atingirá maturidade de **95%+** e estará pronto para escala.
