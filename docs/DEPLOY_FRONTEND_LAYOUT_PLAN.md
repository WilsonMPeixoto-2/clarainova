# Plano de Deploy - Melhorias Frontend/Layout CLARA

Data: 2026-02-18  
Branch: `feat/frontend-improvements-round2`

## 1) Status dos blocos

Concluídos no código:
1. Bloco 1 - Hero framing + overlay separation
2. Bloco 2 - tokens cinematográficos + contraste
3. Bloco 3 - tipografia premium
4. Bloco 4 - header sem duplicidade de marca
5. Bloco 5 - remoção do falso chat + quick actions
6. Bloco 6 - overlay/menu mobile premium
7. Bloco 7 - drawer desktop resizable + mobile snap sheet
8. Bloco 8 - avatar CLARA + padronização visual de ícones
9. Bloco 9 - Direto/Didático com subtexto + web fallback interno
10. Bloco 10 - energia sutil + reduced-motion
11. Bloco 11 - assets responsivos AVIF/WebP/JPG + prioridade de LCP
12. Bloco 12 - robustez de fetch + UX de erro + detalhes técnicos

Observação:
- Bloco 0 e Bloco 13 são processuais e já foram executados na prática.

## 2) Commits de implementação (ordem cronológica)

1. `cf88b52` - `refactor(modes): segmented control + internal web fallback`
2. `247da65` - `feat(chat): resizable drawer + mobile snap sheet`
3. `be89a44` - `style(chat): clara avatar + icon system`
4. `4af8c65` - `fix(home): right-size quick actions carousel`
5. `65c1b56` - `style(header): refine monogram and chat cta treatment`
6. `d985df2` - `perf(hero): responsive cinematic images + LCP priority assets`

## 3) Bloqueador atual para deploy

O smoke test do endpoint de chat falhou por resolução de host:
- erro: `host não é conhecido` para o domínio configurado em `VITE_SUPABASE_URL`

Conclusão:
- Antes de publicar preview/prod, corrigir variáveis de ambiente do frontend para um projeto Supabase válido e acessível.

## 4) Plano cronológico de rollout

### Fase A - Pré-deploy técnico
1. Confirmar URL correta do Supabase (projeto ativo).
2. Confirmar chave pública correta (`VITE_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`).
3. Atualizar variáveis no provedor de deploy (Preview e Production separadamente).
4. Executar smoke test do endpoint `clara-chat` com as envs novas.

### Fase B - Preview
1. Abrir/atualizar PR da branch `feat/frontend-improvements-round2`.
2. Gerar deploy preview (sem `--prod`).
3. Executar checklist manual:
   - Hero framing desktop/mobile
   - contraste/legibilidade
   - quick actions
   - menu mobile
   - resize desktop e snap mobile do chat
   - avatar CLARA
   - modos Direto/Didático
   - erro de rede com painel técnico

### Fase C - Aprovação
1. Validar Lighthouse (Home): LCP, CLS e TBT.
2. Validar logs de erro de frontend e retorno do endpoint de chat.
3. Aprovar PR.

### Fase D - Produção
1. Merge em `prod`.
2. Deploy production.
3. Smoke test pós-deploy:
   - abrir chat e enviar pergunta
   - testar quick action da home
   - validar drawer no mobile
4. Monitorar primeiras 24h (erros de fetch, taxa de fallback, performance de home).

## 5) Comandos de validação local

```bash
npm run lint
npm test
npm run build
```

