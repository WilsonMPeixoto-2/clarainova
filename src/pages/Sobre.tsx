import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { ArrowUp, Shield, Sparkles, Server, BookOpen } from 'lucide-react';

const Sobre = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Sobre - CLARA"
        description="Entenda o que é a CLARA (Consultora de Legislação e Apoio a Rotinas Administrativas), como funciona e quais são seus limites e compromissos."
        keywords={["sobre", "CLARA", "assistente virtual", "SEI", "legislação", "administração pública", "procedimentos administrativos"]}
      />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Pular para o conteúdo principal
      </a>

      <Header />

      <main id="main-content" className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <ScrollReveal>
            <header className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Sobre a CLARA</h1>
              <p className="text-muted-foreground">
                Uma assistente de apoio a rotinas administrativas, com foco em orientacoes passo a passo e indicacao de fontes.
              </p>
            </header>
          </ScrollReveal>

          <div className="prose prose-invert max-w-none space-y-8">
            <ScrollReveal delay={0.1}>
              <section className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles size={18} aria-hidden="true" />
                  O que e
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  A CLARA (Consultora de Legislacao e Apoio a Rotinas Administrativas) e uma ferramenta de apoio para
                  consultas e orientacoes relacionadas a legislacao, procedimentos e rotinas administrativas.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Ela foi desenhada para ajudar com perguntas praticas e para resumir/organizar informacoes, sempre
                  reforcando a necessidade de validacao junto a fontes oficiais.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <section className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Server size={18} aria-hidden="true" />
                  Como funciona (alto nivel)
                </h2>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong className="text-foreground">Frontend:</strong> React/Vite, com interface de chat e componentes de UI.
                  </li>
                  <li>
                    <strong className="text-foreground">Backend:</strong> Supabase (Auth/Database/Storage) e Edge Functions.
                  </li>
                  <li>
                    <strong className="text-foreground">IA:</strong> provedores (ex: Gemini) chamados pela Edge Function do chat.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Dependendo da configuracao, a CLARA pode responder apenas com base em contexto local (base de conhecimento)
                  e/ou com apoio de busca web quando habilitada.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <section className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40 bg-primary/5">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield size={18} aria-hidden="true" />
                  Limites e responsabilidade
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  A CLARA e uma <strong className="text-foreground">ferramenta de apoio</strong>. As orientacoes:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Podem conter imprecisoes e devem ser validadas em fontes oficiais.</li>
                  <li>Não substituem assessoria juridica ou decisao administrativa formal.</li>
                  <li>Não devem ser usadas como unico fundamento para atos administrativos.</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.25}>
              <section className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen size={18} aria-hidden="true" />
                  Transparencia
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  A CLARA prioriza respostas com estrutura, passos claros e indicacao de fontes quando disponiveis.
                  Quando houver duvidas, a recomendacao e sempre consultar o texto normativo oficial.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Para detalhes sobre privacidade e termos, consulte as paginas:
                  {' '}
                  <a href="/privacidade" className="text-primary hover:underline font-medium">Politica de Privacidade</a>
                  {' '}e{' '}
                  <a href="/termos" className="text-primary hover:underline font-medium">Termos de Servico</a>.
                </p>
              </section>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.3}>
            <div className="mt-12 text-center">
              <button
                onClick={scrollToTop}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg px-4 py-2"
                aria-label="Voltar ao topo"
              >
                <ArrowUp size={16} />
                Voltar ao topo
              </button>
            </div>
          </ScrollReveal>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Sobre;

