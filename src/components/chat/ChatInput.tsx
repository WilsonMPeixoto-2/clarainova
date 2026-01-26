import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponseModeSelector, ResponseMode } from "./ResponseModeSelector";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface ChatInputProps {
  onSend: (message: string, mode: ResponseMode) => void;
  isLoading: boolean;
  onCancel?: () => void;
  initialValue?: string;
}

export function ChatInput({ onSend, isLoading, onCancel, initialValue = "" }: ChatInputProps) {
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useLocalStorage<ResponseMode>("clara-response-mode", "fast");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Set initial value
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
    }
  }, [initialValue]);

  const handleSubmit = () => {
    if (value.trim() && !isLoading) {
      onSend(value.trim(), mode);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = value.length;
  const maxChars = 2000;
  const isNearLimit = charCount > maxChars * 0.9;

  return (
    <motion.div 
      className="glass-card rounded-2xl p-2"
      animate={{ 
        boxShadow: isFocused 
          ? "0 0 0 2px hsl(var(--primary) / 0.2), 0 10px 30px -10px hsl(var(--primary) / 0.15)"
          : "0 4px 20px -5px hsl(var(--background) / 0.5)"
      }}
      transition={{ duration: 0.2 }}
      role="form" 
      aria-label="Enviar mensagem"
    >
      <div className="flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Digite sua pergunta
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxChars))}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Digite sua pergunta sobre legislação ou rotinas administrativas..."
          disabled={isLoading}
          rows={1}
          aria-describedby="chat-hint"
          className="flex-1 bg-transparent border-0 resize-none px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 disabled:opacity-50"
          style={{ minHeight: "44px", maxHeight: "200px" }}
        />
        
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="cancel"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCancel}
                    className="flex-shrink-0 h-10 w-10 rounded-xl hover:bg-destructive/20 hover:text-destructive"
                    aria-label="Cancelar resposta"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancelar</TooltipContent>
              </Tooltip>
            </motion.div>
          ) : (
            <motion.div
              key="send"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSubmit}
                    disabled={!value.trim()}
                    className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    aria-label="Enviar mensagem"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9, rotate: 15 }}
                    >
                      <Send className="w-5 h-5" aria-hidden="true" />
                    </motion.div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enviar (Enter)</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Status bar with mode selector */}
      <div className="flex items-center justify-between px-2 py-1.5 gap-2">
        <ResponseModeSelector
          mode={mode}
          onChange={setMode}
          disabled={isLoading}
        />
        
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 text-xs text-muted-foreground" 
                role="status" 
                aria-live="polite"
              >
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                <span className="hidden sm:inline">CLARA está digitando...</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          {!isLoading && (
            <motion.span 
              className={`text-xs ${isNearLimit ? "text-destructive" : "text-muted-foreground/50"}`}
              animate={{ scale: isNearLimit ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              {charCount}/{maxChars}
            </motion.span>
          )}
        </div>
      </div>
      
      <p id="chat-hint" className="sr-only">
        Pressione Enter para enviar, Shift+Enter para nova linha
      </p>
    </motion.div>
  );
}
