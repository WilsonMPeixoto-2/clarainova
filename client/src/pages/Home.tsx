import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
// Input substituído por textarea customizado
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
  sources?: { documentTitle: string; section?: string; link?: string }[];
  usedWebSearch?: boolean;
}

const EXAMPLE_QUESTIONS = [
  { icon: FileSearch, text: "Abrir um processo no SEI" },
  { icon: ClipboardList, text: "Anexar documentos externos" },
  { icon: BookOpen, text: "Fazer a prestação de contas do SDP" },
  { icon: HelpCircle, text: "Consultar níveis de acesso no SEI" },
  { icon: FileText, text: "Assinar e autenticar documentos no SEI" },
  { icon: MessageSquare, text: "Tramitar processo para outra unidade" },
];

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          usedWebSearch: data.usedWebSearch,
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
    textareaRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col bg-sei-gradient-light">
      {/* Header */}
      <header className="bg-sei-gradient text-white shadow-lg">
        <div className="container py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
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
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-amber-400/20 text-amber-100 rounded-full border border-amber-400/30">
                Versão de testes (Beta)
              </span>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                      {EXAMPLE_QUESTIONS.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSendMessage(question.text)}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-200 text-left group cursor-pointer"
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
                                          {/* Web Search Indicator */}
                                          {message.usedWebSearch && (
                                            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                              </svg>
                                              Inclui informações de fontes governamentais externas
                                            </div>
                                          )}
                                          
                                          {/* Sources */}
                                          {message.sources && message.sources.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-border/50">
                                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                                Fontes consultadas:
                                              </p>
                                              <div className="flex flex-wrap gap-1">
                                                {message.sources.map((source, idx) => (
                                                  source.link ? (
                                                    <a
                                                      key={idx}
                                                      href={source.link}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                                    >
                                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                      </svg>
                                                      {source.documentTitle}
                                                    </a>
                                                  ) : (
                                                    <span
                                                      key={idx}
                                                      className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                                                    >
                                                      <FileText className="w-3 h-3" />
                                                      {source.documentTitle}
                                                      {source.section && ` - ${source.section}`}
                                                    </span>
                                                  )
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

              {/* Input Area - Melhorado para UX */}
              <CardContent className="p-4 border-t bg-muted/30">
                <div className="relative bg-white rounded-xl border-2 border-slate-300 shadow-md focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 transition-all duration-200">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder="💬 Digite sua pergunta sobre o SEI ou SDP aqui..."
                    disabled={isLoading}
                    rows={3}
                    className="w-full min-h-[80px] max-h-[200px] p-4 pr-16 bg-transparent text-foreground placeholder:text-muted-foreground/70 resize-none focus:outline-none text-base leading-relaxed"
                  />
                  <Button
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={!inputValue.trim() || isLoading}
                    size="lg"
                    className="absolute bottom-3 right-3 h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 shadow-lg transition-all duration-200 hover:scale-105"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  As respostas são baseadas em manuais e guias do SEI inseridos na base de conhecimento.
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
                
                {/* Data de atualização da base */}
                <p className="text-xs text-muted-foreground mt-3 text-center italic">
                  Base atualizada em: 12/01/2026
                </p>

                {/* Seção: Sobre este assistente */}
                <div className="mt-6 p-3 bg-primary/5 rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Sobre este assistente
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify" style={{ lineHeight: '1.6' }}>
                    Ferramenta em desenvolvimento pela 4ª CRE, em fase de validação 
                    e aprimoramento, voltada ao apoio operacional na utilização do 
                    Sistema Eletrônico de Informações (SEI).
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify mt-2 font-medium" style={{ lineHeight: '1.6' }}>
                    Este ambiente não constitui canal oficial do Município do Rio de Janeiro 
                    ou do sistema SEI!RIO, nem substitui orientações formais.
                  </p>
                </div>

                {/* Seção: Ressalva */}
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Ressalva
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed text-justify" style={{ lineHeight: '1.6' }}>
                    As respostas têm caráter orientativo, podendo conter limitações 
                    inerentes a sistemas automatizados. Recomenda-se validação por 
                    documentação oficial vigente e pelos fluxos e orientações dos 
                    setores responsáveis e dos órgãos competentes.
                  </p>
                </div>

                {/* Seção: Limites de atuação */}
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Limites de atuação
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify" style={{ lineHeight: '1.6' }}>
                    O conteúdo gerado baseia-se na documentação oficial inserida na 
                    base de conhecimento (manuais e guias do SEI Federal e da instância 
                    SEI!RIO utilizada no Município do Rio de Janeiro). O assistente 
                    limita-se a orientações sobre o SEI e a normas administrativas 
                    diretamente correlatas ao uso do sistema.
                  </p>
                </div>

                {/* Seção: Complemento por busca externa */}
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Busca externa
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify" style={{ lineHeight: '1.6' }}>
                    Na ausência de base documental interna suficiente, o assistente 
                    poderá consultar fontes externas oficiais (preferencialmente .gov.br 
                    e repositórios normativos), mantendo o tema restrito ao SEI e normas 
                    correlatas. Quando utilizar fontes externas, os links serão indicados 
                    na resposta.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      {/* Footer - Versão neutra */}
      <footer className="bg-card border-t py-3">
        <div className="container">
          <p className="text-center text-xs text-muted-foreground">
            Central de Inteligência SEI!RIO — Projeto em desenvolvimento pela 4ª CRE — Versão de testes
          </p>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-1">
            Uso interno orientativo — sujeito a validação por fontes oficiais
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
