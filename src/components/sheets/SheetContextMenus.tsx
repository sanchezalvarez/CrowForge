import axios from "axios";
import {
  Pencil, Copy, Trash2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Filter, X, Eraser, ListChecks, Tags, Sparkles, ChevronRight,
  RotateCcw, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../ui/dialog";
import { idxToCol } from "../../lib/cellUtils";
import type { Sheet, SheetSizes } from "../../lib/cellUtils";
import { getAPIBase } from "../../lib/api";

export interface SheetContextMenusProps {
  // Sheet context menu
  sheetMenu: { sheetId: string; x: number; y: number } | null;
  setSheetMenu: (v: { sheetId: string; x: number; y: number } | null) => void;
  sheetRenameStart: (id: string) => void;
  duplicateSheet: (id: string) => void;
  deleteSheet: (id: string) => void;

  // Column context menu
  colMenu: { colIndex: number; x: number; y: number } | null;
  colRenameStart: (idx: number) => void;
  colInsertAt: (idx: number) => void;
  colMoveLeft: (idx: number) => void;
  colMoveRight: (idx: number) => void;
  colSort: (idx: number, asc: boolean) => void;
  openFilterEditor: (idx: number) => void;
  filters: Map<number, { operator: string; value: string }>;
  removeFilter: (idx: number) => void;
  colDelete: (idx: number) => void;
  colHide: (idx: number) => void;
  colToolClean: (idx: number) => void;
  colToolNormalize: (idx: number) => void;
  colToolCategorize: (idx: number) => void;
  aiDisabled: boolean;
  aiFilling: boolean;
  activeSheet: Sheet | null;

  // Filter editor popup
  filterEditCol: number | null;
  setFilterEditCol: (v: number | null) => void;
  filterOp: string;
  setFilterOp: (v: string) => void;
  filterVal: string;
  setFilterVal: (v: string) => void;
  applyFilter: (col: number) => void;

  // Cell context menu
  cellMenu: { row: number; col: number; x: number; y: number } | null;
  setCellMenu: (v: { row: number; col: number; x: number; y: number } | null) => void;
  explainFormula: (row: number, col: number) => void;
  setAiOpSourceStr: (v: string) => void;
  setAiOpTargetStr: (v: string) => void;
  setAiOpMode: (mode: "row-wise" | "aggregate" | "matrix") => void;
  setAiOpOpen: (open: boolean) => void;

  // Formula explanation popover
  formulaExplanation: { row: number; col: number; text: string; loading: boolean } | null;
  setFormulaExplanation: (v: { row: number; col: number; text: string; loading: boolean } | null) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;

  // Row context menu
  rowMenu: { rowIndex: number; x: number; y: number } | null;
  setRowMenu: (v: { rowIndex: number; x: number; y: number } | null) => void;
  rowInsertAbove: (idx: number) => void;
  rowInsertBelow: (idx: number) => void;
  rowDuplicate: (idx: number) => void;
  rowDelete: (idx: number) => void;
  hideRow: (idx: number) => void;
  rowHeights: Record<number, number>;
  setRowHeights: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setSheets: React.Dispatch<React.SetStateAction<Sheet[]>>;
  activeSheetId: string | null;

  // Delete confirmation dialog
  pendingDelete: { type: "row" | "col"; index: number; sheetId: string } | null;
  setPendingDelete: (v: { type: "row" | "col"; index: number; sheetId: string } | null) => void;
  confirmDelete: () => void;
}

export function SheetContextMenus({
  sheetMenu, setSheetMenu, sheetRenameStart, duplicateSheet, deleteSheet,
  colMenu, colRenameStart, colInsertAt, colMoveLeft, colMoveRight,
  colSort, openFilterEditor, filters, removeFilter, colDelete, colHide,
  colToolClean, colToolNormalize, colToolCategorize, aiDisabled, aiFilling, activeSheet,
  filterEditCol, setFilterEditCol, filterOp, setFilterOp, filterVal, setFilterVal, applyFilter,
  cellMenu, setCellMenu, explainFormula, setAiOpSourceStr, setAiOpTargetStr, setAiOpMode, setAiOpOpen,
  formulaExplanation, setFormulaExplanation, gridRef,
  rowMenu, setRowMenu, rowInsertAbove, rowInsertBelow, rowDuplicate, rowDelete, hideRow,
  rowHeights, setRowHeights, setSheets, activeSheetId,
  pendingDelete, setPendingDelete, confirmDelete,
}: SheetContextMenusProps) {
  return (
    <>
      {/* Sheet sidebar context menu */}
      {sheetMenu && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px] text-sm"
          style={{ left: sheetMenu.x, top: sheetMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => { sheetRenameStart(sheetMenu.sheetId); setSheetMenu(null); }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Rename
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => { duplicateSheet(sheetMenu.sheetId); setSheetMenu(null); }}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Duplicate
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-destructive"
            onClick={() => { deleteSheet(sheetMenu.sheetId); setSheetMenu(null); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Column context menu */}
      {colMenu && (
        <div
          className="fixed z-50 surface-noise rounded-md py-1 min-w-[170px]"
          style={{ left: colMenu.x, top: colMenu.y, border: "1.5px solid var(--border-strong)", background: "var(--card)", boxShadow: "3px 3px 0 var(--riso-teal)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => colRenameStart(colMenu.colIndex)}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Rename column
          </button>
          <div className="h-px my-1 bg-border-strong" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => colInsertAt(colMenu.colIndex)}
          >
            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
            Insert column left
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => colInsertAt(colMenu.colIndex + 1)}
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            Insert column right
          </button>
          <div className="h-px my-1 bg-border-strong" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs disabled:opacity-40 disabled:cursor-default transition-colors"
            onClick={() => colMoveLeft(colMenu.colIndex)}
            disabled={colMenu.colIndex === 0}
          >
            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
            Move left
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs disabled:opacity-40 disabled:cursor-default transition-colors"
            onClick={() => colMoveRight(colMenu.colIndex)}
            disabled={!activeSheet || colMenu.colIndex >= activeSheet.columns.length - 1}
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            Move right
          </button>
          <div className="h-px my-1 bg-border-strong" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => colSort(colMenu.colIndex, true)}
          >
            <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
            Sort ascending
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => colSort(colMenu.colIndex, false)}
          >
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
            Sort descending
          </button>
          <div className="h-px my-1 bg-border-strong" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => openFilterEditor(colMenu.colIndex)}
          >
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {filters.has(colMenu.colIndex) ? "Edit filter" : "Filter column"}
          </button>
          {filters.has(colMenu.colIndex) && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
              style={{ color: "var(--accent-orange)" }}
              onClick={() => removeFilter(colMenu.colIndex)}
            >
              <X className="h-3.5 w-3.5" />
              Remove filter
            </button>
          )}
          <div className="h-px my-1 bg-border-strong" />
          <div className="px-3 py-1 font-mono-ui text-[10px] text-muted-foreground/60 uppercase tracking-widest">AI Tools</div>
          {aiDisabled ? (
            <div className="px-3 py-1.5 font-mono-ui text-xs text-muted-foreground/50">Disabled for large tables</div>
          ) : (
            <>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs disabled:opacity-40 transition-colors"
                onClick={() => colToolClean(colMenu.colIndex)}
                disabled={aiFilling}
              >
                <Eraser className="h-3.5 w-3.5 text-muted-foreground" />
                Clean data
              </button>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs disabled:opacity-40 transition-colors"
                onClick={() => colToolNormalize(colMenu.colIndex)}
                disabled={aiFilling}
              >
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                Normalize values
              </button>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs disabled:opacity-40 transition-colors"
                onClick={() => colToolCategorize(colMenu.colIndex)}
                disabled={aiFilling}
              >
                <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                Categorize
              </button>
            </>
          )}
          <div className="h-px my-1 bg-border-strong" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => colHide(colMenu.colIndex)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Hide column
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs text-destructive transition-colors"
            onClick={() => colDelete(colMenu.colIndex)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete column
          </button>
        </div>
      )}

      {/* Filter editor popup */}
      {filterEditCol !== null && activeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFilterEditCol(null)}>
          <div
            className="card-riso card-riso-teal surface-noise riso-frame w-[320px] p-4 rounded-lg relative overflow-hidden animate-ink-in"
            style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-teal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Riso color strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
            <div className="flex items-center gap-2 mb-3 mt-1">
              <Filter className="h-4 w-4" style={{ color: "var(--accent-teal)" }} />
              <h3 className="font-display font-black text-sm tracking-tight">Filter: {activeSheet.columns[filterEditCol]?.name}</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <select
                className="h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)" }}
                value={filterOp}
                onChange={(e) => setFilterOp(e.target.value)}
              >
                <option value="contains">Contains</option>
                <option value="=">=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
              </select>
              <input
                className="flex-1 h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-teal)" }}
                placeholder="Value..."
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilter(filterEditCol); if (e.key === "Escape") setFilterEditCol(null); }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-tactile btn-tactile-outline" onClick={() => setFilterEditCol(null)}>Cancel</button>
              <button className="btn-tactile btn-tactile-teal" onClick={() => applyFilter(filterEditCol)}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Cell context menu (formula cells only) */}
      {cellMenu && (
        <div
          className="fixed z-50 surface-noise rounded-md py-1 min-w-[160px]"
          style={{ left: cellMenu.x, top: cellMenu.y, border: "1.5px solid var(--border-strong)", background: "var(--card)", boxShadow: "3px 3px 0 var(--riso-teal)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 font-mono-ui text-xs hover:bg-muted/60 transition-colors"
            onClick={() => explainFormula(cellMenu.row, cellMenu.col)}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent-violet)" }} />
            Explain formula
          </button>

          <div className="my-1" style={{ borderTop: "1px solid var(--border-strong)" }} />

          <div className="relative group/ai">
            <button className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors">
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent-orange)" }} />
              <span>AI</span>
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            <div className="absolute left-full top-[-5px] hidden group-hover/ai:block rounded-md py-1 min-w-[180px]" style={{ border: "1.5px solid var(--border-strong)", background: "var(--card)", boxShadow: "3px 3px 0 var(--riso-teal)" }}>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted/60 font-mono-ui text-xs transition-colors"
                onClick={() => {
                  setAiOpSourceStr(`${idxToCol(cellMenu.col)}${cellMenu.row + 1}`);
                  setAiOpTargetStr(`${idxToCol(cellMenu.col)}${cellMenu.row + 1}`);
                  setAiOpMode("row-wise");
                  setAiOpOpen(true);
                  setCellMenu(null);
                }}
              >
                Apply to selection...
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formula explanation popover */}
      {formulaExplanation && (() => {
        const cellEl = gridRef.current?.querySelector(
          `tr:nth-child(${formulaExplanation.row + 1}) td:nth-child(${formulaExplanation.col + 2})`
        );
        const rect = cellEl?.getBoundingClientRect();
        const x = rect ? rect.left : 200;
        const y = rect ? rect.bottom + 4 : 200;
        return (
          <div
            className="fixed z-50 card-riso card-riso-violet surface-noise rounded-lg p-3 max-w-[320px] animate-ink-in"
            style={{ left: x, top: y, border: "1.5px solid var(--border-strong)", boxShadow: "3px 3px 0 var(--riso-violet)" }}
            data-formula-explanation
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-violet)" }} />
              <span className="riso-section-label" style={{ fontSize: "10px" }}>Formula Explanation</span>
              <button className="ml-auto btn-tactile btn-tactile-outline h-5 w-5 p-0 flex items-center justify-center" onClick={() => setFormulaExplanation(null)}>
                <X className="h-3 w-3" />
              </button>
            </div>
            {formulaExplanation.loading ? (
              <div className="flex items-center gap-1.5 font-mono-ui text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--accent-violet)" }} />
                Thinking...
              </div>
            ) : (
              <p className="font-mono-ui text-xs leading-relaxed text-foreground">{formulaExplanation.text}</p>
            )}
          </div>
        );
      })()}

      {/* Row context menu */}
      {rowMenu && (
        <div
          className="fixed z-50 surface-noise rounded-md py-1 min-w-[160px]"
          style={{ left: rowMenu.x, top: rowMenu.y, border: "1.5px solid var(--border-strong)", background: "var(--card)", boxShadow: "3px 3px 0 var(--riso-orange)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => rowInsertAbove(rowMenu.rowIndex)}
          >
            <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
            Insert row above
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => rowInsertBelow(rowMenu.rowIndex)}
          >
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
            Insert row below
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => rowDuplicate(rowMenu.rowIndex)}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Duplicate row
          </button>
          {rowMenu.rowIndex in rowHeights && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
              onClick={() => {
                const next = { ...rowHeights };
                delete next[rowMenu.rowIndex];
                setRowHeights(next);
                const sizes = activeSheet!.sizes ?? {};
                const updated: SheetSizes = { ...sizes, colWidths: sizes.colWidths ?? {}, rowHeights: next };
                setSheets(prev => prev.map(s => s.id === activeSheetId ? { ...s, sizes: updated } : s));
                axios.put(`${getAPIBase()}/sheets/${activeSheetId}/sizes`, updated).catch(() => {});
                setRowMenu(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              Reset row height
            </button>
          )}
          <div className="h-px my-1 bg-border-strong" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => hideRow(rowMenu.rowIndex)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Hide row
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted/60 flex items-center gap-2 font-mono-ui text-xs text-destructive transition-colors"
            onClick={() => rowDelete(rowMenu.rowIndex)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete row
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.type === "col" ? "column" : "row"}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The {pendingDelete?.type === "col" ? "column and all its data" : "row"} will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className="btn-tactile btn-tactile-outline" onClick={() => setPendingDelete(null)}>Cancel</button>
            <button
              className="btn-tactile"
              style={{ background: "var(--destructive)", backgroundImage: "var(--noise-btn)", borderColor: "rgba(0,0,0,0.15)", color: "#fff" }}
              onClick={confirmDelete}
            >Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
