import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubmitFeedbackParams {
  queryId: string;
  rating: boolean;
  category?: string;
  feedbackText?: string;
}

export function useFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const submitFeedback = useCallback(async (params: SubmitFeedbackParams): Promise<boolean> => {
    if (isSubmitting) return false;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("response_feedback")
        .insert({
          query_id: params.queryId,
          rating: params.rating,
          feedback_category: params.category || null,
          feedback_text: params.feedbackText || null,
        });

      if (error) {
        console.error("[useFeedback] Error submitting feedback:", error);
        toast({
          title: "Erro ao enviar feedback",
          description: "Tente novamente mais tarde.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Obrigado!",
        description: params.rating 
          ? "Seu feedback positivo foi registrado." 
          : "Seu feedback nos ajudará a melhorar.",
      });

      return true;
    } catch (err) {
      console.error("[useFeedback] Unexpected error:", err);
      toast({
        title: "Erro ao enviar feedback",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, toast]);

  return {
    submitFeedback,
    isSubmitting,
  };
}
