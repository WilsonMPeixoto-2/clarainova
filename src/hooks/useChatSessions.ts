import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatMessage } from "./useChat";
import type { Json } from "@/integrations/supabase/types";
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

interface UseChatSessionsReturn {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  createSession: (messages: ChatMessage[]) => Promise<string | null>;
  updateSession: (sessionId: string, messages: ChatMessage[]) => Promise<void>;
  loadSession: (sessionId: string) => Promise<ChatMessage[] | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

// Generate a title from the first user message
function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "Nova conversa";
  
  const content = firstUserMessage.content.trim();
  if (content.length <= 50) return content;
  return content.substring(0, 47) + "...";
}

// Convert ChatMessage to JSON-safe format
function messagesToJson(messages: ChatMessage[]): Json {
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp.toISOString(),
    sources: msg.sources || null,
    queryId: msg.queryId || null,
    userQuery: msg.userQuery || null,
  })) as Json;
}

// Convert JSON back to ChatMessage format
function jsonToMessages(json: unknown): ChatMessage[] {
  if (!Array.isArray(json)) return [];
  
  return json.map((item: unknown) => {
    const msg = item as Record<string, unknown>;
    return {
      id: String(msg.id || crypto.randomUUID()),
      role: msg.role as "user" | "assistant",
      content: String(msg.content || ""),
      timestamp: new Date(String(msg.timestamp || new Date().toISOString())),
      sources: msg.sources as ChatMessage["sources"],
      queryId: msg.queryId as string | undefined,
      userQuery: msg.userQuery as string | undefined,
    };
  });
}

export function useChatSessions(): UseChatSessionsReturn {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all sessions for the current user
  const refreshSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, messages, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const parsed: ChatSession[] = (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        messages: jsonToMessages(row.messages),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      setSessions(parsed);
    } catch (err) {
      console.error("[useChatSessions] Error fetching sessions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load sessions when user changes
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Create a new session
  const createSession = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      if (!user) return null;

      try {
        const title = generateTitle(messages);
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            title,
            messages: messagesToJson(messages),
          })
          .select("id")
          .single();

        if (error) throw error;

        const sessionId = data?.id || null;
        if (sessionId) {
          setCurrentSessionId(sessionId);
          await refreshSessions();
        }
        return sessionId;
      } catch (err) {
        console.error("[useChatSessions] Error creating session:", err);
        return null;
      }
    },
    [user, refreshSessions]
  );

  // Update an existing session
  const updateSession = useCallback(
    async (sessionId: string, messages: ChatMessage[]): Promise<void> => {
      if (!user) return;

      try {
        const title = generateTitle(messages);
        const { error } = await supabase
          .from("chat_sessions")
          .update({
            title,
            messages: messagesToJson(messages),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .eq("user_id", user.id);

        if (error) throw error;
      } catch (err) {
        console.error("[useChatSessions] Error updating session:", err);
      }
    },
    [user]
  );

  // Load a specific session
  const loadSession = useCallback(
    async (sessionId: string): Promise<ChatMessage[] | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from("chat_sessions")
          .select("messages")
          .eq("id", sessionId)
          .eq("user_id", user.id)
          .single();

        if (error) throw error;

        setCurrentSessionId(sessionId);
        return jsonToMessages(data?.messages);
      } catch (err) {
        console.error("[useChatSessions] Error loading session:", err);
        return null;
      }
    },
    [user]
  );

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!user) return;

      try {
        const { error } = await supabase
          .from("chat_sessions")
          .delete()
          .eq("id", sessionId)
          .eq("user_id", user.id);

        if (error) throw error;

        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
        }
        await refreshSessions();
      } catch (err) {
        console.error("[useChatSessions] Error deleting session:", err);
      }
    },
    [user, currentSessionId, refreshSessions]
  );

  return {
    sessions,
    currentSessionId,
    isLoading,
    createSession,
    updateSession,
    loadSession,
    deleteSession,
    refreshSessions,
  };
}
