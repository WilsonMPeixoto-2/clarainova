import { FileText, Globe } from "lucide-react";
import { Streamdown } from "streamdown";
import { MessageActions } from "./MessageActions";

export interface ChatMessageData {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: { documentTitle: string; section?: string; link?: string }[];
  usedWebSearch?: boolean;
  isError?: boolean;
}

interface ChatMessageBubbleProps {
  message: ChatMessageData;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} message-enter`}>
      <div className={`max-w-[92%] md:max-w-[88%] ${isUser ? "chat-message-user" : "chat-message-assistant"}`}>
        {isUser ? (
          <p className="text-sm md:text-[0.94rem] whitespace-pre-wrap leading-relaxed tracking-[0.003em]">
            {message.content}
          </p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert clara-assistant-prose">
            <Streamdown>{message.content}</Streamdown>
          </div>
        )}

        {message.usedWebSearch && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-primary/85">
            <Globe className="size-3" />
            <span>Inclui informacoes de fontes governamentais externas</span>
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/25">
            <p className="clara-source-title mb-2">Fontes consultadas</p>
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((source, idx) =>
                source.link ? (
                  <a
                    key={idx}
                    href={source.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="clara-source-chip clara-source-chip-link"
                  >
                    <Globe className="size-3" />
                    {source.documentTitle}
                  </a>
                ) : (
                  <span key={idx} className="clara-source-chip">
                    <FileText className="size-3" />
                    {source.documentTitle}
                    {source.section && ` - ${source.section}`}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {!isUser && <MessageActions content={message.content} sources={message.sources} />}
      </div>
    </div>
  );
}
