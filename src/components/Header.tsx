import { useState } from 'react';
import { Menu, X, MessageCircle } from 'lucide-react';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onOpenChat?: () => void;
}

const Header = ({ onOpenChat }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isScrolled } = useScrollPosition(50);
  const location = useLocation();

  const navLinks = [
    { label: 'Base de Conhecimento', href: '#conhecimento' },
    { label: 'Dúvidas Frequentes', href: '#faq' },
    { label: 'Política de Privacidade', href: '/privacidade.html' },
    { label: 'Termos de Uso', href: '/termos.html' },
  ];

  const isActiveLink = (href: string) => {
    if (href.startsWith('#')) {
      return location.hash === href;
    }
    return location.pathname === href;
  };

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-normal ${
          isScrolled 
            ? 'bg-surface-1/85 backdrop-blur-xl border-b border-border-subtle shadow-sm' 
            : 'bg-transparent border-b border-transparent'
        }`}
        role="banner"
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <a 
              href="/" 
              className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg group"
            >
              <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-fast">
                CLARA
              </span>
              {/* Badge refined - editorial style */}
              <span 
                className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-primary/10 text-primary/80 border border-primary/20"
                aria-label="Versão de testes"
              >
                Preview
              </span>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1" role="navigation" aria-label="Navegação principal">
              {navLinks.map((link) => {
                const isActive = isActiveLink(link.href);
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-fast
                      ${isActive 
                        ? 'text-primary' 
                        : 'text-text-secondary hover:text-foreground hover:bg-surface-3/50'
                      }
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                    `}
                  >
                    {link.label}
                    {/* Active indicator - refined 1px underline */}
                    {isActive && (
                      <span className="absolute bottom-0.5 left-4 right-4 h-px bg-primary rounded-full" />
                    )}
                  </a>
                );
              })}
              
              {/* Chat Button - Premium pill with amber accent */}
              {onOpenChat && (
                <Button
                  onClick={onOpenChat}
                  size="sm"
                  className="ml-3 gap-2 shadow-sm hover:shadow-glow border border-primary/20"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  Chat
                </Button>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-lg text-text-secondary hover:text-foreground hover:bg-surface-3/50 transition-all duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Navigation Drawer */}
      <nav 
        id="mobile-menu"
        className={`fixed top-0 right-0 z-50 h-full w-[280px] bg-surface-1 border-l border-border-subtle shadow-lg transform transition-transform duration-normal ease-out lg:hidden
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="navigation"
        aria-label="Menu mobile"
        aria-hidden={!mobileMenuOpen}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
          <span className="text-lg font-semibold text-foreground">Menu</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-text-secondary hover:text-foreground hover:bg-surface-3/50 transition-all duration-fast"
            aria-label="Fechar menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex flex-col h-[calc(100%-73px)]">
          {/* Navigation Links */}
          <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.href);
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-fast
                    ${isActive 
                      ? 'bg-primary/15 text-primary border-l-2 border-primary' 
                      : 'text-text-secondary hover:text-foreground hover:bg-surface-3/50'
                    }
                  `}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
          
          {/* Drawer Footer - CTA */}
          {onOpenChat && (
            <div className="px-4 py-6 border-t border-border-subtle">
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenChat();
                }}
                className="w-full gap-2 h-12 text-base shadow-md hover:shadow-glow"
              >
                <MessageCircle size={18} aria-hidden="true" />
                Chat com CLARA
              </Button>
              <p className="text-hint text-center mt-3">
                Tire suas dúvidas instantaneamente
              </p>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Header;
