import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
  ],
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
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    cssCodeSplit: true,
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  esbuild: {
    target: "esnext",
  },
}));
