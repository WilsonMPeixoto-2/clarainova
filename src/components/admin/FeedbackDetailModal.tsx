import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, AlertTriangle, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface QueryAnalytics {
  id: string;
  user_query: string;
  assistant_response: string;
  sources_cited: string[];
  created_at: string;
  session_fingerprint?: string | null;
}

interface ResponseFeedback {
  id: string;
  query_id: string;
  rating: boolean;
  feedback_category: string | null;
  feedback_text: string | null;
  created_at: string;
  query?: QueryAnalytics;
}

interface SessionContext {
  id: string;
  user_query: string;
  assistant_response: string;
  created_at: string;
  isCurrent: boolean;
}

interface FeedbackDetailModalProps {
  feedback: ResponseFeedback | null;
  onClose: () => void;
}

const getCategoryLabel = (category: string | null): string => {
  const labels: Record<string, string> = {
    incorrect: "Informação incorreta",
    outdated: "Desatualizado",
    incomplete: "Incompleto",
    confusing: "Confuso/difícil de entender",
    off_topic: "Não respondeu à pergunta",
    other: "Outro",
  };
  return labels[category || ""] || category || "Sem categoria";
};

export function FeedbackDetailModal({ feedback, onClose }: FeedbackDetailModalProps) {
  const [sessionContext, setSessionContext] = useState<SessionContext[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // Fetch session context when modal opens
  useEffect(() => {
    if (!feedback?.query?.session_fingerprint) {
      setSessionContext([]);
      return;
    }

    const fetchSessionContext = async () => {
      setIsLoadingContext(true);
      try {
        const { data, error } = await supabase
          .from("query_analytics")
          .select("id, user_query, assistant_response, created_at")
          .eq("session_fingerprint", feedback.query!.session_fingerprint!)
          .order("created_at", { ascending: true })
          .limit(10);

        if (error) throw error;

        const context: SessionContext[] = (data || []).map((item) => ({
          id: item.id,
          user_query: item.user_query,
          assistant_response: item.assistant_response,
          created_at: item.created_at,
          isCurrent: item.id === feedback.query_id,
        }));

        setSessionContext(context);
      } catch (err) {
        console.error("[FeedbackDetailModal] Error fetching session context:", err);
        setSessionContext([]);
      } finally {
        setIsLoadingContext(false);
      }
    };

    fetchSessionContext();
  }, [feedback]);

  if (!feedback) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AnimatePresence>
      {feedback && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-4 z-50 mx-auto max-w-3xl max-h-[90vh] overflow-auto my-auto"
            style={{ top: "5%", bottom: "5%" }}
          >
            <div className="bg-card border border-border rounded-xl shadow-xl">
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Detalhes do Feedback
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(feedback.created_at)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Category and Comment */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Categoria:</span>
                    <Badge variant="destructive">
                      {getCategoryLabel(feedback.feedback_category)}
                    </Badge>
                  </div>
                  
                  {feedback.feedback_text && (
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Comentário do usuário:
                      </p>
                      <p className="text-sm text-foreground italic">
                        "{feedback.feedback_text}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Session Context */}
                {sessionContext.length > 1 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Contexto da Sessão ({sessionContext.length} interações)
                    </h4>
                    <div className="bg-muted/20 rounded-lg p-4 space-y-3 max-h-[200px] overflow-y-auto">
                      {isLoadingContext ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </div>
                      ) : (
                        sessionContext.map((item, index) => (
                          <div
                            key={item.id}
                            className={`flex items-start gap-2 text-xs ${
                              item.isCurrent
                                ? "bg-destructive/10 border border-destructive/20 rounded-lg p-2 -mx-2"
                                : ""
                            }`}
                          >
                            <span className="text-muted-foreground font-mono w-5 text-right flex-shrink-0">
                              {index + 1}.
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground truncate">
                                <span className="font-medium">P:</span> {item.user_query}
                              </p>
                              <p className="text-muted-foreground truncate mt-0.5">
                                <span className="font-medium">R:</span>{" "}
                                {item.assistant_response.substring(0, 100)}...
                              </p>
                            </div>
                            <span className="text-muted-foreground/60 text-[10px] flex-shrink-0">
                              {formatTime(item.created_at)}
                            </span>
                            {item.isCurrent && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                Esta
                              </Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* User Query */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-secondary text-foreground text-xs flex items-center justify-center">
                      U
                    </span>
                    Pergunta do Usuário
                  </h4>
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-sm text-foreground">
                      {feedback.query?.user_query || "Pergunta não disponível"}
                    </p>
                  </div>
                </div>

                {/* Assistant Response */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                      C
                    </span>
                    Resposta da CLARA
                  </h4>
                  <div className="bg-primary/5 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {feedback.query?.assistant_response || "Resposta não disponível"}
                    </p>
                  </div>
                </div>

                {/* Sources */}
                {feedback.query?.sources_cited && feedback.query.sources_cited.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      Fontes Citadas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {feedback.query.sources_cited.map((source, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-card border-t border-border p-4 flex justify-end rounded-b-xl">
                <Button onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
