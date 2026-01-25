
## Objetivo
Eliminar de vez a rejeição do Google (“link de Política de Privacidade ausente/inválido”) tornando a Política de Privacidade acessível como **página pública estática** (HTML “de verdade”), com URL estável e sem depender do React Router/JS para renderizar o conteúdo.

## Por que isso está acontecendo (e por que não é “automático”)
A integração “login com Google” do Lovable Cloud resolve a parte técnica de autenticar usuários (OAuth).  
Mas a **aprovação/revisão do Google** é um processo externo, com regras de conformidade (links legais, conteúdo, acessibilidade pública).  
Mesmo quando o app está correto, o Google às vezes valida esses links de forma automatizada **sem executar JavaScript** ou com checagens bem rígidas (ex.: evitar páginas que dependem do SPA para exibir conteúdo). Por isso, um link que “abre no navegador” pode ainda ser marcado como inválido por eles.

## Diagnóstico do estado atual (o que já está certo)
- Existem rotas no app para:
  - `/privacidade` (página React `src/pages/Privacidade.tsx`)
  - `/termos` (página React `src/pages/Termos.tsx`)
- Existem links visíveis no Header e na Hero apontando para `/privacidade` e `/termos`.
- `robots.txt` permite indexação (não bloqueia bots).

Mesmo assim, como o Google ainda acusa “ausente/inválido”, o caminho mais robusto é fornecer páginas legais **estáticas** no diretório `public/`.

## Solução proposta (mais robusta para validação do Google)
### A) Criar páginas estáticas públicas (sem SPA)
1. Criar:
   - `public/privacy.html` (ou `public/privacidade.html`)
   - `public/terms.html` (ou `public/termos.html`)
2. Conteúdo mínimo nessas páginas:
   - Título claro (“Política de Privacidade – CLARA”)
   - Texto objetivo incluindo:
     - Quais dados são coletados (nome/email/foto, histórico se aplicável)
     - Finalidade do uso
     - Como remover/solicitar exclusão
     - Contato (email)
   - Link interno entre elas (Privacidade ↔ Termos)
   - Sem exigir login; sem redirecionar; sem scripts obrigatórios
3. Garantir que essas URLs respondam 200 com HTML completo imediatamente:
   - `https://clarainova.lovable.app/privacidade.html` (ou `/privacy.html`)
   - `https://clarainova.lovable.app/termos.html` (ou `/terms.html`)

### B) Trocar os links do site para apontarem para as páginas estáticas
Para evitar qualquer ambiguidade no Google:
- Header: trocar `/privacidade` → `/privacidade.html` e `/termos` → `/termos.html`
- HeroSection: idem
- Login (/login): idem (já é um lugar crítico porque fica antes do botão do Google)

Isso garante que o usuário e o Google sempre chegam no conteúdo legal, mesmo que o validador não execute JS.

### C) (Opcional) Reforçar “descoberta” no HTML base
Adicionar no `index.html`:
- `<link rel="privacy-policy" href="/privacidade.html">`
- `<link rel="terms-of-service" href="/termos.html">`
E opcionalmente um bloco `<noscript>` contendo links visíveis (para validadores simples).

## Checklist de validação (antes de reenviar ao Google)
1. Testar em janela anônima:
   - Abrir: `https://clarainova.lovable.app/privacidade.html`
   - Abrir: `https://clarainova.lovable.app/termos.html`
   - Confirmar que carrega conteúdo imediatamente (sem “tela em branco”).
2. Testar com “copiar e colar” o link direto (deep link):
   - Se abrir direto, é ótimo sinal.
3. Atualizar no Google Cloud Console (OAuth consent screen):
   - Homepage: `https://clarainova.lovable.app`
   - Privacy Policy: `https://clarainova.lovable.app/privacidade.html`
   - Terms of Service: `https://clarainova.lovable.app/termos.html`

## O que eu vou implementar quando você trocar para o modo de edição (Default mode)
1. Criar os arquivos HTML estáticos em `public/` (privacidade e termos).
2. Atualizar:
   - `src/components/Header.tsx` (links)
   - `src/components/HeroSection.tsx` (link)
   - `src/pages/Login.tsx` (link)
3. (Opcional) Atualizar `index.html` com `rel="privacy-policy"` / `rel="terms-of-service"` e um `<noscript>` simples.
4. Te passar uma lista final das URLs exatas para você colar no Google.

## Observação importante
Manteremos as páginas React (`/privacidade` e `/termos`) se você quiser (bom para UX dentro do app), mas a recomendação para “destravar” a verificação é apontar o Google (e os links principais) para as versões `.html` estáticas.

