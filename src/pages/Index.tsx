import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import Footer from '@/components/Footer';
import { SEOHead, SchemaOrg } from '@/components/SEOHead';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="CLARA - Assistente de Legislação e Apoio Administrativo"
        description="Sua assistente virtual especializada em SEI, SDP e procedimentos da 4ª CRE. Orientações passo a passo com indicação de fontes documentais."
        keywords={["SEI", "SDP", "4ª CRE", "legislação", "administração pública", "assistente virtual", "CLARA"]}
      />
      <SchemaOrg type="WebApplication" />
      
      {/* Skip link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Pular para o conteúdo principal
      </a>
      
      <Header />
      <main id="main-content">
        <HeroSection />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
