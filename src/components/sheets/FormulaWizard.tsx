import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Loader2, Check, RefreshCw } from "lucide-react";
import axios from "axios";
import type { Sheet } from "../../lib/cellUtils";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { idxToCol } from "../../lib/cellUtils";
import { getAPIBase } from "../../lib/api";

const EXAMPLES = [
  "sum of column B where column A > 100",
  "average of Sales column",
  "count non-empty cells in column C",
  "if value in A is greater than B, show 'Over budget', else 'OK'",
  "concatenate columns A and B with a space",
];

interface FormulaWizardProps {
  sheet: Sheet;
  selection: { r1: number; c1: number; r2: number; c2: number } | null;
  onInsert: (formula: string) => void;
  onClose: () => void;
}

export function FormulaWizard({ sheet, selection, onInsert, onClose }: FormulaWizardProps) {
  const [description, setDescription] = useState("");
  const [formula, setFormula] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEscapeKey(onClose);

  const currentCell = selection
    ? `${idxToCol(selection.c1)}${selection.r1 + 1}`
    : "";

  const sampleRow = sheet.rows[0] ?? [];

  const generate = async () => {
    const desc = description.trim();
    if (!desc) return;
    setLoading(true);
    setError(null);
    setFormula("");
    try {
      const res = await axios.post(`${getAPIBase()}/ai/formula-assist`, {
        description: desc,
        columns: sheet.columns.map((c) => ({ name: c.name, type: c.type })),
        sample_row: sampleRow.slice(0, 10),
        current_cell: currentCell,
      });
      setFormula(res.data.formula ?? "");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (formula) {
      onInsert(formula);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="card-riso card-riso-violet surface-noise riso-frame w-[480px] max-w-[96vw] p-5 flex flex-col gap-4 rounded-lg relative overflow-hidden animate-ink-in"
        style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-violet)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Riso color strip */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
        {/* Header */}
        <div className="flex items-center gap-2 mt-1">
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--accent-violet)" }} />
          <h2 className="font-display font-black text-sm tracking-tight flex-1">AI Formula Assistant</h2>
          {currentCell && (
            <span className="font-mono-ui text-[10px] text-muted-foreground px-1.5 py-0.5 rounded" style={{ background: "var(--background-3)", border: "1px solid var(--border-strong)" }}>
              Insert into {currentCell}
            </span>
          )}
          <button className="btn-tactile btn-tactile-outline h-6 w-6 p-0 flex items-center justify-center" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Column hint */}
        {sheet.columns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sheet.columns.map((col, i) => (
              <span
                key={i}
                className="font-mono-ui text-[10px] px-1.5 py-0.5 rounded text-muted-foreground"
                style={{ background: "var(--background-3)", border: "1px solid var(--border)" }}
                title={`Column ${idxToCol(i)} — ${col.type}`}
              >
                {idxToCol(i)}: {col.name}
              </span>
            ))}
          </div>
        )}

        {/* Description input */}
        <div className="flex flex-col gap-1.5">
          <label className="riso-section-label">Describe the formula you need:</label>
          <textarea
            ref={inputRef}
            className="w-full h-20 px-2.5 py-2 font-mono-ui text-xs rounded-md outline-none resize-none"
            style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
            placeholder='e.g. "sum of Sales column" or "if A > 100 show OK else NOK"'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                generate();
              }
            }}
          />
          <div className="flex flex-wrap gap-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="font-mono-ui text-[10px] px-2 py-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                style={{ border: "1px solid var(--border-strong)", background: "var(--background-2)" }}
                onClick={() => { setDescription(ex); inputRef.current?.focus(); }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          className="btn-tactile btn-tactile-violet gap-1.5 self-start"
          onClick={generate}
          disabled={!description.trim() || loading}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="h-3 w-3" /> Generate formula</>
          )}
        </button>

        {/* Error */}
        {error && (
          <p className="font-mono-ui text-xs text-destructive rounded px-2 py-1.5" style={{ background: "color-mix(in srgb, var(--destructive) 10%, transparent)" }}>{error}</p>
        )}

        {/* Result */}
        {formula && (
          <div className="flex flex-col gap-2">
            <label className="riso-section-label">Generated formula:</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 h-8 px-2.5 font-mono-ui text-xs rounded-md outline-none"
                style={{ border: "1.5px solid var(--accent-violet)", background: "color-mix(in srgb, var(--accent-violet) 8%, var(--background-2))", boxShadow: "2px 2px 0 var(--riso-violet)" }}
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
              />
              <button
                className="btn-tactile btn-tactile-outline h-8 w-8 p-0 flex items-center justify-center shrink-0"
                title="Regenerate"
                onClick={generate}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border-strong)" }}>
          <button className="btn-tactile btn-tactile-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn-tactile btn-tactile-violet gap-1.5"
            onClick={handleInsert}
            disabled={!formula}
          >
            <Check className="h-3.5 w-3.5" />
            Insert formula
          </button>
        </div>
      </div>
    </div>
  );
}
