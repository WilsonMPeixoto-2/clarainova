import { BookOpen, FileSearch, ClipboardList, HelpCircle, FileText } from "lucide-react";
import ClaraLogo from "@/components/ClaraLogo";

const EXAMPLE_QUESTIONS = [
  { icon: FileSearch, text: "Abrir um processo no sistema" },
  { icon: ClipboardList, text: "Anexar documentos externos" },
  { icon: BookOpen, text: "Consultar procedimentos administrativos" },
  { icon: HelpCircle, text: "Verificar níveis de acesso" },
  { icon: FileText, text: "Assinar e autenticar documentos" },
  { icon: FileSearch, text: "Tramitar processo para outra unidade" },
];

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void;
}

export function WelcomeScreen({ onSendMessage }: WelcomeScreenProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6
        bg-primary/10 border border-primary/20
        shadow-[0_0_24px_var(--primary-glow)]
        animate-[glow_3s_ease-in-out_infinite]"
      >
        <ClaraLogo size={40} variant="light" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-heading)" }}>
        Bem-vindo à CLARA
      </h2>
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        Consultora especializada em legislação e rotinas administrativas. Como posso ajudá-lo hoje?
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
        {EXAMPLE_QUESTIONS.map((question, index) => (
          <button
            key={index}
            onClick={() => onSendMessage(question.text)}
            className="group flex items-center gap-3 p-4 rounded-xl text-left
              border border-border/50 bg-card/50 backdrop-blur-sm
              hover:bg-accent/10 hover:border-primary/30
              hover:shadow-[0_4px_20px_var(--primary-glow)]
              hover:-translate-y-1 active:translate-y-0
              transition-all duration-300 cursor-pointer"
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0
              group-hover:bg-primary/20 group-hover:shadow-[0_0_12px_var(--primary-glow)]
              transition-all duration-300"
            >
              <question.icon className="size-4 text-primary" />
            </div>
            <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
              {question.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
