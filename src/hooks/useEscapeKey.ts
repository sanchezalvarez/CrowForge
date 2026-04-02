import { useEffect } from "react";

/** Register a global Escape key handler. Listener is only active when `enabled` is true (default). */
export function useEscapeKey(callback: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") callback(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [callback, enabled]);
}
