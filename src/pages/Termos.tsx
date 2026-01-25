import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { ArrowUp } from 'lucide-react';

const Termos = () => {
  const lastUpdated = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Termos de Serviço - CLARA"
        description="Termos de Serviço da CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas. Condições de uso do serviço."
        keywords={["termos de serviço", "CLARA", "termos de uso", "condições", "uso do serviço"]}
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
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Termos de Serviço
              </h1>
              <p className="text-muted-foreground">
                Última atualização: {lastUpdated}
              </p>
            </header>
          </ScrollReveal>

          <div className="prose prose-invert max-w-none space-y-8">
            <ScrollReveal delay={0.1}>
              <section id="aceitacao" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">1. Aceitação dos Termos</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ao acessar e utilizar a CLARA (Consultora de Legislação e Apoio a Rotinas Administrativas), 
                  você concorda em cumprir e estar vinculado a estes Termos de Serviço. Se você não concordar 
                  com qualquer parte destes termos, não poderá acessar o serviço.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Estes termos constituem um acordo legal entre você e a CLARA. Ao utilizar nosso serviço, 
                  você declara ter capacidade legal para celebrar este acordo.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <section id="descricao" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">2. Descrição do Serviço</h2>
                <p className="text-muted-foreground leading-relaxed">
                  A CLARA é um assistente virtual especializado em:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Orientações sobre o Sistema Eletrônico de Informações (SEI)</li>
                  <li>Procedimentos e rotinas administrativas</li>
                  <li>Consultas à legislação e normas aplicáveis</li>
                  <li>Sistemas de gestão pública</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  O serviço utiliza inteligência artificial para fornecer orientações baseadas em documentos 
                  oficiais e legislação vigente.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <section id="uso-permitido" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">3. Uso Permitido</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Você pode utilizar a CLARA para:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Consultas pessoais sobre procedimentos administrativos</li>
                  <li>Auxílio em atividades profissionais relacionadas à administração pública</li>
                  <li>Pesquisas sobre legislação e normas aplicáveis</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  <strong className="text-foreground">É vedado:</strong>
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Uso comercial ou revenda das orientações fornecidas</li>
                  <li>Tentativa de manipular ou explorar vulnerabilidades do sistema</li>
                  <li>Uso para fins ilegais ou antiéticos</li>
                  <li>Reprodução em massa do conteúdo para outros sistemas</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.25}>
              <section id="limitacao" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40 bg-primary/5">
                <h2 className="text-xl font-semibold text-foreground mb-4">4. Limitação de Responsabilidade</h2>
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg mb-4">
                  <p className="text-primary font-medium">⚠️ Aviso Importante</p>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  A CLARA é uma <strong className="text-foreground">ferramenta de apoio</strong> e suas orientações:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li><strong className="text-foreground">NÃO substituem</strong> a consulta direta às normas oficiais</li>
                  <li><strong className="text-foreground">NÃO substituem</strong> assessoria jurídica especializada</li>
                  <li><strong className="text-foreground">NÃO têm</strong> caráter oficial ou vinculante</li>
                  <li>Podem conter imprecisões ou informações desatualizadas</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  O usuário é responsável por verificar as informações junto às fontes oficiais antes de 
                  tomar decisões baseadas nas orientações fornecidas.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <section id="conta" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">5. Conta do Usuário</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ao criar uma conta através do login com Google, você é responsável por:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Manter a segurança de suas credenciais de acesso</li>
                  <li>Todas as atividades realizadas em sua conta</li>
                  <li>Notificar-nos imediatamente sobre qualquer uso não autorizado</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.35}>
              <section id="propriedade" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">6. Propriedade Intelectual</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Todo o conteúdo, design, código e funcionalidades da CLARA são protegidos por direitos 
                  de propriedade intelectual.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  A utilização do serviço não confere a você qualquer direito de propriedade sobre:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>A marca, logo e identidade visual da CLARA</li>
                  <li>O código-fonte e tecnologias utilizadas</li>
                  <li>Os modelos de inteligência artificial e base de conhecimento</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <section id="disponibilidade" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">7. Disponibilidade do Serviço</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Nos esforçamos para manter o serviço disponível 24 horas por dia, 7 dias por semana. 
                  No entanto, não garantimos disponibilidade ininterrupta e podemos:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Realizar manutenções programadas ou emergenciais</li>
                  <li>Suspender o serviço temporariamente por questões técnicas</li>
                  <li>Modificar ou descontinuar funcionalidades com aviso prévio</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.45}>
              <section id="modificacoes" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">8. Modificações nos Termos</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Reservamo-nos o direito de modificar estes Termos de Serviço a qualquer momento. 
                  Alterações significativas serão comunicadas através de:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Atualização da data de "última atualização" nesta página</li>
                  <li>Notificação por email para usuários registrados (quando aplicável)</li>
                  <li>Aviso no próprio serviço</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  O uso continuado do serviço após as alterações constitui aceitação dos novos termos.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.5}>
              <section id="lei" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">9. Lei Aplicável e Foro</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estes Termos de Serviço são regidos pelas leis da República Federativa do Brasil.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Qualquer controvérsia decorrente destes termos será submetida ao foro da comarca 
                  de Porto Alegre, Estado do Rio Grande do Sul, com exclusão de qualquer outro, 
                  por mais privilegiado que seja.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.55}>
              <section id="contato" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">10. Contato</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para questões relacionadas a estes Termos de Serviço, entre em contato conosco:
                </p>
                <div className="mt-4 p-4 bg-background/50 rounded-lg border border-border/40">
                  <p className="text-foreground font-medium">CLARA - Inteligência Administrativa</p>
                  <p className="text-muted-foreground mt-1">
                    Email: <a href="mailto:wilsonmp2@gmail.com" className="text-primary hover:underline">wilsonmp2@gmail.com</a>
                  </p>
                </div>
              </section>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.6}>
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

export default Termos;
