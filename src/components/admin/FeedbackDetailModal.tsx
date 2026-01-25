import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QueryAnalytics {
  id: string;
  user_query: string;
  assistant_response: string;
  sources_cited: string[];
  created_at: string;
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
            className="fixed inset-4 z-50 mx-auto max-w-2xl max-h-[90vh] overflow-auto my-auto"
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
