import { useState } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import Footer from '@/components/Footer';
import { SEOHead, SchemaOrg } from '@/components/SEOHead';
import { ChatPanel } from '@/components/chat/ChatPanel';

const Index = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  const handleOpenChat = (query?: string) => {
    setInitialQuery(query || '');
    setChatOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="CLARA Inteligência Administrativa"
        description="Consultora de Legislação e Apoio a Rotinas Administrativas. Orientações passo a passo com indicação de fontes documentais."
        keywords={["SEI", "legislação", "administração pública", "assistente virtual", "CLARA", "inteligência administrativa", "procedimentos administrativos"]}
      />
      <SchemaOrg type="WebApplication" />
      
      {/* Skip link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Pular para o conteúdo principal
      </a>
      
      <Header onOpenChat={() => handleOpenChat()} />
      <main id="main-content">
        <HeroSection onOpenChat={handleOpenChat} />
        <FeaturesSection />
      </main>
      <Footer />

      {/* Chat Panel */}
      <ChatPanel 
        open={chatOpen} 
        onOpenChange={setChatOpen} 
        initialQuery={initialQuery}
      />
    </div>
  );
};

export default Index;
