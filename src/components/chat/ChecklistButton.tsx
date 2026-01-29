import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListChecks, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChecklistButtonProps {
  text: string;
}

/**
 * Converts markdown lists to a checklist format
 * - Bullet points → [ ] Item
 * - Numbered lists → [ ] Item
 */
function convertToChecklist(text: string): string {
  const lines = text.split("\n");
  const converted: string[] = [];
  
  for (const line of lines) {
    // Match unordered list items: - item or * item
    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (unorderedMatch) {
      converted.push(`${unorderedMatch[1]}[ ] ${unorderedMatch[2]}`);
      continue;
    }
    
    // Match ordered list items: 1. item, 2. item, etc.
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (orderedMatch) {
      converted.push(`${orderedMatch[1]}[ ] ${orderedMatch[2]}`);
      continue;
    }
    
    // Keep other lines as-is
    converted.push(line);
  }
  
  return converted.join("\n");
}

/**
 * Check if the text contains any lists that can be converted
 */
function hasConvertibleLists(text: string): boolean {
  return /^(\s*)[-*]\s+.+/m.test(text) || /^(\s*)\d+\.\s+.+/m.test(text);
}

export function ChecklistButton({ text }: ChecklistButtonProps) {
  const [copied, setCopied] = useState(false);
  
  // Don't show if there are no lists to convert
  if (!hasConvertibleLists(text)) {
    return null;
  }

  const handleCopy = async () => {
    try {
      const checklistText = convertToChecklist(text);
      await navigator.clipboard.writeText(checklistText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Falha ao copiar como checklist:", err);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className={`action-btn ${copied ? "success" : ""}`}
          aria-label="Copiar como checklist"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.12 }}
                className="flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Copiado</span>
              </motion.span>
            ) : (
              <motion.span
                key="checklist"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.12 }}
                className="flex items-center gap-1.5"
              >
                <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Checklist</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Copiar como checklist (formato [ ] item)
      </TooltipContent>
    </Tooltip>
  );
}
