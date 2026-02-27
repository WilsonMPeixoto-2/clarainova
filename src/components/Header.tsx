import { useEffect, useState } from 'react';
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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const primaryLinks = [
    { label: 'Base de Conhecimento', href: '/#conhecimento', note: 'Guias e fluxos principais' },
    { label: 'Dúvidas Frequentes', href: '/#faq', note: 'Perguntas e respostas rápidas' },
  ];

  const secondaryLinks = [
    { label: 'Política de Privacidade', href: '/privacidade.html', note: 'Uso e proteção de dados' },
    { label: 'Termos de Uso', href: '/termos.html', note: 'Condições de acesso ao serviço' },
    { label: 'Contato', href: 'mailto:wilsonmp2@gmail.com', note: 'wilsonmp2@gmail.com' },
  ];

  const utilityLinks = [
    { label: 'Privacidade', href: '/privacidade.html' },
    { label: 'Termos', href: '/termos.html' },
    { label: 'Contato', href: 'mailto:wilsonmp2@gmail.com' },
  ];

  const isActiveLink = (href: string) => {
    if (href.includes('#')) {
      const [path, hash] = href.split('#');
      const hashWithPrefix = hash ? `#${hash}` : '';
      if (path && location.pathname !== path) return false;
      return hashWithPrefix ? location.hash === hashWithPrefix : false;
    }
    if (href.includes('privacidade')) {
      return location.pathname.startsWith('/privacidade');
    }
    if (href.includes('termos')) {
      return location.pathname.startsWith('/termos');
    }
    if (href.startsWith('/')) {
      return location.pathname === href;
    }
    return false;
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${isScrolled
            ? 'bg-white/[0.02] backdrop-blur-3xl saturate-150 border-b border-white/[0.08] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.4)]'
            : 'bg-transparent border-b border-transparent'
          }`}
        role="banner"
      >
        <div className="container mx-auto max-w-[1600px] px-6 md:px-8 xl:px-10">
          <div className="flex items-center h-16 gap-3 md:h-20 md:grid md:grid-cols-[minmax(300px,1fr)_auto_minmax(300px,1fr)] md:gap-10">
            {/* Brand Mark (minimal monogram to avoid duplicate CLARA headline) */}
            <a
              href="/"
              className="inline-flex items-center gap-2 shrink-0 min-w-[120px] sm:min-w-[150px] md:min-w-[280px] md:justify-self-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full"
            >
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-primary/35 bg-[linear-gradient(135deg,hsl(var(--gold-1)/0.15),hsl(var(--gold-2)/0.25))] text-primary text-lg font-bold tracking-tight"
                aria-hidden="true"
              >
                C
              </span>
              <span className="hidden sm:block">
                <span className="block text-[0.66rem] font-semibold tracking-[0.18em] uppercase text-text-muted">
                  CLARA
                </span>
                <span className="hidden md:block text-[0.64rem] font-medium tracking-[0.03em] text-text-secondary/85 mt-0.5 max-w-[28ch] leading-tight">
                  Inteligência Administrativa & Inovação no Serviço Público
                </span>
              </span>
              <span className="sr-only">CLARA - Página inicial</span>
            </a>

            <nav className="hidden md:flex items-center justify-center md:justify-self-center gap-5 lg:gap-7" aria-label="Links utilitários">
              {utilityLinks.map((link) => {
                const isActive = isActiveLink(link.href);
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${isActive
                        ? 'text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                      }`}
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>

            <div className="ml-auto md:ml-0 flex items-center gap-2 md:gap-3 shrink-0 md:justify-self-end">
              {onOpenChat && (
                <Button
                  onClick={onOpenChat}
                  size="sm"
                  className="btn-clara-secondary type-label h-10 min-w-[102px] px-4 gap-2 rounded-full"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  Chat
                </Button>
              )}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="inline-flex items-center justify-center gap-2 h-10 px-3 sm:min-w-[108px] rounded-lg border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:border-white/20 hover:shadow-[0_0_24px_rgba(255,255,255,0.1)] transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
          className="menu-backdrop"
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
        aria-modal={menuOpen ? true : undefined}
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
                className="btn-cinematic-glow type-label w-full gap-2 h-11"
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
