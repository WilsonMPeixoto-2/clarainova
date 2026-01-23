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
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 text-sm"
            >
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-foreground/80">{source}</span>
              <span className="text-xs text-muted-foreground ml-auto">Base local</span>
            </div>
          ))}
          
          {sources.web?.map((source, i) => (
            <a
              key={`web-${i}`}
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 text-sm hover:bg-muted/50 transition-colors group"
            >
              <ExternalLink className="w-4 h-4 text-accent flex-shrink-0" />
              <span className="text-foreground/80 truncate flex-1">{source}</span>
              <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                Abrir ↗
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
