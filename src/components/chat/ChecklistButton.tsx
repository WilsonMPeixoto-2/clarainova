import { useState } from "react";
import { ListChecks, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          aria-label="Copiar como checklist"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-primary" aria-hidden="true" />
              <span className="hidden sm:inline">Copiado!</span>
            </>
          ) : (
            <>
              <ListChecks className="w-3 h-3" aria-hidden="true" />
              <span className="hidden sm:inline">Checklist</span>
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        Copiar como checklist (formato [ ] item)
      </TooltipContent>
    </Tooltip>
  );
}
