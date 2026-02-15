import { motion } from "framer-motion";
import { Target, BookOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ResponseMode = "fast" | "deep";

interface ResponseModeSelectorProps {
  mode: ResponseMode;
  onChange: (mode: ResponseMode) => void;
  disabled?: boolean;
}

const modes = [
  {
    value: "fast" as ResponseMode,
    label: "Direto",
    icon: Target,
    tooltip: "Respostas objetivas com citações diretas. Ideal para dúvidas simples e procedimentos do dia a dia.",
    shortLabel: "Direto",
  },
  {
    value: "deep" as ResponseMode,
    label: "Didático",
    icon: BookOpen,
    tooltip: "Explicações completas com analogias e contexto. Ideal para entender o 'porquê' das regras.",
    shortLabel: "Didático",
  },
];

export function ResponseModeSelector({ mode, onChange, disabled }: ResponseModeSelectorProps) {
  return (
    <div 
      className="flex items-center gap-1 p-1 rounded-lg bg-surface-3/50 border border-border-subtle"
      role="radiogroup"
      aria-label="Modo de resposta"
    >
      {modes.map((option) => {
        const Icon = option.icon;
        const isSelected = mode === option.value;
        
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <motion.button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isSelected
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-4/50"
                )}
                whileTap={{ scale: 0.97 }}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeMode"
                    className="absolute inset-0 bg-primary rounded-md"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{option.label}</span>
                </span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
              <p className="font-medium mb-1">{option.label}</p>
              <p className="text-muted-foreground">{option.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
