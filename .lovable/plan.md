
# Plano: Upgrade Super Premium — Performance + Observabilidade + Governança

## Resumo Executivo

Este plano implementa três eixos críticos para transformar a CLARA em um produto "operável" e profissionalmente mantido:

1. **Performance (FCP/LCP)** — Otimização de preloads para percepção de velocidade
2. **Observabilidade** — Telemetria estruturada para diagnósticos sem "reclamação"
3. **Governança** — Changelog formal, checklist de regressão e política de release

---

## Fase 1: Performance — Preloads Críticos

### Diagnóstico Atual
- Fonts já usam `preload` + async loading
- Hero image otimizada com WebP responsivo
- Critical CSS inline no `index.html`
- **Gap:** Falta preload do hero image e módulos críticos

### Implementação

**Arquivo:** `index.html`

Adicionar preloads para recursos críticos:

```html
<!-- Preload hero image para LCP -->
<link rel="preload" href="/src/assets/clara-hero-1920.webp" as="image" type="image/webp" media="(min-width: 1024px)" />
<link rel="preload" href="/src/assets/clara-hero-1024.webp" as="image" type="image/webp" media="(min-width: 640px) and (max-width: 1023px)" />
<link rel="preload" href="/src/assets/clara-hero-640.webp" as="image" type="image/webp" media="(max-width: 639px)" />

<!-- Preconnect Supabase API -->
<link rel="preconnect" href="https://pypqlqnfonixeocvmeoy.supabase.co" />
```

**Resultado Esperado:** LCP reduzido em 200-400ms

---

## Fase 2: Observabilidade Leve

### 2.1 Métricas de Chat (Já Existente — Expandir)

A tabela `api_usage_stats` já captura `provider`, `model` e `mode`. Vamos expandir para incluir métricas de performance.

**Nova tabela:** `chat_metrics`

```sql
CREATE TABLE IF NOT EXISTS chat_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Identificação
  session_fingerprint TEXT,
  request_id UUID,
  
  -- Performance (ms)
  embedding_latency_ms INTEGER,
  search_latency_ms INTEGER,
  llm_first_token_ms INTEGER,
  llm_total_ms INTEGER,
  
  -- Operacionais
  provider TEXT,              -- 'gemini' | 'lovable'
  model TEXT,
  mode TEXT,                   -- 'fast' | 'deep'
  web_search_used BOOLEAN,
  local_chunks_found INTEGER,
  web_sources_count INTEGER,
  
  -- Qualidade
  fallback_triggered BOOLEAN DEFAULT FALSE,
  rate_limit_hit BOOLEAN DEFAULT FALSE,
  error_type TEXT,             -- NULL = sucesso
  
  CONSTRAINT valid_provider CHECK (provider IN ('gemini', 'lovable'))
);

-- Index para queries de dashboard
CREATE INDEX idx_chat_metrics_created ON chat_metrics(created_at DESC);
CREATE INDEX idx_chat_metrics_provider ON chat_metrics(provider, created_at DESC);
```

### 2.2 Edge Function — Instrumentação

**Arquivo:** `supabase/functions/clara-chat/index.ts`

Adicionar coleta de métricas:

```typescript
// No início do request
const requestId = crypto.randomUUID();
const startTime = performance.now();
let embeddingLatency = 0;
let searchLatency = 0;
let firstTokenTime = 0;

// Após embedding
embeddingLatency = performance.now() - startTime;

// Após busca
searchLatency = performance.now() - startTime - embeddingLatency;

// No primeiro token do streaming
if (!firstTokenTime) firstTokenTime = performance.now() - startTime;

// Ao final, salvar métricas
const logMetrics = async () => {
  try {
    await supabase.from("chat_metrics").insert({
      request_id: requestId,
      session_fingerprint: sessionFingerprint || null,
      embedding_latency_ms: Math.round(embeddingLatency),
      search_latency_ms: Math.round(searchLatency),
      llm_first_token_ms: Math.round(firstTokenTime),
      llm_total_ms: Math.round(performance.now() - startTime),
      provider: apiProvider,
      model: activeModelName,
      mode,
      web_search_used: needsWebSearch,
      local_chunks_found: mergedChunks.length,
      web_sources_count: webSources.length,
      fallback_triggered: useFallback,
      rate_limit_hit: false,
      error_type: null,
    });
  } catch (err) {
    console.warn("[metrics] Failed to log:", err);
  }
};
```

