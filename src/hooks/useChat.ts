import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ResponseMode = "fast" | "deep";
export type WebSearchMode = "auto" | "deep";

// Message status for UI rendering
export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface ApiProviderInfo {
  provider: "gemini" | "lovable";
  model: string;
}

export type NoticeType = 
  | "web_search" 
  | "limited_base" 
  | "general_guidance" 
  | "out_of_scope"
  | "info"
  | "stopped"; // New: for interrupted responses

export interface ChatNotice {
  type: NoticeType;
  message: string;
}

// Structured web source with evidence
export interface WebSourceData {
  url: string;
  title: string;
  domain?: string;
  domain_category: "primary" | "official_mirror" | "aggregator" | "unknown";
  confidence: "high" | "medium" | "low";
  excerpt_used: string;
  retrieved_at: string;
}

export interface ChatMessageSources {
  local: string[];
  web?: WebSourceData[] | string[]; // Support both structured and simple URL formats
  quorum_met?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: ChatMessageSources;
  isStreaming?: boolean; // @deprecated - use status instead
  status?: MessageStatus; // New: explicit message status
  queryId?: string; // ID from query_analytics for feedback
  userQuery?: string; // Original user query for PDF export (only on assistant messages)
  apiProvider?: ApiProviderInfo; // Which API was used for this response
  notice?: ChatNotice; // Transparency notice (web search, limited base, etc.)
  requestId?: string; // New: backend request ID for tracking
}

interface ThinkingState {
  isThinking: boolean;
  step: string;
}

interface UseChatOptions {
  onError?: (error: string) => void;
}

// Options for sendMessage to support continuation
interface SendMessageOptions {
  continuation?: boolean;
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
  
