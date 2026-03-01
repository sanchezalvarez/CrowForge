import { useRef, useCallback } from "react";

export interface AgentEvent {
  type: "started_tool" | "finished_tool" | "thinking" | "error" | "tool_error";
  tool?: string;
  args?: Record<string, unknown>;
  call_id?: string;
  result?: string;
  duration_ms?: number;
  content?: string;   // for "thinking" events
  message?: string;   // for "error" events
  error?: string;     // for "tool_error" events
}

interface FetchSSECallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onStructuredEvent?: (event: AgentEvent) => void;
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
        // SSE spec: multi-line data fields are joined with "\n",
        // events are delimited by blank lines.
        let dataLines: string[] = [];

        function dispatchEvent(callbacks: FetchSSECallbacks): "done" | "error" | "token" | null {
          if (dataLines.length === 0) return null;
          const payload = dataLines.join("\n");
          dataLines = [];

          if (payload === "[DONE]") {
            callbacks.onDone();
            return "done";
          }
          if (payload.startsWith("[ERROR]")) {
            callbacks.onError(payload.slice(8));
            return "error";
          }
          // Check for structured agent events
          if (callbacks.onStructuredEvent) {
            try {
              const parsed = JSON.parse(payload);
              if (parsed && typeof parsed === "object" && parsed.type &&
                  ["started_tool", "finished_tool", "thinking", "error", "tool_error"].includes(parsed.type)) {
                callbacks.onStructuredEvent(parsed as AgentEvent);
                return "token";
              }
            } catch { /* not JSON — treat as plain token */ }
          }
          callbacks.onToken(payload);
          return "token";
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const stripped = line.replace(/\r$/, "");

            // Blank line = end of SSE event
            if (stripped === "") {
              const result = dispatchEvent(callbacks);
              if (result === "done" || result === "error") return;
              continue;
            }

            if (stripped.startsWith("data:")) {
              // Per SSE spec: strip exactly one optional space after "data:"
              const raw = stripped.slice(5);
              dataLines.push(raw.startsWith(" ") ? raw.slice(1) : raw);
            }
            // Ignore other SSE fields (event:, id:, retry:)
          }
        }

        // Flush any remaining buffered event (e.g. [DONE] without trailing blank line)
        const finalResult = dispatchEvent(callbacks);

        // Stream ended without [DONE] — treat as done (avoid double-calling onDone)
        if (finalResult !== "done" && finalResult !== "error") {
          callbacks.onDone();
        }
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
