import { useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSent = useRef(false);
  const { toast } = useToast();

  const { messages, isLoading, thinking, sendMessage, clearHistory, cancelStream } = useChat({
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error
      });
    }
  });

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleClearHistory = () => {
    if (messages.length > 0) {
      clearHistory();
      toast({
        title: "Histórico limpo",
        description: "A conversa foi apagada."
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-border/50">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-foreground">CLARA</h1>
              <p className="text-xs text-muted-foreground">Assistente SEI & SDP</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-6 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Olá! Sou a CLARA
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Sua assistente especializada em SEI, SDP e procedimentos da 4ª CRE.
              Como posso ajudar você hoje?
            </p>
            
            {/* Sugestões */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {[
                "Como criar um novo processo no SEI?",
                "Como anexar documentos?",
                "O que é bloco de assinatura?",
                "Como fazer prestação de contas no SDP?"
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  disabled={isLoading}
                  className="text-left px-4 py-3 rounded-xl border border-border/60 bg-card/40 text-sm text-foreground/80 hover:bg-card hover:border-primary/30 transition-all disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            
            {thinking.isThinking && (
              <ThinkingIndicator step={thinking.step} />
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="sticky bottom-0 border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            onCancel={cancelStream}
            initialValue={initialQuery && !hasAutoSent.current ? initialQuery : ""}
          />
          <p className="text-xs text-center text-muted-foreground/60 mt-2">
            CLARA pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </footer>
    </div>
  );
}
