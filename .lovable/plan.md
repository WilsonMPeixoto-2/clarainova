
## Objetivo
Corrigir os problemas apontados pelo Google na verificação OAuth:
1. Garantir que a homepage tenha links funcionais para a Política de Privacidade
2. Atualizar a Política de Privacidade com todas as declarações exigidas pelo Google

## Diagnóstico dos Problemas

### Problema 1: Links inconsistentes no Footer
O arquivo `src/components/Footer.tsx` ainda usa as rotas React (`/privacidade`, `/termos`) ao invés dos arquivos estáticos (`.html`). Isso pode causar falha na validação do Google.

### Problema 2: Política de Privacidade incompleta
O Google exige declarações específicas que estão ausentes:
- **Retenção de dados**: Quanto tempo os dados são mantidos
- **Exclusão de dados**: Como o usuário pode solicitar exclusão
- **Proibição de venda**: Declaração explícita de que NÃO vende dados
- **Proibição de publicidade**: Declaração de que NÃO usa dados para anúncios direcionados
- **Proibição de transferência**: Declaração de que NÃO transfere para corretores de dados

## Solução Proposta

### Parte A: Corrigir Footer.tsx
Atualizar os links de:
- `/privacidade` para `/privacidade.html`
- `/termos` para `/termos.html`

### Parte B: Atualizar public/privacidade.html
Adicionar/expandir as seguintes seções para atender aos requisitos do Google:

**Nova Seção - Retenção e Exclusão de Dados:**
- Período de retenção dos dados (enquanto a conta estiver ativa)
- Como solicitar exclusão (email de contato)
- Prazo para exclusão (30 dias)
- O que acontece após exclusão

**Atualizar Seção - Compartilhamento de Dados (mais explícita):**
- Adicionar declarações específicas exigidas pelo Google:
  - "Não vendemos seus dados para terceiros"
  - "Não compartilhamos dados para publicidade direcionada"
  - "Não transferimos dados para corretores de dados"
  - "Não usamos dados do Google para determinar crédito"

**Atualizar Seção - Uso dos Dados:**
- Declaração clara: "Usamos seus dados exclusivamente para fornecer os serviços solicitados"

**Atualizar Seção - Proteção dos Dados:**
- Linguagem mais clara sobre medidas de segurança

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Footer.tsx` | Trocar `/privacidade` por `/privacidade.html` e `/termos` por `/termos.html` |
| `public/privacidade.html` | Adicionar seção de retenção/exclusão, expandir seção de compartilhamento com declarações do Google |

## Resultado Esperado

Após as alterações:
1. Todos os links na homepage (Header, Hero, Footer) apontarão para `/privacidade.html`
2. A Política de Privacidade conterá todas as declarações exigidas pelo Google
3. O Google não terá mais motivos para rejeitar a verificação

## Próximos Passos (após implementação)
1. Publicar o projeto
2. Testar `https://clarainova.lovable.app/privacidade.html` em janela anônima
3. Atualizar o Google Cloud Console (OAuth consent screen) com:
   - Homepage: `https://clarainova.lovable.app`
   - Privacy Policy: `https://clarainova.lovable.app/privacidade.html`
   - Terms of Service: `https://clarainova.lovable.app/termos.html`
4. Reenviar para verificação respondendo ao email do Google
