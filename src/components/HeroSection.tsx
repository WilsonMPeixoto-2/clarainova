import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { BookOpen, MessageCircle, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import claraHeroFallback from '@/assets/clara-hero-fallback.jpg';

import claraAnimatedVideo from '@/assets/clara-animated.mp4';

const QUICK_QUESTIONS = [
  'Como anexar documentos no SEI-Rio?',
  'Quais são os prazos da prestação de contas?',
  'Como solicitar diárias administrativas?',
  'Como organizar bloco de assinatura no SEI?',
  'Como encaminhar um processo administrativo?',
  'Como atualizar dados no SDP?',
  'Quais documentos são exigidos em licitações?',
  'Como validar uma assinatura digital?',
  'Como acompanhar a tramitação de protocolos?',
  'Como cadastrar contratos e aditivos?',
  'Como configurar notificações de prazos?',
  'Onde encontro modelos oficiais no sistema?',
];

const QUICK_SCROLL_DISTANCE = 320;
const HERO_MOBILE_QUERY = '(max-width: 899px)';

interface HeroSectionProps {
  onOpenChat: (query?: string) => void;
}

interface HeroDebugState {
  breakpoint: string;
  cardW: string;
  overlayOpacity: string;
}

const HeroSection = ({ onOpenChat }: HeroSectionProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const heroSectionRef = useRef<HTMLElement>(null);
  const quickCarouselRef = useRef<HTMLDivElement>(null);
  const magneticRafRef = useRef<number | null>(null);
  const [isJsEnabled, setIsJsEnabled] = useState(false);
  const [isHeroMobile, setIsHeroMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return isMobile;
    }
    return window.matchMedia(HERO_MOBILE_QUERY).matches;
  });
  const [debugHero, setDebugHero] = useState(false);
  const [debugState, setDebugState] = useState<HeroDebugState>({
    breakpoint: '',
    cardW: '',
    overlayOpacity: '',
  });

  const shouldAnimate = isJsEnabled && !prefersReducedMotion && !isHeroMobile;

  const containerVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: isHeroMobile ? 0.1 : 0.12,
        delayChildren: 0.06,
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: isHeroMobile ? 0.55 : 0.75,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  const scrollQuickCarousel = useCallback((direction: 'prev' | 'next') => {
    const el = quickCarouselRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === 'next' ? QUICK_SCROLL_DISTANCE : -QUICK_SCROLL_DISTANCE,
      behavior: 'smooth',
    });
  }, []);

  const handleMagneticMove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (!shouldAnimate || isHeroMobile || !window.matchMedia('(pointer:fine)').matches) {
        return;
      }

      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const offsetX = ((event.clientX - (rect.left + rect.width / 2)) / rect.width) * 12;
      const offsetY = ((event.clientY - (rect.top + rect.height / 2)) / rect.height) * 12;

      if (magneticRafRef.current) {
        cancelAnimationFrame(magneticRafRef.current);
      }

      magneticRafRef.current = requestAnimationFrame(() => {
        target.style.setProperty('--magnetic-x', `${offsetX.toFixed(2)}px`);
        target.style.setProperty('--magnetic-y', `${offsetY.toFixed(2)}px`);
      });
    },
    [isHeroMobile, shouldAnimate],
  );

  const handleMagneticLeave = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    target.style.setProperty('--magnetic-x', '0px');
    target.style.setProperty('--magnetic-y', '0px');
  }, []);

  // Preload deprecado: O navegador gerenciará o buffer do vídeo nativamente.

  useEffect(() => {
    return () => {
      if (magneticRafRef.current) {
        cancelAnimationFrame(magneticRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsJsEnabled(document.body.classList.contains('js-enabled'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      setIsHeroMobile(isMobile);
      return;
    }

    const mediaQuery = window.matchMedia(HERO_MOBILE_QUERY);
    const syncViewport = () => setIsHeroMobile(mediaQuery.matches);

    syncViewport();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, [isMobile]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setDebugHero(params.get('debug') === 'hero');
  }, [location.search]);

  useEffect(() => {
    if (!debugHero || !heroSectionRef.current) return;

    const getBreakpointLabel = (width: number) => {
      if (width < 900) return '<900';
      if (width <= 1023) return '900-1023';
      if (width <= 1279) return '1024-1279';
      if (width <= 1439) return '1280-1439';
      return '>=1440';
    };

    const readDebugState = () => {
      const section = heroSectionRef.current;
      if (!section) return;

      const styles = window.getComputedStyle(section);
      setDebugState({
        breakpoint: getBreakpointLabel(window.innerWidth),
        cardW: styles.getPropertyValue('--hero-card-w').trim() || '-',
        overlayOpacity: styles.getPropertyValue('--hero-overlay-opacity').trim() || '-',
      });
    };

    readDebugState();
    window.addEventListener('resize', readDebugState);
    return () => {
      window.removeEventListener('resize', readDebugState);
    };
  }, [debugHero]);

  const { scrollYProgress } = useScroll({
    target: heroSectionRef,
    offset: ['start start', 'end start'],
  });
  const mediaParallaxY = useTransform(scrollYProgress, [0, 1], [0, 22]);
  const overlayParallaxY = useTransform(scrollYProgress, [0, 1], [0, 28]);
  const textParallaxY = useTransform(scrollYProgress, [0, 1], [0, 7]);

  const safeFrameStyle = useMemo(() => {
    // Deprecated exact coords in favor of right alignment visual approximation
    return {
      left: '72%',
      top: '34%',
    };
  }, []);

  return (
    <section
      ref={heroSectionRef}
      className={`clara-hero relative flex items-center overflow-hidden ${debugHero ? 'clara-hero-debug' : ''
        }`}
    >
      <motion.div
        initial={shouldAnimate ? { opacity: 0.86 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.82, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
        style={shouldAnimate ? { y: mediaParallaxY } : undefined}
        className="clara-hero-bg-parallax hero-parallax-layer absolute inset-0 z-0 pointer-events-none"
      >
        <div className="clara-hero-bg-scale">
          <video
            src={claraAnimatedVideo}
            autoPlay
            loop
            muted
            playsInline
            poster={claraHeroFallback}
            className="clara-hero-image"
            aria-hidden="true"
          />
        </div>
      </motion.div>

      <div className="clara-hero-aurora hero-aurora-layer absolute inset-0 z-10 pointer-events-none" aria-hidden="true" />

      <motion.div
        className="clara-hero-overlay-directional absolute inset-0 z-20 pointer-events-none"
        initial={shouldAnimate ? { opacity: 0.86 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.9, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
        style={shouldAnimate ? { y: overlayParallaxY } : undefined}
        aria-hidden="true"
      />

      <motion.div
        className="hero-energy hero-energy-layer absolute inset-0 z-30 pointer-events-none"
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: 0.08 } : { duration: 0 }}
        style={shouldAnimate ? { y: overlayParallaxY } : undefined}
        aria-hidden="true"
      >
        <span className="hero-energy-ribbon hero-energy-ribbon--north" />
        <span className="hero-energy-ribbon hero-energy-ribbon--south" />
        <span className="hero-energy-beam hero-energy-beam--primary" />
        <span className="hero-energy-beam hero-energy-beam--secondary" />
        <span className="hero-energy-beam hero-energy-beam--tertiary" />
        <span className="hero-energy-stream" />
        <span className="hero-energy-stream hero-energy-stream--secondary" />
      </motion.div>

      <motion.div
        className="clara-hero-content-wrap relative z-40"
        style={shouldAnimate ? { y: textParallaxY } : undefined}
      >
        <motion.div
          variants={containerVariants}
          initial={shouldAnimate ? 'hidden' : 'visible'}
          animate="visible"
          className="clara-hero-card-wrap"
        >
          <div className="clara-hero-card space-y-6 md:space-y-9 w-full">
            <motion.div variants={itemVariants}>
              <span className="badge-chip">
                <motion.span
                  animate={shouldAnimate ? { scale: [1, 1.2, 1] } : undefined}
                  transition={shouldAnimate ? { duration: 2, repeat: Infinity } : undefined}
                  className="w-2 h-2 rounded-full bg-primary"
                />
                <Sparkles className="w-3 h-3 text-primary" aria-hidden="true" />
                Inteligência Administrativa
              </span>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div className="maintenance-chip" role="status" aria-live="polite">
                <span className="maintenance-dot animate-pulse-subtle" aria-hidden="true" />
                CLARA em manutenção e atualização. Volta em breve.
              </div>
            </motion.div>

            <motion.h1 variants={itemVariants} className="hero-title-mask">
              <motion.span
                className="hero-title amber-glow inline-block hero-title-reveal"
                initial={
                  shouldAnimate
                    ? { opacity: 0, filter: 'blur(2px)', clipPath: 'inset(0 100% 0 0)' }
                    : false
                }
                animate={{ opacity: 1, filter: 'blur(0px)', clipPath: 'inset(0 0% 0 0)' }}
                transition={
                  shouldAnimate
                    ? { duration: 0.68, delay: 0.16, ease: [0.16, 1, 0.3, 1] }
                    : { duration: 0 }
                }
              >
                CLARA
              </motion.span>
            </motion.h1>

            <motion.p variants={itemVariants} className="hero-subtitle text-glow">
              <span className="text-primary">C</span>onsultora de{' '}
              <span className="text-primary">L</span>egislação e{' '}
              <span className="text-primary">A</span>poio a{' '}
              <span className="text-primary">R</span>otinas{' '}
              <span className="text-primary">A</span>dministrativas
            </motion.p>

            <motion.p variants={itemVariants} className="text-body max-w-[50ch]">
              Sua assistente especializada em sistemas eletrônicos de informações e procedimentos
              administrativos. Orientações passo a passo com indicação de fontes documentais.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 pt-3">
              <button
                onClick={() => onOpenChat()}
                className="btn-clara-primary hero-cta-button type-label flex items-center justify-center gap-2"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
              >
                <MessageCircle size={20} aria-hidden="true" />
                Iniciar conversa
              </button>
              <button
                onClick={() => {
                  const featuresSection =
                    document.getElementById('conhecimento') ?? document.getElementById('features');
                  featuresSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-clara-secondary hero-cta-button type-label flex items-center justify-center gap-2"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
              >
                <BookOpen size={20} aria-hidden="true" />
                Ver tópicos
              </button>
            </motion.div>

            <motion.p variants={itemVariants} className="text-caption max-w-[44ch]">
              Ao usar nossos serviços, você concorda com nossa{' '}
              <a
                href="/privacidade.html"
                className="text-primary hover:underline font-medium transition-colors duration-150"
              >
                Política de Privacidade
              </a>
            </motion.p>

            <motion.div variants={itemVariants} className="pt-5">
              <p className="text-caption mb-2 text-text-secondary">Perguntas rápidas</p>
              <div className="quick-carousel-shell">
                <div
                  ref={quickCarouselRef}
                  className="quick-carousel"
                  role="list"
                  aria-label="Perguntas rápidas"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      scrollQuickCarousel('next');
                    }
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      scrollQuickCarousel('prev');
                    }
                  }}
                >
                  {QUICK_QUESTIONS.map((question, i) => (
                    <div key={question} role="listitem" className="quick-chip-item">
                      <button
                        type="button"
                        className="quick-chip"
                        onClick={() => onOpenChat(question)}
                        style={{ animationDelay: `${0.05 * i}s` }}
                      >
                        {question}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {debugHero ? (
        <>
          <div className="clara-hero-safe-frame" style={safeFrameStyle} aria-hidden="true" />
          <aside className="clara-hero-debug-panel" aria-live="polite">
            <strong>Hero Debug</strong>
            <span>breakpoint: {debugState.breakpoint || '-'}</span>
            <span>card-w: {debugState.cardW || '-'}</span>
            <span>overlay-opacity: {debugState.overlayOpacity || '-'}</span>
          </aside>
        </>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default HeroSection;
