import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Loader2, Check, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import axios from "axios";
import type { Sheet } from "../../lib/cellUtils";
import { idxToCol } from "../../lib/cellUtils";

const API_BASE = "http://127.0.0.1:8000";

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
      const res = await axios.post(`${API_BASE}/ai/formula-assist`, {
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
        className="bg-background border border-border rounded-xl shadow-2xl w-[480px] max-w-[96vw] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h2 className="text-sm font-semibold flex-1">AI Formula Assistant</h2>
          {currentCell && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Insert into {currentCell}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Column hint */}
        {sheet.columns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sheet.columns.map((col, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground"
                title={`Column ${idxToCol(i)} — ${col.type}`}
              >
                {idxToCol(i)}: {col.name}
              </span>
            ))}
          </div>
        )}

        {/* Description input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Describe the formula you need:</label>
          <textarea
            ref={inputRef}
            className="w-full h-20 px-2.5 py-2 text-xs border border-border rounded-lg bg-background outline-none focus:ring-1 focus:ring-primary/40 resize-none font-mono"
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
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-border hover:bg-muted text-muted-foreground transition-colors"
                onClick={() => { setDescription(ex); inputRef.current?.focus(); }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button
          className="self-start h-8 text-xs gap-1.5"
          onClick={generate}
          disabled={!description.trim() || loading}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="h-3 w-3" /> Generate formula</>
          )}
        </Button>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>
        )}

        {/* Result */}
        {formula && (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">Generated formula:</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 h-8 px-2.5 text-xs font-mono border border-primary/40 rounded-lg bg-primary/5 outline-none focus:ring-1 focus:ring-primary/40"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
              />
              <Button
                variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                title="Regenerate"
                onClick={generate}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm" className="gap-1.5"
            onClick={handleInsert}
            disabled={!formula}
          >
            <Check className="h-3.5 w-3.5" />
            Insert formula
          </Button>
        </div>
      </div>
    </div>
  );
}
