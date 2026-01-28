import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (category: string | undefined, text: string | undefined) => void;
  isSubmitting?: boolean;
}

const FEEDBACK_CATEGORIES = [
  { value: "incorrect", label: "Informação incorreta" },
  { value: "outdated", label: "Desatualizado" },
  { value: "incomplete", label: "Incompleto" },
  { value: "confusing", label: "Confuso/difícil de entender" },
  { value: "off_topic", label: "Não respondeu à pergunta" },
  { value: "other", label: "Outro" },
] as const;

export function FeedbackModal({ isOpen, onClose, onSubmit, isSubmitting }: FeedbackModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [feedbackText, setFeedbackText] = useState("");

  const handleSubmit = () => {
    onSubmit(
      selectedCategory || undefined,
      feedbackText.trim() || undefined
    );
    // Reset state after submit
    setSelectedCategory("");
    setFeedbackText("");
  };

  const handleSkip = () => {
    onSubmit(undefined, undefined);
    setSelectedCategory("");
    setFeedbackText("");
  };

  const handleClose = () => {
    setSelectedCategory("");
    setFeedbackText("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-surface-0/85 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md"
          >
            <div className="bg-card border border-border rounded-xl shadow-xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  O que estava errado?
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Categories */}
              <RadioGroup
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                className="space-y-2 mb-4"
              >
                {FEEDBACK_CATEGORIES.map((category) => (
                  <div
                    key={category.value}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-surface-3 transition-colors"
                  >
                    <RadioGroupItem
                      value={category.value}
                      id={category.value}
                      className="border-muted-foreground"
                    />
                    <Label
                      htmlFor={category.value}
                      className="text-sm text-foreground cursor-pointer flex-1"
                    >
                      {category.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {/* Text feedback */}
              <div className="mb-6">
                <Label
                  htmlFor="feedback-text"
                  className="text-sm text-muted-foreground mb-2 block"
                >
                  Comentário opcional
                </Label>
                <Textarea
                  id="feedback-text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Conte-nos mais sobre o problema..."
                  className="min-h-[80px] bg-background/50 resize-none"
                  maxLength={500}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="text-muted-foreground"
                >
                  Pular
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground"
                >
                  {isSubmitting ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
