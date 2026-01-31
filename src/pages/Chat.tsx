import { useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, MessageSquare, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import { useChatShortcuts } from "@/hooks/useKeyboardShortcuts";
import UserMenu from "@/components/auth/UserMenu";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Animation variants
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

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get("q") || "";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isUserAtBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSent = useRef(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { messages, isLoading, thinking, sendMessage, clearHistory, cancelStream, regenerateLast, continueLast } = useChat({
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

  // Detectar posição do scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const threshold = 100;
      isUserAtBottom.current = 
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    }
  }, []);

  // Auto-scroll inteligente - só rola se usuário estiver no fim
  useEffect(() => {
    if (isUserAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinking.isThinking]);

  // Enviar query inicial da URL
  useEffect(() => {
    if (initialQuery && !hasAutoSent.current && messages.length === 0) {
      hasAutoSent.current = true;
      sendMessage(initialQuery);
      // Limpar query da URL
      setSearchParams({});
    }
  }, [initialQuery, messages.length, sendMessage, setSearchParams]);

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
      <SEOHead 
        title="Chat - CLARA"
        description="Converse com a CLARA, sua assistente especializada em legislação e procedimentos administrativos."
      />
      
      <OfflineIndicator />
      
      <div className="min-h-screen bg-background flex flex-col">
        {/* Skip link for accessibility */}
        <a 
          href="#chat-input" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
        >
          Pular para o campo de mensagem
        </a>

        {/* Header */}
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-50 glass-card border-b border-border/50" 
          role="banner"
        >
          <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/">
                    <Button variant="ghost" size="icon" className="rounded-full" aria-label="Voltar para página inicial">
                      <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Voltar (Esc)</TooltipContent>
              </Tooltip>
              <div>
                <h1 className="text-lg font-semibold text-foreground">CLARA</h1>
                <p className="text-xs text-muted-foreground">Inteligência Administrativa</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground"
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
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    aria-label="Limpar histórico da conversa"
                  >
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpar histórico (Ctrl+Shift+L)</TooltipContent>
              </Tooltip>

              {/* Auth Section */}
              {!authLoading && (
                user ? (
                  <UserMenu />
                ) : (
                  <motion.button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border/30 rounded-lg hover:bg-card/50 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Entrar
                  </motion.button>
                )
              )}
            </div>
          </div>
        </motion.header>

        {/* Messages Area */}
        <main 
          ref={scrollContainerRef as React.RefObject<HTMLElement>}
          onScroll={handleScroll}
          className="flex-1 container max-w-4xl mx-auto px-4 py-6 overflow-y-auto" 
          role="main" 
          aria-label="Área de mensagens"
        >
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <motion.div 
                key="empty-state"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center"
              >
                <motion.div 
                  variants={itemVariants}
                  className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6" 
                  aria-hidden="true"
                >
                  <MessageSquare className="w-8 h-8 text-primary" />
                </motion.div>
                
                <motion.h2 
                  variants={itemVariants}
                  className="text-2xl font-semibold text-foreground mb-2"
                >
                  Olá! Sou a CLARA
                </motion.h2>
                
                <motion.p 
                  variants={itemVariants}
                  className="text-muted-foreground max-w-md mb-8"
                >
                  Sua assistente especializada em legislação e procedimentos administrativos.
                  Como posso ajudar você hoje?
                </motion.p>
                
                {/* Sugestões */}
                <motion.div 
                  variants={containerVariants}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg" 
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
                      className="text-left px-4 py-3 rounded-xl border border-border/60 bg-card/40 text-sm text-foreground/80 hover:bg-card hover:border-primary/30 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="space-y-6" 
                role="log" 
                aria-live="polite" 
                aria-label="Histórico da conversa"
              >
                {messages.map((message, index) => {
                  const isLastAssistant = 
                    message.role === "assistant" && 
                    index === messages.length - 1 || 
                    (message.role === "assistant" && 
                     messages.slice(index + 1).every(m => m.role !== "assistant"));
                  
                  return (
                    <ChatMessage 
                      key={message.id} 
                      message={message}
                      onStop={cancelStream}
                      onRegenerate={regenerateLast}
                      onContinue={continueLast}
                      isLoading={isLoading}
                      isLastAssistant={isLastAssistant}
                    />
                  );
                })}
                
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
        <motion.footer 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="sticky bottom-0 border-t border-border/50 bg-background/80 backdrop-blur-xl chat-input-footer"
          role="contentinfo"
        >
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <ChatInput
              onSend={sendMessage}
              isLoading={isLoading}
              onCancel={cancelStream}
              initialValue={initialQuery && !hasAutoSent.current ? initialQuery : ""}
            />
            <p className="text-xs text-center text-muted-foreground/60 mt-2" aria-live="polite">
              CLARA pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </motion.footer>
      </div>
    </TooltipProvider>
  );
}
