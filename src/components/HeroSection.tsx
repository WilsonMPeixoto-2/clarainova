import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MessageCircle, BookOpen, Sparkles } from 'lucide-react';
import claraHero from '@/assets/clara-hero.png';

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

const floatAnimation = {
  y: [0, -10, 0],
  transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const }
};

const HeroSection = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image Layer - Integrated, no frame */}
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${claraHero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center right',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Desktop Gradient Overlay - Left to Right fade */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none hidden md:block hero-overlay"
      />
      
      {/* Mobile Gradient Overlay - Top to Bottom fade */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none md:hidden hero-overlay-mobile"
      />

      {/* Floating decorative elements */}
      <motion.div
        animate={floatAnimation}
        className="absolute top-1/4 right-1/4 w-2 h-2 rounded-full bg-primary/30 blur-sm hidden lg:block"
      />
      <motion.div
        animate={floatAnimation}
        className="absolute top-1/3 right-1/3 w-3 h-3 rounded-full bg-primary/20 blur-sm hidden lg:block"
      />

      {/* Content Layer */}
      <div className="container mx-auto px-6 relative z-20 pt-24 md:pt-32 pb-16 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column - Content (60%) */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="md:col-span-7 lg:col-span-7 space-y-6 md:space-y-8"
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

            {/* H1 - CLARA */}
            <motion.h1 variants={itemVariants}>
              <motion.span 
                className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight text-primary amber-glow inline-block"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                CLARA
              </motion.span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              variants={itemVariants}
              className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground tracking-tight text-glow max-w-xl"
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
              className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg"
            >
              Sua assistente especializada em sistemas eletrônicos de informações e procedimentos administrativos. Orientações passo a passo com indicação de fontes documentais.
            </motion.p>

            {/* CTAs */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 pt-2"
            >
              <motion.button 
                onClick={() => navigate('/login')}
                className="btn-clara-primary flex items-center justify-center gap-2"
                whileHover={{ scale: 1.03, boxShadow: "0 10px 30px -10px hsl(var(--primary) / 0.4)" }}
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
                className="btn-clara-secondary flex items-center justify-center gap-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <BookOpen size={20} aria-hidden="true" />
                Ver tópicos
              </motion.button>
            </motion.div>

            {/* Search Bar */}
            <motion.div variants={itemVariants} className="pt-4">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    navigate(`/chat?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                className="relative max-w-xl"
                role="search"
              >
                <label htmlFor="hero-search" className="sr-only">
                  Pesquisar dúvidas
                </label>
                <motion.div
                  animate={{ 
                    boxShadow: isSearchFocused 
                      ? "0 0 0 2px hsl(var(--primary) / 0.3), 0 10px 30px -10px hsl(var(--primary) / 0.2)"
                      : "0 4px 20px -5px hsl(var(--primary) / 0.1)"
                  }}
                  transition={{ duration: 0.2 }}
                  className="relative rounded-2xl overflow-hidden"
                >
                  <Search 
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 z-10" 
                    size={20}
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Descreva sua dúvida com suas próprias palavras…"
                    className="search-input-clara pl-12"
                    autoComplete="off"
                  />
                </motion.div>
              </form>
            </motion.div>
          </motion.div>

          {/* Right Column - Empty space for background image to show through */}
          <div className="hidden md:block md:col-span-5 lg:col-span-5" />
        </div>
      </div>

      {/* Decorative gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default HeroSection;
