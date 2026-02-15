import { useState, useEffect, useCallback } from "react";

interface UseOnlineStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
}

export function useOnlineStatus(options: UseOnlineStatusOptions = {}) {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  // Treat "loaded while offline" as offline for the purpose of triggering onOnline later.
  const [wasOffline, setWasOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    if (wasOffline) {
      options.onOnline?.();
    }
    setWasOffline(false);
  }, [wasOffline, options]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
    options.onOffline?.();
  }, [options]);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
