import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import ClaraLogo from "@/components/ClaraLogo";

interface ChatHeaderProps {
  onNewChat: () => void;
  showNewChat: boolean;
}

export function ChatHeader({ onNewChat, showNewChat }: ChatHeaderProps) {
  return (
    <header
      className="text-foreground shadow-lg relative z-10"
      style={{
        background: "oklch(0.14 0.04 250 / 0.8)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid oklch(0.95 0.01 250 / 0.08)",
      }}
    >
      <div className="container py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div
              className="size-12 rounded-xl flex items-center justify-center"
              style={{
                background: "oklch(0.70 0.18 45 / 0.15)",
                border: "1px solid oklch(0.70 0.18 45 / 0.25)",
                boxShadow: "0 0 20px oklch(0.70 0.18 45 / 0.2)",
              }}
            >
              <ClaraLogo size={28} variant="light" />
            </div>
            <div>
              <h1
                className="text-xl md:text-2xl font-bold tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                CLARA
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Consultora de Legislação e Apoio a Rotinas Administrativas
              </p>
            </div>
            <span
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full
                bg-primary/15 text-primary border border-primary/25"
            >
              Beta
            </span>
          </div>

          <div className="flex items-center gap-2">
            {showNewChat && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNewChat}
                className="border-border/40 hover:border-primary/40 hover:shadow-[0_0_12px_var(--primary-glow)] transition-all duration-300"
              >
                <RefreshCw className="size-4 mr-2" />
                Nova Conversa
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
