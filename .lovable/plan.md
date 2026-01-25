

# 📋 Relatório Consolidado: Alterações nas Últimas 48 Horas

**Projeto:** CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas  
**Período:** 23/01/2026 - 25/01/2026  
**Status:** ✅ Operacional

---

## 1. Reorganização da Arquitetura de Navegação

### Alteração Principal
Integração do chat como **painel lateral deslizante** na página principal, eliminando a página `/chat` separada.

### Arquivos Criados
| Arquivo | Descrição |
|---------|-----------|
| `src/components/chat/ChatPanel.tsx` | Novo componente de chat em painel lateral usando Sheet (Radix UI) |

### Arquivos Modificados
| Arquivo | Alterações |
|---------|------------|
| `src/pages/Index.tsx` | Integração do ChatPanel com estados `chatOpen` e `initialQuery` |
| `src/components/HeroSection.tsx` | CTAs redirecionam para painel lateral via prop `onOpenChat` |
| `src/components/Header.tsx` | Adicionado botão "Chat" na navegação desktop e mobile |
| `src/App.tsx` | Rota `/chat` agora redireciona para Index |
| `public/sitemap.xml` | Removida entrada `/chat` |

### Comportamento
- Desktop: Painel de 450px desliza da direita
- Mobile: Painel ocupa tela inteira
- Atalhos de teclado: `Ctrl+N` (nova conversa), `Ctrl+Shift+L` (limpar), `/` (focar input)

---

## 2. Correção Crítica: Migração do Modelo de IA

### Problema
Modelo `gemini-2.5-pro-preview-05-06` **deprecado** pelo Google, causando erro 404 na Edge Function.

### Solução Implementada
Migração para **Lovable AI Gateway** com modelo `google/gemini-2.5-flash`.

### Arquivo Modificado
`supabase/functions/clara-chat/index.ts`

### Mudanças Técnicas
- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`
- Autenticação: `LOVABLE_API_KEY` (pré-configurado)
- Formato: API compatível com OpenAI
- Streaming SSE mantido
- RAG (embeddings) continua usando `text-embedding-004` via `GEMINI_API_KEY`
- Tratamento de erros 429 (rate limit) e 402 (créditos)

---

## 3. Hardening de Segurança (RLS Policies)

### Migração Aplicada
`20260125204012_d4d692dd-1bce-4862-a190-43fd24633975.sql`

### Tabelas Protegidas

| Tabela | Políticas Aplicadas |
|--------|---------------------|
| `profiles` | SELECT/INSERT/UPDATE restritos a `authenticated` + owner; DENY ALL para `anon` |
| `chat_sessions` | CRUD completo restrito a `authenticated` + owner |
| `rate_limits` | DENY ALL para `anon` e `authenticated` (apenas service role) |
| `user_roles` | SELECT próprio role; DENY INSERT/UPDATE/DELETE para usuários |

### Total de Policies Criadas
**15+ novas políticas RLS** substituindo políticas permissivas anteriores.

---

## 4. Atualização de Infraestrutura

### Deno Standard Library
Todas as Edge Functions atualizadas de `0.168.0` para `0.224.0`:

| Função | Versão Anterior | Versão Atual |
|--------|-----------------|--------------|
| `clara-chat` | 0.168.0 | 0.224.0 |
| `documents` | 0.168.0 | 0.224.0 |
| `search` | 0.168.0 | 0.224.0 |
| `admin-auth` | 0.168.0 | 0.224.0 |

---

## 5. Migrações de Banco de Dados Aplicadas (48h)

| Data | ID | Descrição |
|------|-----|-----------|
| 25/01 20:40 | d4d692dd | Hardening RLS (profiles, chat_sessions, rate_limits, user_roles) |
| 25/01 18:44 | 70da657e | Políticas explícitas para profiles (authenticated only) |
| 25/01 15:14 | 25d27efd | Criação de profiles, chat_sessions, user_roles, enum app_role, triggers |
| 25/01 14:46 | f0867457 | Tabela rate_limits com função check_rate_limit |

---

## 6. Schema de Banco Criado

### Novas Tabelas
```text
profiles (id, email, display_name, avatar_url, created_at, last_seen_at)
chat_sessions (id, user_id, title, messages JSONB, created_at, updated_at)
user_roles (id, user_id, role app_role)
rate_limits (id, client_key, endpoint, request_count, window_start)
```

### Funções Criadas
- `has_role(uuid, app_role)` - Verifica role do usuário (SECURITY DEFINER)
- `check_rate_limit(...)` - Rate limiting por IP/endpoint
- `handle_new_user()` - Trigger para criar profile + role no signup
- `cleanup_rate_limits()` - Limpeza de registros antigos

### Índices Criados
- `idx_chat_sessions_user_id`
- `idx_chat_sessions_updated_at`
- `idx_user_roles_user_id`
- `idx_rate_limits_lookup`

---

## 7. Testes e Validações Realizados

| Teste | Resultado |
|-------|-----------|
| Chat desktop (450px panel) | ✅ Funcional |
| Chat mobile (full-screen) | ✅ Funcional |
| Streaming de respostas | ✅ Funcional |
| Citação de fontes RAG | ✅ Funcional |
| Botão Chat no header mobile | ✅ Adicionado |
| Rate limiting | ✅ Configurado (15 req/min) |

---

## 8. Secrets Configurados

| Secret | Status | Uso |
|--------|--------|-----|
| `GEMINI_API_KEY` | ✅ Ativo | Embeddings (text-embedding-004) |
| `LOVABLE_API_KEY` | ✅ Ativo | Chat (Lovable AI Gateway) |
| `ADMIN_KEY` | ✅ Ativo | Autenticação /admin |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Ativo | Operações administrativas |

---

## 9. Resumo de Impacto

| Categoria | Antes | Depois |
|-----------|-------|--------|
| Navegação | Confusa (3 páginas) | Simplificada (1 página + painel) |
| Modelo IA | Deprecado (erro 404) | Operacional (Lovable Gateway) |
| Segurança RLS | Parcial | Completa (15+ policies) |
| Deno Std | 0.168.0 | 0.224.0 |
| Mobile UX | Sem botão chat | Botão no menu hamburger |

---

## 10. Próximos Passos Pendentes

1. **Upload de documentos** - Problema na base de conhecimento administrativa a resolver
2. **Autenticação Google** - Configuração OAuth pendente
3. **Persistência de chat** - Salvar conversas no banco para usuários autenticados

---

*Relatório gerado em 25/01/2026*

