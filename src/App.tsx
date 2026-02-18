import { lazy, Suspense, ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingFallback } from "@/components/LoadingFallback";
import { LenisProvider } from "@/components/LenisProvider";
import { AuthProvider } from "@/contexts/AuthContext";

// Wrapper para lazy imports com retry automático em caso de falha de cache
function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      console.error("Failed to load module, reloading...", error);
      window.location.reload();
      return { default: (() => null) as unknown as T };
    }
  });
}

// Lazy load de páginas com retry automático
const Index = lazyWithRetry(() => import("./pages/Index"));
const Login = lazyWithRetry(() => import("./pages/Login"));
// Chat is now integrated into Index via ChatPanel
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Privacidade = lazyWithRetry(() => import("./pages/Privacidade"));
const Termos = lazyWithRetry(() => import("./pages/Termos"));
const ComingSoon = lazyWithRetry(() => import("./pages/ComingSoon"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AnimatedRoutes() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/chat" element={<Index />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/faq" element={<ComingSoon />} />
          <Route path="/base-conhecimento" element={<ComingSoon />} />
          <Route path="/base-de-conhecimento" element={<ComingSoon />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LenisProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback message="Carregando página..." />}>
                <AnimatedRoutes />
              </Suspense>
            </BrowserRouter>
          </LenisProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
