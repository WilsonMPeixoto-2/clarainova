import { memo } from "react";
import { Bot, User, FileText, ExternalLink } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat";

interface ChatMessageProps {
  message: ChatMessageType;
}

// Renderizar markdown simples
function renderMarkdown(text: string): JSX.Element[] {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLanguage = "";
  let listItems: string[] = [];
  let isOrderedList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      if (isOrderedList) {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-3 ml-2">
            {listItems.map((item, i) => (
              <li key={i} className="text-foreground/90">{renderInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-3 ml-2">
            {listItems.map((item, i) => (
              <li key={i} className="text-foreground/90">{renderInline(item)}</li>
            ))}
          </ul>
        );
      }
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushList();
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-muted/50 rounded-lg p-4 overflow-x-auto my-3 text-sm">
            <code className={codeLanguage ? `language-${codeLanguage}` : ""}>
              {codeContent.join("\n")}
            </code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        flushList();
        codeLanguage = line.slice(3).trim();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="text-lg font-semibold text-foreground mt-4 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="text-xl font-semibold text-foreground mt-5 mb-2">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${elements.length}`} className="text-2xl font-bold text-foreground mt-5 mb-3">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Lists
    const unorderedMatch = line.match(/^[-*]\s+(.+)/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)/);
    
    if (unorderedMatch) {
      if (isOrderedList && listItems.length > 0) {
        flushList();
      }
      isOrderedList = false;
      listItems.push(unorderedMatch[1]);
      continue;
    }
    
    if (orderedMatch) {
      if (!isOrderedList && listItems.length > 0) {
        flushList();
      }
      isOrderedList = true;
      listItems.push(orderedMatch[1]);
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      flushList();
      elements.push(<hr key={`hr-${elements.length}`} className="my-4 border-border/50" />);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="text-foreground/90 leading-relaxed my-2">
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  return elements;
}

// Renderizar formatação inline
function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(...renderInline(remaining.slice(0, boldMatch.index)));
      }
      parts.push(
        <strong key={`b-${keyIndex++}`} className="font-semibold text-foreground">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(remaining.slice(0, codeMatch.index));
      }
      parts.push(
        <code key={`c-${keyIndex++}`} className="bg-muted/70 px-1.5 py-0.5 rounded text-sm font-mono text-primary">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // Citations [Source]
    const citationMatch = remaining.match(/\[([^\]]+)\]/);
    if (citationMatch && citationMatch.index !== undefined) {
      if (citationMatch.index > 0) {
        parts.push(remaining.slice(0, citationMatch.index));
      }
      parts.push(
        <span key={`cite-${keyIndex++}`} className="text-primary/80 text-sm">
          [{citationMatch[1]}]
        </span>
      );
      remaining = remaining.slice(citationMatch.index + citationMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/\*(.+?)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(remaining.slice(0, italicMatch.index));
      }
      parts.push(
        <em key={`i-${keyIndex++}`} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // No more patterns found, add remaining text
    parts.push(remaining);
    break;
  }

  return parts;
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""} animate-fade-in`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
        isUser 
          ? "bg-secondary text-foreground" 
          : "bg-primary/20 text-primary"
      }`}>
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block rounded-2xl px-4 py-3 ${
          isUser 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-card/80 backdrop-blur-sm border border-border/50 rounded-tl-sm"
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="text-sm prose-sm max-w-none">
              {message.isStreaming && !message.content ? (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse delay-100" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse delay-200" />
                </span>
              ) : (
                <>
                  {renderMarkdown(message.content)}
                  {message.isStreaming && (
                    <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5" />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.sources.local?.map((source, i) => (
              <span 
                key={`local-${i}`}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground"
              >
                <FileText className="w-3 h-3" />
                {source}
              </span>
            ))}
            {message.sources.web?.map((source, i) => (
              <a 
                key={`web-${i}`}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Fonte web
              </a>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-muted-foreground/60 mt-1 ${isUser ? "text-right" : ""}`}>
          {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
});
