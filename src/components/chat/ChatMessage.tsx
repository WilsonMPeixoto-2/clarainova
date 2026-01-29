import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, User, FileText, ExternalLink, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import type { ChatMessage as ChatMessageType, WebSourceData } from "@/hooks/useChat";
import { CopyButton } from "./CopyButton";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { FeedbackButtons } from "./FeedbackButtons";
import { ApiProviderBadge } from "./ApiProviderBadge";
import { ChecklistButton } from "./ChecklistButton";
import { ResponseNotice } from "./ResponseNotice";
import { SourceChipWeb } from "./SourceChipWeb";
import { Button } from "@/components/ui/button";

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
          <ol key={`ol-${elements.length}`} className="chat-list list-decimal list-inside space-y-1.5 my-3 ml-1">
            {listItems.map((item, i) => (
              <li key={i} className="text-chat-body">{renderInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="chat-list list-disc list-inside space-y-1.5 my-3 ml-1">
            {listItems.map((item, i) => (
              <li key={i} className="text-chat-body">{renderInline(item)}</li>
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
          <pre key={`code-${elements.length}`} className="bg-surface-3 rounded-lg p-4 overflow-x-auto my-4 text-sm">
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

    // Headings - with chat-section-title styling for visual hierarchy
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="chat-section-title text-chat-subtitle">
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="chat-section-title text-chat-title">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${elements.length}`} className="chat-section-title text-lg font-bold text-foreground mt-5 mb-3">
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

    // Horizontal rule - elegant divider
    if (line.match(/^[-*_]{3,}$/)) {
      flushList();
      elements.push(<hr key={`hr-${elements.length}`} className="chat-divider border-0" />);
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
      <p key={`p-${elements.length}`} className="text-chat-body my-2">
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
        <code key={`c-${keyIndex++}`} className="bg-surface-3/80 px-1.5 py-0.5 rounded text-sm font-mono text-primary">
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

// Type guard to check if web source is structured
function isStructuredWebSource(source: WebSourceData | string): source is WebSourceData {
  return typeof source === 'object' && 'url' in source && 'domain_category' in source;
}

// Componente de fontes colapsável - Premium chips design
function SourcesSection({ sources }: { sources: ChatMessageType["sources"] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!sources) return null;
  
  const webSourcesCount = sources.web?.length || 0;
  const totalSources = (sources.local?.length || 0) + webSourcesCount;
  if (totalSources === 0) return null;
  
  // Check if we have structured web sources
  const hasStructuredWebSources = sources.web && sources.web.length > 0 && isStructuredWebSource(sources.web[0]);
  
  return (
    <motion.div 
      className="mt-4"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-chat-microcopy hover:text-foreground gap-1.5 h-7 px-2 group focus-halo"
        >
          <FileText className="w-3 h-3 group-hover:text-primary transition-colors" aria-hidden="true" />
          <span>Fontes ({totalSources})</span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3 h-3" aria-hidden="true" />
          )}
        </Button>
        
        {/* Quorum badge */}
        {sources.quorum_met && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          >
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            Quórum
          </motion.span>
        )}
      </div>
      
      <motion.div
        initial={false}
        animate={{ 
          height: isExpanded ? "auto" : 0,
          opacity: isExpanded ? 1 : 0
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="sources-row mt-2">
          {/* Local sources */}
          {sources.local?.map((source, i) => (
            <motion.span 
              key={`local-${i}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="source-chip-local"
              title={source}
            >
              <FileText className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[180px]">{source}</span>
            </motion.span>
          ))}
          
          {/* Web sources - structured or simple */}
          {sources.web?.map((source, i) => {
            if (isStructuredWebSource(source)) {
              return (
                <SourceChipWeb
                  key={`web-${i}`}
                  source={source}
                  index={(sources.local?.length || 0) + i}
                />
              );
            }
            
            // Fallback to simple URL chip
            return (
              <motion.a 
                key={`web-${i}`}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: ((sources.local?.length || 0) + i) * 0.05 }}
                className="source-chip-web focus-halo"
                title={source}
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[150px]">Fonte web</span>
              </motion.a>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Loading skeleton component - B1
function MessageSkeleton() {
  return (
    <div className="flex gap-4" aria-hidden="true">
      <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-3 max-w-[85%]">
        <div className="skeleton-text-full" />
        <div className="skeleton-text-medium" />
        <div className="skeleton-text-short" />
      </div>
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const formattedTime = useMemo(() => {
    return message.timestamp.toLocaleTimeString("pt-BR", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  }, [message.timestamp]);

  return (
    <motion.div 
      className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role="article"
      aria-label={`Mensagem de ${isUser ? "você" : "CLARA"}`}
    >
      {/* Avatar */}
      <motion.div 
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
          isUser 
            ? "bg-secondary text-foreground" 
            : "bg-primary/15 text-primary"
        }`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
      >
        {isUser ? <User className="w-5 h-5" aria-hidden="true" /> : <Bot className="w-5 h-5" aria-hidden="true" />}
      </motion.div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block rounded-2xl px-4 py-3 ${
          isUser 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-card/70 backdrop-blur-sm border border-border-subtle rounded-tl-sm"
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="text-sm chat-content-container">
              {message.isStreaming && !message.content ? (
                <span className="inline-flex items-center gap-1.5">
                  <motion.span 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 bg-primary rounded-full" 
                  />
                  <motion.span 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-primary rounded-full" 
                  />
                  <motion.span 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-primary rounded-full" 
                  />
                </span>
              ) : (
                <>
                  {renderMarkdown(message.content)}
                  {message.isStreaming && (
                    <motion.span 
                      className="inline-block w-0.5 h-4 bg-primary ml-0.5"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Notice for transparency */}
        {!isUser && message.notice && !message.isStreaming && (
          <ResponseNotice type={message.notice.type} message={message.notice.message} />
        )}

        {/* Actions for assistant messages - B2: Standardized action bar */}
        {!isUser && !message.isStreaming && message.content && (
          <motion.div 
            className="action-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <CopyButton text={message.content} />
            <ChecklistButton text={message.content} />
            {message.userQuery && (
              <DownloadPdfButton
                userQuery={message.userQuery}
                assistantResponse={message.content}
                timestamp={message.timestamp}
                sources={message.sources}
              />
            )}
            <FeedbackButtons queryId={message.queryId || null} />
          </motion.div>
        )}

        {/* Sources */}
        {!isUser && <SourcesSection sources={message.sources} />}

        {/* Timestamp and API Provider */}
        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? "justify-end" : ""}`}>
          <p className="text-chat-microcopy">
            {formattedTime}
          </p>
          {!isUser && message.apiProvider && !message.isStreaming && (
            <ApiProviderBadge apiProvider={message.apiProvider} />
          )}
        </div>
      </div>
    </motion.div>
  );
});

// Export skeleton for use in ChatPanel
export { MessageSkeleton };
