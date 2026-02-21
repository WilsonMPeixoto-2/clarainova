import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { BookOpen, MessageCircle, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import claraHeroFallback from '@/assets/clara-hero-fallback.jpg';

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

const HeroSection = ({ onOpenChat }: HeroSectionProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const heroSectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Performance Video Observer
  useEffect(() => {
    if (!videoRef.current || !heroSectionRef.current || isHeroMobile || prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!videoRef.current) return;
          if (entry.isIntersecting) {
            videoRef.current.play().catch(() => { });
          } else {
            videoRef.current.pause();
          }
        });
      },
      { threshold: 0.05 }
    );

    observer.observe(heroSectionRef.current);
    return () => observer.disconnect();
  }, [isHeroMobile, prefersReducedMotion]);

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

  const { scrollYProgress } = useScroll({
    target: heroSectionRef,
    offset: ['start start', 'end start'],
  });
  const textParallaxY = useTransform(scrollYProgress, [0, 1], [0, 30]);
  const mediaParallaxY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <section
      ref={heroSectionRef}
      className={`clara-hero ${debugHero ? 'clara-hero-debug' : ''}`}
    >
      {/* 1. Base Layer (Background + Deep Glow) */}
      <div className="hero-base-layer" aria-hidden="true">
        <div className="hero-energy-glow" />
      </div>

      {/* 2. Media Layer (Video Stage Anchored to Right) */}
      <div className="hero-media-stage" aria-hidden="true">
        <motion.div
          className="hero-media-motion"
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 1.2, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
          style={shouldAnimate ? { y: mediaParallaxY } : undefined}
        >
          {shouldAnimate ? (
            <video
              ref={videoRef}
              src="/videos/clara-hero.mp4"
              poster={claraHeroFallback}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="hero-clara-video"
            />
          ) : (
            <img
              src={claraHeroFallback}
              alt=""
              className="hero-clara-video"
            />
          )}
        </motion.div>
      </div>

      {/* 3. Content Layer (Copy Safe Zone to the Left) */}
      <motion.div
        className="hero-content-layer"
        style={shouldAnimate ? { y: textParallaxY } : undefined}
      >
        <div className="hero-copy-column">
          <motion.div
            variants={containerVariants}
            initial={shouldAnimate ? 'hidden' : 'visible'}
            animate="visible"
            className="hero-copy-surface space-y-6 md:space-y-9"
          >
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
                className="hero-title inline-block hero-title-reveal"
                initial={
                  shouldAnimate
                    ? { opacity: 0, filter: 'blur(4px)', clipPath: 'inset(0 100% 0 0)' }
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
          </motion.div>
        </div>
      </motion.div>

      {debugHero ? (
        <aside className="clara-hero-debug-panel" aria-live="polite">
          <strong>Awwwards Hero Debug</strong>
          <span>Mode: Layered Geometric</span>
          <span>Window width: {window.innerWidth}px</span>
        </aside>
      ) : null}

    </section>
  );
};

export default HeroSection;
