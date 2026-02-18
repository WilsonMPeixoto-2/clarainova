import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, MessageCircle, Compass } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const routeConfig: Record<string, { title: string; description: string; cta: string; anchor: string }> = {
  "/faq": {
    title: "FAQ em atualização editorial",
    description:
      "Estamos refinando curadoria, linguagem e profundidade visual da seção de dúvidas frequentes para manter consistência premium com a experiência CLARA.",
    cta: "Ver seção de FAQ na Home",
    anchor: "/#faq",
  },
  "/base-conhecimento": {
    title: "Base de conhecimento em evolução",
    description:
      "A próxima versão inclui navegação temática, camadas visuais e fluxos guiados para uma consulta mais rápida e mais confiável.",
    cta: "Ir para Base na Home",
    anchor: "/#conhecimento",
  },
  "/base-de-conhecimento": {
    title: "Base de conhecimento em evolução",
    description:
      "A próxima versão inclui navegação temática, camadas visuais e fluxos guiados para uma consulta mais rápida e mais confiável.",
    cta: "Ir para Base na Home",
    anchor: "/#conhecimento",
  },
};

export default function ComingSoon() {
  const location = useLocation();
  const config = routeConfig[location.pathname] ?? {
    title: "Seção em atualização",
    description:
      "Esta rota está recebendo melhorias visuais e funcionais. Enquanto isso, você pode navegar pela experiência principal da CLARA.",
    cta: "Voltar para Home",
    anchor: "/",
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${config.title} - CLARA`}
        description={config.description}
      />
      <Header />

      <main className="pt-28 pb-20">
        <div className="container mx-auto px-6">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="max-w-3xl mx-auto rounded-3xl border border-border-subtle bg-[linear-gradient(165deg,hsl(var(--bg-elev)/0.92),hsl(var(--bg-base)/0.84))] p-7 md:p-10 shadow-[0_22px_44px_hsl(var(--shadow)/0.45)]"
          >
            <span className="knowledge-kicker">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Atualização em andamento
            </span>
            <h1 className="text-h2 mt-5">{config.title}</h1>
            <p className="text-body mt-4 max-w-2xl">{config.description}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={config.anchor} className="btn-clara-primary type-label inline-flex items-center gap-2">
                <Compass className="w-4 h-4" aria-hidden="true" />
                {config.cta}
              </a>
              <a href="/?chat=1" className="btn-clara-secondary type-label inline-flex items-center gap-2">
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                Abrir Chat CLARA
              </a>
              <Link to="/" className="inline-flex items-center gap-2 text-caption hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Voltar para a página inicial
              </Link>
            </div>
          </motion.section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
