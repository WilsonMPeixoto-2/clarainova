import { Brain, Search, Sparkles } from "lucide-react";

interface ThinkingIndicatorProps {
  step: string;
}

export function ThinkingIndicator({ step }: ThinkingIndicatorProps) {
  // Determinar ícone baseado no step
  const getIcon = () => {
    if (step.toLowerCase().includes("busca")) {
      return <Search className="w-4 h-4" />;
    }
    if (step.toLowerCase().includes("analisa")) {
      return <Brain className="w-4 h-4" />;
    }
    return <Sparkles className="w-4 h-4" />;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 glass-card rounded-xl animate-fade-in">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary">
        <div className="animate-pulse">
          {getIcon()}
        </div>
      </div>
      
      <div className="flex-1">
        <p className="text-sm text-foreground font-medium">CLARA está pensando...</p>
        <p className="text-xs text-muted-foreground">{step}</p>
      </div>
      
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
