const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-16 md:py-20 border-t border-border-subtle" role="contentinfo">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo & Copyright */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <span className="text-xl font-bold text-foreground tracking-tight">CLARA</span>
            <p className="text-caption">
              © {currentYear} CLARA. Todos os direitos reservados.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6 md:gap-8" aria-label="Links do rodapé">
            <a 
              href="/sobre.html" 
              rel="about"
              className="footer-link"
            >
              Sobre
            </a>
            <a 
              href="/termos.html" 
              className="footer-link"
            >
              Termos de Serviço
            </a>
            <a 
              href="/privacidade.html" 
              rel="privacy-policy"
              itemProp="privacyPolicy"
              className="footer-link"
            >
              Política de Privacidade
            </a>
            <a 
              href="mailto:wilsonmp2@gmail.com" 
              className="footer-link"
            >
              Contato
            </a>
          </nav>
        </div>

        {/* Disclaimer */}
        <div className="mt-10 pt-8 border-t border-border-subtle">
          <p className="text-xs text-text-muted text-center max-w-3xl mx-auto leading-relaxed" role="note">
            A CLARA é uma ferramenta de apoio e suas orientações não substituem a consulta direta às normas oficiais ou assessoria jurídica especializada.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
