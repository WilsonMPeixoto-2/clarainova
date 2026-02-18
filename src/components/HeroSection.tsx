import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, BookOpen, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import claraHeroFallback from '@/assets/clara-hero-fallback.jpg';

const HERO_IMAGE_BREAKPOINTS = [480, 768, 1024, 1440, 1920, 2560, 3840] as const;
const HERO_IMAGE_SIZES = '(max-width: 768px) 100vw, (max-width: 1440px) 90vw, 1200px';

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

const HeroSection = ({ onOpenChat }: HeroSectionProps) => {
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const quickCarouselRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const containerVariants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: isMobile ? 0.05 : 0.08, delayChildren: 0 },
        },
      };

  const itemVariants = prefersReducedMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: isMobile ? 0.3 : 0.4, ease: 'easeOut' as const },
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

  return (
    <section className="hero-shell relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image Layer */}
      <motion.div 
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.35, scale: 1.03 }}
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                scale: [1.03, 1.01, 1.05],
                x: [0, -18, 8, 0],
                y: [0, -6, 4, 0],
              }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.45, ease: 'easeOut' }
            : {
                opacity: { duration: isMobile ? 0.5 : 0.75, ease: 'easeOut' },
                scale: { duration: 58, ease: 'linear', repeat: Infinity, repeatType: 'mirror' },
                x: { duration: 62, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' },
                y: { duration: 54, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' },
              }
        }
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <picture>
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
            className="w-full h-full object-cover hero-image"
            aria-hidden="true"
          />
        </picture>
      </motion.div>

      {/* Overlay Layer (separate from media layer to avoid washing image details) */}
      <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 hidden md:block hero-overlay" />
        <div className="absolute inset-0 md:hidden hero-overlay-mobile" />
      </div>

      {/* Energy Motion Layer */}
      <div className="absolute inset-0 z-20 pointer-events-none hero-energy" aria-hidden="true">
        <span className="hero-energy-stream" />
        <span className="hero-energy-stream hero-energy-stream--secondary" />
      </div>


      {/* Content Layer */}
      <div className="container mx-auto px-6 relative z-20 pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end md:items-center">
          {/* Left Column - Editorial Stack */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="md:col-span-6 lg:col-span-5"
          >
            <div className="hero-copy-panel space-y-6 md:space-y-9">
              {/* Badge Chip */}
              <motion.div variants={itemVariants}>
                <span className="badge-chip">
                  <motion.span 
                    animate={prefersReducedMotion ? undefined : { scale: [1, 1.2, 1] }}
                    transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
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
              <motion.h1 variants={itemVariants}>
                <span className="hero-title amber-glow inline-block">
                  CLARA
                </span>
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
                className="text-body max-w-[42ch]"
              >
                Sua assistente especializada em sistemas eletrônicos de informações e procedimentos administrativos. Orientações passo a passo com indicação de fontes documentais.
              </motion.p>

              {/* CTAs */}
              <motion.div 
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-4 pt-3"
              >
                <motion.button 
                  onClick={() => onOpenChat()}
                  className="btn-clara-primary type-label flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <MessageCircle size={20} aria-hidden="true" />
                  Iniciar conversa
                </motion.button>
                <motion.button 
                  onClick={() => {
                    const featuresSection = document.getElementById('conhecimento') ?? document.getElementById('features');
                    featuresSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-clara-secondary type-label flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <BookOpen size={20} aria-hidden="true" />
                  Ver tópicos
                </motion.button>
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

          {/* Right Column - intentionally left for art direction balance */}
          <div className="hidden md:block md:col-span-6 lg:col-span-7" aria-hidden="true" />
        </div>
      </div>

      {/* Decorative gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default HeroSection;
