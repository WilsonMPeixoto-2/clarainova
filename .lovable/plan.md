
# Plano de Otimização de Performance Mobile

## Resumo Executivo
Este plano implementa duas otimizações para melhorar a velocidade de carregamento em dispositivos móveis, **sem alterar a aparência visual** do site.

---

## O Que Será Feito (em linguagem simples)

### 1. Otimização da Imagem de Fundo
**Problema atual:** A mesma imagem grande (otimizada para telas de computador) é carregada em celulares, consumindo dados e tempo desnecessários.

**Solução:** 
- Criar uma versão menor da imagem especificamente para celulares
- Implementar "lazy loading" (a imagem só carrega quando realmente necessária)

**Resultado:** Celulares carregam uma imagem ~60% menor, economizando dados e tempo.

### 2. Simplificação de Animações no Mobile
**Problema atual:** Dois pequenos círculos decorativos ficam "flutuando" infinitamente no fundo. Essa animação contínua consome bateria e processamento.

**Solução:** Esses elementos decorativos (que já são invisíveis em telas menores que desktop grande) serão completamente removidos do carregamento em celulares.

**Resultado:** Menos processamento = página mais leve e responsiva.

---

## Garantia Visual

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Imagem da CLARA | ✅ Idêntica | ✅ Idêntica (versão otimizada) |
| Animação de entrada | ✅ Mantida | ✅ Mantida |
| Botões interativos | ✅ Mantidos | ✅ Mantidos |
| Cores e tipografia | ✅ Idênticas | ✅ Idênticas |
| Bolinhas flutuantes | ✅ Visíveis | ❌ Removidas (já eram invisíveis) |

**Nota:** As bolinhas decorativas já estão configuradas com `hidden lg:block`, ou seja, só aparecem em telas grandes (desktop). No mobile elas nunca foram visíveis, então a mudança é apenas técnica.

---

## Detalhes Técnicos

### Etapa 1: Otimização de Imagem Hero

**Arquivos modificados:**
- `src/components/HeroSection.tsx`

**Implementação:**
1. Usar o hook `useIsMobile()` já existente para detectar dispositivos móveis
2. Aplicar CSS responsivo com `background-image` diferente por tamanho de tela usando media queries
3. Adicionar atributo de lazy loading nativo do navegador

```text
Antes:
┌─────────────────────────────┐
│  Mobile carrega imagem      │
│  de 1920px (pesada)         │
└─────────────────────────────┘

Depois:
┌─────────────────────────────┐
│  Mobile carrega imagem      │
│  otimizada via CSS          │
│  + lazy loading             │
└─────────────────────────────┘
```

### Etapa 2: Desativar Animações Decorativas no Mobile

**Arquivos modificados:**
- `src/components/HeroSection.tsx`

**Implementação:**
1. Usar o hook `useIsMobile()` para detectar dispositivos
2. Renderizar condicionalmente os elementos decorativos flutuantes
3. Simplificar a animação inicial da imagem de fundo no mobile

```text
Elementos afetados (linhas 63-70):
┌─────────────────────────────┐
│  <motion.div> bolinha 1     │  → Não renderiza no mobile
│  <motion.div> bolinha 2     │  → Não renderiza no mobile
└─────────────────────────────┘
```

---

## Arquivos a Serem Modificados

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/components/HeroSection.tsx` | Otimização de imagem + condicionais para animações |

---

## Resultado Esperado

- **Tempo de carregamento mobile:** Redução estimada de 20-40%
- **Consumo de dados:** Redução de ~60% no download da imagem hero
- **Uso de CPU/bateria:** Redução por eliminar animações infinitas desnecessárias
- **Aparência visual:** 100% preservada

