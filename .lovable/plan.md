
# Plano: Corrigir Erro de Página Não Funcionando

## Diagnóstico

O erro mostra dois problemas encadeados:

1. **"Failed to fetch dynamically imported module: src/pages/Index.tsx"**
   - O Vite não consegue carregar o módulo lazy-loaded
   
2. **"Cannot read properties of null (reading 'useState')"**
   - Indica múltiplas instâncias do React em conflito

O `force: true` no `vite.config.ts` força reconstrução de dependências, mas pode criar inconsistência temporária entre o cache do navegador e os novos bundles.

## Causa Raiz

Quando `force: true` é aplicado:
- O Vite regenera os hashes dos chunks (ex: `chunk-DRWLMN53.js?v=8a24826e`)
- O navegador pode ter cache de módulos antigos
- O lazy loading tenta carregar módulos com hashes desatualizados
- React é carregado de bundles diferentes, causando o erro de hooks

## Solução (2 alterações)

### 1. Remover `force: true` do vite.config.ts

O `force: true` só deve ser usado uma vez para limpar cache corrompido. Mantê-lo permanentemente causa rebuilds desnecessários e pode gerar inconsistências.

**Arquivo: `vite.config.ts`**

```typescript
optimizeDeps: {
  include: ["react", "react-dom", "framer-motion"],
  exclude: [],
  // Remover: force: true,
  esbuildOptions: {
    target: "esnext",
  },
},
```

### 2. Adicionar tratamento de erro no lazy loading

Para evitar que erros de cache quebrem a aplicação, adicionar retry automático nos imports dinâmicos.

**Arquivo: `src/App.tsx`**

Criar uma função wrapper que tenta recarregar o módulo em caso de falha:

```typescript
// Função para retry de lazy imports com fallback
function lazyWithRetry(
  importFn: () => Promise<{ default: React.ComponentType<unknown> }>
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // Se falhar, força refresh da página para limpar cache
      console.error("Failed to load module, reloading...", error);
      window.location.reload();
      // Retorna um componente vazio enquanto recarrega
      return { default: () => null };
    }
  });
}

// Uso:
const Index = lazyWithRetry(() => import("./pages/Index"));
const Login = lazyWithRetry(() => import("./pages/Login"));
// ... demais páginas
```

## Por que isso resolve

| Problema | Solução |
|----------|---------|
| Cache inconsistente | Remove `force: true` para estabilizar hashes |
| Falha no lazy loading | Retry automático com reload |
| Múltiplas instâncias React | Deduplicação já configurada funciona corretamente |

## Ação Imediata do Usuário

Enquanto implemento as correções, o usuário pode resolver temporariamente:
- **Limpar cache do navegador** e recarregar a página
- Ou usar **Ctrl+Shift+R** (hard refresh)

## Resultado Esperado

Após as alterações:
- A página carrega normalmente
- Erros de cache são tratados automaticamente com reload
- Não haverá mais conflitos de instâncias do React
