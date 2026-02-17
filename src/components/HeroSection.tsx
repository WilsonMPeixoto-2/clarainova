import { motion } from 'framer-motion';
import { MessageCircle, BookOpen, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import claraHeroLarge from '@/assets/clara-hero-desktop-1920.jpg';
import claraHeroMedium from '@/assets/clara-hero-desktop-1024.jpg';
import claraHeroSmall from '@/assets/clara-hero-mobile-640.jpg';
import claraHeroFallback from '@/assets/clara-hero-fallback.jpg';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};


interface HeroSectionProps {
  onOpenChat: (query?: string) => void;
}

const HeroSection = ({ onOpenChat }: HeroSectionProps) => {
  const isMobile = useIsMobile();
  const quickQuestions = [
    "Como anexar documentos no SEI?",
    "Prazos de prestação de contas",
    "Modelos SEI-Rio disponíveis",
    "Como solicitar diárias?",
    "O que é bloco de assinatura?",
    "Como encaminhar processos?",
    "Como atualizar dados no SDP?",
    "Regras para afastamento temporário",
    "Configurações de assinatura digital",
    "Checklist para licitações"
  ];

  return (
    <section className="hero-shell relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image Layer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: isMobile ? 0.55 : 0.9, ease: "easeOut" }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <picture>
          <source
            type="image/jpeg"
            media="(max-width: 640px)"
            srcSet={claraHeroSmall}
          />
          <source
            type="image/jpeg"
            media="(max-width: 1024px)"
            srcSet={claraHeroMedium}
          />
          <source
            type="image/jpeg"
            srcSet={claraHeroLarge}
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


      {/* Content Layer */}
      <div className="container mx-auto px-6 relative z-20 pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column - Content (60%) */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="md:col-span-7 lg:col-span-7 space-y-6 md:space-y-9"
          >
            {/* Badge Chip */}
            <motion.div variants={itemVariants}>
              <span className="badge-chip">
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
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
                  const featuresSection = document.getElementById('features');
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
              <div className="quick-carousel" role="list" aria-label="Perguntas rápidas">
                {quickQuestions.map((question, i) => (
                  <button
                    key={question}
                    type="button"
                    className="quick-chip"
                    onClick={() => onOpenChat(question)}
                    style={{ animationDelay: `${0.05 * i}s` }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Empty space for background image */}
          <div className="hidden md:block md:col-span-5 lg:col-span-5" />
        </div>
      </div>

      {/* Decorative gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default HeroSection;
