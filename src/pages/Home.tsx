import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Settings } from "lucide-react";
import { Link } from "wouter";
import ClaraLogo from "@/components/ClaraLogo";
import { ChatMessageBubble, type ChatMessageData } from "@/components/chat/ChatMessageBubble";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { ChatInput } from "@/components/chat/ChatInput";
import { KnowledgeBaseSidebar } from "@/components/chat/KnowledgeBaseSidebar";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessageData = {
      id: Date.now(),
      role: "user",
      content: message.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("clara-chat", {
        body: { message: message.trim() },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: data.answer || "Desculpe, não consegui gerar uma resposta.",
          sources: data.sources?.map((s: { title?: string; similarity?: number }) => ({
            documentTitle: s.title || "Documento",
          })),
        },
      ]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content:
            error?.message?.includes("Rate limit") || error?.message?.includes("429")
              ? "O sistema está temporariamente sobrecarregado. Por favor, tente novamente em alguns segundos."
              : "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Premium */}
      <header
        className="text-foreground shadow-lg relative z-10"
        style={{
          background: "oklch(0.14 0.04 250 / 0.8)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid oklch(0.95 0.01 250 / 0.08)",
        }}
      >
        <div className="container py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <div
                className="size-12 rounded-xl flex items-center justify-center"
                style={{
                  background: "oklch(0.70 0.18 45 / 0.15)",
                  border: "1px solid oklch(0.70 0.18 45 / 0.25)",
                  boxShadow: "0 0 20px oklch(0.70 0.18 45 / 0.2)",
                }}
              >
                <ClaraLogo size={28} variant="light" />
              </div>
              <div>
                <h1
                  className="text-xl md:text-2xl font-bold tracking-tight text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  CLARA
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Consultora de Legislação e Apoio a Rotinas Administrativas
                </p>
              </div>
              <span
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full
                  bg-primary/15 text-primary border border-primary/25"
              >
                Beta
              </span>
            </div>

            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewChat}
                  className="border-border/40 hover:border-primary/40 hover:shadow-[0_0_12px_var(--primary-glow)] transition-all duration-300"
                >
                  <RefreshCw className="size-4 mr-2" />
                  Nova Conversa
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-6 flex flex-col">
        <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full" style={{ height: "80vh" }}>
          {/* Chat Area */}
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
              {/* Messages */}
              <ScrollArea className="flex-1 p-4 md:p-6 custom-scrollbar">
                {messages.length === 0 ? (
                  <WelcomeScreen onSendMessage={handleSendMessage} />
                ) : (
                  <div className="space-y-5 min-h-full">
                    {messages.map((message) => (
                      <ChatMessageBubble key={message.id} message={message} />
                    ))}

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

              {/* Input */}
              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSendMessage}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Sidebar */}
          <KnowledgeBaseSidebar />
        </div>
      </main>

      {/* Footer Premium */}
      <footer
        className="mt-8 py-8"
        style={{
          background: "oklch(0.10 0.04 250 / 0.8)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid oklch(0.95 0.01 250 / 0.06)",
        }}
      >
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3
                className="font-semibold mb-4 text-lg text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Sobre CLARA
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Assistente de inteligência artificial especializada em legislação
                e procedimentos administrativos.
              </p>
              <p className="text-muted-foreground/50 text-xs mt-3">
                Versão de testes (Beta)
              </p>
            </div>

            <div>
              <h3
                className="font-semibold mb-4 text-lg text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Recursos
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/relatorio-tecnico">
                    <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
                      <Settings className="size-4" />
                      Relatório Técnico
                    </span>
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3
                className="font-semibold mb-4 text-lg text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Importante
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                As respostas têm caráter orientativo e devem ser validadas por
                fontes oficiais.
              </p>
            </div>
          </div>

          <div className="border-t border-border/20 pt-6 text-center text-muted-foreground/60 text-sm">
            <p>
              © 2026 CLARA — Consultora de Legislação e Apoio a Rotinas
              Administrativas
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
