# Checklist de Regressão — CLARA

Este checklist deve ser executado **antes de cada publicação para Production**.

Tempo estimado: **10-15 minutos**

---

## 📱 Mobile (360×800)

- [ ] Chat abre sem overflow horizontal
- [ ] Mensagem com URL longa não quebra layout
- [ ] Input visível acima do teclado virtual
- [ ] Chips de fontes com scroll horizontal suave
- [ ] Botões com touch target adequado (44px mínimo)
- [ ] Menu hambúrguer funciona corretamente
- [ ] Safe-area respeitada (iPhone com notch)

---

## 🖥️ Desktop (1440px)

- [ ] Layout centralizado (max-width adequado)
- [ ] Chat streaming SSE funcional
- [ ] Fontes citadas expandíveis (collapsible)
- [ ] Header com navegação completa
- [ ] Footer visível e acessível

---

## 💬 Chat Core

- [ ] Mensagem curta (10 palavras) → resposta OK
- [ ] Mensagem longa (2000+ chars) → resposta OK
- [ ] Modo **Direto** funciona (respostas concisas)
- [ ] Modo **Didático** funciona (explicações completas)
- [ ] Web search ativado quando base local insuficiente
- [ ] Fallback Gemini → Lovable Gateway funciona (simular 429)
- [ ] Indicador "pensando" aparece durante geração
- [ ] API Provider badge exibe corretamente

---

## 👍👎 Feedback

- [ ] Thumbs up registra feedback positivo
- [ ] Thumbs down abre modal de categoria
- [ ] Feedback aparece no Admin > Analytics

---

## 🔐 Admin

- [ ] Login com chave válida
- [ ] Login com chave inválida → erro
- [ ] Brute-force bloqueado após 5 tentativas
- [ ] Lista de documentos carrega
- [ ] Upload de PDF processa (status: processing → processed)
- [ ] Exclusão de documento funciona
- [ ] Analytics exibe métricas (7 dias)
- [ ] Relatórios: criar, editar, excluir, PDF

---

## 📲 PWA

- [ ] Android: botão "Instalar" aparece após alguns segundos
- [ ] iOS: "Adicionar à Tela de Início" funciona
- [ ] Ícone correto após instalação (não genérico)
- [ ] App abre em modo standalone (sem barra do navegador)
- [ ] Splash screen exibe corretamente

---

## ⚡ Performance

- [ ] FCP < 1.5s (PageSpeed Insights)
- [ ] LCP < 2.5s (PageSpeed Insights)
- [ ] Sem forced reflow no Lighthouse
- [ ] Hero image carrega via preload (verificar Network tab)

---

## 🔗 Links e Navegação

- [ ] Link "Chat" na landing leva para /chat
- [ ] Link "Chat com CLARA" no hero funciona
- [ ] Página 404 exibe corretamente
- [ ] Links de privacidade e termos funcionam

---

## 🛡️ Segurança

- [ ] Input de chat rejeita > 10.000 caracteres
- [ ] Rate limiting funciona (15 req/min)
- [ ] Console não exibe API keys ou tokens
- [ ] Dados sensíveis não aparecem em logs

---

## Processo de Validação

1. **Testar no Preview** (este ambiente)
2. **Executar este checklist**
3. **Se todos ✅ → Publicar para Production**
4. **Atualizar CHANGELOG.md com a nova versão**
5. **Se falha crítica após publish → Rollback imediato**

---

## Rollback

- Lovable mantém histórico de versões
- Em caso de falha crítica: reverter para commit anterior
- Comunicar equipe sobre incidente

---

*Última atualização: 30/01/2026*
