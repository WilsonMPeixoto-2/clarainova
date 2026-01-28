const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 border-t border-border-subtle" role="contentinfo">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Copyright */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-xl font-bold text-foreground">CLARA</span>
            <p className="text-caption">
              © {currentYear} CLARA. Todos os direitos reservados.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6 md:gap-8" aria-label="Links do rodapé">
            <a 
              href="/sobre.html" 
              rel="about"
              className="text-caption hover:text-foreground transition-colors duration-150 focus-ring rounded px-1"
            >
              Sobre
            </a>
            <a 
              href="/termos.html" 
              className="text-caption hover:text-foreground transition-colors duration-150 focus-ring rounded px-1"
            >
              Termos de Serviço
            </a>
            <a 
              href="/privacidade.html" 
              rel="privacy-policy"
              itemProp="privacyPolicy"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-150 focus-ring rounded px-1"
            >
              Política de Privacidade
            </a>
            <a 
              href="mailto:wilsonmp2@gmail.com" 
              className="text-caption hover:text-foreground transition-colors duration-150 focus-ring rounded px-1"
            >
              Contato
            </a>
          </nav>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 pt-6 border-t border-border-subtle">
          <p className="text-hint text-center max-w-3xl mx-auto" role="note">
            A CLARA é uma ferramenta de apoio e suas orientações não substituem a consulta direta às normas oficiais ou assessoria jurídica especializada.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
