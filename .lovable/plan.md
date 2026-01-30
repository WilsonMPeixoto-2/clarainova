
# Plano de Consolidação e Operação — Fechamento do Ciclo v2.0

## Contexto

O projeto completou quatro fases de implementação:
1. ✅ Busca Web robusta (Firecrawl + fallback + quórum)
2. ✅ Responsividade/Mobile + PWA
3. ✅ "Super Premium" (performance + observabilidade + governança)
4. ✅ Saneamento de Segurança/LGPD (hashing, rate limiting, edge function dedicada)

**Estado atual validado:**
- `frontend_errors`: 2 registros (ambos com `user_agent: "Other"` — detectável via `categorizeBrowser` já corrigida)
- `rate_limits`: IPs antigos neutralizados (`legacy_redacted_`), novos registros com hash (32 chars hex)
- `chat_metrics`: 0 registros (instrumentação precisa ser testada em produção real)
- Governança: CHANGELOG.md v2.0.0, REGRESSION_CHECKLIST.md, Política de Release documentada

**Próximo passo:** Fechar ciclo de desenvolvimento e entrar em modo operacional.

---

## Fase 1: Validação de Release (Executar Checklist)

### 1.1. Validação PWA Ponta-a-Ponta

O `manifest.json` está configurado corretamente:
- `display: standalone`
- Ícones: 64×64, 192×192, 512×512 (any + maskable)
- `theme_color: #16a34a` (verde)
- Shortcuts para `/chat`

**Ações de validação manual (usuário):**

| Plataforma | Validação | Status |
|------------|-----------|--------|
| Android | Botão "Instalar" aparece após 30s de uso | Verificar |
| Android | Ícone correto na home screen | Verificar |
| iOS | "Adicionar à Tela de Início" via Share menu | Verificar |
| iOS | App abre sem barra de navegação do Safari | Verificar |
| Ambos | Splash screen com tema correto | Verificar |

### 1.2. Validação de Telemetria

**Objetivo:** Confirmar que a instrumentação está funcionando:

1. Fazer um chat real no Preview
2. Verificar se `chat_metrics` recebe registro com:
   - `session_fingerprint` hasheado (32 chars) ou NULL
   - `embedding_latency_ms`, `search_latency_ms`, `llm_first_token_ms` > 0
   - `provider` = "gemini" ou "lovable"

### 1.3. Validação de Segurança

**Checklist técnico:**

| Item | Query de Verificação | Resultado Esperado |
|------|----------------------|-------------------|
| IPs puros | `SELECT COUNT(*) FROM rate_limits WHERE client_key ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'` | 0 |
| Rate limit log-frontend-error | 11 POSTs em 60s | 11º retorna 429 |
| RLS frontend_errors | INSERT via anon key | Deve falhar |
| Salts configurados | Edge function logs | Sem warnings de salt missing |

---

## Fase 2: Dashboard de Observabilidade

### 2.1. Componente: ChatMetricsDashboard

**Local:** `src/components/admin/ChatMetricsDashboard.tsx`

Exibir:
- **Latência média por etapa** (embed/search/LLM) — gráfico de barras empilhadas
- **Taxa de fallback** (Gemini → Lovable) — gauge ou %
- **Rate limit hits** por dia — linha temporal
- **Volume de chats** por dia/modo — área empilhada
- **Erros por tipo** — tabela com contagem

### 2.2. RPC Functions Necessárias

Criar função `get_chat_metrics_summary`:

