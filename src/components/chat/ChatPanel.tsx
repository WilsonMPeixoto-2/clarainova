import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Keyboard, AlertCircle, RefreshCw, Sparkles, Target, BookOpen, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChat, ChatErrorDetails } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useAuth } from "@/contexts/AuthContext";
import { ChatMessage } from "@/components/chat/ChatMessage";
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

const DRAWER_WIDTH_KEY = "clara-chat-drawer-width";
const MIN_DRAWER_WIDTH = 440;
const DESKTOP_DEFAULT_WIDTH = 640;
const MOBILE_SNAP_POINTS = [40, 70, 100];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const clampDesktopWidth = (value: number) => {
  if (typeof window === "undefined") return value;
  const max = Math.max(520, window.innerWidth - 80);
  return clamp(value, MIN_DRAWER_WIDTH, max);
};

const nearestSnapPoint = (value: number) => {
  return MOBILE_SNAP_POINTS.reduce((closest, point) =>
    Math.abs(point - value) < Math.abs(closest - value) ? point : closest,
    MOBILE_SNAP_POINTS[0]
  );
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
            className="drawer-suggestion-chip"
          >
            {suggestion}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

export function ChatPanel({ open, onOpenChange, initialQuery }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isUserAtBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastInitialQuery = useRef<string>("");
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastErrorDetails, setLastErrorDetails] = useState<ChatErrorDetails | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(() => {
    if (typeof window === "undefined") return DESKTOP_DEFAULT_WIDTH;
    const stored = Number(window.localStorage.getItem(DRAWER_WIDTH_KEY));
    return clampDesktopWidth(Number.isFinite(stored) ? stored : DESKTOP_DEFAULT_WIDTH);
  });
  const [expandedDesktop, setExpandedDesktop] = useState(false);
  const [restoreDesktopWidth, setRestoreDesktopWidth] = useState(DESKTOP_DEFAULT_WIDTH);
  const [mobileSnapPoint, setMobileSnapPoint] = useState<number>(MOBILE_SNAP_POINTS[1]);
  const desktopResizeState = useRef<{ startX: number; startWidth: number } | null>(null);
  const mobileResizeState = useRef<{ startY: number; startSnap: number } | null>(null);

  const { messages, isLoading, thinking, sendMessage, clearHistory, cancelStream, setMessages } = useChat({
    onError: (error, details) => {
      setLastError(error);
      setLastErrorDetails(details ?? null);
      setShowErrorDetails(false);
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

  useEffect(() => {
    if (isMobile) return;
    setDrawerWidth((current) => clampDesktopWidth(current));
    window.localStorage.setItem(DRAWER_WIDTH_KEY, String(clampDesktopWidth(drawerWidth)));
  }, [drawerWidth, isMobile]);

  useEffect(() => {
    if (isMobile) {
      setExpandedDesktop(false);
      return;
    }

    const onResize = () => {
      setDrawerWidth((current) => clampDesktopWidth(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

  const handleDesktopResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile) return;
      event.preventDefault();
      setExpandedDesktop(false);
      desktopResizeState.current = { startX: event.clientX, startWidth: drawerWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [drawerWidth, isMobile],
  );

  const handleDesktopResizeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!desktopResizeState.current) return;
    const delta = desktopResizeState.current.startX - event.clientX;
    const nextWidth = clampDesktopWidth(desktopResizeState.current.startWidth + delta);
    setDrawerWidth(nextWidth);
  }, []);

  const handleDesktopResizeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!desktopResizeState.current) return;
    desktopResizeState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const toggleDesktopExpand = useCallback(() => {
    if (isMobile) return;
    if (expandedDesktop) {
      const restored = clampDesktopWidth(restoreDesktopWidth);
      setDrawerWidth(restored);
      setExpandedDesktop(false);
      return;
    }

    setRestoreDesktopWidth(drawerWidth);
    setDrawerWidth(clampDesktopWidth(window.innerWidth - 24));
    setExpandedDesktop(true);
  }, [drawerWidth, expandedDesktop, isMobile, restoreDesktopWidth]);

  const handleMobileResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    event.preventDefault();
    mobileResizeState.current = { startY: event.clientY, startSnap: mobileSnapPoint };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [isMobile, mobileSnapPoint]);

  const handleMobileResizeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!mobileResizeState.current) return;
    const deltaY = mobileResizeState.current.startY - event.clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    setMobileSnapPoint(clamp(mobileResizeState.current.startSnap + deltaPercent, MOBILE_SNAP_POINTS[0], MOBILE_SNAP_POINTS[MOBILE_SNAP_POINTS.length - 1]));
  }, []);

  const handleMobileResizeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!mobileResizeState.current) return;
    mobileResizeState.current = null;
    setMobileSnapPoint((current) => nearestSnapPoint(current));
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

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

  // Send initial query
  useEffect(() => {
    if (open && initialQuery && initialQuery !== lastInitialQuery.current) {
      lastInitialQuery.current = initialQuery;
      setLastError(null);
      setLastErrorDetails(null);
      setShowErrorDetails(false);
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
      setLastErrorDetails(null);
      setShowErrorDetails(false);
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
    setLastErrorDetails(null);
    setShowErrorDetails(false);
    toast({ title: "Nova conversa iniciada" });
  }

  const handleLoadSession = useCallback(async (sessionId: string) => {
    const loadedMessages = await loadSession(sessionId);
    if (loadedMessages && setMessages) {
      setMessages(loadedMessages);
      lastSavedLength.current = loadedMessages.length;
      setLastError(null);
      setLastErrorDetails(null);
      setShowErrorDetails(false);
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
    setLastErrorDetails(null);
    setShowErrorDetails(false);
    sendMessage(query, "fast");
  }, [sendMessage]);

  const handleRetry = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMessage) {
        setLastError(null);
        setLastErrorDetails(null);
        setShowErrorDetails(false);
        sendMessage(lastUserMessage.content, "fast");
      }
    }
  }, [messages, sendMessage]);

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side={isMobile ? "bottom" : "right"}
          className={`drawer-shell flex flex-col p-0 gap-0 ${
            isMobile
              ? "w-full max-w-full h-[70vh] rounded-t-2xl border-t border-l-0"
              : "h-full border-l"
          }`}
          style={
            isMobile
              ? { height: `${mobileSnapPoint}vh` }
              : { width: `${drawerWidth}px`, maxWidth: `${drawerWidth}px` }
          }
        >
          {!isMobile && (
            <div
              className="drawer-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Ajustar largura do chat"
              tabIndex={0}
              onPointerDown={handleDesktopResizeStart}
              onPointerMove={handleDesktopResizeMove}
              onPointerUp={handleDesktopResizeEnd}
              onPointerCancel={handleDesktopResizeEnd}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setDrawerWidth((current) => clampDesktopWidth(current + 24));
                }
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setDrawerWidth((current) => clampDesktopWidth(current - 24));
                }
              }}
            />
          )}

          {isMobile && (
            <div
              className="mobile-sheet-handle"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Ajustar altura do chat"
              tabIndex={0}
              onPointerDown={handleMobileResizeStart}
              onPointerMove={handleMobileResizeMove}
              onPointerUp={handleMobileResizeEnd}
              onPointerCancel={handleMobileResizeEnd}
            />
          )}

          {/* Header */}
          <SheetHeader className="drawer-header-surface flex-shrink-0 px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="clara-avatar w-10 h-10" aria-hidden="true">
                  C
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

                {!isMobile && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleDesktopExpand}
                        className="btn-icon h-8 w-8"
                        aria-label={expandedDesktop ? "Restaurar largura" : "Expandir chat"}
                      >
                        {expandedDesktop ? (
                          <Minimize2 className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Maximize2 className="w-4 h-4" aria-hidden="true" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{expandedDesktop ? "Restaurar" : "Expandir"}</TooltipContent>
                  </Tooltip>
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
          <main 
            ref={scrollContainerRef as React.RefObject<HTMLElement>}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4" 
            role="main" 
            aria-label="Área de mensagens"
          >
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
                      className="p-3 rounded-xl bg-destructive/5 border border-destructive/20"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium">Não foi possível processar</p>
                          <p className="text-chat-microcopy mt-0.5">{lastError}</p>
                          {lastErrorDetails?.hint && (
                            <p className="text-chat-microcopy mt-1 text-text-muted">{lastErrorDetails.hint}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleRetry}
                          className="text-xs gap-1.5 h-7 focus-halo"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Tentar novamente
                        </Button>
                        {lastErrorDetails && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowErrorDetails((current) => !current)}
                            className="text-xs h-7 focus-halo"
                          >
                            {showErrorDetails ? "Ocultar detalhes" : "Detalhes técnicos"}
                          </Button>
                        )}
                      </div>
                      {lastErrorDetails && showErrorDetails && (
                        <pre className="mt-2 text-[11px] leading-relaxed p-2 rounded-lg bg-background/50 border border-border-subtle overflow-x-auto">
{JSON.stringify(lastErrorDetails, null, 2)}
                        </pre>
                      )}
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Input Area */}
          <footer className="drawer-footer-surface flex-shrink-0 border-t px-4 py-3 chat-input-footer">
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
