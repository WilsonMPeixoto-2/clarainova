import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ChevronDown, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type WebSearchMode = "auto" | "deep";

interface WebSearchModeSelectorProps {
  mode: WebSearchMode;
  onChange: (mode: WebSearchMode) => void;
  disabled?: boolean;
  className?: string;
}

const modeConfig = {
  auto: {
    label: "Busca Auto",
    shortLabel: "Auto",
    description: "CLARA decide quando buscar na web",
    icon: Sparkles,
    className: "text-muted-foreground",
  },
  deep: {
    label: "Busca Profunda",
    shortLabel: "Deep",
    description: "Forçar busca web com quórum de fontes",
    icon: Search,
    className: "text-primary",
  },
};

export const WebSearchModeSelector = memo(function WebSearchModeSelector({
  mode,
  onChange,
  disabled = false,
  className,
}: WebSearchModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentMode = modeConfig[mode];
  const ModeIcon = currentMode.icon;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-7 px-2 gap-1.5 text-xs font-normal",
            "hover:bg-muted/50 transition-colors",
            currentMode.className,
            className
          )}
        >
          <Globe className="w-3 h-3" aria-hidden="true" />
          <span className="hidden sm:inline">{currentMode.shortLabel}</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <AnimatePresence>
          {Object.entries(modeConfig).map(([key, config], index) => {
            const Icon = config.icon;
            const isSelected = key === mode;

            return (
              <DropdownMenuItem
                key={key}
                onClick={() => onChange(key as WebSearchMode)}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer",
                  isSelected && "bg-primary/5"
                )}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-1.5 rounded-md mt-0.5",
                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium text-sm",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {config.label}
                    </span>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {config.description}
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })}
        </AnimatePresence>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
