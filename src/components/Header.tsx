import { useState } from 'react';
import { Menu, X, MessageCircle } from 'lucide-react';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onOpenChat?: () => void;
}

const Header = ({ onOpenChat }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isScrolled } = useScrollPosition(50);

  const navLinks = [
    { label: 'Base de Conhecimento', href: '#conhecimento' },
    { label: 'Dúvidas Frequentes', href: '#faq' },
    { label: 'Política de Privacidade', href: '/privacidade.html' },
    { label: 'Termos de Uso', href: '/termos.html' },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-normal ${
        isScrolled 
          ? 'bg-background/80 backdrop-blur-lg border-b border-border-subtle' 
          : 'bg-transparent border-b border-transparent'
      }`}
      role="banner"
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg">
            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              CLARA
            </span>
            <span className="test-badge hidden sm:inline-block" aria-label="Versão de testes">
              Versão de testes
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6" role="navigation" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg px-2 py-1"
              >
                {link.label}
              </a>
            ))}
            
            {/* Chat Button */}
            {onOpenChat && (
              <Button
                onClick={onOpenChat}
                size="sm"
                className="gap-2"
              >
                <MessageCircle size={16} aria-hidden="true" />
                Chat
              </Button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav 
            id="mobile-menu"
            className="md:hidden py-4 border-t border-border-subtle animate-fade-in"
            role="navigation"
            aria-label="Menu mobile"
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg px-2"
                >
                  {link.label}
                </a>
              ))}
              
              {/* Mobile Chat Button */}
              {onOpenChat && (
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenChat();
                  }}
                  size="sm"
                  className="gap-2 mt-2"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  Chat com CLARA
                </Button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
