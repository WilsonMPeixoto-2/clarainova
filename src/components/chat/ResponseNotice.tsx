import { memo } from "react";
import { motion } from "framer-motion";
import { Info, Globe, AlertTriangle, Lightbulb } from "lucide-react";

export type NoticeType = 
  | "web_search" 
  | "limited_base" 
  | "general_guidance" 
  | "out_of_scope"
  | "info";

interface ResponseNoticeProps {
  type: NoticeType;
  message: string;
}

const noticeConfig: Record<NoticeType, { icon: typeof Info; className: string }> = {
  web_search: {
    icon: Globe,
    className: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  },
  limited_base: {
    icon: AlertTriangle,
    className: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
  general_guidance: {
    icon: Lightbulb,
    className: "bg-primary/10 border-primary/20 text-primary",
  },
  out_of_scope: {
    icon: Info,
    className: "bg-muted/50 border-border-subtle text-muted-foreground",
  },
  info: {
    icon: Info,
    className: "bg-muted/50 border-border-subtle text-muted-foreground",
  },
};

export const ResponseNotice = memo(function ResponseNotice({ type, message }: ResponseNoticeProps) {
  const config = noticeConfig[type] || noticeConfig.info;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        border backdrop-blur-sm mb-2
        ${config.className}
      `}
    >
      <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </motion.div>
  );
});
