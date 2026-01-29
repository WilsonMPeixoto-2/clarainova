import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, MessageSquare, Keyboard, AlertCircle, RefreshCw, Sparkles, Target, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChat, ChatMessage as ChatMessageType, ResponseMode } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useAuth } from "@/contexts/AuthContext";
import { ChatMessage, MessageSkeleton } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatHistory } from "@/components/chat/ChatHistory";
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
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
};

const suggestionVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.25 }
  }),
  hover: { scale: 1.01, transition: { duration: 0.15 } },
  tap: { scale: 0.98 }
};

// B1: Empty State Component
function EmptyState({ onSuggestionClick, isLoading }: { onSuggestionClick: (query: string) => void; isLoading: boolean }) {
  const suggestions = [
    "Como criar um novo processo no SEI?",
    "Como anexar documentos?",
    "O que é bloco de assinatura?",
    "Como fazer prestação de contas no SDP?"
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 0.95 }}
      className="state-container h-full min-h-[40vh]"
    >
      <motion.div 
        variants={itemVariants}
        className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5"
      >
        <Sparkles className="w-8 h-8 text-primary" aria-hidden="true" />
      </motion.div>
      
      <motion.h2 variants={itemVariants} className="state-title">
        Olá! Sou a CLARA
      </motion.h2>
      
      <motion.p variants={itemVariants} className="state-description mb-6">
        Sua assistente especializada em legislação e procedimentos administrativos.
      </motion.p>

      {/* Response modes explanation - B1 */}
      <motion.div 
        variants={itemVariants}
        className="flex items-center justify-center gap-4 mb-6 text-chat-microcopy"
      >
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span><strong>Direto:</strong> Respostas objetivas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span><strong>Didático:</strong> Explicações detalhadas</span>
        </div>
      </motion.div>
      
      {/* Suggestions */}
      <motion.div 
        variants={containerVariants}
        className="grid grid-cols-1 gap-2 w-full max-w-sm" 
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
            onClick={() => onSuggestionClick(suggestion)}
            disabled={isLoading}
            className="text-left px-4 py-3 rounded-xl border border-border-subtle bg-card/40 text-sm text-foreground/85 hover:bg-card hover:border-primary/25 transition-all duration-fast disabled:opacity-50 focus-halo"
          >
            {suggestion}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

// B1: Error State Component
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="state-container"
    >
      <div className="w-14 h-14 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="state-title">Algo deu errado</h3>
      <p className="state-description mb-4">{message}</p>
      <Button 
        variant="outline" 
        onClick={onRetry}
        className="gap-2 focus-halo"
      >
        <RefreshCw className="w-4 h-4" />
        Tentar novamente
      </Button>
    </motion.div>
  );
}

export function ChatPanel({ open, onOpenChange, initialQuery }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastInitialQuery = useRef<string>("");
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [lastError, setLastError] = useState<string | null>(null);

  const { messages, isLoading, thinking, sendMessage, clearHistory, cancelStream, setMessages } = useChat({
    onError: (error) => {
      setLastError(error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error
      });
    }
  });

  // Chat sessions for authenticated users
  const {
    sessions,
    currentSessionId,
    isLoading: sessionsLoading,
    createSession,
    updateSession,
    loadSession,
    deleteSession,
  } = useChatSessions();

  // Track if we need to save to database
  const lastSavedLength = useRef(0);

  // Auto-save messages to database for authenticated users
  useEffect(() => {
    if (!user || messages.length === 0) return;
    if (messages.length <= lastSavedLength.current) return;
    
    const timeoutId = setTimeout(async () => {
      const completeMessages = messages.filter(m => !m.isStreaming);
      if (completeMessages.length === 0) return;

      if (currentSessionId) {
        await updateSession(currentSessionId, completeMessages);
      } else if (completeMessages.length >= 2) {
        await createSession(completeMessages);
      }
      lastSavedLength.current = messages.length;
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [user, messages, currentSessionId, createSession, updateSession]);

  // Keyboard shortcuts
  useChatShortcuts({
    onNewChat: handleNewChat,
    onClearHistory: () => {
      if (messages.length > 0) handleClearHistory();
    },
    onFocusInput: () => inputRef.current?.focus(),
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking.isThinking]);

  // Send initial query
  useEffect(() => {
    if (open && initialQuery && initialQuery !== lastInitialQuery.current) {
      lastInitialQuery.current = initialQuery;
      setLastError(null);
      sendMessage(initialQuery, "fast");
    }
  }, [open, initialQuery, sendMessage]);

  useEffect(() => {
    if (!open) lastInitialQuery.current = "";
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleClearHistory = useCallback(() => {
    if (messages.length > 0) {
      clearHistory();
      lastSavedLength.current = 0;
      setLastError(null);
      toast({
        title: "Histórico limpo",
        description: "A conversa foi apagada."
      });
    }
  }, [messages.length, clearHistory, toast]);

  function handleNewChat() {
    clearHistory();
    lastSavedLength.current = 0;
    setLastError(null);
    toast({ title: "Nova conversa iniciada" });
  }

  const handleLoadSession = useCallback(async (sessionId: string) => {
    const loadedMessages = await loadSession(sessionId);
    if (loadedMessages && setMessages) {
      setMessages(loadedMessages);
      lastSavedLength.current = loadedMessages.length;
      setLastError(null);
    }
  }, [loadSession, setMessages]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteSession(sessionId);
    toast({
      title: "Conversa excluída",
      description: "A conversa foi removida do histórico."
    });
  }, [deleteSession, toast]);

  const handleSuggestionClick = useCallback((query: string) => {
    setLastError(null);
    sendMessage(query, "fast");
  }, [sendMessage]);

  const handleRetry = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMessage) {
        setLastError(null);
        sendMessage(lastUserMessage.content, "fast");
      }
    }
  }, [messages, sendMessage]);

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className={`flex flex-col p-0 gap-0 ${
            isMobile ? 'w-full max-w-full' : 'w-[450px] sm:max-w-[450px]'
          }`}
        >
          {/* Header */}
          <SheetHeader className="flex-shrink-0 px-4 py-3 border-b border-border-subtle bg-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-semibold text-foreground">CLARA</SheetTitle>
                  <p className="text-chat-microcopy">Inteligência Administrativa</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {user && (
                  <ChatHistory
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    isLoading={sessionsLoading}
                    onLoadSession={handleLoadSession}
                    onDeleteSession={handleDeleteSession}
                    onNewChat={handleNewChat}
                  />
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="btn-icon h-8 w-8"
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
                      className="btn-icon h-8 w-8 hover:text-destructive"
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
                <EmptyState 
                  key="empty-state"
                  onSuggestionClick={handleSuggestionClick}
                  isLoading={isLoading}
                />
              ) : (
                <motion.div 
                  key="messages"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-5" 
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

                  {/* Error state inline - B1 */}
                  {lastError && !isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/20"
                    >
                      <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium">Não foi possível processar</p>
                        <p className="text-chat-microcopy mt-0.5">{lastError}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleRetry}
                        className="text-xs gap-1.5 h-7 focus-halo"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Tentar
                      </Button>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Input Area */}
          <footer className="flex-shrink-0 border-t border-border-subtle bg-background/80 backdrop-blur-xl px-4 py-3">
            <ChatInput
              onSend={sendMessage}
              isLoading={isLoading}
              onCancel={cancelStream}
            />
            <p className="text-chat-microcopy text-center mt-2">
              CLARA pode cometer erros. Verifique informações importantes.
            </p>
          </footer>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
