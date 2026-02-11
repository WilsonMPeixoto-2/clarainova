import { BookOpen, FileSearch, ClipboardList, HelpCircle, FileText } from "lucide-react";
import ClaraLogo from "@/components/ClaraLogo";

const EXAMPLE_QUESTIONS = [
  { icon: FileSearch, text: "Abrir um processo no sistema" },
  { icon: ClipboardList, text: "Anexar documentos externos" },
  { icon: BookOpen, text: "Consultar procedimentos administrativos" },
  { icon: HelpCircle, text: "Verificar niveis de acesso" },
  { icon: FileText, text: "Assinar e autenticar documentos" },
  { icon: FileSearch, text: "Tramitar processo para outra unidade" },
];

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void;
}

export function WelcomeScreen({ onSendMessage }: WelcomeScreenProps) {
  return (
    <div className="clara-welcome-shell">
      <div className="clara-welcome-logo">
        <ClaraLogo size={40} variant="light" />
      </div>

      <h2 className="text-2xl md:text-3xl font-semibold clara-heading-tight mb-2">Bem-vindo a CLARA</h2>

      <p className="clara-welcome-description">
        Consultora especializada em legislacao e rotinas administrativas. Escolha um tema abaixo ou digite sua
        pergunta para comecar.
      </p>

      <div className="clara-question-grid">
        {EXAMPLE_QUESTIONS.map((question, index) => (
          <button
            key={index}
            onClick={() => onSendMessage(question.text)}
            className="clara-question-card example-card group"
          >
            <div className="clara-question-icon">
              <question.icon className="size-4 text-primary" />
            </div>
            <span className="text-sm text-foreground/90 leading-snug">{question.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
