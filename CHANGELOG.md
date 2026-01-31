# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [2.1.0] - 2026-01-31

### Adicionado
- **Chat Controls (Stop/Regenerate/Continue):**
  - Botão "Parar" durante streaming para interromper resposta
  - Botão "Regenerar" para gerar nova resposta
  - Botão "Continuar" para continuar resposta interrompida
  - Estado `stopped` com notice visual "Resposta interrompida"
  - Tracking de `request_id` via SSE para observabilidade
- **Interface ChatMessage Aprimorada:**
  - Novo componente `MessageControls` para ações de controle
  - Status de mensagem (`streaming`, `done`, `stopped`, `error`)
  - Suporte a continuação de respostas no backend

### Alterado
- `useChat` hook refatorado com refs para regenerate/continue
- Backend `clara-chat` emite `request_id` via SSE
- Backend suporta flag `continuation: true` para continuar respostas

---

## [2.0.1] - 2026-01-30

### Adicionado
- **Dashboard de Métricas de Chat:**
  - Nova aba "Métricas" no Admin
  - Latência média por etapa (embedding/search/LLM)
  - Taxa de fallback Gemini → Lovable
  - Distribuição de providers e uso de web search
  - Alertas visuais para fallback > 20% e erros frequentes
- **RPCs de Observabilidade:**
  - `get_chat_metrics_summary(p_days)` — agregação de métricas de chat
  - `get_frontend_errors_summary(p_days)` — agregação de erros frontend

### Segurança
- **Saneamento de Segurança/LGPD:**
  - Edge function dedicada `log-frontend-error` com rate limit (10 req/min)
  - Hashing de IPs via SHA-256 + salt configurável
  - Hashing de session fingerprints via SHA-256 + salt configurável
  - Neutralização de IPs antigos na tabela `rate_limits`
  - Política de retenção de 30 dias para dados operacionais
- **Eliminação de fallback salts fixos:**
  - Secrets `FINGERPRINT_SALT` e `RATELIMIT_SALT` obrigatórios
  - Degradação segura quando ausentes (não persiste PII)

### Corrigido
- `categorizeBrowser()` agora identifica corretamente Edge, Opera e Mobile WebKit
- Removido header `Authorization` desnecessário do ErrorBoundary

---

## [2.0.0] - 2026-01-30

### Adicionado
- **Responsividade Mobile Premium:**
...

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
