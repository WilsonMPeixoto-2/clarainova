import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck } from 'lucide-react';
import ScrollReveal from '@/components/animations/ScrollReveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface FAQSectionProps {
  onOpenChat: (query?: string) => void;
}

const faqItems = [
  {
    id: 'faq-1',
    question: 'A CLARA substitui análise jurídica?',
    answer:
      'Não. A CLARA acelera entendimento e execução de rotinas administrativas, mas decisões formais devem considerar normas oficiais e, quando necessário, parecer técnico-jurídico.',
    prompt: 'Qual a melhor forma de validar juridicamente uma orientação recebida?',
  },
  {
    id: 'faq-2',
    question: 'Posso usar para processos em andamento no SEI-Rio?',
    answer:
      'Sim. Você pode usar para revisão de etapas, organização documental, prazos e preparação de encaminhamentos, com foco em clareza e rastreabilidade.',
    prompt: 'Me ajude a revisar um processo em andamento no SEI-Rio.',
  },
  {
    id: 'faq-3',
    question: 'Como funciona o modo Direto e o Didático?',
    answer:
      'Direto prioriza resposta curta e acionável. Didático explica fundamentos, contexto e passo a passo para apoiar aprendizado e padronização interna.',
    prompt: 'Mostre um exemplo prático comparando modo Direto e Didático.',
  },
  {
    id: 'faq-4',
    question: 'As respostas trazem base documental?',
    answer:
      'A experiência foi desenhada para privilegiar fonte e contexto. Sempre que possível, valide com os documentos e normativos oficiais da sua rotina.',
    prompt: 'Quero uma resposta com foco em fundamento documental.',
  },
  {
    id: 'faq-5',
    question: 'A CLARA funciona em celular e desktop?',
    answer:
      'Sim. O layout foi otimizado para ambos. No desktop, o chat é redimensionável; no mobile, funciona como sheet com pontos de ajuste.',
    prompt: 'Quais recursos de produtividade no chat estão disponíveis?',
  },
];

const FAQSection = ({ onOpenChat }: FAQSectionProps) => {
  return (
    <section id="faq" className="faq-section py-20 md:py-24 relative" aria-labelledby="faq-heading">
      <div className="container mx-auto px-6">
        <ScrollReveal>
          <div className="faq-shell">
            <div className="faq-header">
              <span className="knowledge-kicker">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Dúvidas Frequentes
              </span>
              <h2 id="faq-heading" className="text-h2 mt-4">
                Clareza operacional com confiança
              </h2>
              <p className="text-body mt-3 max-w-3xl">
                Respostas para as perguntas que mais impactam execução, segurança e consistência no trabalho administrativo.
              </p>
            </div>

            <Accordion type="single" collapsible className="faq-accordion">
              {faqItems.map((item) => (
                <AccordionItem key={item.id} value={item.id} className="faq-item">
                  <AccordionTrigger className="faq-trigger">{item.question}</AccordionTrigger>
                  <AccordionContent className="faq-content">
                    <p className="text-body mb-4">{item.answer}</p>
                    <motion.button
                      type="button"
                      className="knowledge-cta"
                      onClick={() => onOpenChat(item.prompt)}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Levar essa dúvida para o chat
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    </motion.button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default FAQSection;
