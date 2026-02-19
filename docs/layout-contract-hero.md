# Layout Contract - Hero (Texto ↔ Clara)

## Escopo
- Objetivo: travar a geometria editorial do Hero sem alterar conteúdo textual aprovado.
- Regras aplicadas:
  - Split Hero com grid 12 colunas.
  - Texto ancorado no left rail com largura máxima controlada.
  - Safe frame determinístico por breakpoint com tokens CSS.
  - Overlay direcional (lado texto mais escuro, lado rosto mais limpo).
  - Modo debug por querystring `?debugLayout=1`.

## Tokens do Safe Frame

| Breakpoint | `--clara-pos-x` | `--clara-pos-y` | `--clara-scale` | `--clara-overlay` | Colunas Texto/Arte | Max-width texto |
|---|---:|---:|---:|---:|---|---|
| `>=1440` | `10%` | `44%` | `1.03` | `0.74` | `5 / 7` | `clamp(540px, 34vw, 640px)` |
| `1280-1439` | `13%` | `45%` | `1.01` | `0.78` | `5 / 7` | `clamp(520px, 35vw, 620px)` |
| `1024-1279` | `17%` | `46%` | `0.99` | `0.82` | `5 / 7` | `clamp(500px, 40vw, 600px)` |
| `900-1199` | `17%` | `47%` | `0.97` | `0.86` | `6 / 6` | `clamp(460px, 48vw, 560px)` |
| `<900` | `60%` | `48%` | `1.00` | `0.92` | `12 / 12` | `min(100%, 640px)` |

Nota: na interseção `1024-1199`, prevalece o contrato do limbo `900-1199` por prioridade de estabilidade.

## Checklist PASS/FAIL por Breakpoint

Critérios:
- Rosto não some.
- Texto não compete com a zona do rosto.
- Limbo `900-1199` mantém duas colunas estáveis.
- Sem regressão perceptível no mobile.

| Breakpoint | Rosto visível | Texto sem competição | Grid estável | Resultado |
|---|---|---|---|---|
| `>=1440` | PASS | PASS | PASS | PASS |
| `1280-1439` | PASS | PASS | PASS | PASS |
| `1024-1279` | PASS | PASS | PASS | PASS |
| `900-1199` | PASS | PASS | PASS | PASS |
| `<900` | PASS | PASS | PASS | PASS |

## Debug Mode
- Ativação: `?debugLayout=1`
- Exibe:
  - contorno do grid;
  - contorno das colunas texto/arte;
  - safe frame do rosto;
  - painel com breakpoint e valores finais dos tokens.
