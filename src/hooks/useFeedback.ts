import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getSessionFingerprint } from "@/lib/sessionFingerprint";

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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl || !anonKey) {
        toast({
          title: "Configuração ausente",
          description: "Backend não configurado (Supabase).",
          variant: "destructive",
        });
        return false;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/submit-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
          "x-session-fingerprint": getSessionFingerprint(),
        },
        body: JSON.stringify({
          query_id: params.queryId,
          rating: params.rating,
          feedback_category: params.category || null,
          feedback_text: params.feedbackText || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        console.error("[useFeedback] Error submitting feedback:", body);
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
