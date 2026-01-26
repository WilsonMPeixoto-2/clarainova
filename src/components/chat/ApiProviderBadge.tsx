import { memo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";
import type { ApiProviderInfo } from "@/hooks/useChat";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ApiProviderBadgeProps {
  apiProvider: ApiProviderInfo;
}

const providerConfig = {
  gemini: {
    icon: Sparkles,
    label: "Gemini",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "API direta do Google Gemini",
  },
  lovable: {
    icon: Zap,
    label: "Fallback",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Lovable AI Gateway (fallback)",
  },
};

export const ApiProviderBadge = memo(function ApiProviderBadge({ 
  apiProvider 
}: ApiProviderBadgeProps) {
  const config = providerConfig[apiProvider.provider] || providerConfig.gemini;
  const Icon = config.icon;
  
  // Extract friendly model name
  const modelName = apiProvider.model
    .replace("gemini-", "")
    .replace("google/", "")
    .replace("-preview", "");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${config.bgColor} ${config.color} cursor-default`}
        >
          <Icon className="w-2.5 h-2.5" aria-hidden="true" />
          <span className="font-medium">{config.label}</span>
        </motion.span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">{config.description}</p>
        <p className="text-muted-foreground">Modelo: {modelName}</p>
      </TooltipContent>
    </Tooltip>
  );
});
