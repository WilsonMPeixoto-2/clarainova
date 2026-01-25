import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { ArrowUp } from 'lucide-react';

const Privacidade = () => {
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
        title="Política de Privacidade - CLARA"
        description="Política de Privacidade da CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas. Saiba como protegemos seus dados."
        keywords={["política de privacidade", "CLARA", "LGPD", "proteção de dados", "privacidade"]}
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
                Política de Privacidade
              </h1>
              <p className="text-muted-foreground">
                Última atualização: {lastUpdated}
              </p>
            </header>
          </ScrollReveal>

          <div className="prose prose-invert max-w-none space-y-8">
            <ScrollReveal delay={0.1}>
              <section id="introducao" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">1. Introdução</h2>
                <p className="text-muted-foreground leading-relaxed">
                  A CLARA (Consultora de Legislação e Apoio a Rotinas Administrativas) é um assistente virtual 
                  especializado em orientações sobre SEI, SDP e procedimentos administrativos da 4ª CRE. 
                  Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas 
                  informações pessoais quando você utiliza nosso serviço.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Estamos comprometidos com a proteção da sua privacidade e com o cumprimento da Lei Geral de 
                  Proteção de Dados (LGPD - Lei nº 13.709/2018).
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <section id="dados-coletados" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">2. Dados Coletados</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Ao utilizar a CLARA com autenticação via Google, coletamos os seguintes dados:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong className="text-foreground">Nome:</strong> Seu nome de exibição do perfil Google</li>
                  <li><strong className="text-foreground">Email:</strong> Seu endereço de email do Google</li>
                  <li><strong className="text-foreground">Foto do perfil:</strong> Sua foto de perfil do Google (opcional)</li>
                  <li><strong className="text-foreground">Histórico de conversas:</strong> As mensagens trocadas com a CLARA</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  <strong className="text-foreground">Nota:</strong> Você pode utilizar a CLARA sem autenticação, 
                  porém o histórico de conversas não será salvo entre sessões.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <section id="uso-dados" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">3. Uso dos Dados</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Utilizamos seus dados pessoais para as seguintes finalidades:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong className="text-foreground">Autenticação:</strong> Identificar você e permitir acesso ao serviço</li>
                  <li><strong className="text-foreground">Personalização:</strong> Exibir seu nome e foto no interface</li>
                  <li><strong className="text-foreground">Histórico:</strong> Manter suas conversas anteriores para referência</li>
                  <li><strong className="text-foreground">Melhoria do serviço:</strong> Analisar padrões de uso (de forma anônima)</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.25}>
              <section id="protecao" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">4. Proteção dos Dados</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Implementamos medidas técnicas e organizacionais para proteger seus dados:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
                  <li>Armazenamento seguro em servidores protegidos</li>
                  <li>Acesso restrito apenas a pessoal autorizado</li>
                  <li>Autenticação segura via OAuth 2.0 do Google</li>
                  <li>Políticas de segurança a nível de banco de dados (RLS)</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <section id="compartilhamento" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">5. Compartilhamento de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Não vendemos, alugamos ou compartilhamos</strong> suas informações 
                  pessoais com terceiros para fins comerciais ou de marketing.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Seus dados podem ser compartilhados apenas nas seguintes situações:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Quando exigido por lei ou ordem judicial</li>
                  <li>Para proteger nossos direitos legais</li>
                  <li>Com provedores de infraestrutura essenciais para o funcionamento do serviço</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.35}>
              <section id="direitos" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">6. Seus Direitos (LGPD)</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  De acordo com a LGPD, você tem os seguintes direitos sobre seus dados:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong className="text-foreground">Acesso:</strong> Solicitar informações sobre seus dados armazenados</li>
                  <li><strong className="text-foreground">Correção:</strong> Solicitar a correção de dados incorretos</li>
                  <li><strong className="text-foreground">Exclusão:</strong> Solicitar a exclusão de seus dados pessoais</li>
                  <li><strong className="text-foreground">Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                  <li><strong className="text-foreground">Revogação:</strong> Retirar seu consentimento a qualquer momento</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Para exercer esses direitos, entre em contato conosco através do email indicado na seção de Contato.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <section id="cookies" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">7. Cookies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Utilizamos cookies essenciais para o funcionamento do serviço, incluindo:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li><strong className="text-foreground">Cookies de autenticação:</strong> Para manter sua sessão ativa</li>
                  <li><strong className="text-foreground">Cookies de preferências:</strong> Para lembrar suas configurações</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Não utilizamos cookies de rastreamento ou publicidade.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.45}>
              <section id="alteracoes" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">8. Alterações nesta Política</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Podemos atualizar esta Política de Privacidade periodicamente. Quando fizermos alterações 
                  significativas, atualizaremos a data de "última atualização" no topo desta página e, 
                  quando apropriado, notificaremos você por email.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Recomendamos que você revise esta política periodicamente para se manter informado sobre 
                  como protegemos seus dados.
                </p>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.5}>
              <section id="contato" className="bg-card/30 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-border/40">
                <h2 className="text-xl font-semibold text-foreground mb-4">9. Contato</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para questões relacionadas a esta Política de Privacidade ou ao tratamento de seus dados 
                  pessoais, entre em contato conosco:
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

          <ScrollReveal delay={0.55}>
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

export default Privacidade;
