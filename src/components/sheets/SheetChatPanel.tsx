import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { useFetchSSE } from "../../hooks/useFetchSSE";
import type { Sheet } from "../../lib/cellUtils";
import { idxToCol } from "../../lib/cellUtils";

const API_BASE = "http://127.0.0.1:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SelectionRect {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

interface SheetChatPanelProps {
  sheet: Sheet;
  selection: SelectionRect | null;
  onClose: () => void;
}

/** Build a CSV/text context block from the sheet (selection or full sheet, capped). */
function buildContext(sheet: Sheet, selection: SelectionRect | null): string {
  const MAX_ROWS = 200;
  const colNames = sheet.columns.map((c) => c.name);

  let rowIndices: number[];
  let colIndices: number[];

  if (selection) {
    rowIndices = [];
    for (let r = selection.r1; r <= Math.min(selection.r2, selection.r1 + MAX_ROWS - 1); r++) {
      rowIndices.push(r);
    }
    colIndices = [];
    for (let c = selection.c1; c <= selection.c2; c++) colIndices.push(c);
  } else {
    rowIndices = Array.from({ length: Math.min(sheet.rows.length, MAX_ROWS) }, (_, i) => i);
    colIndices = Array.from({ length: sheet.columns.length }, (_, i) => i);
  }

  const selectedColNames = colIndices.map((c) => colNames[c] ?? idxToCol(c));
  const lines: string[] = [selectedColNames.join(",")];

  for (const r of rowIndices) {
    const row = sheet.rows[r] ?? [];
    lines.push(colIndices.map((c) => {
      const v = row[c] ?? "";
      return v.includes(",") || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(","));
  }

  const rangeLabel = selection
    ? `${idxToCol(selection.c1)}${selection.r1 + 1}:${idxToCol(selection.c2)}${selection.r2 + 1}`
    : `A1:${idxToCol(sheet.columns.length - 1)}${sheet.rows.length}`;

  const truncated = selection
    ? rowIndices.length < selection.r2 - selection.r1 + 1
    : rowIndices.length < sheet.rows.length;

  let header = `Sheet: "${sheet.title}" | Range: ${rangeLabel}`;
  if (truncated) header += ` (showing first ${MAX_ROWS} rows)`;
  return header + "\n\n" + lines.join("\n");
}

export function SheetChatPanel({ sheet, selection, onClose }: SheetChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const streamBufferRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { start, cancel } = useFetchSSE();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setStreaming(true);
    setStreamBuffer("");
    streamBufferRef.current = "";

    const context = buildContext(sheet, selection);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    start(
      `${API_BASE}/ai/ask/stream`,
      {
        message: text,
        context,
        history,
        system:
          "You are a data analyst assistant helping the user understand their spreadsheet data. " +
          "Be concise, accurate, and helpful. Use the data context provided. " +
          "Respond in the same language as the user.",
        max_tokens: 1024,
      },
      {
        onToken: (token) => {
          streamBufferRef.current += token;
          setStreamBuffer(streamBufferRef.current);
        },
        onDone: () => {
          const finalText = streamBufferRef.current || "(no response)";
          setMessages((prev) => [...prev, { role: "assistant", content: finalText }]);
          setStreamBuffer("");
          streamBufferRef.current = "";
          setStreaming(false);
        },
        onError: (err) => {
          setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
          setStreamBuffer("");
          streamBufferRef.current = "";
          setStreaming(false);
        },
      }
    );
  };

  const contextLabel = selection
    ? `${idxToCol(selection.c1)}${selection.r1 + 1}:${idxToCol(selection.c2)}${selection.r2 + 1}`
    : `full sheet (${sheet.rows.length} rows)`;

  return (
    <div className="flex flex-col h-full border-l border-border bg-background w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold flex-1 truncate">Ask about data</span>
        <span className="text-[10px] text-muted-foreground truncate max-w-[90px]" title={contextLabel}>
          {contextLabel}
        </span>
        {messages.length > 0 && (
          <Button
            variant="ghost" size="icon" className="h-5 w-5 shrink-0"
            title="Clear conversation"
            onClick={() => { setMessages([]); setStreamBuffer(""); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <Sparkles className="h-6 w-6 text-primary/40" />
            <p className="text-xs text-muted-foreground">
              Ask anything about your data.
            </p>
            <div className="flex flex-col gap-1 w-full mt-2">
              {[
                "Summarize this data",
                "Which row has the highest value?",
                "What trends do you see?",
              ].map((q) => (
                <button
                  key={q}
                  className="text-[11px] text-left px-2 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground whitespace-pre-wrap break-words">
              {streamBuffer || (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking…
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-border flex gap-1.5 items-center">
        <input
          ref={inputRef}
          className="flex-1 h-7 px-2 text-xs border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          disabled={streaming}
        />
        {streaming ? (
          <Button variant="destructive" size="icon" className="h-7 w-7 shrink-0" onClick={cancel} title="Stop">
            <X className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            size="icon" className="h-7 w-7 shrink-0"
            onClick={send}
            disabled={!input.trim()}
            title="Send (Enter)"
          >
            <Send className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
