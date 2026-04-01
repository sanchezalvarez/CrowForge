import { useState } from "react";
import { X, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Sheet } from "../../lib/cellUtils";

export interface SortLevel {
  col_index: number;
  ascending: boolean;
}

interface MultiSortDialogProps {
  sheet: Sheet;
  onApply: (levels: SortLevel[]) => void;
  onClose: () => void;
}

export function MultiSortDialog({ sheet, onApply, onClose }: MultiSortDialogProps) {
  const [levels, setLevels] = useState<SortLevel[]>([
    { col_index: 0, ascending: true },
  ]);

  const addLevel = () => {
    const used = new Set(levels.map((l) => l.col_index));
    const next = sheet.columns.findIndex((_, i) => !used.has(i));
    setLevels((ls) => [...ls, { col_index: next >= 0 ? next : 0, ascending: true }]);
  };

  const removeLevel = (i: number) =>
    setLevels((ls) => ls.filter((_, idx) => idx !== i));

  const updateLevel = (i: number, patch: Partial<SortLevel>) =>
    setLevels((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="card-riso card-riso-orange surface-noise riso-frame w-[420px] max-w-[95vw] p-5 flex flex-col gap-4 rounded-lg relative overflow-hidden animate-ink-in"
        style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-orange)" }}
      >
        {/* Riso color strip */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
        {/* Header */}
        <div className="flex items-center justify-between mt-1">
          <h2 className="font-display font-black text-sm tracking-tight">Multi-level Sort</h2>
          <button className="btn-tactile btn-tactile-outline h-6 w-6 p-0 flex items-center justify-center" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Levels */}
        <div className="flex flex-col gap-2">
          {levels.map((lv, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-mono-ui text-[10px] text-muted-foreground uppercase tracking-widest w-16 shrink-0">
                {i === 0 ? "Sort by" : "Then by"}
              </span>
              <select
                className="flex-1 h-7 px-2 font-mono-ui text-xs rounded outline-none"
                style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)" }}
                value={lv.col_index}
                onChange={(e) => updateLevel(i, { col_index: parseInt(e.target.value) })}
              >
                {sheet.columns.map((col, ci) => (
                  <option key={ci} value={ci}>{col.name}</option>
                ))}
              </select>
              <button
                className="btn-tactile gap-1"
                style={lv.ascending
                  ? { background: "color-mix(in srgb, var(--accent-teal) 15%, transparent)", borderColor: "var(--accent-teal)", color: "var(--accent-teal)" }
                  : {}}
                onClick={() => updateLevel(i, { ascending: true })}
              >
                <ArrowUp className="h-3 w-3" /> A→Z
              </button>
              <button
                className="btn-tactile gap-1"
                style={!lv.ascending
                  ? { background: "color-mix(in srgb, var(--accent-teal) 15%, transparent)", borderColor: "var(--accent-teal)", color: "var(--accent-teal)" }
                  : {}}
                onClick={() => updateLevel(i, { ascending: false })}
              >
                <ArrowDown className="h-3 w-3" /> Z→A
              </button>
              <button
                className="btn-tactile btn-tactile-outline h-6 w-6 p-0 flex items-center justify-center shrink-0"
                onClick={() => removeLevel(i)}
                disabled={levels.length === 1}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add level */}
        {levels.length < sheet.columns.length && (
          <button className="btn-tactile btn-tactile-outline gap-1 self-start" onClick={addLevel}>
            <Plus className="h-3 w-3" /> Add level
          </button>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border-strong)" }}>
          <button className="btn-tactile btn-tactile-outline" onClick={onClose}>Cancel</button>
          <button className="btn-tactile btn-tactile-orange" onClick={() => { onApply(levels); onClose(); }}>Apply Sort</button>
        </div>
      </div>
    </div>
  );
}
