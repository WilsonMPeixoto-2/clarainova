import { useState, useCallback, useRef } from "react";

export type ResponseMode = "fast" | "deep";
export type WebSearchMode = "auto" | "deep";

// Message status for UI rendering
export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface ApiProviderInfo {
  provider: "gemini";
  model: string;
}

export type NoticeType = 
  | "web_search" 
  | "limited_base" 
  | "general_guidance" 
  | "out_of_scope"
  | "info"
  | "clarification"
  | "source_ambiguity"
  | "low_confidence"
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

export interface ChatErrorDetails {
  code: "config" | "http" | "network" | "response" | "unknown";
  requestUrl?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
  webSearchMode?: WebSearchMode;
  hint?: string;
  technicalMessage?: string;
  responseSnippet?: string;
}

interface UseChatOptions {
  onError?: (error: string, details?: ChatErrorDetails) => void;
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
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((msg): msg is Record<string, unknown> => typeof msg === "object" && msg !== null)
        .map((msg) => {
          const timestampRaw = msg.timestamp;
          const timestamp =
            typeof timestampRaw === "string" || typeof timestampRaw === "number"
              ? new Date(timestampRaw)
              : new Date();

          return {
            id: typeof msg.id === "string" ? msg.id : crypto.randomUUID(),
            role: msg.role === "assistant" ? "assistant" : "user",
            content: typeof msg.content === "string" ? msg.content : "",
            timestamp,
            sources:
              typeof msg.sources === "object" && msg.sources !== null
                ? (msg.sources as ChatMessageSources)
                : undefined,
            status: typeof msg.status === "string" ? (msg.status as MessageStatus) : undefined,
            isStreaming: typeof msg.isStreaming === "boolean" ? msg.isStreaming : undefined,
            queryId: typeof msg.queryId === "string" ? msg.queryId : undefined,
            userQuery: typeof msg.userQuery === "string" ? msg.userQuery : undefined,
            apiProvider:
              typeof msg.apiProvider === "object" && msg.apiProvider !== null
                ? (msg.apiProvider as ApiProviderInfo)
                : undefined,
            notice:
              typeof msg.notice === "object" && msg.notice !== null
                ? (msg.notice as ChatNotice)
                : undefined,
            requestId: typeof msg.requestId === "string" ? msg.requestId : undefined,
          } satisfies ChatMessage;
        });
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

function getRequestDurationMs(startedAt: number): number {
  return Math.max(1, Math.round(performance.now() - startedAt));
}

function resolveInternalWebSearchMode(
  query: string,
  mode: ResponseMode,
): { webSearchMode: WebSearchMode; reason: string } {
  const normalized = query.toLowerCase();
  const freshnessIntent =
    /\b(hoje|agora|atual|atualizada|vigente|mais recente|últim[oa]|publicad[oa]|202[4-9])\b/.test(normalized);
  const legalActIntent =
    /\b(portaria|decreto|lei|resolução|resolucao|instrução|instrucao normativa|edital)\b/.test(normalized);

  if (freshnessIntent) {
    return { webSearchMode: "deep", reason: "freshness_intent" };
  }
  if (mode === "deep" && legalActIntent) {
    return { webSearchMode: "deep", reason: "didactic_regulatory_query" };
  }
  return { webSearchMode: "auto", reason: "local_base_first" };
}

function getHttpErrorHint(status: number): string {
  if (status === 400) return "Requisição inválida. Revise payload e parâmetros enviados.";
  if (status === 401 || status === 403) return "Credenciais inválidas ou permissão insuficiente no endpoint.";
  if (status === 404) return "Endpoint da função não encontrado (URL incorreta ou função indisponível).";
  if (status === 429) return "Limite de uso atingido. Aguarde e tente novamente.";
  if (status >= 500) return "Falha no servidor da função. Verifique logs do backend.";
  return "Erro HTTP inesperado ao chamar o backend do chat.";
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
    webSearchMode?: WebSearchMode,
    sendOptions: SendMessageOptions = {}
  ) => {
    const isContinuation = sendOptions.continuation === true;
    
    // For continuation, we don't need new content
    if (!isContinuation && (!content.trim() || isLoading)) return;
    if (isContinuation && isLoading) return;

    const userQueryContent = isContinuation ? lastUserMessageRef.current : content.trim();
    const requestedWebSearchMode = webSearchMode ?? "auto";
    const internalWebPolicy = isContinuation
      ? { webSearchMode: lastWebSearchModeRef.current, reason: "continuation_previous_policy" }
      : resolveInternalWebSearchMode(userQueryContent, mode);
    const resolvedWebSearchMode: WebSearchMode =
      requestedWebSearchMode === "deep" ? "deep" : internalWebPolicy.webSearchMode;
    const webPolicyReason =
      requestedWebSearchMode === "deep" ? "forced_external_deep" : internalWebPolicy.reason;
    
    // Store last user message for regenerate/continue
    if (!isContinuation) {
      lastUserMessageRef.current = userQueryContent;
      lastModeRef.current = mode;
      lastWebSearchModeRef.current = resolvedWebSearchMode;
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
    let queryId: string | undefined;
    activeRequestIdRef.current = null;
    let requestUrl: string | undefined;
    const requestStartedAt = performance.now();
    const requestMethod = "POST";

    console.info("[chat:web-policy]", {
      mode,
      resolvedWebSearchMode,
      reason: webPolicyReason,
      continuation: isContinuation,
    });

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
      const anonKey =
        import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!import.meta.env.VITE_SUPABASE_URL || !anonKey) {
        const configError = new Error(
          "Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).",
        ) as Error & { details?: ChatErrorDetails };
        configError.details = {
          code: "config",
          method: requestMethod,
          webSearchMode: resolvedWebSearchMode,
          hint: "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente atual.",
        };
        throw configError;
      }

      requestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clara-chat`;
      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "x-session-fingerprint": getSessionFingerprint(),
        },
        body: JSON.stringify({
          message: isContinuation ? "" : userQueryContent,
          history: historyForApi.slice(0, -1), // Excluir a mensagem atual
          mode: mode,
          webSearchMode: resolvedWebSearchMode,
          continuation: isContinuation, // Signal backend to continue previous response
          stream: true,
        }),
        signal: abortControllerRef.current.signal
      });

      console.info("[chat:fetch]", {
        url: requestUrl,
        method: requestMethod,
        status: response.status,
        durationMs: getRequestDurationMs(requestStartedAt),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const parsedError = (() => {
          if (!errorText) return {};
          try {
            return JSON.parse(errorText) as Record<string, unknown>;
          } catch {
            return {};
          }
        })();
        const serverMessage =
          typeof parsedError.error === "string"
            ? parsedError.error
            : `Erro ${response.status} ao consultar o chat`;
        const requestError = new Error(serverMessage) as Error & { details?: ChatErrorDetails };
        requestError.details = {
          code: "http",
          requestUrl,
          method: requestMethod,
          status: response.status,
          durationMs: getRequestDurationMs(requestStartedAt),
          webSearchMode: resolvedWebSearchMode,
          hint: getHttpErrorHint(response.status),
          technicalMessage: serverMessage,
          responseSnippet: errorText.slice(0, 300),
        };
        throw requestError;
      }

      const contentType = response.headers.get("content-type") || "";

      // Safety: if the backend responds with JSON (non-streaming), handle it gracefully.
      if (contentType.includes("application/json")) {
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const answer = typeof data.answer === "string" ? data.answer : "";
        queryId = typeof data.query_id === "string" ? data.query_id : undefined;
        if (
          typeof data.notice === "object" &&
          data.notice !== null &&
          typeof (data.notice as Record<string, unknown>).type === "string" &&
          typeof (data.notice as Record<string, unknown>).message === "string"
        ) {
          noticeInfo = {
            type: (data.notice as Record<string, unknown>).type as NoticeType,
            message: (data.notice as Record<string, unknown>).message as string,
          };
        }
        const sources = Array.isArray(data.sources) ? data.sources : [];
        localSources = sources
          .map((s) => (typeof s === "object" && s !== null ? (s as Record<string, unknown>).title : null))
          .filter((t): t is string => typeof t === "string");
        quorumMet = localSources.length > 0;
        assistantContent = answer || "Desculpe, não consegui gerar uma resposta.";
      } else {
        if (!response.body) {
          const emptyBodyError = new Error("Resposta sem corpo");
          (emptyBodyError as Error & { details?: ChatErrorDetails }).details = {
            code: "response",
            requestUrl,
            method: requestMethod,
            status: response.status,
            durationMs: getRequestDurationMs(requestStartedAt),
            webSearchMode: resolvedWebSearchMode,
            hint: "A função respondeu sem stream/body. Verifique logs da função clara-chat.",
          };
          throw emptyBodyError;
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
                const data = JSON.parse(jsonStr) as Record<string, unknown>;

                switch (eventType) {
                case "request_id":
                  // Store backend request ID for tracking
                  if (typeof data.id === "string") {
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
                  if (typeof data.provider === "string" && typeof data.model === "string") {
                    apiProviderInfo = { provider: data.provider as ApiProviderInfo["provider"], model: data.model };
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
                  setThinking({ isThinking: true, step: String(data.step ?? "Processando...") });
                  break;
                  
                case "delta":
                  if (typeof data.content === "string") {
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
                  if (Array.isArray(data.local)) {
                    localSources = data.local.filter((x): x is string => typeof x === "string");
                  }
                  if (Array.isArray(data.web)) {
                    webSources = data.web as WebSourceData[] | string[];
                  }
                  if (typeof data.quorum_met === "boolean") {
                    quorumMet = data.quorum_met;
                  }
                  break;

                case "notice":
                  if (typeof data.type === "string" && typeof data.message === "string") {
                    noticeInfo = { type: data.type as NoticeType, message: data.message };
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
                    if (typeof data.query_id === "string") {
                      queryId = data.query_id;
                    }
                    break;
                  
                case "error":
                  throw new Error(typeof data.message === "string" ? data.message : "Erro no streaming");
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
                const data = JSON.parse(jsonStr) as Record<string, unknown>;
                if (typeof data.content === "string") {
                  assistantContent += data.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId ? { ...msg, content: assistantContent } : msg,
                    ),
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

      setMessages(prev => {
        const final = prev.map(msg => 
          msg.id === assistantId 
            ? { 
                ...msg, 
                content: finalContent,
                isStreaming: false,
                status: "done" as MessageStatus,
                sources: finalSources,
                queryId: queryId,
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

      const rawError = error instanceof Error ? error : new Error("Erro desconhecido");
      const errorWithDetails = rawError as Error & { details?: ChatErrorDetails };
      const looksLikeNetworkError =
        rawError instanceof TypeError ||
        /Failed to fetch|fetch failed|NetworkError|Load failed/i.test(rawError.message);

      const errorDetails: ChatErrorDetails =
        errorWithDetails.details ??
        {
          code: looksLikeNetworkError ? "network" : "unknown",
          requestUrl,
          method: requestMethod,
          durationMs: getRequestDurationMs(requestStartedAt),
          requestId: activeRequestIdRef.current ?? undefined,
          webSearchMode: resolvedWebSearchMode,
          hint: looksLikeNetworkError
            ? "Falha de rede, CORS ou endpoint inacessível. Verifique URL/env/headers e disponibilidade da função."
            : "Falha inesperada no processamento do chat.",
          technicalMessage: rawError.message,
        };

      const userFacingMessage =
        errorDetails.code === "network"
          ? "Falha de conexão com o serviço da CLARA. Tente novamente em instantes."
          : rawError.message;

      console.error("[chat:error]", {
        message: rawError.message,
        details: errorDetails,
      });
      
      // Atualizar mensagem com erro
      setMessages(prev => {
        const final = prev.map(msg => 
          msg.id === assistantId 
            ? { 
                ...msg, 
                content: msg.content || `Desculpe, ocorreu um erro: ${userFacingMessage}. Por favor, tente novamente.`,
                isStreaming: false,
                status: "error" as MessageStatus,
              }
            : msg
        );
        saveMessagesToStorage(final);
        return final;
      });
      
      options.onError?.(userFacingMessage, errorDetails);
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
