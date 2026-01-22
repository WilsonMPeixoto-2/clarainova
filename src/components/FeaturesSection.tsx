import { FileSearch, MessagesSquare, BookCheck } from 'lucide-react';

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
    <section className="py-20 md:py-28 relative">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Como a CLARA pode ajudar
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Recursos projetados para simplificar seu trabalho com legislação e processos administrativos.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="feature-card group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
