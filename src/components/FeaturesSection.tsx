import { FileSearch, MessagesSquare, BookCheck } from 'lucide-react';
import ScrollReveal from '@/components/animations/ScrollReveal';

const features = [
  {
    icon: FileSearch,
    title: 'Busca Inteligente',
    description: 'Encontre normas, decretos e procedimentos com linguagem natural. A CLARA entende o contexto da sua dúvida.',
  },
  {
    icon: MessagesSquare,
    title: 'Respostas Contextualizadas',
    description: 'Orientações claras e objetivas, sempre com indicação das fontes documentais para conferência.',
  },
  {
    icon: BookCheck,
    title: 'Passo a Passo',
    description: 'Guias detalhados para procedimentos administrativos, adaptados ao seu nível de familiaridade.',
  },
];

const FeaturesSection = () => {
  return (
    <section 
      id="features" 
      className="py-20 md:py-28 relative"
      aria-labelledby="features-heading"
    >
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 
            id="features-heading"
            className="text-3xl md:text-4xl font-bold text-foreground mb-4"
          >
            Como a CLARA pode ajudar
          </h2>
          <p className="text-body text-lg max-w-2xl mx-auto">
            Recursos projetados para simplificar seu trabalho com legislação e processos administrativos.
          </p>
        </div>

        {/* Features Grid */}
        <div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
          role="list"
          aria-label="Recursos da CLARA"
        >
          {features.map((feature, index) => (
            <ScrollReveal 
              key={feature.title} 
              delay={index * 0.1}
            >
              <article 
                className="feature-card group h-full"
                role="listitem"
              >
                {/* Icon */}
                <div 
                  className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:bg-primary/15 group-hover:border-primary/30 transition-all duration-300"
                  aria-hidden="true"
                >
                  <feature.icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-body leading-relaxed">
                  {feature.description}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
