import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSend, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 210) + "px";
  };

  return (
    <div className="clara-input-footer">
      <div className="clara-input-shell">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyPress}
          aria-label="Digite sua pergunta para a CLARA"
          placeholder="Digite sua pergunta sobre legislacao ou procedimentos administrativos..."
          disabled={isLoading}
          rows={2}
          className="clara-textarea"
        />

        <Button onClick={() => onSend(value)} disabled={!value.trim() || isLoading} size="icon" className="clara-send-button">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>

      <p className="clara-input-meta">Respostas baseadas em documentacao oficial | Pressione Enter para enviar</p>
    </div>
  );
}
