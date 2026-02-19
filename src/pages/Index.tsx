import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import Footer from '@/components/Footer';
import { SEOHead, SchemaOrg } from '@/components/SEOHead';

// Lazy load below-the-fold and heavy components to reduce unused JS
const FeaturesSection = lazy(() => import('@/components/FeaturesSection'));
const FAQSection = lazy(() => import('@/components/FAQSection'));
const ChatPanel = lazy(() => import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel })));

const Index = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatRouteHandledRef = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPanelMounted, setChatPanelMounted] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  const handleOpenChat = (query?: string) => {
    setChatPanelMounted(true);
    setInitialQuery(query || '');
    setChatOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('chat') !== '1') return;
    const prefilled = searchParams.get('q') ?? '';
    handleOpenChat(prefilled || undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('chat');
    next.delete('q');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (location.pathname !== '/chat') {
      chatRouteHandledRef.current = false;
      return;
    }
    if (chatRouteHandledRef.current) return;
    chatRouteHandledRef.current = true;
    const prefilled = searchParams.get('q') ?? '';
    handleOpenChat(prefilled || undefined);
  }, [location.pathname, searchParams]);

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
      <main id="main-content" className="site-main-canvas">
        <HeroSection onOpenChat={handleOpenChat} />
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <FeaturesSection onOpenChat={handleOpenChat} />
          <FAQSection onOpenChat={handleOpenChat} />
        </Suspense>
      </main>
      <Footer />

      {/* Chat Panel - loaded only after first user intent */}
      {chatPanelMounted ? (
        <Suspense fallback={null}>
          <ChatPanel
            open={chatOpen}
            onOpenChange={setChatOpen}
            initialQuery={initialQuery}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default Index;
