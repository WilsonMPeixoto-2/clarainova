import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ResponseMode = "fast" | "deep";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: {
    local: string[];
    web?: string[];
  };
  isStreaming?: boolean;
  queryId?: string; // ID from query_analytics for feedback
  userQuery?: string; // Original user query for PDF export (only on assistant messages)
}

interface ThinkingState {
  isThinking: boolean;
  step: string;
}

interface UseChatOptions {
  onError?: (error: string) => void;
}

const STORAGE_KEY = "clara-chat-history";

function loadMessagesFromStorage(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
  } catch (e) {
    console.error("Erro ao carregar histórico:", e);
  }
  return [];
}

function saveMessagesToStorage(messages: ChatMessage[]) {
  try {
    const toStore = messages.map(msg => ({
      ...msg,
      isStreaming: false
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error("Erro ao salvar histórico:", e);
  }
}

// Get or create session fingerprint
function getSessionFingerprint(): string {
  const FINGERPRINT_KEY = "clara-session-fingerprint";
  let fingerprint = sessionStorage.getItem(FINGERPRINT_KEY);
  if (!fingerprint) {
    fingerprint = `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    sessionStorage.setItem(FINGERPRINT_KEY, fingerprint);
  }
  return fingerprint;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessagesFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [thinking, setThinking] = useState<ThinkingState>({ isThinking: false, step: "" });
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const sendMessage = useCallback(async (content: string, mode: ResponseMode = "fast") => {
    if (!content.trim() || isLoading) return;

    const userQueryContent = content.trim();

    // Adicionar mensagem do usuário
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userQueryContent,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveMessagesToStorage(updatedMessages);

    setIsLoading(true);
    setThinking({ isThinking: true, step: "Analisando pergunta..." });

    // Preparar histórico para a API
    const historyForApi = updatedMessages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Criar placeholder para resposta do assistente
    const assistantId = crypto.randomUUID();
    let assistantContent = "";
    let localSources: string[] = [];

    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true
      }
    ]);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clara-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({
            message: content,
            history: historyForApi.slice(0, -1), // Excluir a mensagem atual
            mode: mode,
          }),
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Resposta sem corpo");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Processar linhas completas
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line || line.startsWith(":")) continue;

          if (line.startsWith("event: ")) {
            const eventType = line.slice(7);
            
            // Pegar a linha de dados seguinte se estiver no buffer
            const dataLineEnd = buffer.indexOf("\n");
            if (dataLineEnd === -1) {
              // Dados incompletos, colocar de volta
              buffer = line + "\n" + buffer;
              break;
            }
            
            const dataLine = buffer.slice(0, dataLineEnd).trim();
            buffer = buffer.slice(dataLineEnd + 1);
            
            if (!dataLine.startsWith("data: ")) continue;
            const jsonStr = dataLine.slice(6);

            try {
              const data = JSON.parse(jsonStr);

              switch (eventType) {
                case "thinking":
                  setThinking({ isThinking: true, step: data.step || "Processando..." });
                  break;
                  
                case "delta":
                  if (data.content) {
                    assistantContent += data.content;
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === assistantId 
                          ? { ...msg, content: assistantContent }
                          : msg
                      )
                    );
                  }
                  setThinking({ isThinking: false, step: "" });
                  break;
                  
                case "sources":
                  if (data.local) {
                    localSources = data.local;
                  }
                  break;
                  
                case "done":
                  // Finalizar streaming
                  break;
                  
                case "error":
                  throw new Error(data.message || "Erro no streaming");
              }
            } catch (parseError) {
              // Ignorar erros de parse de eventos individuais
              console.warn("Erro ao parsear evento SSE:", parseError);
            }
          } else if (line.startsWith("data: ")) {
            // Formato alternativo sem event:
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;
            
            try {
              const data = JSON.parse(jsonStr);
              if (data.content) {
                assistantContent += data.content;
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantId 
                      ? { ...msg, content: assistantContent }
                      : msg
                  )
                );
              }
            } catch {
              // Ignorar
            }
          }
        }
      }

      // Finalizar mensagem do assistente e salvar analytics
      const finalContent = assistantContent || "Desculpe, não consegui gerar uma resposta.";
      const finalSources = localSources.length > 0 ? { local: localSources } : undefined;

      // Save to query_analytics (fire and forget)
      let savedQueryId: string | null = null;
      try {
        const sessionFingerprint = getSessionFingerprint();
        const { data: analyticsData } = await supabase
          .from("query_analytics")
          .insert({
            user_query: content.trim(),
            assistant_response: finalContent,
            sources_cited: localSources,
            session_fingerprint: sessionFingerprint,
          })
          .select("id")
          .single();
        
        savedQueryId = analyticsData?.id || null;
      } catch (err) {
        console.warn("[useChat] Failed to save query analytics:", err);
      }

      setMessages(prev => {
        const final = prev.map(msg => 
          msg.id === assistantId 
            ? { 
                ...msg, 
                content: finalContent,
                isStreaming: false,
                sources: finalSources,
                queryId: savedQueryId || undefined,
                userQuery: userQueryContent, // Store original query for PDF export
              }
            : msg
        );
        saveMessagesToStorage(final);
        return final;
      });

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Cancelado pelo usuário
        setMessages(prev => prev.filter(msg => msg.id !== assistantId));
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro no chat:", error);
      
      // Atualizar mensagem com erro
      setMessages(prev => {
        const final = prev.map(msg => 
          msg.id === assistantId 
            ? { 
                ...msg, 
                content: `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`,
                isStreaming: false
              }
            : msg
        );
        saveMessagesToStorage(final);
        return final;
      });
      
      options.onError?.(errorMessage);
    } finally {
      setIsLoading(false);
      setThinking({ isThinking: false, step: "" });
      abortControllerRef.current = null;
    }
  }, [messages, isLoading, options]);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    isLoading,
    thinking,
    sendMessage,
    clearHistory,
    cancelStream,
    setMessages
  };
}
