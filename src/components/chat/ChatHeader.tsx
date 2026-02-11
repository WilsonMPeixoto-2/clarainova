import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import ClaraLogo from "@/components/ClaraLogo";

interface ChatHeaderProps {
  onNewChat: () => void;
  showNewChat: boolean;
}

const PREVIEW_VERSION = "2.9";
const UPDATED_AT = "11/02/2026";

export function ChatHeader({ onNewChat, showNewChat }: ChatHeaderProps) {
  return (
    <header className="clara-header text-foreground relative z-20">
      <div className="container py-4 md:py-5">
        <div className="clara-header-inner">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="clara-logo-shell size-12 rounded-2xl flex items-center justify-center">
              <ClaraLogo size={28} variant="light" />
            </div>

            <div>
              <h1 className="text-xl md:text-2xl font-semibold clara-heading-tight">CLARA</h1>
              <p className="clara-subtitle text-xs md:text-sm text-muted-foreground hidden sm:block">
                Consultora de Legislacao e Apoio a Rotinas Administrativas
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="clara-beta-chip inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full">
                Preview {PREVIEW_VERSION}
              </span>
              <span className="clara-build-chip hidden md:inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full">
                Atualizada em {UPDATED_AT}
              </span>
            </div>
          </div>

          {showNewChat && (
            <Button variant="outline" size="sm" onClick={onNewChat} className="clara-button-outline">
              <RefreshCw className="size-4 mr-2" />
              Nova Conversa
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
