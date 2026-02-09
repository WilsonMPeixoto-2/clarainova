import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw } from "lucide-react";
import ClaraLogo from "@/components/ClaraLogo";
import { ChatMessageBubble, type ChatMessageData } from "@/components/chat/ChatMessageBubble";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { ChatInput } from "@/components/chat/ChatInput";
import { KnowledgeBaseSidebar } from "@/components/chat/KnowledgeBaseSidebar";
import { toast } from "sonner";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatFooter } from "@/components/chat/ChatFooter";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessageData = {
      id: Date.now(),
      role: "user",
      content: message.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setLastFailedMessage(null);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("clara-chat", {
        body: {
          message: message.trim(),
          conversationHistory,
        },
      });

      if (error) {
        console.error("[Home] Edge function error:", error);
        throw new Error(error.message || "Erro na comunicação com o servidor");
      }

      if (data?.error) {
        const isRateLimit = data.details?.includes("RATE_LIMIT") || data.details?.includes("429");
        const isPayment = data.details?.includes("PAYMENT") || data.details?.includes("402");

        if (isRateLimit) {
          toast.error("Sistema sobrecarregado", {
            description: "Aguarde alguns segundos e tente novamente.",
          });
        } else if (isPayment) {
          toast.error("Créditos esgotados", {
            description: "Contate o administrador do sistema.",
          });
        }

        setLastFailedMessage(message.trim());
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: "assistant",
            content: `⚠️ ${data.error}`,
            isError: true,
          },
        ]);
        return;
      }

      if (data?.metrics) {
        console.log(
          `[CLARA] Provider: ${data.metrics.provider} | Tempo: ${data.metrics.total_time_ms}ms | Chunks: ${data.metrics.chunks_found} | Versão: ${data.metrics.version}`
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: data?.answer || "Desculpe, não consegui gerar uma resposta.",
          sources: data?.sources?.map((s: { title?: string; similarity?: number }) => ({
            documentTitle: s.title || "Documento",
          })),
        },
      ]);
    } catch (error: any) {
      console.error("[Home] Error:", error);
      setLastFailedMessage(message.trim());

      const errorMsg = error?.message || "";
      let displayMessage: string;

      if (errorMsg.includes("FunctionsHttpError") || errorMsg.includes("500")) {
        displayMessage = "Erro interno do servidor. A equipe foi notificada. Tente novamente em instantes.";
      } else if (errorMsg.includes("FunctionsRelayError") || errorMsg.includes("502")) {
        displayMessage = "O serviço está temporariamente indisponível. Tente novamente em alguns segundos.";
      } else if (errorMsg.includes("rate") || errorMsg.includes("429")) {
        displayMessage = "Muitas requisições. Aguarde alguns segundos antes de tentar novamente.";
      } else {
        displayMessage = "Ocorreu um erro ao processar sua pergunta. Tente novamente.";
      }

      toast.error("Erro ao consultar CLARA", {
        description: displayMessage,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: `⚠️ ${displayMessage}`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);

  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      // Remove the last error message
      setMessages((prev) => prev.slice(0, -1));
      handleSendMessage(lastFailedMessage);
    }
  }, [lastFailedMessage, handleSendMessage]);

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
    setLastFailedMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ChatHeader onNewChat={handleNewChat} showNewChat={messages.length > 0} />

      {/* Main Content */}
      <main className="flex-1 container py-6 flex flex-col">
        <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full" style={{ height: "80vh" }}>
          <div className="flex-1 flex flex-col w-full min-h-0">
            <div
              className="flex-1 flex flex-col overflow-hidden rounded-2xl"
              style={{
                background: "oklch(0.14 0.04 250 / 0.5)",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                border: "1px solid oklch(0.95 0.01 250 / 0.1)",
                boxShadow:
                  "inset 0 1px 0 0 oklch(0.95 0.01 250 / 0.08), 0 8px 40px oklch(0 0 0 / 0.35), 0 0 0 1px oklch(0 0 0 / 0.1)",
              }}
            >
              <ScrollArea className="flex-1 p-4 md:p-6 custom-scrollbar">
                {messages.length === 0 ? (
                  <WelcomeScreen onSendMessage={handleSendMessage} />
                ) : (
                  <div className="space-y-5 min-h-full">
                    {messages.map((message) => (
                      <ChatMessageBubble key={message.id} message={message} />
                    ))}

                    {/* Retry button after error */}
                    {lastFailedMessage && !isLoading && (
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-all duration-300"
                        >
                          <RotateCcw className="size-4 mr-2" />
                          Tentar Novamente
                        </Button>
                      </div>
                    )}

                    {isLoading && (
                      <div className="flex justify-start message-enter">
                        <div className="chat-message-assistant flex items-center gap-3">
                          <div className="typing-indicator text-primary">
                            <span />
                            <span />
                            <span />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Consultando base de conhecimento...
                          </span>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSendMessage}
                isLoading={isLoading}
              />
            </div>
          </div>

          <KnowledgeBaseSidebar />
        </div>
      </main>

      <ChatFooter />
    </div>
  );
}
