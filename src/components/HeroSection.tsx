import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { MessageCircle, BookOpen, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import claraHeroFallback from '@/assets/clara-hero-fallback.jpg';

const HERO_IMAGE_BREAKPOINTS = [480, 768, 1024, 1440, 1920, 2560, 3840] as const;
const HERO_IMAGE_SIZES =
  '(max-width: 899px) 100vw, (max-width: 1199px) 54vw, (max-width: 1439px) 53vw, (max-width: 1919px) 58vw, 60vw';

const heroAvifFiles = [
  new URL('../assets/clara-hero-480.avif', import.meta.url),
  new URL('../assets/clara-hero-768.avif', import.meta.url),
  new URL('../assets/clara-hero-1024.avif', import.meta.url),
  new URL('../assets/clara-hero-1440.avif', import.meta.url),
  new URL('../assets/clara-hero-1920.avif', import.meta.url),
  new URL('../assets/clara-hero-2560.avif', import.meta.url),
  new URL('../assets/clara-hero-3840.avif', import.meta.url),
] as const;
const heroWebpFiles = [
  new URL('../assets/clara-hero-480.webp', import.meta.url),
  new URL('../assets/clara-hero-768.webp', import.meta.url),
  new URL('../assets/clara-hero-1024.webp', import.meta.url),
  new URL('../assets/clara-hero-1440.webp', import.meta.url),
  new URL('../assets/clara-hero-1920.webp', import.meta.url),
  new URL('../assets/clara-hero-2560.webp', import.meta.url),
  new URL('../assets/clara-hero-3840.webp', import.meta.url),
] as const;
const heroJpgFiles = [
  new URL('../assets/clara-hero-480.jpg', import.meta.url),
  new URL('../assets/clara-hero-768.jpg', import.meta.url),
  new URL('../assets/clara-hero-1024.jpg', import.meta.url),
  new URL('../assets/clara-hero-1440.jpg', import.meta.url),
  new URL('../assets/clara-hero-1920.jpg', import.meta.url),
  new URL('../assets/clara-hero-2560.jpg', import.meta.url),
  new URL('../assets/clara-hero-3840.jpg', import.meta.url),
] as const;

const heroAvifSrcSet = heroAvifFiles
  .map((file, index) => `${file.href} ${HERO_IMAGE_BREAKPOINTS[index]}w`)
  .join(', ');
const heroWebpSrcSet = heroWebpFiles
  .map((file, index) => `${file.href} ${HERO_IMAGE_BREAKPOINTS[index]}w`)
  .join(', ');
const heroJpgSrcSet = heroJpgFiles
  .map((file, index) => `${file.href} ${HERO_IMAGE_BREAKPOINTS[index]}w`)
  .join(', ');
const heroPreloadSrc = heroAvifFiles[3].href;

const QUICK_QUESTIONS = [
  "Como anexar documentos no SEI-Rio?",
  "Quais são os prazos da prestação de contas?",
  "Como solicitar diárias administrativas?",
  "Como organizar bloco de assinatura no SEI?",
  "Como encaminhar um processo administrativo?",
  "Como atualizar dados no SDP?",
  "Quais documentos são exigidos em licitações?",
  "Como validar uma assinatura digital?",
  "Como acompanhar a tramitação de protocolos?",
  "Como cadastrar contratos e aditivos?",
  "Como configurar notificações de prazos?",
  "Onde encontro modelos oficiais no sistema?",
];

const QUICK_SCROLL_DISTANCE = 320;

interface HeroSectionProps {
  onOpenChat: (query?: string) => void;
}

interface HeroLayoutDebugState {
  breakpoint: string;
  claraPos: string;
  scale: string;
  overlayOpacity: string;
  cardWidth: string;
  cardMarginLeft: string;
}

const HeroSection = ({ onOpenChat }: HeroSectionProps) => {
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const heroSectionRef = useRef<HTMLElement>(null);
  const quickCarouselRef = useRef<HTMLDivElement>(null);
  const magneticRafRef = useRef<number | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [isJsEnabled, setIsJsEnabled] = useState(false);
  const [debugLayout, setDebugLayout] = useState(false);
  const [debugLayoutState, setDebugLayoutState] = useState<HeroLayoutDebugState>({
    breakpoint: '',
    claraPos: '',
    scale: '',
    overlayOpacity: '',
    cardWidth: '',
    cardMarginLeft: '',
  });

  const shouldAnimate = isJsEnabled && !prefersReducedMotion;

  const containerVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: isMobile ? 0.1 : 0.12,
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
        duration: isMobile ? 0.55 : 0.75,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  const updateQuickScrollState = useCallback(() => {
    const el = quickCarouselRef.current;
    if (!el) return;
    const epsilon = 2;
    setCanScrollPrev(el.scrollLeft > epsilon);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - epsilon);
  }, []);

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
      if (!shouldAnimate || isMobile || !window.matchMedia('(pointer:fine)').matches) {
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
    [isMobile, shouldAnimate],
  );

  const handleMagneticLeave = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    target.style.setProperty('--magnetic-x', '0px');
    target.style.setProperty('--magnetic-y', '0px');
  }, []);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = heroPreloadSrc;
    link.type = 'image/avif';
    link.imagesrcset = heroAvifSrcSet;
    link.imagesizes = HERO_IMAGE_SIZES;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const el = quickCarouselRef.current;
    if (!el) return;
    updateQuickScrollState();
    const onScroll = () => updateQuickScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [updateQuickScrollState]);

  useEffect(() => {
    return () => {
      if (magneticRafRef.current) {
        cancelAnimationFrame(magneticRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const syncDebugLayout = () => {
      const params = new URLSearchParams(window.location.search);
      setDebugLayout(params.get('debugLayout') === '1');
    };

    syncDebugLayout();
    window.addEventListener('popstate', syncDebugLayout);
    return () => {
      window.removeEventListener('popstate', syncDebugLayout);
    };
  }, []);

  useEffect(() => {
    setIsJsEnabled(document.body.classList.contains('js-enabled'));
  }, []);

  useEffect(() => {
    if (!debugLayout || !heroSectionRef.current) return;

    const getBreakpointLabel = (width: number) => {
      if (width < 900) return '<900';
      if (width <= 1199) return '900-1199';
      if (width <= 1279) return '1024-1279';
      if (width <= 1439) return '1280-1439';
      return '>=1440';
    };

    const readLayoutState = () => {
      const section = heroSectionRef.current;
      if (!section) return;
      const styles = window.getComputedStyle(section);
      setDebugLayoutState({
        breakpoint: getBreakpointLabel(window.innerWidth),
        claraPos: styles.getPropertyValue('--clara-pos').trim() || '-',
        scale: styles.getPropertyValue('--clara-scale').trim() || '-',
        overlayOpacity: styles.getPropertyValue('--hero-overlay-opacity').trim() || '-',
        cardWidth: styles.getPropertyValue('--hero-card-w').trim() || '-',
        cardMarginLeft: styles.getPropertyValue('--hero-card-ml').trim() || '-',
      });
    };

    readLayoutState();
    window.addEventListener('resize', readLayoutState);
    return () => {
      window.removeEventListener('resize', readLayoutState);
    };
  }, [debugLayout]);

  const { scrollYProgress } = useScroll({
    target: heroSectionRef,
    offset: ['start start', 'end start'],
  });
  const mediaParallaxY = useTransform(scrollYProgress, [0, 1], [0, 22]);
  const auroraParallaxY = useTransform(scrollYProgress, [0, 1], [0, 28]);
  const textParallaxY = useTransform(scrollYProgress, [0, 1], [0, 7]);

  return (
    <section
      ref={heroSectionRef}
      className={`clara-hero relative overflow-hidden ${
        debugLayout ? 'hero-layout-debug' : ''
      }`}
    >
      {/* Background Layer */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0.86 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.82, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
        style={shouldAnimate ? { y: mediaParallaxY } : undefined}
        className="hero-bg-parallax absolute inset-0 z-0 pointer-events-none"
      >
        <div className="hero-bg-scale absolute inset-0">
          <picture className="absolute inset-0 block">
            <source
              type="image/avif"
              srcSet={heroAvifSrcSet}
              sizes={HERO_IMAGE_SIZES}
            />
            <source
              type="image/webp"
              srcSet={heroWebpSrcSet}
              sizes={HERO_IMAGE_SIZES}
            />
            <source
              type="image/jpeg"
              srcSet={heroJpgSrcSet}
              sizes={HERO_IMAGE_SIZES}
            />
            <img
              src={claraHeroFallback}
              alt=""
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="hero-clara-img"
              aria-hidden="true"
            />
          </picture>
        </div>
      </motion.div>

      {/* Overlay Layer */}
      <motion.div
        className="absolute inset-0 z-10 pointer-events-none"
        initial={shouldAnimate ? { opacity: 0.86 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.9, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
        style={shouldAnimate ? { y: auroraParallaxY } : undefined}
        aria-hidden="true"
      >
        <div className="absolute inset-0 hero-overlay-directional" />
      </motion.div>

      {/* Energy Motion Layer */}
      <motion.div
        className="absolute inset-0 z-[15] pointer-events-none hero-energy"
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: 0.08 } : { duration: 0 }}
        style={shouldAnimate ? { y: auroraParallaxY } : undefined}
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


      {/* Content Layer */}
      <motion.div
        className="relative z-20 mx-auto w-full max-w-[1400px] px-6 lg:px-10 py-16 md:py-24"
        style={shouldAnimate ? { y: textParallaxY } : undefined}
      >
        <motion.div
          variants={containerVariants}
          initial={shouldAnimate ? 'hidden' : 'visible'}
          animate="visible"
          className="hero-copy-column"
        >
          <div className="hero-glass-card space-y-6 md:space-y-9 w-full">
              {/* Badge Chip */}
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

              {/* H1 - CLARA with tighter tracking for brand signature */}
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

              {/* Subtitle - with elegant leading */}
              <motion.p 
                variants={itemVariants}
                className="hero-subtitle text-glow"
              >
                <span className="text-primary">C</span>onsultora de{' '}
                <span className="text-primary">L</span>egislação e{' '}
                <span className="text-primary">A</span>poio a{' '}
                <span className="text-primary">R</span>otinas{' '}
                <span className="text-primary">A</span>dministrativas
              </motion.p>

              {/* Description */}
              <motion.p 
                variants={itemVariants}
                className="text-body max-w-[50ch]"
              >
                Sua assistente especializada em sistemas eletrônicos de informações e procedimentos administrativos. Orientações passo a passo com indicação de fontes documentais.
              </motion.p>

              {/* CTAs */}
              <motion.div 
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-4 pt-3"
              >
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
                    const featuresSection = document.getElementById('conhecimento') ?? document.getElementById('features');
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

              {/* Privacy Policy Link */}
              <motion.p 
                variants={itemVariants}
                className="text-caption max-w-[44ch]"
              >
                Ao usar nossos serviços, você concorda com nossa{' '}
                <a 
                  href="/privacidade.html" 
                  className="text-primary hover:underline font-medium transition-colors duration-150"
                >
                  Política de Privacidade
                </a>
              </motion.p>

              {/* Quick Actions Carousel */}
              <motion.div variants={itemVariants} className="pt-5">
                <p className="text-caption mb-2 text-text-secondary">Perguntas rápidas</p>
                <div className="quick-carousel-shell">
                  {!isMobile && (
                    <button
                      type="button"
                      className="quick-carousel-arrow quick-carousel-arrow--prev"
                      onClick={() => scrollQuickCarousel('prev')}
                      disabled={!canScrollPrev}
                      aria-label="Ver perguntas anteriores"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}

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

                  {!isMobile && (
                    <button
                      type="button"
                      className="quick-carousel-arrow quick-carousel-arrow--next"
                      onClick={() => scrollQuickCarousel('next')}
                      disabled={!canScrollNext}
                      aria-label="Ver próximas perguntas"
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {debugLayout ? (
        <aside className="hero-debug-panel" aria-live="polite">
          <strong>Hero Layout Debug</strong>
          <span>breakpoint: {debugLayoutState.breakpoint || '-'}</span>
          <span>pos: {debugLayoutState.claraPos}</span>
          <span>scale: {debugLayoutState.scale}</span>
          <span>overlay: {debugLayoutState.overlayOpacity}</span>
          <span>card-w: {debugLayoutState.cardWidth}</span>
          <span>card-ml: {debugLayoutState.cardMarginLeft}</span>
        </aside>
      ) : null}

      {/* Decorative gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default HeroSection;
