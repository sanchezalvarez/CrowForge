import { useRef, useCallback } from "react";

interface FetchSSECallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export function useFetchSSE() {
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (url: string, body: unknown, callbacks: FetchSSECallbacks) => {
      cancel();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          callbacks.onError(`HTTP ${response.status}`);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          callbacks.onError("No response body");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;

            if (payload === "[DONE]") {
              callbacks.onDone();
              return;
            }
            if (payload.startsWith("[ERROR]")) {
              callbacks.onError(payload.slice(8));
              return;
            }
            callbacks.onToken(payload);
          }
        }

        // Stream ended without [DONE] — treat as done
        callbacks.onDone();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        callbacks.onError(String(err));
      } finally {
        controllerRef.current = null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  return { start, cancel };
}
