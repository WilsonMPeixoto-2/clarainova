import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";
import { 
  Send, 
  MessageSquare, 
  FileText, 
  HelpCircle, 
  Loader2,
  BookOpen,
  FileSearch,
  ClipboardList,
  RefreshCw
} from "lucide-react";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: { documentTitle: string; section?: string }[];
}

const EXAMPLE_QUESTIONS = [
  { icon: FileSearch, text: "Como abrir um processo no SEI?" },
  { icon: ClipboardList, text: "Como anexar documentos externos?" },
  { icon: BookOpen, text: "Como fazer a prestação de contas do SDP?" },
  { icon: HelpCircle, text: "Quais são os níveis de acesso no SEI?" },
];

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: data.response,
          sources: data.sources,
        },
      ]);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.",
        },
      ]);
      setIsLoading(false);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: message.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    sendMessageMutation.mutate({
      message: message.trim(),
      sessionId: sessionId || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setInputValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col bg-sei-gradient-light">
      {/* Header */}
      <header className="bg-sei-gradient text-white shadow-lg">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                  Central de Inteligência SEI!RIO
                </h1>
                <p className="text-sm text-white/80 hidden sm:block">
                  Assistente Virtual para o Sistema Eletrônico de Informações
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Nova Conversa
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-6 flex flex-col">
        <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto w-full">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            <Card className="flex-1 flex flex-col shadow-lg border-0 overflow-hidden">
              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-4 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                      <BookOpen className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Bem-vindo à Central de Inteligência SEI!RIO
                    </h2>
                    <p className="text-muted-foreground max-w-md mb-8">
                      Sou um assistente especializado no Sistema SEI e em procedimentos 
                      de prestação de contas do SDP. Como posso ajudá-lo hoje?
                    </p>
                    
                    {/* Example Questions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                      {EXAMPLE_QUESTIONS.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSendMessage(question.text)}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left group"
                        >
                          <question.icon className="w-5 h-5 text-primary shrink-0" />
                          <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                            {question.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 min-h-full">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] ${
                            message.role === "user"
                              ? "chat-message-user"
                              : "chat-message-assistant"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <Streamdown>{message.content}</Streamdown>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}
                          
                          {/* Sources */}
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Fontes consultadas:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {message.sources.map((source, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                                  >
                                    <FileText className="w-3 h-3" />
                                    {source.documentTitle}
                                    {source.section && ` - ${source.section}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Loading indicator */}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="chat-message-assistant flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
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

              {/* Input Area */}
              <CardContent className="p-4 border-t bg-card">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Digite sua pergunta sobre o SEI ou SDP..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={!inputValue.trim() || isLoading}
                    className="shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  As respostas são baseadas nos manuais do SEI e documentos de prestação de contas do SDP.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Knowledge Base Info */}
          <aside className="lg:w-80 shrink-0">
            <Card className="shadow-lg border-0">
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-primary" />
                  Base de Conhecimento
                </h3>
                
                <div className="space-y-3">
                  <DocumentItem 
                    title="Manual do Usuário SEI 4.0"
                    description="Guia completo de operações no Sistema Eletrônico de Informações"
                    status="indexed"
                  />
                  <DocumentItem 
                    title="Cartilha do Usuário SEI"
                    description="Orientações práticas para uso do sistema"
                    status="indexed"
                  />
                  <DocumentItem 
                    title="Manual de Prestação de Contas SDP"
                    description="Procedimentos para prestação de contas da 4ª CRE"
                    status="indexed"
                  />
                  <DocumentItem 
                    title="Guia Orientador SDP"
                    description="Circular E/SUBG/CPGOF Nº 06/2024"
                    status="indexed"
                  />
                </div>

                <div className="mt-6 p-3 bg-primary/5 rounded-lg">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Sobre este assistente
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Este assistente foi treinado com os manuais oficiais do SEI e 
                    documentos de prestação de contas do Sistema Descentralizado de 
                    Pagamento (SDP) da 4ª CRE. As respostas são baseadas exclusivamente 
                    nestes documentos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t py-4">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground">
            Central de Inteligência SEI!RIO — GAD / 4ª CRE — Secretaria Municipal de Educação do Rio de Janeiro
          </p>
        </div>
      </footer>
    </div>
  );
}

function DocumentItem({ 
  title, 
  description, 
  status 
}: { 
  title: string; 
  description: string; 
  status: "indexed" | "pending" | "error" 
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground truncate">{title}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
      </div>
      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
        status === "indexed" ? "bg-green-500" : 
        status === "pending" ? "bg-yellow-500" : "bg-red-500"
      }`} />
    </div>
  );
}
