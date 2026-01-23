import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle, BookOpen } from 'lucide-react';
import claraHero from '@/assets/clara-hero.png';

const HeroSection = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image Layer - Integrated, no frame */}
      <div 
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

      {/* Content Layer */}
      <div className="container mx-auto px-6 relative z-20 pt-24 md:pt-32 pb-16 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column - Content (60%) */}
          <div className="md:col-span-7 lg:col-span-7 space-y-6 md:space-y-8">
            {/* Badge Chip */}
            <div className="animate-fade-in">
              <span className="badge-chip">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Assistente de Legislação
              </span>
            </div>

            {/* H1 - CLARA */}
            <h1 className="animate-slide-up">
              <span className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight text-primary amber-glow">
                CLARA
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground tracking-tight text-glow animate-slide-up-delay max-w-xl">
              Consultora de Legislação e Apoio a Rotinas Administrativas
            </p>

            {/* Description */}
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg animate-fade-in-delay">
              Sua assistente especializada em sistemas eletrônicos de informações e procedimentos administrativos. Orientações passo a passo com indicação de fontes documentais.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2 animate-fade-in-delay-2">
              <button 
                onClick={() => navigate('/chat')}
                className="btn-clara-primary flex items-center justify-center gap-2"
              >
                <MessageCircle size={20} />
                Iniciar conversa
              </button>
              <button 
                onClick={() => {
                  const featuresSection = document.getElementById('features');
                  featuresSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-clara-secondary flex items-center justify-center gap-2"
              >
                <BookOpen size={20} />
                Ver tópicos
              </button>
            </div>

            {/* Search Bar */}
            <div className="pt-4 animate-fade-in-delay-2">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    navigate(`/chat?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                className="relative max-w-xl"
              >
                <Search 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" 
                  size={20} 
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Descreva sua dúvida com suas próprias palavras…"
                  className="search-input-clara pl-12"
                />
              </form>
            </div>
          </div>

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
