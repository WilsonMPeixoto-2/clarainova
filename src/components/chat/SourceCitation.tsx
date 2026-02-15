import { FileText, ExternalLink, ChevronDown } from "lucide-react";
import { useState } from "react";

interface SourceCitationProps {
  sources: {
    local: string[];
    web?: string[];
  };
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalSources = (sources.local?.length || 0) + (sources.web?.length || 0);
  
  if (totalSources === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="w-4 h-4" />
        <span>{totalSources} {totalSources === 1 ? "fonte" : "fontes"} consultadas</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {sources.local?.map((source, i) => (
            <div 
              key={`local-${i}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-3 text-sm"
            >
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-foreground/80">{source}</span>
              <span className="text-caption ml-auto">Base local</span>
            </div>
          ))}
          
          {sources.web?.map((source, i) => {
            // Parse "title - url" format from grounding metadata
            const parts = source.split(" - ");
            const title = parts.length > 1 ? parts[0] : source;
            const url = parts.length > 1 ? parts.slice(1).join(" - ") : source;
            const isValidUrl = url.startsWith("http");
            
            return isValidUrl ? (
              <a
                key={`web-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/10 text-sm hover:bg-surface-4 transition-colors group"
              >
                <ExternalLink className="w-4 h-4 text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground/80 block truncate">{title}</span>
                  <span className="text-caption truncate block">{url}</span>
                </div>
                <span className="text-xs text-accent group-hover:underline transition-colors flex-shrink-0">
                  Abrir ↗
                </span>
              </a>
            ) : (
              <div
                key={`web-${i}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-3 text-sm"
              >
                <ExternalLink className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-foreground/80 truncate flex-1">{source}</span>
                <span className="text-caption">Busca web</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
