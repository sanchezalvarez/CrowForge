import React, { useMemo } from "react";
import { flushSync } from "react-dom";
import axios from "axios";
import { Table2, Plus, Filter, Trash2, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import {
  type Sheet, type CellFormat, type RefGroup,
  DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, MIN_COL_WIDTH,
  ROW_RENDER_LIMIT, REF_COLORS,
  parseFormulaRefGroups, resolveRange, resolveCellRef, idxToCol,
} from "../../lib/cellUtils";

const API_BASE = "http://127.0.0.1:8000";

type SelectionRect = { r1: number; c1: number; r2: number; c2: number };
type AnchorPoint = { row: number; col: number };

export interface SheetGridProps {
  activeSheet: Sheet;
  selection: SelectionRect | null;
  editingCell: { row: number; col: number } | null;
  editValue: string;
  editValueRef: React.RefObject<string>;
  setEditValue: (v: string) => void;
  cellError: string | null;
  setCellError: (v: string | null) => void;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  filteredRowIndices: number[];
  visibleRowIndices: number[];
  scrollRowStart: number;
  filters: Map<number, { operator: string; value: string }>;
  isCellSelected: (ri: number, ci: number) => boolean;
  handleCellMouseDown: (ri: number, ci: number, e: React.MouseEvent) => void;
  handleCellMouseEnter: (ri: number, ci: number) => void;
  handleMouseUp: () => void;
  handleGridScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  startEditing: (ri: number, ci: number, val: string) => void;
  commitEdit: () => Promise<void> | void;
  cancelEdit: () => void;
  pasteAtSelection: (text: string) => void;
  copySelection: () => void;
  cutSelection: () => Promise<void> | void;
  clearSelectedCells: () => Promise<void> | void;
  toggleBold: () => void;
  toggleItalic: () => void;
  undoSheet: () => void;
  redoSheet: () => void;
  aiFilling: boolean;
  selAnchor: AnchorPoint | null;
  setSelAnchor: (v: AnchorPoint | null) => void;
  selMoving: React.MutableRefObject<AnchorPoint | null>;
  setSelection: (v: SelectionRect | null) => void;
  makeRect: (a: AnchorPoint, b: AnchorPoint) => SelectionRect;
  aiFillCol: number;
  aiFilledRows: Set<number>;
  aiFillErrors: Map<number, string>;
  aiOpOpen: boolean;
  aiOpSourceStr: string;
  aiOpTargetStr: string;
  aiOpMode: "row-wise" | "aggregate" | "matrix";
  updateSheet: (s: Sheet) => void;
  deleteRow: (sheetId: string, ri: number) => void;
  setColMenu: (v: { colIndex: number; x: number; y: number } | null) => void;
  setRowMenu: (v: { rowIndex: number; x: number; y: number } | null) => void;
  setCellMenu: (v: { row: number; col: number; x: number; y: number } | null) => void;
  renamingCol: number | null;
  setRenamingCol: (v: number | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  renameRef: React.RefObject<HTMLInputElement | null>;
  colRenameCommit: () => void;
  addingColumn: boolean;
  setAddingColumn: (v: boolean) => void;
  newColName: string;
  setNewColName: (v: string) => void;
  setNewColType: (v: string) => void;
  colNameRef: React.RefObject<HTMLInputElement | null>;
  submitNewColumn: () => void;
  setResizing: (v: { type: "col" | "row"; index: number; startPos: number; startSize: number } | null) => void;
  setColWidths: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  cellInputRef: React.RefObject<HTMLInputElement | null>;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

// ---- Memoized row component ----
interface SheetRowProps {
  ri: number;
  row: string[];
  activeSheet: Sheet;
  editingCell: { row: number; col: number } | null;
  editValue: string;
  editValueRef: React.RefObject<string>;
  setEditValue: (v: string) => void;
  cellError: string | null;
  setCellError: (v: string | null) => void;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  isCellSelected: (ri: number, ci: number) => boolean;
  handleCellMouseDown: (ri: number, ci: number, e: React.MouseEvent) => void;
  handleCellMouseEnter: (ri: number, ci: number) => void;
  startEditing: (ri: number, ci: number, val: string) => void;
  commitEdit: () => Promise<void> | void;
  cancelEdit: () => void;
  setResizing: (v: { type: "col" | "row"; index: number; startPos: number; startSize: number } | null) => void;
  setRowMenu: (v: { rowIndex: number; x: number; y: number } | null) => void;
  setCellMenu: (v: { row: number; col: number; x: number; y: number } | null) => void;
  updateSheet: (s: Sheet) => void;
  deleteRow: (sheetId: string, ri: number) => void;
  aiFillCol: number;
  aiFilledRows: Set<number>;
  aiFillErrors: Map<number, string>;
  formulaRefMap: Map<string, number>;
  aiTargetRect: SelectionRect | null;
  cellInputRef: React.RefObject<HTMLInputElement | null>;
}

const SheetRow = React.memo(function SheetRow({
  ri, row, activeSheet,
  editingCell, editValue, editValueRef, setEditValue,
  cellError, setCellError,
  colWidths, rowHeights,
  isCellSelected, handleCellMouseDown, handleCellMouseEnter,
  startEditing, commitEdit, cancelEdit,
  setResizing, setRowMenu, setCellMenu,
  updateSheet, deleteRow,
  aiFillCol, aiFilledRows, aiFillErrors,
  formulaRefMap, aiTargetRect,
  cellInputRef,
}: SheetRowProps) {
  return (
    <tr key={ri}>
      <td
        className="sticky left-0 z-10 border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground text-center cursor-context-menu select-none relative"
        style={ri in rowHeights ? { height: rowHeights[ri] } : { minHeight: DEFAULT_ROW_HEIGHT }}
        onContextMenu={(e) => {
          e.preventDefault();
          setRowMenu({ rowIndex: ri, x: e.clientX, y: e.clientY });
        }}
      >
        {ri + 1}
        {/* Row resize handle */}
        <div
          className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-primary/40 z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setResizing({ type: "row", index: ri, startPos: e.clientY, startSize: rowHeights[ri] ?? DEFAULT_ROW_HEIGHT });
          }}
        />
      </td>
      {row.map((cell, ci) => {
        const isEditing = editingCell?.row === ri && editingCell?.col === ci;
        const colType = activeSheet.columns[ci]?.type ?? "text";
        const justFilled = ci === aiFillCol && aiFilledRows.has(ri);
        const fillError = ci === aiFillCol && aiFillErrors.has(ri);
        const selected = !isEditing && isCellSelected(ri, ci);
        const refColorIdx = formulaRefMap.get(`${ri},${ci}`);
        const isFormulaRef = refColorIdx !== undefined;
        const hasFormula = !!activeSheet.formulas?.[`${ri},${ci}`];
        const isErrorValue = hasFormula && typeof cell === "string" && cell.startsWith("#");
        const refColor = isFormulaRef ? REF_COLORS[refColorIdx] : null;
        const isAiTarget = aiTargetRect && ri >= aiTargetRect.r1 && ri <= aiTargetRect.r2 && ci >= aiTargetRect.c1 && ci <= aiTargetRect.c2;

        return (
          <td
            key={ci}
            className={cn(
              "border p-0 relative",
              "overflow-hidden",
              !isFormulaRef && "border-border",
              isEditing && "ring-2 ring-primary/40 ring-inset",
              isEditing && cellError && "ring-destructive/60",
              selected && !isFormulaRef && "bg-primary/10",
              justFilled && "bg-green-500/10",
              fillError && "bg-destructive/10",
              isAiTarget && "bg-purple-500/10"
            )}
            style={(() => {
              const fmt: CellFormat = activeSheet.formats?.[`${ri},${ci}`] ?? {};
              const baseStyle = {
                width: colWidths[ci] ?? DEFAULT_COL_WIDTH,
                minWidth: MIN_COL_WIDTH,
                ...(isFormulaRef && !isEditing
                  ? { backgroundColor: refColor!.bg, borderColor: refColor!.border }
                  : fmt.bg ? { backgroundColor: fmt.bg } : {}),
              };
              if (isAiTarget) {
                return { ...baseStyle, outline: "2px dashed rgba(168,85,247,0.4)", outlineOffset: "-2px" };
              }
              return baseStyle;
            })()}
            onContextMenu={(e) => {
              if (hasFormula) {
                e.preventDefault();
                setCellMenu({ row: ri, col: ci, x: e.clientX, y: e.clientY });
              }
            }}
            onMouseDown={(e) => {
              if (!isEditing) {
                e.preventDefault();
                handleCellMouseDown(ri, ci, e);
              }
            }}
            onMouseEnter={() => handleCellMouseEnter(ri, ci)}
            onClick={() => {
              if (colType === "boolean" && !isEditing) {
                const next = cell.toLowerCase() === "true" ? "false" : "true";
                axios.put(`${API_BASE}/sheets/${activeSheet.id}/cell`, {
                  row_index: ri, col_index: ci, value: next,
                }).then((res) => updateSheet(res.data)).catch(() => {});
              } else if (!isEditing && isCellSelected(ri, ci)) {
                startEditing(ri, ci, cell);
              }
            }}
          >
            {isEditing ? (
              <div className="relative h-full">
                <input
                  ref={cellInputRef}
                  type={editValue.startsWith("=") ? "text" : colType === "number" ? "number" : colType === "date" ? "date" : "text"}
                  step={colType === "number" ? "any" : undefined}
                  className="w-full h-full px-2 py-1 text-sm bg-transparent outline-none"
                  value={editValue}
                  onChange={(e) => { editValueRef.current = e.target.value; setEditValue(e.target.value); setCellError(null); }}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setCellError(null);
                      cancelEdit();
                    } else if (e.key === "Tab") {
                      e.preventDefault();
                      commitEdit();
                      const nextCol = e.shiftKey ? ci - 1 : ci + 1;
                      if (nextCol >= 0 && nextCol < (activeSheet?.columns.length ?? 0)) {
                        startEditing(ri, nextCol, row[nextCol] ?? "");
                      } else if (!e.shiftKey && ri + 1 < (activeSheet?.rows.length ?? 0)) {
                        startEditing(ri + 1, 0, activeSheet?.rows[ri + 1]?.[0] ?? "");
                      }
                    }
                  }}
                />
                {cellError && (
                  <div className="absolute left-0 top-full z-10 mt-0.5 px-2 py-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded shadow-sm whitespace-nowrap flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {cellError}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="px-2 py-1 text-sm cursor-text select-none flex gap-1"
                style={(() => {
                  const a = activeSheet.alignments?.[`${ri},${ci}`];
                  const [h, v] = a ? a.split(",") : ["left", "top"];
                  const fmt: CellFormat = activeSheet.formats?.[`${ri},${ci}`] ?? {};
                  const noWrap = fmt.wrap === false;
                  const manualH = ri in rowHeights;
                  return {
                    ...(manualH ? { height: rowHeights[ri], overflow: "hidden" as const } : { minHeight: DEFAULT_ROW_HEIGHT }),
                    whiteSpace: noWrap ? ("nowrap" as const) : ("normal" as const),
                    wordBreak: noWrap ? undefined : ("break-word" as const),
                    lineBreak: noWrap ? undefined : ("anywhere" as const),
                    ...(noWrap ? { overflow: "hidden" as const, textOverflow: "ellipsis" as const } : {}),
                    textAlign: (h || "left") as "left" | "center" | "right",
                    justifyContent: h === "center" ? "center" : h === "right" ? "flex-end" : "flex-start",
                    alignItems: v === "middle" ? "center" : v === "bottom" ? "flex-end" : "flex-start",
                    fontWeight: fmt.b ? 700 : undefined,
                    fontStyle: fmt.i ? ("italic" as const) : undefined,
                    color: fmt.tc || undefined,
                    backgroundColor: fmt.bg || undefined,
                    fontSize: fmt.fs ? `${fmt.fs}px` : undefined,
                  };
                })()}
              >
                {hasFormula && !isErrorValue && (
                  <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0 leading-none">fx</span>
                )}
                {colType === "boolean" ? (
                  <span className={(cell ?? "").toLowerCase() === "true" ? "text-green-500" : "text-muted-foreground/50"}>
                    {(cell ?? "").toLowerCase() === "true" ? "Yes" : "No"}
                  </span>
                ) : isErrorValue ? (
                  <span className="text-destructive font-mono text-xs cursor-help flex items-center gap-0.5" title={`${cell}\nFormula: ${activeSheet.formulas[`${ri},${ci}`]}`}>
                    <AlertCircle className="h-2.5 w-2.5 shrink-0" />{cell}
                  </span>
                ) : (
                  <span>{cell || <span className="text-muted-foreground/30">&nbsp;</span>}</span>
                )}
              </div>
            )}
          </td>
        );
      })}
      <td className="border border-border p-0">
        <button
          onClick={() => deleteRow(activeSheet.id, ri)}
          className="w-full h-full flex items-center justify-center px-1 py-1 text-muted-foreground/40 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
});

// ---- Main SheetGrid component ----
export function SheetGrid({
  activeSheet, selection, editingCell, editValue, editValueRef, setEditValue,
  cellError, setCellError, colWidths, rowHeights, filteredRowIndices,
  visibleRowIndices, scrollRowStart, filters,
  isCellSelected, handleCellMouseDown, handleCellMouseEnter, handleMouseUp,
  handleGridScroll, startEditing, commitEdit, cancelEdit,
  pasteAtSelection, copySelection, cutSelection, clearSelectedCells,
  toggleBold, toggleItalic, undoSheet, redoSheet, aiFilling,
  selAnchor, setSelAnchor, selMoving, setSelection, makeRect,
  aiFillCol, aiFilledRows, aiFillErrors, aiOpOpen, aiOpSourceStr, aiOpTargetStr, aiOpMode,
  updateSheet, deleteRow, setColMenu, setRowMenu, setCellMenu,
  renamingCol, setRenamingCol, renameValue, setRenameValue, renameRef, colRenameCommit,
  addingColumn, setAddingColumn, newColName, setNewColName, setNewColType,
  colNameRef, submitNewColumn, setResizing, setColWidths, cellInputRef, gridRef,
}: SheetGridProps) {
  // Compute formula ref highlights once per render (only when editing a formula)
  const formulaRefMap = useMemo(() => {
    const map = new Map<string, number>();
    if (editingCell && editValue.startsWith("=")) {
      try {
        const groups: RefGroup[] = parseFormulaRefGroups(editValue, activeSheet.rows.length, activeSheet.columns.length);
        for (const g of groups) {
          for (const k of g.cells) {
            if (!map.has(k)) map.set(k, g.colorIdx);
          }
        }
      } catch { /* never crash rendering */ }
    }
    return map;
  }, [editingCell, editValue, activeSheet.rows.length, activeSheet.columns.length]);

  // Compute AI ghost overlay target rect once per render
  const aiTargetRect = useMemo((): SelectionRect | null => {
    if (!aiOpOpen || !aiOpSourceStr || !aiOpTargetStr) return null;
    const s = resolveRange(aiOpSourceStr);
    const t = resolveCellRef(aiOpTargetStr);
    if (!s || !t) return null;
    if (aiOpMode === "row-wise") {
      const h = s.r2 - s.r1;
      return { r1: t.row, c1: t.col, r2: t.row + h, c2: t.col };
    } else if (aiOpMode === "aggregate") {
      return { r1: t.row, c1: t.col, r2: t.row, c2: t.col };
    } else {
      const h = s.r2 - s.r1;
      const w = s.c2 - s.c1;
      return { r1: t.row, c1: t.col, r2: t.row + h, c2: t.col + w };
    }
  }, [aiOpOpen, aiOpSourceStr, aiOpTargetStr, aiOpMode]);

  const maxRow = (activeSheet.rows.length ?? 1) - 1;
  const maxCol = (activeSheet.columns.length ?? 1) - 1;

  return (
    <>
      {/* Grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto"
        tabIndex={-1}
        onScroll={handleGridScroll}
        onPaste={(e) => {
          if (editingCell) return;
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          if (text) pasteAtSelection(text);
        }}
        onKeyDown={(e) => {
          if (editingCell) return;

          if (e.key === "F2" && selection) {
            e.preventDefault();
            const displayValue = activeSheet.rows[selection.r1]?.[selection.c1] ?? "";
            startEditing(selection.r1, selection.c1, displayValue);
            return;
          }

          if ((e.ctrlKey || e.metaKey) && e.key === "b") {
            e.preventDefault();
            toggleBold();
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "i") {
            e.preventDefault();
            toggleItalic();
            return;
          }

          if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
            e.preventDefault();
            if (!aiFilling) undoSheet();
            return;
          }
          if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
            e.preventDefault();
            if (!aiFilling) redoSheet();
            return;
          }

          const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
          const isNav = isArrow || e.key === "Enter" || e.key === "Tab";
          if (isNav && maxRow >= 0 && maxCol >= 0) {
            e.preventDefault();
            const anchor = selAnchor ?? { row: 0, col: 0 };
            let nr = anchor.row;
            let nc = anchor.col;

            if (e.key === "ArrowUp") nr = Math.max(0, nr - 1);
            else if (e.key === "ArrowDown" || e.key === "Enter") nr = Math.min(maxRow, nr + 1);
            else if (e.key === "ArrowLeft") nc = Math.max(0, nc - 1);
            else if (e.key === "ArrowRight") nc = Math.min(maxCol, nc + 1);
            else if (e.key === "Tab") {
              if (e.shiftKey) { nc--; if (nc < 0) { nc = maxCol; nr = Math.max(0, nr - 1); } }
              else { nc++; if (nc > maxCol) { nc = 0; nr = Math.min(maxRow, nr + 1); } }
            }

            if (e.shiftKey && isArrow) {
              const mov = selMoving.current ?? { ...anchor };
              if (e.key === "ArrowUp") mov.row = Math.max(0, mov.row - 1);
              else if (e.key === "ArrowDown") mov.row = Math.min(maxRow, mov.row + 1);
              else if (e.key === "ArrowLeft") mov.col = Math.max(0, mov.col - 1);
              else if (e.key === "ArrowRight") mov.col = Math.min(maxCol, mov.col + 1);
              selMoving.current = { ...mov };
              setSelection(makeRect(anchor, mov));
            } else {
              setSelAnchor({ row: nr, col: nc });
              selMoving.current = { row: nr, col: nc };
              setSelection({ r1: nr, c1: nc, r2: nr, c2: nc });
            }
            return;
          }

          if (e.key === "Escape" && selection) {
            setSelection(null);
            setSelAnchor(null);
          }
          if ((e.key === "Delete" || e.key === "Backspace") && selection) {
            e.preventDefault();
            clearSelectedCells();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "c" && selection) {
            e.preventDefault();
            copySelection();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "x" && selection) {
            e.preventDefault();
            cutSelection();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "v") {
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
              if (text) pasteAtSelection(text);
            }).catch(() => {});
            return;
          }
          // Start editing on printable character
          if (selection && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
            flushSync(() => {
              startEditing(selection.r1, selection.c1, "");
            });
            cellInputRef.current?.focus();
          }
        }}
      >
        {activeSheet.columns.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Table2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium mb-2">No columns yet</p>
              {addingColumn ? (
                <div className="flex items-center gap-1.5 justify-center">
                  <input
                    ref={colNameRef}
                    className="h-7 px-2 text-xs border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 w-32"
                    placeholder="Column name"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") submitNewColumn();
                      if (e.key === "Escape") setAddingColumn(false);
                    }}
                  />
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={submitNewColumn}>Add</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setAddingColumn(true); setNewColName(""); setNewColType("text"); }}>
                  <Plus className="h-3 w-3" />
                  Add Column
                </Button>
              )}
            </div>
          </div>
        ) : (
          <table className="border-collapse text-sm select-none" style={{ tableLayout: "fixed", width: "max-content" }} onMouseUp={handleMouseUp}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 border border-border bg-muted px-2 py-1.5 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                {activeSheet.columns.map((col, ci) => (
                  <th
                    key={ci}
                    className="group border border-border bg-muted px-2 py-1.5 text-left text-xs font-medium text-muted-foreground cursor-context-menu relative"
                    style={{ width: colWidths[ci] ?? DEFAULT_COL_WIDTH, minWidth: MIN_COL_WIDTH }}
                    onClick={() => {
                      const lastRow = activeSheet.rows.length - 1;
                      if (lastRow < 0) return;
                      setSelAnchor({ row: 0, col: ci });
                      selMoving.current = { row: lastRow, col: ci };
                      setSelection({ r1: 0, c1: ci, r2: lastRow, c2: ci });
                      gridRef.current?.focus();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setColMenu({ colIndex: ci, x: e.clientX, y: e.clientY });
                    }}
                  >
                    {renamingCol === ci ? (
                      <input
                        ref={renameRef}
                        className="w-full h-5 px-1 text-xs border border-primary/40 rounded bg-background outline-none"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={colRenameCommit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") colRenameCommit();
                          if (e.key === "Escape") setRenamingCol(null);
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{col.name}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          {filters.has(ci) && <Filter className="h-3 w-3 text-primary" />}
                          {col.type !== "text" && (
                            <span className="text-[10px] px-1 py-0 rounded bg-muted-foreground/10 text-muted-foreground/60">
                              {col.type}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {/* Column resize handle */}
                    <div
                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/40 z-10"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setResizing({ type: "col", index: ci, startPos: e.clientX, startSize: colWidths[ci] ?? DEFAULT_COL_WIDTH });
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const canvas = document.createElement("canvas");
                        const ctx2d = canvas.getContext("2d");
                        if (!ctx2d) return;
                        ctx2d.font = "14px sans-serif";
                        let maxW = ctx2d.measureText(col.name).width + 32;
                        for (const row of activeSheet.rows) {
                          const val = row[ci] ?? "";
                          if (val) {
                            const w = ctx2d.measureText(val).width + 24;
                            if (w > maxW) maxW = w;
                          }
                        }
                        const fitW = Math.max(MIN_COL_WIDTH, Math.min(500, Math.ceil(maxW)));
                        const next = { ...colWidths, [ci]: fitW };
                        setColWidths(next);
                        axios.put(`${API_BASE}/sheets/${activeSheet.id}/sizes`, {
                          colWidths: next,
                          rowHeights,
                        }).catch(() => {});
                      }}
                    />
                  </th>
                ))}
                <th className="border border-border bg-muted px-1 py-1 min-w-[120px]">
                  {addingColumn ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={colNameRef}
                        className="h-6 flex-1 px-1.5 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40"
                        placeholder="Name"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") submitNewColumn();
                          if (e.key === "Escape") setAddingColumn(false);
                        }}
                        onBlur={() => { if (!newColName.trim()) setAddingColumn(false); }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingColumn(true); setNewColName(""); setNewColType("text"); }}
                      className="w-full flex items-center justify-center text-muted-foreground/50 hover:text-primary transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Virtual scroll spacer top */}
              {filteredRowIndices.length > ROW_RENDER_LIMIT && scrollRowStart > 0 && (
                <tr><td colSpan={activeSheet.columns.length + 2} style={{ height: filteredRowIndices.slice(0, scrollRowStart).reduce((sum, ri) => sum + (rowHeights[ri] ?? DEFAULT_ROW_HEIGHT) + 1, 0), padding: 0, border: "none" }} /></tr>
              )}
              {visibleRowIndices.map((ri) => (
                <SheetRow
                  key={ri}
                  ri={ri}
                  row={activeSheet.rows[ri]}
                  activeSheet={activeSheet}
                  editingCell={editingCell}
                  editValue={editValue}
                  editValueRef={editValueRef}
                  setEditValue={setEditValue}
                  cellError={cellError}
                  setCellError={setCellError}
                  colWidths={colWidths}
                  rowHeights={rowHeights}
                  isCellSelected={isCellSelected}
                  handleCellMouseDown={handleCellMouseDown}
                  handleCellMouseEnter={handleCellMouseEnter}
                  startEditing={startEditing}
                  commitEdit={commitEdit}
                  cancelEdit={cancelEdit}
                  setResizing={setResizing}
                  setRowMenu={setRowMenu}
                  setCellMenu={setCellMenu}
                  updateSheet={updateSheet}
                  deleteRow={deleteRow}
                  aiFillCol={aiFillCol}
                  aiFilledRows={aiFilledRows}
                  aiFillErrors={aiFillErrors}
                  formulaRefMap={formulaRefMap}
                  aiTargetRect={aiTargetRect}
                  cellInputRef={cellInputRef}
                />
              ))}
              {/* Virtual scroll spacer bottom */}
              {filteredRowIndices.length > ROW_RENDER_LIMIT && (scrollRowStart + ROW_RENDER_LIMIT) < filteredRowIndices.length && (
                <tr><td colSpan={activeSheet.columns.length + 2} style={{ height: filteredRowIndices.slice(scrollRowStart + ROW_RENDER_LIMIT).reduce((sum, ri) => sum + (rowHeights[ri] ?? DEFAULT_ROW_HEIGHT) + 1, 0), padding: 0, border: "none" }} /></tr>
              )}
              {filteredRowIndices.length === 0 && (
                <tr>
                  <td colSpan={activeSheet.columns.length + 2} className="border border-border px-4 py-6 text-center text-xs text-muted-foreground">
                    {activeSheet.rows.length === 0
                      ? 'No rows yet. Click "+ Row" to add one.'
                      : `All ${activeSheet.rows.length} rows hidden by filters.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t px-4 py-1 flex items-center gap-4 text-[11px] text-muted-foreground bg-muted/30 shrink-0">
        <span>{activeSheet.rows.length} rows</span>
        <span>{activeSheet.columns.length} columns</span>
        {selection && (() => {
          const count = (selection.r2 - selection.r1 + 1) * (selection.c2 - selection.c1 + 1);
          return count > 1 ? <span className="text-primary font-medium">{count} cells selected</span> : null;
        })()}
        {selection && selection.r1 === selection.r2 && selection.c1 === selection.c2 && activeSheet.columns[selection.c1] && (
          activeSheet.formulas?.[`${selection.r1},${selection.c1}`]
            ? <span className="text-blue-500 font-medium">Formula</span>
            : <span>Type: {activeSheet.columns[selection.c1].type}</span>
        )}
        {selection && selection.r1 === selection.r2 && selection.c1 === selection.c2 && (
          <span className="text-muted-foreground/60">
            Cell {idxToCol(selection.c1)}{selection.r1 + 1}
          </span>
        )}
        {filters.size > 0 && (
          <span className="ml-auto">Filtered: {filteredRowIndices.length}/{activeSheet.rows.length}</span>
        )}
      </div>
    </>
  );
}