```sql
CREATE OR REPLACE FUNCTION get_chat_metrics_summary(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  total_requests INTEGER,
  avg_embedding_ms NUMERIC,
  avg_search_ms NUMERIC,
  avg_llm_first_token_ms NUMERIC,
  avg_llm_total_ms NUMERIC,
  fallback_count INTEGER,
  rate_limit_hits INTEGER,
  gemini_count INTEGER,
  lovable_count INTEGER
) AS $$
  SELECT 
    DATE(created_at) as date,
    COUNT(*)::INTEGER as total_requests,
    ROUND(AVG(embedding_latency_ms), 0) as avg_embedding_ms,
    ROUND(AVG(search_latency_ms), 0) as avg_search_ms,
    ROUND(AVG(llm_first_token_ms), 0) as avg_llm_first_token_ms,
    ROUND(AVG(llm_total_ms), 0) as avg_llm_total_ms,
    COUNT(*) FILTER (WHERE fallback_triggered)::INTEGER as fallback_count,
    COUNT(*) FILTER (WHERE rate_limit_hit)::INTEGER as rate_limit_hits,
    COUNT(*) FILTER (WHERE provider = 'gemini')::INTEGER as gemini_count,
    COUNT(*) FILTER (WHERE provider = 'lovable')::INTEGER as lovable_count
  FROM chat_metrics
  WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### 2.3. Integração no Admin

Adicionar nova aba "Métricas de Chat" no `/admin` que exibe:
- Cards de resumo (últimas 24h)
- Gráficos de tendência (7 dias)
- Alertas visuais se: fallback > 20% ou rate_limit > 10/h

---

## Fase 3: Validação de Busca Web (Casos Reais)

### 3.1. Cenários de Teste

| Cenário | Query de Teste | Verificação |
|---------|----------------|-------------|
| Normativo simples | "Qual o prazo para prestar contas de diárias?" | Modo Deep ativado, quórum de 2+ fontes |
| PDF oficial | "Decreto 44.698 diárias servidor" | Extração de PDF funciona |
| Site JS pesado | "PCDP sistema comprasnet" | Firecrawl fallback ativado |
| Múltiplas fontes | "Valor diária servidor federal 2024" | Deduplicação, prioridade oficial |

### 3.2. Melhorias Pendentes (Backlog)

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Lista de domínios confiáveis | Alta | Tabela `trusted_domains` editável no Admin |
| Estratégia de quórum configurável | Média | 2+ oficiais para normativo, 1+ para informativo |
| Extração de excerpt melhorada | Média | Capturar trecho específico que justifica citação |
| Cache de busca web | Baixa | Já implementado (24h) — monitorar hit rate |

---

## Fase 4: Governança de Mudanças

### 4.1. Congelamento de Escopo (Imediato)

**Regra:** Por 48h após este release, apenas correções de bug/regressão. Nenhuma feature nova.

### 4.2. Atualização do CHANGELOG

Adicionar ao v2.0.0:
- Saneamento de segurança (edge function log-frontend-error)
- Hashing de identificadores (LGPD)
- Rate limiting em todos os endpoints públicos

### 4.3. Roteiro de Rollback

| Cenário | Ação | Responsável |
|---------|------|-------------|
| Chat não responde | Verificar logs clara-chat, fallback para Lovable Gateway | Automático |
| Rate limit excessivo | Ajustar `RATE_LIMIT_CONFIG` e redeploy | Manual |
| Erro crítico no frontend | Restaurar versão anterior via History | Manual |
| Migração quebrou tabela | Restaurar backup Supabase (automático diário) | Manual |

---

## Resumo de Implementação

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/admin/ChatMetricsDashboard.tsx` | Dashboard de métricas de chat |
| Migração SQL | RPC `get_chat_metrics_summary` |

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Admin.tsx` | Adicionar aba "Métricas de Chat" |
| `CHANGELOG.md` | Documentar saneamento de segurança v2.0.1 |

### Validações (Usuário)

| Validação | Método |
|-----------|--------|
| PWA Android/iOS | Teste manual em dispositivos |
| Telemetria funcionando | Fazer chat → verificar `chat_metrics` |
| Rate limit | 11 POSTs para log-frontend-error |

---

## Critérios de "OK para Produção"

- [ ] REGRESSION_CHECKLIST.md 100% validado
- [ ] PWA instala e abre corretamente em Android e iOS
- [ ] `chat_metrics` recebendo dados após chat
- [ ] Nenhum IP puro em `rate_limits`
- [ ] Console sem warnings de salt missing
- [ ] FCP < 1.5s, LCP < 2.5s no PageSpeed Insights
- [ ] Fallback Gemini → Lovable testado (simular 429)

---

## Próximos Passos (Pós-Produção)

1. **Monitoramento 24h** — Observar métricas de chat, taxa de fallback, erros
2. **Alertas automáticos** — Configurar quando fallback > 20% ou erro > 5/h
3. **Política de fontes** — Criar tabela editável de domínios confiáveis
4. **Play Store** — Avaliar empacotamento com TWA/Capacitor (próxima fase)
