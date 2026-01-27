
# Plano: Corrigir Erro de Build (Top-Level Await)

## Problema

O `pdfjs-dist@4.0.379` usa **top-level await**, que não é suportado pelos targets padrão do Vite (`chrome87`, `edge88`, `es2020`).

```
ERROR: Top-level await is not available in the configured target environment
```

## Solução

Adicionar `target: "esnext"` em três lugares do `vite.config.ts`:

1. **`optimizeDeps.esbuildOptions.target`** - Para o dev server
2. **`build.target`** - Para o build de produção
3. **`esbuild.target`** - Para a transpilação geral

## Alteração Necessária

**Arquivo: `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "framer-motion"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "framer-motion"],
    exclude: [],
    esbuildOptions: {
      target: "esnext",  // <-- ADICIONAR
    },
  },
  build: {
    target: "esnext",    // <-- ADICIONAR
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  esbuild: {
    target: "esnext",    // <-- ADICIONAR
  },
}));
```

## Por que esta solução funciona

| Target | Suporta Top-Level Await |
|--------|------------------------|
| `es2020` | Não |
| `chrome87` | Não |
| `esnext` | Sim |

O `esnext` é suportado por todos os navegadores modernos (Chrome 89+, Firefox 89+, Safari 15+).

## Resultado Esperado

Após esta alteração, o build deve completar sem erros e o `pdfjs-dist` funcionará corretamente no frontend.
