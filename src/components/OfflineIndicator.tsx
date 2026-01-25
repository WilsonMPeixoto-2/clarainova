import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const { toast } = useToast();
  const [showReconnected, setShowReconnected] = useState(false);
  
  const { isOnline } = useOnlineStatus({
    onOffline: () => {
      toast({
        variant: "destructive",
        title: "Sem conexão",
        description: "Você está offline. Algumas funcionalidades podem não funcionar."
      });
    },
    onOnline: () => {
      setShowReconnected(true);
      toast({
        title: "Conexão restaurada",
        description: "Você está online novamente."
      });
      setTimeout(() => setShowReconnected(false), 3000);
    }
  });

  // Não renderiza nada se estiver online e não acabou de reconectar
  if (isOnline && !showReconnected) return null;

  return (
    <AnimatePresence>
      {(!isOnline || showReconnected) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full flex items-center gap-2 shadow-lg ${
            isOnline 
              ? "bg-primary text-primary-foreground" 
              : "bg-destructive text-destructive-foreground"
          }`}
          role="status"
          aria-live="polite"
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm font-medium">Reconectado!</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm font-medium">Sem conexão</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
