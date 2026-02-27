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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!/[\\/]node_modules[\\/]/.test(id)) {
            return;
          }

          if (id.includes("jspdf")) {
            return "vendor-jspdf";
          }

          if (id.includes("pdfjs-dist")) {
            return "vendor-pdfjs";
          }

          if (id.includes("html2canvas")) {
            return "vendor-html2canvas";
          }

          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) ||
            id.includes("react-router") ||
            id.includes("@tanstack/react-query")
          ) {
            return "vendor-core";
          }

          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }

          if (
            id.includes("framer-motion") ||
            id.includes("motion-dom") ||
            id.includes("motion-utils")
          ) {
            return "vendor-motion";
          }

          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }

          if (id.includes("recharts") || /[\\/]node_modules[\\/]d3-/.test(id)) {
            return "vendor-charts";
          }
        },
      },
    },
  },
  esbuild: {
    target: "esnext",
  },
}));
