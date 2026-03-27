import { idxToCol, type Sheet } from "../../lib/cellUtils";

export interface FormulaBarProps {
  activeSheet: Sheet;
  selection: { r1: number; c1: number; r2: number; c2: number } | null;
  editingCell: { row: number; col: number } | null;
  editValue: string;
  editValueRef: React.RefObject<string>;
  setEditValue: (v: string) => void;
  setCellError: (v: string | null) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  startEditing: (ri: number, ci: number, val: string) => void;
}

export function FormulaBar({
  activeSheet,
  selection,
  editingCell,
  editValue,
  editValueRef,
  setEditValue,
  setCellError,
  commitEdit,
  cancelEdit,
  startEditing,
}: FormulaBarProps) {
  if (activeSheet.columns.length === 0) return null;

  const singleSel = selection && selection.r1 === selection.r2 && selection.c1 === selection.c2;
  const selKey = singleSel ? `${selection!.r1},${selection!.c1}` : null;
  const selFormula = selKey ? activeSheet.formulas?.[selKey] : null;
  const displayLabel = editingCell
    ? `${idxToCol(editingCell.col)}${editingCell.row + 1}`
    : singleSel
      ? `${idxToCol(selection!.c1)}${selection!.r1 + 1}`
      : "—";
  const displayValue = editingCell
    ? editValue
    : selFormula ?? (selKey ? (activeSheet.rows[selection!.r1]?.[selection!.c1] ?? "") : "");
  const FUNS = ["SUM", "AVG", "COUNT", "MIN", "MAX"];

  return (
    <div className="border-b px-2 py-1 flex items-center gap-1 bg-muted/20 shrink-0">
      <span className="font-mono-ui text-[11px] text-muted-foreground w-10 text-center shrink-0 bg-muted rounded px-1 py-0.5">{displayLabel}</span>
      <div className="w-px h-5 bg-border mx-1" />
      {FUNS.map((fn) => (
        <button
          key={fn}
          className="btn-tactile shrink-0"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!selection) return;
            const { r1, c1, r2, c2 } = selection;
            const rangeStr = `${idxToCol(c1)}${r1+1}:${idxToCol(c2)}${r2+1}`;
            const formula = `=${fn}(${rangeStr})`;
            if (r2 + 1 < activeSheet.rows.length) {
              startEditing(r2 + 1, c1, formula);
            } else if (c2 + 1 < activeSheet.columns.length) {
              startEditing(r1, c2 + 1, formula);
            } else {
              startEditing(r1, c1, formula);
            }
          }}
        >
          {fn}
        </button>
      ))}
      <div className="w-px h-5 bg-border mx-1" />
      <input
        className="font-mono-ui flex-1 text-xs bg-transparent outline-none text-foreground px-1"
        placeholder={editingCell || singleSel ? "Enter value or =formula…" : selection ? `${idxToCol(selection.c1)}${selection.r1+1}:${idxToCol(selection.c2)}${selection.r2+1} — select then click function` : "Select a cell"}
        readOnly={!singleSel && !editingCell}
        value={displayValue}
        onFocus={() => {
          if (singleSel && !editingCell) {
            startEditing(selection!.r1, selection!.c1, displayValue);
          }
        }}
        onChange={(e) => {
          if (editingCell) {
            editValueRef.current = e.target.value;
            setEditValue(e.target.value);
            setCellError(null);
          }
        }}
        onBlur={() => { if (editingCell) commitEdit(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
          if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
        }}
      />
    </div>
  );
}
