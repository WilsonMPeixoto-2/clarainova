import { FileText, Globe } from "lucide-react";
import { Streamdown } from "streamdown";
import { MessageActions } from "./MessageActions";

export interface ChatMessageData {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: { documentTitle: string; section?: string; link?: string }[];
  usedWebSearch?: boolean;
}

interface ChatMessageBubbleProps {
  message: ChatMessageData;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} message-enter`}>
      <div
        className={`max-w-[85%] ${
          isUser ? "chat-message-user" : "chat-message-assistant"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <Streamdown>{message.content}</Streamdown>
          </div>
        )}

        {/* Web Search Indicator */}
        {message.usedWebSearch && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-primary/80">
            <Globe className="size-3" />
            <span>Inclui informações de fontes governamentais externas</span>
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Fontes consultadas:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((source, idx) =>
                source.link ? (
                  <a
                    key={idx}
                    href={source.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md
                      bg-primary/10 text-primary border border-primary/20
                      hover:bg-primary/20 hover:border-primary/40 hover:shadow-[0_0_8px_var(--primary-glow)]
                      transition-all duration-200"
                  >
                    <Globe className="size-3" />
                    {source.documentTitle}
                  </a>
                ) : (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md
                      bg-accent/10 text-accent border border-accent/20"
                  >
                    <FileText className="size-3" />
                    {source.documentTitle}
                    {source.section && ` — ${source.section}`}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isUser && (
          <MessageActions content={message.content} sources={message.sources} />
        )}
      </div>
    </div>
  );
}
