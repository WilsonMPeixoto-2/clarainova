import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, MessageSquare, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { useToast } from "@/hooks/use-toast";
import { useChatShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const suggestionVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.3 }
  }),
  hover: { scale: 1.02, transition: { duration: 0.2 } },
  tap: { scale: 0.98 }
};

export function ChatPanel({ open, onOpenChange, initialQuery }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSent = useRef(false);
  const lastInitialQuery = useRef<string>("");
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const { messages, isLoading, thinking, sendMessage, clearHistory, cancelStream } = useChat({
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error
      });
    }
  });

  // Keyboard shortcuts
  useChatShortcuts({
    onNewChat: () => {
      clearHistory();
      toast({ title: "Nova conversa iniciada" });
    },
    onClearHistory: () => {
      if (messages.length > 0) {
        handleClearHistory();
      }
    },
    onFocusInput: () => {
      inputRef.current?.focus();
    },
  });

  // Auto-scroll to last message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking.isThinking]);

  // Send initial query when panel opens with a new query
  useEffect(() => {
    if (open && initialQuery && initialQuery !== lastInitialQuery.current) {
      lastInitialQuery.current = initialQuery;
      sendMessage(initialQuery);
    }
  }, [open, initialQuery, sendMessage]);

  // Reset tracking when panel closes
  useEffect(() => {
    if (!open) {
      lastInitialQuery.current = "";
    }
  }, [open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleClearHistory = useCallback(() => {
    if (messages.length > 0) {
      clearHistory();
      toast({
        title: "Histórico limpo",
        description: "A conversa foi apagada."
      });
    }
  }, [messages.length, clearHistory, toast]);

  const suggestions = [
    "Como criar um novo processo no SEI?",
    "Como anexar documentos?",
    "O que é bloco de assinatura?",
    "Como fazer prestação de contas no SDP?"
  ];

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className={`flex flex-col p-0 gap-0 ${
            isMobile 
              ? 'w-full max-w-full' 
              : 'w-[450px] sm:max-w-[450px]'
          }`}
        >
          {/* Header */}
          <SheetHeader className="flex-shrink-0 px-4 py-3 border-b border-border/50 bg-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-semibold text-foreground">CLARA</SheetTitle>
                  <p className="text-xs text-muted-foreground">Inteligência Administrativa</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-muted-foreground h-8 w-8"
                      aria-label="Atalhos de teclado"
                    >
                      <Keyboard className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <p><kbd className="px-1 bg-muted rounded">Ctrl+N</kbd> Nova conversa</p>
                      <p><kbd className="px-1 bg-muted rounded">/</kbd> Focar no campo</p>
                      <p><kbd className="px-1 bg-muted rounded">Ctrl+Shift+L</kbd> Limpar</p>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClearHistory}
                      disabled={messages.length === 0}
                      className="rounded-full text-muted-foreground hover:text-destructive h-8 w-8"
                      aria-label="Limpar histórico da conversa"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Limpar histórico</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </SheetHeader>

          {/* Messages Area */}
          <main className="flex-1 overflow-y-auto px-4 py-4" role="main" aria-label="Área de mensagens">
            <AnimatePresence mode="wait">
              {messages.length === 0 ? (
                <motion.div 
                  key="empty-state"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center px-2"
                >
                  <motion.h2 
                    variants={itemVariants}
                    className="text-xl font-semibold text-foreground mb-2"
                  >
                    Olá! Sou a CLARA
                  </motion.h2>
                  
                  <motion.p 
                    variants={itemVariants}
                    className="text-sm text-muted-foreground max-w-sm mb-6"
                  >
                    Sua assistente especializada em legislação e procedimentos administrativos.
                  </motion.p>
                  
                  {/* Suggestions */}
                  <motion.div 
                    variants={containerVariants}
                    className="grid grid-cols-1 gap-2 w-full" 
                    role="group" 
                    aria-label="Sugestões de perguntas"
                  >
                    {suggestions.map((suggestion, index) => (
                      <motion.button
                        key={suggestion}
                        custom={index}
                        variants={suggestionVariants}
                        whileHover="hover"
                        whileTap="tap"
                        onClick={() => sendMessage(suggestion)}
                        disabled={isLoading}
                        className="text-left px-3 py-2.5 rounded-lg border border-border/60 bg-card/40 text-sm text-foreground/80 hover:bg-card hover:border-primary/30 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div 
                  key="messages"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4" 
                  role="log" 
                  aria-live="polite" 
                  aria-label="Histórico da conversa"
                >
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  
                  <AnimatePresence>
                    {thinking.isThinking && (
                      <ThinkingIndicator step={thinking.step} />
                    )}
                  </AnimatePresence>
                  
                  <div ref={messagesEndRef} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Input Area */}
          <footer className="flex-shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
            <ChatInput
              onSend={sendMessage}
              isLoading={isLoading}
              onCancel={cancelStream}
            />
            <p className="text-xs text-center text-muted-foreground/60 mt-2">
              CLARA pode cometer erros. Verifique informações importantes.
            </p>
          </footer>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
