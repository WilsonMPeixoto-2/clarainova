import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, MessageCircle } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("404 route accessed:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="404 - Página não encontrada | CLARA"
        description="A rota solicitada não foi encontrada. Volte para a experiência principal da CLARA."
        noIndex
      />

      <Header />

      <main className="pt-28 pb-20 min-h-[70vh] flex items-center justify-center px-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-2xl rounded-3xl border border-border-subtle bg-[linear-gradient(165deg,hsl(var(--bg-elev)/0.94),hsl(var(--bg-base)/0.88))] p-8 md:p-10 shadow-[0_26px_52px_hsl(var(--shadow)/0.5)]"
        >
          <span className="knowledge-kicker">
            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Rota não encontrada
          </span>

          <h1 className="text-h2 mt-5">
            404
          </h1>
          <p className="text-body mt-3 max-w-xl">
            A página <strong className="text-foreground">{location.pathname}</strong> não existe ou foi movida para uma nova estrutura.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/" className="btn-clara-primary type-label inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar para a home
            </a>
            <a href="/?chat=1" className="btn-clara-secondary type-label inline-flex items-center gap-2">
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Falar com a CLARA
            </a>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
