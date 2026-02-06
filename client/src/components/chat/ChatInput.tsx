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
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  return (
    <div className="p-4 border-t border-border/20">
      <div className="relative rounded-xl border border-border/40 bg-muted/20 backdrop-blur-sm
        focus-within:border-primary/50 focus-within:shadow-[0_0_20px_var(--primary-glow)]
        transition-all duration-300"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyPress}
          placeholder="Digite sua pergunta sobre legislação ou procedimentos administrativos..."
          disabled={isLoading}
          rows={2}
          className="w-full min-h-[64px] max-h-[200px] p-4 pr-16 bg-transparent text-foreground
            placeholder:text-muted-foreground/50 resize-none focus:outline-none
            text-sm leading-relaxed"
        />
        <Button
          onClick={() => onSend(value)}
          disabled={!value.trim() || isLoading}
          size="icon"
          className="absolute bottom-3 right-3 size-10 rounded-lg
            bg-primary hover:bg-primary/90
            shadow-[0_4px_12px_var(--primary-glow)]
            hover:shadow-[0_4px_20px_var(--primary-glow)]
            transition-all duration-300 hover:scale-105"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-2 text-center">
        Respostas baseadas em documentação oficial • Pressione Enter para enviar
      </p>
    </div>
  );
}