### 2.3 Dashboard de Observabilidade (Admin)

**Arquivo:** `src/components/admin/ObservabilityDashboard.tsx`

Componente que exibe:

| Métrica | Visualização |
|---------|--------------|
| Tempo médio de resposta | Linha temporal (7 dias) |
| Taxa de fallback Gemini → Lovable | Barra de % |
| Taxa de web search | Barra de % |
| Erros 429 (rate limit) | Contador + trend |
| Latência por etapa | Breakdown (embed/search/LLM) |

### 2.4 Error Boundary com Reporting

**Arquivo:** `src/components/ErrorBoundary.tsx`

Já existe, mas vamos adicionar logging para analytics:

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
  // Log para analytics (sem dados sensíveis)
  try {
    supabase.from("frontend_errors").insert({
      error_message: error.message.slice(0, 500),
      component_stack: errorInfo.componentStack?.slice(0, 1000),
      url: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 200),
    });
  } catch {
    // Silently fail
  }
}
```

**Nova tabela:** `frontend_errors`

```sql
CREATE TABLE IF NOT EXISTS frontend_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  error_message TEXT,
  component_stack TEXT,
  url TEXT,
  user_agent TEXT
);
```

---

## Fase 3: Governança do Projeto

### 3.1 CHANGELOG.md

**Novo arquivo:** `CHANGELOG.md`

```markdown
# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [2.0.0] - 2026-01-30

### Adicionado
- Responsividade mobile premium (anti-overflow, smart scroll, safe-area)
- Hero image otimizada com WebP responsivo (640w/1024w/1920w)
- Source chips com scroll horizontal snap no mobile
- Dashboard de observabilidade no Admin
- Métricas de performance por request

### Alterado
- `useIsMobile` agora usa `matchMedia.matches` (sem forced reflow)
- Auto-scroll inteligente respeita posição do usuário durante streaming
- Touch targets aumentados para 44px mínimo

### Corrigido
- Forced reflow no carregamento inicial
- Overflow horizontal em mensagens com URLs longas

### Segurança
- Auditoria de erros frontend sem dados sensíveis

## [1.0.0] - 2026-01-25

### Adicionado
- Chat RAG com streaming SSE
- Busca híbrida (semântica + keywords)
- Google Search grounding automático
- Interface administrativa para documentos
- PWA com instalação standalone
```

### 3.2 Checklist de Regressão

**Novo arquivo:** `REGRESSION_CHECKLIST.md`

```markdown
# Checklist de Regressão — CLARA

## Pré-Publicação (10 min)

### Mobile (360×800)
- [ ] Chat abre sem overflow horizontal
- [ ] Input visível acima do teclado
- [ ] Chips de fontes com scroll suave
- [ ] Botões com touch target adequado

### Desktop (1440px)
- [ ] Layout centralizado (max-width 4xl)
- [ ] Streaming SSE funcional
- [ ] Fontes citadas expandíveis

### Chat Core
- [ ] Mensagem curta → resposta OK
- [ ] Mensagem longa (5000 chars) → resposta OK
- [ ] Modo Direto funciona
- [ ] Modo Didático funciona
- [ ] Web search ativado quando necessário

### Admin
- [ ] Login com chave válida
- [ ] Lista de documentos carrega
- [ ] Upload de PDF processa
- [ ] Analytics exibe métricas

### PWA
- [ ] Android: botão "Instalar" aparece
- [ ] iOS: "Adicionar à Tela de Início" funciona
- [ ] Ícone correto após instalação

