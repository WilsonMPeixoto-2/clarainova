import { memo } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Shield, Building, Database, HelpCircle } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface WebSourceData {
  url: string;
  title: string;
  domain?: string;
  domain_category: "primary" | "official_mirror" | "aggregator" | "unknown";
  confidence: "high" | "medium" | "low";
  excerpt_used: string;
  retrieved_at: string;
}

interface SourceChipWebProps {
  source: WebSourceData;
  index: number;
}

const categoryConfig = {
  primary: {
    label: "Oficial",
    icon: Shield,
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  official_mirror: {
    label: "Espelho",
    icon: Building,
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  aggregator: {
    label: "Agregador",
    icon: Database,
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  unknown: {
    label: "Externo",
    icon: HelpCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
};

const confidenceConfig = {
  high: {
    label: "Alta",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  medium: {
    label: "Média",
    dotClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  low: {
    label: "Baixa",
    dotClass: "bg-red-500",
    textClass: "text-red-600 dark:text-red-400",
  },
};

function formatRetrievedAt(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Data desconhecida";
  }
}

function truncateUrl(url: string, maxLength: number = 40): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    if (path.length > maxLength) {
      return path.slice(0, maxLength - 3) + "...";
    }
    return urlObj.hostname + (path !== "/" ? path : "");
  } catch {
    return url.slice(0, maxLength);
  }
}

export const SourceChipWeb = memo(function SourceChipWeb({ source, index }: SourceChipWebProps) {
  const category = categoryConfig[source.domain_category] || categoryConfig.unknown;
  const confidence = confidenceConfig[source.confidence] || confidenceConfig.low;
  const CategoryIcon = category.icon;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs",
            "border transition-all duration-200 cursor-pointer",
            "hover:shadow-md hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
            category.className
          )}
        >
          <CategoryIcon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          <span className="truncate max-w-[120px]">
            {source.title || source.domain || "Fonte web"}
          </span>
          <span
            className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", confidence.dotClass)}
            title={`Confiança: ${confidence.label}`}
          />
          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" aria-hidden="true" />
        </motion.a>
      </HoverCardTrigger>

      <HoverCardContent
        className="w-80 p-3"
        side="top"
        align="start"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-foreground line-clamp-2">
                {source.title || "Sem título"}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {truncateUrl(source.url)}
              </p>
            </div>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5", category.className)}>
              {category.label}
            </Badge>
          </div>

          {/* Excerpt */}
          {source.excerpt_used && (
            <div className="bg-muted/50 rounded-md p-2">
              <p className="text-xs text-foreground/80 italic line-clamp-4">
                "{source.excerpt_used}"
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span
                className={cn("w-2 h-2 rounded-full", confidence.dotClass)}
                aria-hidden="true"
              />
              <span className={confidence.textClass}>
                Confiança {confidence.label.toLowerCase()}
              </span>
            </div>
            <span>Recuperado: {formatRetrievedAt(source.retrieved_at)}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});
