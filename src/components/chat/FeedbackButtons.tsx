import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "./FeedbackModal";
import { useFeedback } from "@/hooks/useFeedback";

interface FeedbackButtonsProps {
  queryId: string | null;
}

export const FeedbackButtons = memo(function FeedbackButtons({ queryId }: FeedbackButtonsProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<"positive" | "negative" | null>(null);
  const [showModal, setShowModal] = useState(false);
  const { submitFeedback, isSubmitting } = useFeedback();

  // Don't show if no queryId available
  if (!queryId) return null;

  const handlePositive = async () => {
    if (feedbackGiven) return;
    
    const success = await submitFeedback({
      queryId,
      rating: true,
    });

    if (success) {
      setFeedbackGiven("positive");
    }
  };

  const handleNegative = () => {
    if (feedbackGiven) return;
    setShowModal(true);
  };

  const handleModalSubmit = async (category: string | undefined, text: string | undefined) => {
    const success = await submitFeedback({
      queryId,
      rating: false,
      category,
      feedbackText: text,
    });

    if (success) {
      setFeedbackGiven("negative");
    }
    setShowModal(false);
  };

  // Already gave feedback - show confirmation
  if (feedbackGiven) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Check className="w-3.5 h-3.5 text-primary" />
        <span>Obrigado!</span>
      </motion.div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePositive}
          disabled={isSubmitting}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
          aria-label="Feedback positivo"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNegative}
          disabled={isSubmitting}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          aria-label="Feedback negativo"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </Button>
      </div>

      <FeedbackModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmitting}
      />
    </>
  );
});
