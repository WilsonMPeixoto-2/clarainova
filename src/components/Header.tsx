import { useState } from 'react';
import { Menu, X, MessageCircle } from 'lucide-react';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onOpenChat?: () => void;
}

const Header = ({ onOpenChat }: HeaderProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isScrolled } = useScrollPosition(50);
  const location = useLocation();

  const primaryLinks = [
    { label: 'Base de Conhecimento', href: '#conhecimento', note: 'Guias e fluxos principais' },
    { label: 'Dúvidas Frequentes', href: '#faq', note: 'Perguntas e respostas rápidas' },
  ];

  const secondaryLinks = [
    { label: 'Política de Privacidade', href: '/privacidade.html', note: 'Uso e proteção de dados' },
    { label: 'Termos de Uso', href: '/termos.html', note: 'Condições de acesso ao serviço' },
    { label: 'Contato', href: 'mailto:wilsonmp2@gmail.com', note: 'wilsonmp2@gmail.com' },
  ];

  const isActiveLink = (href: string) => {
    if (href.startsWith('#')) {
      return location.hash === href;
    }
    if (href.startsWith('/')) {
      return location.pathname === href;
    }
    return false;
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
            {/* Brand Mark (minimal monogram to avoid duplicate CLARA headline) */}
            <a 
              href="/" 
              className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
            >
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-primary/35 bg-primary/10 text-primary text-sm font-semibold tracking-tight"
                aria-hidden="true"
              >
                C
              </span>
              <span className="hidden sm:flex flex-col leading-tight">
                <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Sistema</span>
                <span className="text-sm font-semibold tracking-tight text-foreground">Inteligência Administrativa</span>
              </span>
              <span className="sr-only">CLARA - Página inicial</span>
            </a>

            <div className="flex items-center gap-2">
              {onOpenChat && (
                <Button
                  onClick={onOpenChat}
                  size="sm"
                  className="btn-clara-primary type-label h-10 px-4 gap-2"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  Chat
                </Button>
              )}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border border-border-subtle bg-surface-1/80 text-text-secondary hover:text-foreground hover:border-primary/35 hover:shadow-[0_0_12px_hsl(var(--glow)/0.14)] transition-all duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={menuOpen}
                aria-controls="site-menu"
              >
                {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
                <span className="hidden sm:inline text-[11px] uppercase tracking-[0.08em] font-semibold">
                  {menuOpen ? 'Fechar' : 'Menu'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Drawer Overlay */}
      {menuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-[hsl(var(--bg-base)/0.72)] backdrop-blur-[1.5px]"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Navigation Drawer */}
      <nav 
        id="site-menu"
        className={`drawer-shell fixed top-0 right-0 z-50 h-full w-[min(92vw,360px)] border-l transform transition-transform duration-normal ease-out
          ${menuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-label="Menu de navegação"
        aria-hidden={!menuOpen}
      >
        {/* Drawer Header */}
        <div className="drawer-header-surface flex items-center justify-between px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-primary/35 bg-primary/10 text-primary text-xs font-semibold"
              aria-hidden="true"
            >
              C
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.11em] text-text-muted">Navegação</p>
              <p className="text-sm font-semibold text-foreground">Menu CLARA</p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 rounded-lg text-text-secondary hover:text-foreground hover:bg-surface-3/50 transition-all duration-fast"
            aria-label="Fechar menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex flex-col h-[calc(100%-86px)]">
          {/* Navigation Links */}
          <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
            <div className="space-y-1">
              <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.11em] text-text-muted">Base e suporte</p>
              {primaryLinks.map((link) => {
                const isActive = isActiveLink(link.href);
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`group flex flex-col px-3 py-3 rounded-xl border transition-all duration-fast
                      ${isActive 
                        ? 'border-primary/45 bg-primary/10' 
                        : 'border-border-subtle bg-surface-2/45 hover:border-primary/30 hover:bg-surface-2/72'
                      }
                    `}
                  >
                    <span className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                      {link.label}
                    </span>
                    <span className="text-xs text-text-muted mt-1">{link.note}</span>
                  </a>
                );
              })}
            </div>

            <div className="space-y-1">
              <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.11em] text-text-muted">Informações legais</p>
              {secondaryLinks.map((link) => {
                const isActive = isActiveLink(link.href);
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`group flex flex-col px-3 py-3 rounded-xl border transition-all duration-fast
                    ${isActive 
                      ? 'border-primary/45 bg-primary/10' 
                      : 'border-border-subtle bg-surface-2/45 hover:border-primary/30 hover:bg-surface-2/72'
                    }
                  `}
                  >
                    <span className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                      {link.label}
                    </span>
                    <span className="text-xs text-text-muted mt-1">{link.note}</span>
                  </a>
                );
              })}
            </div>
          </div>
          
          {/* Drawer Footer - CTA */}
          {onOpenChat && (
            <div className="drawer-footer-surface px-4 py-5 border-t">
              <Button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenChat();
                }}
                className="btn-clara-primary type-label w-full gap-2 h-11"
              >
                <MessageCircle size={18} aria-hidden="true" />
                Chat com CLARA
              </Button>
              <p className="text-hint text-center mt-3 leading-relaxed">
                Atalhos, base de apoio e documentos em um único menu.
              </p>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Header;
