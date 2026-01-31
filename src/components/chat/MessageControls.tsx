import { memo } from "react";
import { motion } from "framer-motion";
import { Square, RefreshCw, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MessageStatus } from "@/hooks/useChat";

interface MessageControlsProps {
  status?: MessageStatus;
  isStreaming?: boolean;
  onStop?: () => void;
  onRegenerate?: () => void;
  onContinue?: () => void;
  isLoading?: boolean;
}

export const MessageControls = memo(function MessageControls({
  status,
  isStreaming,
  onStop,
  onRegenerate,
  onContinue,
  isLoading = false,
}: MessageControlsProps) {
  const isCurrentlyStreaming = isStreaming || status === "streaming";
  const isStopped = status === "stopped";
  const isDone = status === "done" || (!isStreaming && !status);

  // During streaming: show Stop button
  if (isCurrentlyStreaming && onStop) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 mt-2"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onStop}
              className="h-7 px-3 gap-1.5 text-xs bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 hover:text-destructive"
            >
              <Square className="w-3 h-3" aria-hidden="true" />
              <span>Parar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Interromper resposta</TooltipContent>
        </Tooltip>
      </motion.div>
    );
  }

  // After stopped: show Regenerate + Continue buttons
  if (isStopped && (onRegenerate || onContinue)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mt-2"
      >
        {onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRegenerate}
                disabled={isLoading}
                className="h-7 px-3 gap-1.5 text-xs"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>Regenerar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gerar nova resposta</TooltipContent>
          </Tooltip>
        )}
        {onContinue && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onContinue}
                disabled={isLoading}
                className="h-7 px-3 gap-1.5 text-xs bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
              >
                <PlayCircle className="w-3 h-3" aria-hidden="true" />
                <span>Continuar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Continuar de onde parou</TooltipContent>
          </Tooltip>
        )}
      </motion.div>
    );
  }

  // After done (not stopped): show Regenerate only
  if (isDone && onRegenerate) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-2 mt-2"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isLoading}
              className="h-6 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span className="hidden sm:inline">Regenerar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Gerar nova resposta</TooltipContent>
        </Tooltip>
      </motion.div>
    );
  }

  return null;
});
