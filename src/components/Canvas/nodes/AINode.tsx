import { useState, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Play, Loader2, AlertCircle, Bot } from "lucide-react";
import { cn } from "../../../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

export type AINodeData = {
  prompt: string;
  output: string;
};

export function AINode({ id, data, selected }: NodeProps) {
  const nodeData = data as AINodeData;
  const { updateNodeData } = useReactFlow();

  const [prompt, setPrompt] = useState(nodeData.prompt ?? "");
  const [output, setOutput] = useState(nodeData.output ?? "");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const run = useCallback(() => {
    if (running || !prompt.trim()) return;

    setRunning(true);
    setError(null);
    setOutput("");

    // Close any existing stream
    esRef.current?.close();

    // POST is not native to EventSource — we open the stream via a URL with a query param
    // For a POST-based SSE we POST first, which returns a stream_id, OR we use fetch + ReadableStream.
    // Using fetch + ReadableStream to support POST body.
    const controller = new AbortController();

    fetch(`${API_BASE}/canvas/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim(), node_id: id, context_nodes: [] }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          // Parse SSE lines: "data: ..." format
          const lines = text.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const chunk = line.slice(6);
            if (chunk === "[DONE]") {
              setRunning(false);
              updateNodeData(id, { prompt, output: accumulated });
              return;
            }
            if (chunk.startsWith("[ERROR]")) {
              throw new Error(chunk.slice(7).trim());
            }
            accumulated += chunk;
            setOutput(accumulated);
          }
        }
        setRunning(false);
        updateNodeData(id, { prompt, output: accumulated });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message ?? "Unknown error");
        setRunning(false);
      });

    // Store controller for cleanup on unmount (not needed further but good practice)
    esRef.current = { close: () => controller.abort() } as any;
  }, [prompt, running, id, updateNodeData]);

  return (
    <div
      className={cn(
        "w-[280px] rounded-lg border-2 bg-card text-card-foreground shadow-sm",
        selected ? "border-primary shadow-md" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Top}    className="!bg-primary/70 !w-2.5 !h-2.5 !border-0" />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/40 rounded-t-md">
        <Bot size={12} className="text-primary shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Node</span>
      </div>

      {/* Prompt */}
      <div className="px-3 pt-2 pb-1">
        <textarea
          className="w-full text-xs resize-none bg-muted/40 border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 leading-snug"
          rows={3}
          placeholder="Enter prompt…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button
          className={cn(
            "mt-1 w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors",
            running
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={run}
          disabled={running}
        >
          {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          {running ? "Running…" : "Run"}
        </button>
      </div>

      {/* Output */}
      {(output || error) && (
        <div className="mx-3 mb-2 mt-1 rounded-md border bg-muted/30 px-2 py-1.5 max-h-[160px] overflow-y-auto">
          {error ? (
            <div className="flex items-start gap-1.5 text-destructive text-xs">
              <AlertCircle size={11} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <p className="text-xs whitespace-pre-wrap leading-snug">{output}</p>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-primary/70 !w-2.5 !h-2.5 !border-0" />
    </div>
  );
}
