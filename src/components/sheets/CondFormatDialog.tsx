import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import type { Sheet, ConditionalRule, CondOperator } from "../../lib/cellUtils";

const OPERATORS: { value: CondOperator; label: string; noValue?: boolean }[] = [
  { value: ">",          label: "greater than" },
  { value: "<",          label: "less than" },
  { value: ">=",         label: "≥" },
  { value: "<=",         label: "≤" },
  { value: "==",         label: "equals" },
  { value: "!=",         label: "not equals" },
  { value: "contains",   label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith",   label: "ends with" },
  { value: "isEmpty",    label: "is empty",     noValue: true },
  { value: "isNotEmpty", label: "is not empty", noValue: true },
];

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#fecaca", "#bbf7d0", "#bfdbfe", "#ddd6fe",
];

function newRule(col: number | null): ConditionalRule {
  return {
    id: `r${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    col,
    operator: ">",
    value: "0",
    format: { bg: "#fecaca" },
  };
}

interface CondFormatDialogProps {
  sheet: Sheet;
  rules: ConditionalRule[];
  onSave: (rules: ConditionalRule[]) => void;
  onClose: () => void;
}

export function CondFormatDialog({ sheet, rules: initial, onSave, onClose }: CondFormatDialogProps) {
  const [rules, setRules] = useState<ConditionalRule[]>(initial);

  const add = () => setRules((rs) => [...rs, newRule(null)]);
  const remove = (id: string) => setRules((rs) => rs.filter((r) => r.id !== id));
  const update = (id: string, patch: Partial<ConditionalRule>) =>
    setRules((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));
  const updateFmt = (id: string, patch: Partial<ConditionalRule["format"]>) =>
    setRules((rs) => rs.map((r) => r.id === id ? { ...r, format: { ...r.format, ...patch } } : r));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[540px] max-w-[96vw] p-5 flex flex-col gap-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Conditional Formatting</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {rules.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No rules yet. Add one below.</p>
        )}

        {/* Rules */}
        {rules.map((rule) => {
          const opMeta = OPERATORS.find((o) => o.value === rule.operator);
          return (
            <div key={rule.id} className="border border-border rounded-lg p-3 flex flex-col gap-2.5">
              {/* Row 1: column scope + operator + value */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="h-7 px-2 text-xs border border-border rounded bg-background outline-none"
                  value={rule.col === null ? "" : String(rule.col)}
                  onChange={(e) => update(rule.id, { col: e.target.value === "" ? null : parseInt(e.target.value) })}
                >
                  <option value="">Any column</option>
                  {sheet.columns.map((col, ci) => (
                    <option key={ci} value={ci}>{col.name}</option>
                  ))}
                </select>
                <select
                  className="h-7 px-2 text-xs border border-border rounded bg-background outline-none"
                  value={rule.operator}
                  onChange={(e) => update(rule.id, { operator: e.target.value as CondOperator })}
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {!opMeta?.noValue && (
                  <input
                    className="h-7 px-2 text-xs border border-border rounded bg-background outline-none w-24"
                    value={rule.value}
                    onChange={(e) => update(rule.id, { value: e.target.value })}
                    placeholder="value"
                  />
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => remove(rule.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* Row 2: format options */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground shrink-0">Format:</span>
                {/* BG color */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Fill</span>
                  <div className="flex gap-0.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`w-4 h-4 rounded-sm border transition-transform hover:scale-110 ${rule.format.bg === c ? "ring-1 ring-primary ring-offset-1" : "border-border"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => updateFmt(rule.id, { bg: c })}
                      />
                    ))}
                    <button
                      className="w-4 h-4 rounded-sm border border-border text-[8px] text-muted-foreground hover:bg-muted flex items-center justify-center"
                      title="Remove fill"
                      onClick={() => updateFmt(rule.id, { bg: undefined })}
                    >✕</button>
                  </div>
                </div>
                {/* Text color */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Text</span>
                  <div className="flex gap-0.5 flex-wrap">
                    {["#ef4444","#22c55e","#3b82f6","#8b5cf6","#f97316","#000000","#ffffff"].map((c) => (
                      <button
                        key={c}
                        className={`w-4 h-4 rounded-sm border transition-transform hover:scale-110 ${rule.format.tc === c ? "ring-1 ring-primary ring-offset-1" : "border-border"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => updateFmt(rule.id, { tc: c })}
                      />
                    ))}
                    <button
                      className="w-4 h-4 rounded-sm border border-border text-[8px] text-muted-foreground hover:bg-muted flex items-center justify-center"
                      title="Remove text color"
                      onClick={() => updateFmt(rule.id, { tc: undefined })}
                    >✕</button>
                  </div>
                </div>
                {/* Bold / Italic */}
                <button
                  className={`text-xs px-1.5 h-5 border rounded font-bold transition-colors ${rule.format.b ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                  onClick={() => updateFmt(rule.id, { b: !rule.format.b })}
                >B</button>
                <button
                  className={`text-xs px-1.5 h-5 border rounded italic transition-colors ${rule.format.i ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                  onClick={() => updateFmt(rule.id, { i: !rule.format.i })}
                >I</button>
              </div>
            </div>
          );
        })}

        <Button variant="outline" size="sm" className="self-start h-7 text-xs gap-1" onClick={add}>
          <Plus className="h-3 w-3" /> Add rule
        </Button>

        <div className="flex justify-end gap-2 pt-1 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(rules); onClose(); }}>Save Rules</Button>
        </div>
      </div>
    </div>
  );
}
