import { lazy, Suspense, ComponentType, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingFallback } from "@/components/LoadingFallback";
import { LenisProvider } from "@/components/LenisProvider";
import { AuthProvider } from "@/contexts/AuthContext";

// Wrapper para lazy imports com retry automático em caso de falha de cache
function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
) {
  const reloadMarkerKey = "clara:lazy-reload-attempted";

  return lazy(async () => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(reloadMarkerKey);
      }
      return await importFn();
    } catch (error) {
      console.error("Failed to load module, reloading...", error);

      if (typeof window !== "undefined") {
        const alreadyReloaded = window.sessionStorage.getItem(reloadMarkerKey) === "1";
        if (!alreadyReloaded) {
          window.sessionStorage.setItem(reloadMarkerKey, "1");
          window.location.reload();
        }
      }

      return { default: (() => null) as unknown as T };
    }
  });
}

// Lazy load de páginas com retry automático
const Index = lazyWithRetry(() => import("./pages/Index"));
const Login = lazyWithRetry(() => import("./pages/Login"));
// Chat is now integrated into Index via ChatPanel
const Admin = lazyWithRetry(() => import("./pages/Admin"));
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
          <Route path="/privacidade" element={<Navigate to="/privacidade.html" replace />} />
          <Route path="/termos" element={<Navigate to="/termos.html" replace />} />
          <Route path="/sobre" element={<Navigate to="/sobre.html" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => {
  useEffect(() => {
    document.body.classList.add("js-enabled");
    return () => {
      document.body.classList.remove("js-enabled");
    };
  }, []);

  return (
    <ErrorBoundary>
      <HelmetProvider>
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
              <Analytics />
              <SpeedInsights />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
};

export default App;