  // Refs for regenerate/continue functionality
  const lastUserMessageRef = useRef<string>("");
  const lastModeRef = useRef<ResponseMode>("fast");
  const lastWebSearchModeRef = useRef<WebSearchMode>("auto");
  const activeRequestIdRef = useRef<string | null>(null);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    lastUserMessageRef.current = "";
    activeRequestIdRef.current = null;
  }, []);

  const sendMessage = useCallback(async (
    content: string, 
    mode: ResponseMode = "fast", 
    webSearchMode: WebSearchMode = "auto",
    sendOptions: SendMessageOptions = {}
  ) => {
    const isContinuation = sendOptions.continuation === true;
    
    // For continuation, we don't need new content
    if (!isContinuation && (!content.trim() || isLoading)) return;
    if (isContinuation && isLoading) return;

    const userQueryContent = isContinuation ? lastUserMessageRef.current : content.trim();
    
    // Store last user message for regenerate/continue
    if (!isContinuation) {
      lastUserMessageRef.current = userQueryContent;
      lastModeRef.current = mode;
      lastWebSearchModeRef.current = webSearchMode;
    }

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
    let webSources: WebSourceData[] | string[] = [];
    let quorumMet: boolean | undefined;
    let apiProviderInfo: ApiProviderInfo | undefined;
    let noticeInfo: ChatNotice | undefined;
    let backendRequestId: string | undefined;

    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        status: "streaming"
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
            "Accept": "text/event-stream",
            // Supabase Edge Functions typically expect both apikey + Authorization
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            message: isContinuation ? "" : content,
            history: historyForApi.slice(0, -1), // Excluir a mensagem atual
            // Backward/forward compatibility with older function contracts
            conversationHistory: historyForApi.slice(0, -1),
            mode: mode,
            webSearchMode: webSearchMode,
            continuation: isContinuation, // Signal backend to continue previous response
          }),
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      if (isJson) {
        const data = await response.json().catch(() => ({} as any));

        if (data?.error && !data?.answer) {
          throw new Error(data.error);
        }

        backendRequestId = data?.request_id || data?.requestId || backendRequestId;

        // Map backend provider formats into UI expectations
        const providerRaw = String(data?.provider || data?.metrics?.provider || "").toLowerCase();
        const mappedProvider: ApiProviderInfo["provider"] =
          providerRaw.includes("lovable") ? "lovable" : "gemini";
        const model = String(data?.metrics?.model || data?.model || "").trim();

        if (model) {
          apiProviderInfo = { provider: mappedProvider, model };
        }

        const answerText = String(data?.answer ?? data?.content ?? data?.text ?? "").trim();
        assistantContent = answerText;

        const rawSources = Array.isArray(data?.sources) ? data.sources : [];
        localSources = rawSources
          .map((s: any) => (typeof s === "string" ? s : String(s?.title || "").trim()))
          .filter(Boolean);
        quorumMet = localSources.length > 0;
      } else {
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
                  case "request_id":
                    // Store backend request ID for tracking
                    if (data.id) {
                      backendRequestId = data.id;
                      activeRequestIdRef.current = data.id;
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === assistantId
                            ? { ...msg, requestId: backendRequestId }
                            : msg
                        )
                      );
                    }
                    break;

                  case "api_provider":
                    if (data.provider && data.model) {
                      apiProviderInfo = { provider: data.provider, model: data.model };
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === assistantId
                            ? { ...msg, apiProvider: apiProviderInfo }
                            : msg
                        )
                      );
                    }
                    break;

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
                    if (data.web) {
                      webSources = data.web;
                    }
                    if (typeof data.quorum_met === 'boolean') {
                      quorumMet = data.quorum_met;
                    }
                    break;

                  case "notice":
                    if (data.type && data.message) {
                      noticeInfo = { type: data.type, message: data.message };
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === assistantId
                            ? { ...msg, notice: noticeInfo }
                            : msg
                        )
                      );
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
      }

      // Finalizar mensagem do assistente e salvar analytics
      const finalContent = assistantContent || "Desculpe, não consegui gerar uma resposta.";
      const hasLocalSources = localSources.length > 0;
      const hasWebSources = webSources.length > 0;
      const finalSources: ChatMessageSources | undefined = (hasLocalSources || hasWebSources) 
        ? { 
            local: localSources,
            ...(hasWebSources && { web: webSources }),
            ...(quorumMet !== undefined && { quorum_met: quorumMet }),
          } 
        : undefined;

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
                status: "done" as MessageStatus,
                sources: finalSources,
                queryId: savedQueryId || undefined,
                userQuery: userQueryContent,
                apiProvider: apiProviderInfo,
                notice: noticeInfo,
                requestId: backendRequestId,
              }
            : msg
        );
        saveMessagesToStorage(final);
        return final;
      });

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Cancelado pelo usuário - mark as stopped instead of removing
        setMessages(prev => {
          const final = prev.map(msg => 
            msg.id === assistantId 
              ? { 
                  ...msg, 
                  isStreaming: false,
                  status: "stopped" as MessageStatus,
                  notice: { type: "stopped" as NoticeType, message: "Resposta interrompida" },
                  userQuery: userQueryContent, // Keep for potential continue
                }
              : msg
          );
          saveMessagesToStorage(final);
          return final;
        });
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
                content: msg.content || `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`,
                isStreaming: false,
                status: "error" as MessageStatus,
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

  // Regenerate the last response
  const regenerateLast = useCallback(() => {
    if (!lastUserMessageRef.current || isLoading) return;
    
    // Remove the last assistant message (polyfill for findLastIndex)
    setMessages(prev => {
      let lastAssistantIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "assistant") {
          lastAssistantIdx = i;
          break;
        }
      }
      if (lastAssistantIdx > -1) {
        const updated = prev.slice(0, lastAssistantIdx);
        saveMessagesToStorage(updated);
        return updated;
      }
      return prev;
    });
    
    // Re-send with same parameters (use setTimeout to ensure state update)
    setTimeout(() => {
      sendMessage(lastUserMessageRef.current, lastModeRef.current, lastWebSearchModeRef.current);
    }, 50);
  }, [isLoading, sendMessage]);

  // Continue the last (stopped) response
  const continueLast = useCallback(() => {
    if (!lastUserMessageRef.current || isLoading) return;
    
    // Send with continuation flag
    sendMessage("", lastModeRef.current, lastWebSearchModeRef.current, { continuation: true });
  }, [isLoading, sendMessage]);

  return {
    messages,
    isLoading,
    thinking,
    sendMessage,
    clearHistory,
    cancelStream,
    regenerateLast,
    continueLast,
    setMessages
  };
}
