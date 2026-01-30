# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [2.0.0] - 2026-01-30

### Adicionado
- **Responsividade Mobile Premium:**
  - Anti-overflow global para mensagens de chat (URLs longas, código)
  - Smart scroll que respeita posição do usuário durante streaming
  - Safe-area para iPhones modernos (notch/barra inferior)
  - Source chips com scroll horizontal snap no mobile
  - Touch targets de 44px mínimo em elementos interativos
- **Otimização de Performance (FCP/LCP):**
  - Preload de hero image responsiva (WebP 640w/1024w/1920w)
  - Preconnect para API Supabase
  - Critical CSS inline no index.html
- **Observabilidade:**
  - Tabela `chat_metrics` para latências por etapa (embed/search/LLM)
  - Tabela `frontend_errors` para erros do Error Boundary
  - Dashboard de métricas no Admin (em desenvolvimento)
- **Governança:**
  - CHANGELOG.md formalizado
  - REGRESSION_CHECKLIST.md documentado
  - Política de release Preview → Production

### Alterado
- `useIsMobile` agora usa `matchMedia.matches` (sem forced reflow)
- Auto-scroll inteligente: só rola se usuário estiver no final da conversa
- ResponseNotice com `max-width` e `truncate` para mobile

### Corrigido
- Forced reflow no carregamento inicial
- Overflow horizontal em mensagens com URLs longas ou código
- Layout de source chips quebrando em telas estreitas

### Segurança
- Error Boundary envia apenas stack técnico (sem dados sensíveis)
- Tabelas de métricas com RLS: admins leem, service_role insere

---

## [1.0.0] - 2026-01-25

### Adicionado
- **Chat RAG Completo:**
  - Streaming SSE character-by-character
  - Busca híbrida (semântica + keywords)
  - Reciprocal Rank Fusion (RRF) para ranking
  - Google Search grounding automático
  - Fallback Gemini → Lovable AI Gateway
- **Interface Administrativa:**
  - Gestão de documentos (upload, processamento, exclusão)
  - Analytics de uso e satisfação
  - Monitor de uso de API
  - Relatórios de desenvolvimento
- **PWA:**
  - Instalação standalone (Android/iOS)
  - Service Worker para cache
  - Manifest com ícones
- **Design System v3.0:**
  - Tema dark com amber/copper accent
  - Tokens semânticos HSL
  - Glassmorphism e gradientes

### Segurança
- Rate limiting por IP (15 req/min)
- Validação de input (max 10k chars)
- RLS em todas as tabelas
- Autenticação admin com chave

---

## Histórico de Decisões Técnicas

1. **Gemini para extração de PDF:** Suporta OCR nativo, compatível com Deno runtime
2. **Upload-then-Process:** Bypass do limite de 6MB das Edge Functions
3. **Busca Híbrida com RRF:** Combina precisão semântica com recall de keywords
4. **Streaming SSE:** UX responsiva com feedback em tempo real
5. **Fallback para Lovable Gateway:** Resiliência contra rate limits do Gemini
