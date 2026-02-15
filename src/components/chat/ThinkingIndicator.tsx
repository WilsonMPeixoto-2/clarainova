import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, Sparkles, Database, Globe, Cpu } from "lucide-react";

interface ThinkingIndicatorProps {
  step: string;
}

const stepIcons = {
  search: Search,
  analyze: Brain,
  database: Database,
  web: Globe,
  process: Cpu,
  default: Sparkles,
};

function getIconAndColor(step: string): { Icon: typeof Search; color: string } {
  const lowerStep = step.toLowerCase();
  
  if (lowerStep.includes("busca") || lowerStep.includes("procura")) {
    return { Icon: stepIcons.search, color: "text-blue-500" };
  }
  if (lowerStep.includes("analisa") || lowerStep.includes("pensa")) {
    return { Icon: stepIcons.analyze, color: "text-purple-500" };
  }
  if (lowerStep.includes("base") || lowerStep.includes("documento")) {
    return { Icon: stepIcons.database, color: "text-emerald-500" };
  }
  if (lowerStep.includes("web") || lowerStep.includes("internet")) {
    return { Icon: stepIcons.web, color: "text-orange-500" };
  }
  if (lowerStep.includes("processa") || lowerStep.includes("gera")) {
    return { Icon: stepIcons.process, color: "text-cyan-500" };
  }
  
  return { Icon: stepIcons.default, color: "text-primary" };
}

export const ThinkingIndicator = memo(function ThinkingIndicator({ step }: ThinkingIndicatorProps) {
  const { Icon, color } = useMemo(() => getIconAndColor(step), [step]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center gap-3 px-4 py-3 glass-card rounded-xl"
      role="status"
      aria-live="polite"
      aria-label={`CLARA está processando: ${step}`}
    >
      {/* Animated icon container */}
      <div className="relative flex items-center justify-center w-10 h-10">
        {/* Pulse ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 rounded-full bg-primary/20"
        />
        
        {/* Icon background */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-primary/30 border-t-primary/70"
        />
        
        {/* Icon */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className={`z-10 ${color}`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Text content */}
      <div className="flex-1 min-w-0">
        <motion.p 
          className="text-sm font-medium text-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          CLARA está pensando...
        </motion.p>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-muted-foreground truncate"
          >
            {step}
          </motion.p>
        </AnimatePresence>
      </div>
      
      {/* Animated dots */}
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ 
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut"
            }}
            className="w-2 h-2 rounded-full bg-primary"
          />
        ))}
      </div>
    </motion.div>
  );
});
