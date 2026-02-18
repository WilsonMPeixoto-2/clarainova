import { motion } from 'framer-motion';
import { FileSearch, MessagesSquare, BookCheck, ArrowUpRight, Sparkles } from 'lucide-react';
import ScrollReveal from '@/components/animations/ScrollReveal';

interface FeaturesSectionProps {
  onOpenChat: (query?: string) => void;
}

const features = [
  {
    id: 'search',
    icon: FileSearch,
    title: 'Pesquisa sem ruído',
    subtitle: 'Normas, prazos e procedimentos em segundos',
    description: 'Interprete dúvidas em linguagem natural e vá direto ao ponto com contexto administrativo.',
    points: ['Leitura semântica de consultas', 'Prioriza fontes documentais', 'Histórico e continuidade de contexto'],
    prompt: 'Quais prazos preciso observar na prestação de contas?',
  },
  {
    id: 'answers',
    icon: MessagesSquare,
    title: 'Respostas com fundamento',
    subtitle: 'Objetivo quando precisa, didático quando importa',
    description: 'Escolha entre respostas diretas ou explicativas, mantendo rastreabilidade e transparência.',
    points: ['Modo Direto ou Didático', 'Transparência de fonte', 'Diagnóstico amigável de erros'],
    prompt: 'Explique passo a passo como organizar um bloco de assinatura no SEI.',
  },
  {
    id: 'workflow',
    icon: BookCheck,
    title: 'Execução orientada',
    subtitle: 'Do entendimento à ação com menos retrabalho',
    description: 'Transforme orientação em execução com fluxo claro, linguagem simples e cadência profissional.',
    points: ['Fluxos acionáveis', 'Padronização operacional', 'Menos ambiguidade na rotina'],
    prompt: 'Como encaminhar corretamente um processo administrativo?',
  },
];

const pipeline = [
  {
    step: '01',
    title: 'Pergunte com linguagem natural',
    description: 'Sem comandos técnicos. Diga o que precisa resolver.',
  },
  {
    step: '02',
    title: 'Receba base + racional',
    description: 'Resposta estruturada com contexto e rastreio.',
  },
  {
    step: '03',
    title: 'Aja com segurança',
    description: 'Siga o fluxo recomendado e valide o resultado.',
  },
];

const FeaturesSection = ({ onOpenChat }: FeaturesSectionProps) => {
  return (
    <section
      id="conhecimento"
      className="knowledge-section py-20 md:py-28 relative overflow-hidden"
      aria-labelledby="features-heading"
    >
      <div id="features" className="absolute -top-20" aria-hidden="true" />
      <div className="container mx-auto px-6">
        <ScrollReveal>
          <div className="knowledge-header max-w-4xl mx-auto text-center mb-12 md:mb-16">
            <span className="knowledge-kicker">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Base de Conhecimento
            </span>
            <h2
              id="features-heading"
              className="text-h2 mt-4"
            >
              Um fluxo premium para transformar dúvida em decisão
            </h2>
            <p className="text-body text-lg max-w-3xl mx-auto mt-4">
              Estrutura visual, técnica e operacional pensada para produtividade real: clareza, velocidade e precisão.
            </p>
          </div>
        </ScrollReveal>

        <div
          className="knowledge-grid"
          role="list"
          aria-label="Recursos da CLARA"
        >
          {features.map((feature, index) => (
            <ScrollReveal
              key={feature.id}
              delay={index * 0.08}
              className={index === 0 ? 'lg:col-span-2' : ''}
            >
              <motion.article
                className="knowledge-card group h-full"
                role="listitem"
                whileHover={{ y: -4, rotateX: 1.2, rotateY: index === 1 ? 0.8 : -0.8 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              >
                <div className="knowledge-card-head">
                  <div className="knowledge-icon" aria-hidden="true">
                    <feature.icon className="w-6 h-6 text-primary" strokeWidth={1.6} />
                  </div>
                  <span className="knowledge-index">0{index + 1}</span>
                </div>

                <h3 className="knowledge-title mt-5">{feature.title}</h3>
                <p className="knowledge-subtitle">{feature.subtitle}</p>
                <p className="text-body mt-4">{feature.description}</p>

                <ul className="knowledge-points" aria-label={`Diferenciais de ${feature.title}`}>
                  {feature.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>

                <motion.button
                  type="button"
                  className="knowledge-cta"
                  onClick={() => onOpenChat(feature.prompt)}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Explorar no chat
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </motion.button>
              </motion.article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.12}>
          <div className="knowledge-pipeline" aria-label="Como funciona">
            {pipeline.map((item) => (
              <div key={item.step} className="knowledge-step">
                <span className="knowledge-step-index">{item.step}</span>
                <h3 className="knowledge-step-title">{item.title}</h3>
                <p className="knowledge-step-description">{item.description}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.18}>
          <div className="knowledge-bottom-cta">
            <p className="text-body">
              Pronto para validar um caso real da sua rotina?
            </p>
            <motion.button
              type="button"
              onClick={() => onOpenChat('Preciso de orientação para um processo administrativo em andamento.')}
              className="btn-clara-primary type-label inline-flex items-center justify-center gap-2 px-6"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              Iniciar análise com a CLARA
            </motion.button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default FeaturesSection;
