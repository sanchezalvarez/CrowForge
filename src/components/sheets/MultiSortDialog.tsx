import { useState } from "react";
import { X, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../ui/button";
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
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[420px] max-w-[95vw] p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Multi-level Sort</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Levels */}
        <div className="flex flex-col gap-2">
          {levels.map((lv, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">
                {i === 0 ? "Sort by" : "Then by"}
              </span>
              <select
                className="flex-1 h-7 px-2 text-xs border border-border rounded bg-background outline-none"
                value={lv.col_index}
                onChange={(e) => updateLevel(i, { col_index: parseInt(e.target.value) })}
              >
                {sheet.columns.map((col, ci) => (
                  <option key={ci} value={ci}>{col.name}</option>
                ))}
              </select>
              <button
                className={`flex items-center gap-1 px-2 h-7 text-xs border rounded transition-colors ${lv.ascending ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                onClick={() => updateLevel(i, { ascending: true })}
              >
                <ArrowUp className="h-3 w-3" /> A→Z
              </button>
              <button
                className={`flex items-center gap-1 px-2 h-7 text-xs border rounded transition-colors ${!lv.ascending ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                onClick={() => updateLevel(i, { ascending: false })}
              >
                <ArrowDown className="h-3 w-3" /> Z→A
              </button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                onClick={() => removeLevel(i)}
                disabled={levels.length === 1}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add level */}
        {levels.length < sheet.columns.length && (
          <Button variant="outline" size="sm" className="self-start h-7 text-xs gap-1" onClick={addLevel}>
            <Plus className="h-3 w-3" /> Add level
          </Button>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onApply(levels); onClose(); }}>Apply Sort</Button>
        </div>
      </div>
    </div>
  );
}
