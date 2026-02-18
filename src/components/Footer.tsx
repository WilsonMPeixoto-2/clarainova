import { Mail, Phone, Linkedin, ShieldCheck } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-16 md:py-20 border-t border-border-subtle" role="contentinfo">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div className="flex flex-col gap-3 max-w-xl">
            <span className="text-xl font-bold text-foreground tracking-tight">CLARA</span>
            <p className="text-sm text-muted-foreground">
              Desenvolvido por <span className="text-foreground font-medium">Wilson M. Peixoto</span> - SME/RJ
            </p>
            <p className="text-xs text-muted-foreground/80">Inovação para a Gestão Pública</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground/75">
              <a href="tel:+5521994974132" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                (21) 99497-4132
              </a>
              <a href="mailto:wilsonmp2@gmail.com" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                wilsonmp2@gmail.com
              </a>
              <a
                href="https://www.linkedin.com/in/wilsonmalafaia/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5" aria-hidden="true" />
                LinkedIn
              </a>
            </div>

            <p className="text-caption">© {currentYear} CLARA. Todos os direitos reservados.</p>
          </div>

          <nav className="flex flex-wrap justify-start md:justify-center gap-6 md:gap-8" aria-label="Links do rodapé">
            <a href="/sobre.html" rel="about" className="footer-link">
              Sobre
            </a>
            <a href="/termos.html" className="footer-link">
              Termos de Serviço
            </a>
            <a href="/privacidade.html" rel="privacy-policy" itemProp="privacyPolicy" className="footer-link">
              Política de Privacidade
            </a>
            <a href="mailto:wilsonmp2@gmail.com" className="footer-link">
              Contato
            </a>
          </nav>
        </div>

        <div className="mt-10 pt-8 border-t border-border-subtle">
          <p className="text-xs text-text-muted text-center max-w-3xl mx-auto leading-relaxed inline-flex items-center justify-center gap-2" role="note">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            A CLARA é uma ferramenta de apoio e suas orientações não substituem a consulta direta às normas oficiais ou assessoria jurídica especializada.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