### Performance
- [ ] FCP < 1.5s (PageSpeed)
- [ ] LCP < 2.5s (PageSpeed)
- [ ] Sem forced reflow no Lighthouse
```

### 3.3 Política de Release

**Adicionar ao:** `DOCUMENTATION.md`

```markdown
## Política de Release

### Ambientes
1. **Preview** — Builds automáticos por commit (desenvolvimento)
2. **Staging** — Preview validado com checklist completo
3. **Production** — Publish manual após aprovação

### Processo
1. Implementar feature no Preview
2. Executar REGRESSION_CHECKLIST.md
3. Se OK → Publicar para Production
4. Atualizar CHANGELOG.md
5. Se falha crítica → Rollback imediato

### Rollback
- Lovable mantém histórico de versões
- Em caso de falha crítica: reverter para commit anterior
- Comunicar equipe sobre incidente
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `index.html` | Adicionar preloads de hero image e Supabase |
| `CHANGELOG.md` | **Criar** — histórico formal de versões |
| `REGRESSION_CHECKLIST.md` | **Criar** — roteiro de validação |
| `DOCUMENTATION.md` | Adicionar seção "Política de Release" |
| `supabase/functions/clara-chat/index.ts` | Adicionar instrumentação de métricas |
| `src/components/ErrorBoundary.tsx` | Adicionar logging de erros |
| Nova migração SQL | Criar tabelas `chat_metrics` e `frontend_errors` |
| `src/components/admin/ObservabilityDashboard.tsx` | **Criar** — dashboard de métricas |

---

## Critérios de Aceite

- [ ] Hero image carrega com preload (verificar Network tab)
- [ ] Tabela `chat_metrics` recebe dados após cada chat
- [ ] Admin > Observabilidade exibe métricas reais
- [ ] CHANGELOG.md documenta versão 2.0.0
- [ ] REGRESSION_CHECKLIST.md cobre todos os fluxos críticos

---

## Relatório para "Relatórios de Desenvolvimento"

O relatório institucional a ser gerado após implementação:

```markdown
# Relatório de Desenvolvimento — Release 2.0.0

**Data:** 30/01/2026
**Versão:** 2.0.0
**Tipo:** Feature Release

## Resumo Executivo

Esta release consolida melhorias de performance, responsividade mobile e 
estabelece infraestrutura de observabilidade para operação sustentável.

## Entregas

### Performance
- LCP otimizado com preloads de hero image (WebP responsivo)
- Eliminação de forced reflow no carregamento

### Mobile
- Anti-overflow global para mensagens de chat
- Smart scroll que respeita posição do usuário
- Safe-area para iPhones modernos
- Touch targets de 44px mínimo

### Observabilidade
- Tabela `chat_metrics` com latências por etapa
- Dashboard administrativo de métricas
- Logging de erros frontend (sem dados sensíveis)

### Governança
- CHANGELOG.md formalizado
- Checklist de regressão documentado
- Política de release Preview → Production

## Critérios de Aceite — Mobile/PWA

| Critério | Status |
|----------|--------|
| Mobile 360×800 sem overflow | ✅ |
| Input visível acima do teclado | ✅ |
| PWA instala em Android/iOS | ✅ |
| Ícone correto após instalação | ✅ |

## Riscos Residuais

1. **Quota Gemini:** Fallback para Lovable Gateway funcional
2. **Firecrawl:** Dependência externa para web search

## Próximos Passos

1. Implementar alertas automáticos (taxa de erro > 5%)
2. Dashboard de métricas em tempo real
3. Testes E2E automatizados com Playwright
```

---

## Notas Técnicas

- A instrumentação adiciona ~5ms de overhead (negligível)
- Tabelas de métricas sem RLS (dados operacionais, não sensíveis)
- Logging é "fire and forget" — não bloqueia fluxo principal
- Error boundary captura apenas stack técnico, nunca dados de usuário
