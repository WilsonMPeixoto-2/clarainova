import { useEffect, useCallback } from "react";

type ShortcutHandler = () => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  handler: ShortcutHandler;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape to work even in inputs
        if (event.key !== "Escape") {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Common shortcuts hook for chat
export function useChatShortcuts({
  onNewChat,
  onClearHistory,
  onFocusInput,
}: {
  onNewChat?: () => void;
  onClearHistory?: () => void;
  onFocusInput?: () => void;
}) {
  const shortcuts: ShortcutConfig[] = [
    ...(onNewChat
      ? [{ key: "n", ctrl: true, handler: onNewChat, description: "Nova conversa" }]
      : []),
    ...(onClearHistory
      ? [{ key: "l", ctrl: true, shift: true, handler: onClearHistory, description: "Limpar histórico" }]
      : []),
    ...(onFocusInput
      ? [{ key: "/", handler: onFocusInput, description: "Focar no campo de texto" }]
      : []),
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}
