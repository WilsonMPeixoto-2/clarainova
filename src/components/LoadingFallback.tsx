import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LoadingFallbackProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { container: "min-h-[200px]", icon: "w-6 h-6", text: "text-sm" },
  md: { container: "min-h-[400px]", icon: "w-8 h-8", text: "text-base" },
  lg: { container: "min-h-screen", icon: "w-12 h-12", text: "text-lg" },
};

export function LoadingFallback({ 
  message = "Carregando...", 
  size = "lg" 
}: LoadingFallbackProps) {
  const config = sizeConfig[size];
  
  return (
    <div className={`${config.container} flex flex-col items-center justify-center gap-4 bg-background`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative"
      >
        {/* Outer ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        >
          <div className={`${config.icon} rounded-full border-2 border-primary/20 border-t-primary`} />
        </motion.div>
        
        {/* Icon */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className={`${config.icon} text-primary animate-pulse`} />
        </motion.div>
      </motion.div>
      
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`${config.text} text-muted-foreground`}
      >
        {message}
      </motion.p>
      
      {/* Progress dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 1, 
              repeat: Infinity, 
              delay: i * 0.2,
              ease: "easeInOut"
            }}
            className="w-2 h-2 rounded-full bg-primary/60"
          />
        ))}
      </div>
    </div>
  );
}

// Variante minimalista para componentes menores
export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={className}
    >
      <Loader2 className="w-5 h-5 text-primary" />
    </motion.div>
  );
}
