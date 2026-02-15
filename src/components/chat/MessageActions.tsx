import { useState } from "react";
import { motion } from "framer-motion";
import { MoreHorizontal, Copy, ListChecks, FileText, FileDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ChatMessage } from "@/hooks/useChat";

interface MessageActionsProps {
  message: ChatMessage;
  onDownloadPdf?: () => void;
}

/**
 * Converts markdown lists to a checklist format
 */
function convertToChecklist(text: string): string {
  const lines = text.split("\n");
  const converted: string[] = [];
  
  for (const line of lines) {
    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (unorderedMatch) {
      converted.push(`${unorderedMatch[1]}[ ] ${unorderedMatch[2]}`);
      continue;
    }
    
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (orderedMatch) {
      converted.push(`${orderedMatch[1]}[ ] ${orderedMatch[2]}`);
      continue;
    }
    
    converted.push(line);
  }
  
  return converted.join("\n");
}

function hasConvertibleLists(text: string): boolean {
  return /^(\s*)[-*]\s+.+/m.test(text) || /^(\s*)\d+\.\s+.+/m.test(text);
}

type CopyState = "idle" | "copied-text" | "copied-markdown" | "copied-checklist";

export function MessageActions({ message, onDownloadPdf }: MessageActionsProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const isMobile = useIsMobile();
  const hasLists = hasConvertibleLists(message.content);

  const resetCopyState = () => {
    setTimeout(() => setCopyState("idle"), 2000);
  };

  const handleCopyText = async () => {
    try {
      // Strip markdown for plain text copy
      const plainText = message.content
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^#+\s+/gm, "")
        .replace(/^[-*]\s+/gm, "• ");
      
      await navigator.clipboard.writeText(plainText);
      setCopyState("copied-text");
      resetCopyState();
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyState("copied-markdown");
      resetCopyState();
    } catch (err) {
      console.error("Failed to copy markdown:", err);
    }
  };

  const handleCopyChecklist = async () => {
    try {
      const checklistText = convertToChecklist(message.content);
      await navigator.clipboard.writeText(checklistText);
      setCopyState("copied-checklist");
      resetCopyState();
    } catch (err) {
      console.error("Failed to copy checklist:", err);
    }
  };

  const getCopyIcon = () => {
    if (copyState !== "idle") {
      return <Check className="w-3.5 h-3.5 text-success" />;
    }
    return <Copy className="w-3.5 h-3.5" />;
  };

  const getCopyLabel = () => {
    switch (copyState) {
      case "copied-text":
        return "Texto copiado!";
      case "copied-markdown":
        return "Markdown copiado!";
      case "copied-checklist":
        return "Checklist copiado!";
      default:
        return "Copiar";
    }
  };

  // Mobile: use dropdown menu
  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Mais ações"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={handleCopyText}>
            <Copy className="w-4 h-4 mr-2" />
            Copiar texto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyMarkdown}>
            <FileText className="w-4 h-4 mr-2" />
            Copiar Markdown
          </DropdownMenuItem>
          {hasLists && (
            <DropdownMenuItem onClick={handleCopyChecklist}>
              <ListChecks className="w-4 h-4 mr-2" />
              Copiar como checklist
            </DropdownMenuItem>
          )}
          {onDownloadPdf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDownloadPdf}>
                <FileDown className="w-4 h-4 mr-2" />
                Baixar PDF
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop: show individual buttons
  return (
    <div className="flex items-center gap-1">
      {/* Copy dropdown with options */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={`action-btn ${copyState !== "idle" ? "success" : ""}`}
                aria-label={getCopyLabel()}
              >
                <motion.span
                  key={copyState}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.12 }}
                  className="flex items-center gap-1.5"
                >
                  {getCopyIcon()}
                  <span>{getCopyLabel()}</span>
                </motion.span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Opções de cópia
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={handleCopyText}>
            <Copy className="w-4 h-4 mr-2" />
            Copiar texto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyMarkdown}>
            <FileText className="w-4 h-4 mr-2" />
            Copiar Markdown
          </DropdownMenuItem>
          {hasLists && (
            <DropdownMenuItem onClick={handleCopyChecklist}>
              <ListChecks className="w-4 h-4 mr-2" />
              Copiar como checklist
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
