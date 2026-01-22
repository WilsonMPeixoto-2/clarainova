const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 border-t border-border/40">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Copyright */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-xl font-bold text-foreground">CLARA</span>
            <p className="text-sm text-muted-foreground">
              © {currentYear} CLARA. Todos os direitos reservados.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6 md:gap-8">
            <a 
              href="#termos" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Termos de Uso
            </a>
            <a 
              href="#privacidade" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Política de Privacidade
            </a>
            <a 
              href="#contato" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Contato
            </a>
          </nav>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 pt-6 border-t border-border/20">
          <p className="text-xs text-muted-foreground/70 text-center max-w-3xl mx-auto">
            A CLARA é uma ferramenta de apoio e suas orientações não substituem a consulta direta às normas oficiais ou assessoria jurídica especializada.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
