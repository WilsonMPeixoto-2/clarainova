import { motion } from "framer-motion";
import { Target, BookOpen } from "lucide-react";
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
    description: "Objetivo e prático",
  },
  {
    value: "deep" as ResponseMode,
    label: "Didático",
    icon: BookOpen,
    description: "Explica passo a passo",
  },
];

export function ResponseModeSelector({ mode, onChange, disabled }: ResponseModeSelectorProps) {
  return (
    <div 
      className="flex items-stretch gap-1.5 p-1.5 rounded-xl bg-surface-3/60 border border-border-subtle"
      role="radiogroup"
      aria-label="Modo de resposta"
    >
      {modes.map((option) => {
        const Icon = option.icon;
        const isSelected = mode === option.value;
        
        return (
          <motion.button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative min-w-[126px] sm:min-w-[148px] text-left px-2.5 py-2 rounded-lg border transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected
                ? "text-primary-foreground border-primary/80"
                : "text-muted-foreground border-border-subtle hover:text-foreground hover:border-primary/35 hover:bg-surface-4/40"
            )}
            whileTap={{ scale: 0.98 }}
          >
            {isSelected && (
              <motion.div
                layoutId="activeMode"
                className="absolute inset-0 bg-primary rounded-lg"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 text-xs font-semibold">
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{option.label}</span>
            </span>
            <span
              className={cn(
                "relative z-10 block mt-0.5 text-[10px] leading-snug",
                isSelected ? "text-primary-foreground/90" : "text-text-muted"
              )}
            >
              {option.description}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
