import axios from "axios";
import {
  Pencil, Copy, Trash2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Filter, X, Eraser, ListChecks, Tags, Sparkles, ChevronRight,
  RotateCcw, Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../ui/dialog";
import { idxToCol } from "../../lib/cellUtils";
import type { Sheet, SheetSizes } from "../../lib/cellUtils";

const API_BASE = "http://127.0.0.1:8000";

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
  colSort, openFilterEditor, filters, removeFilter, colDelete,
  colToolClean, colToolNormalize, colToolCategorize, aiDisabled, aiFilling, activeSheet,
  filterEditCol, setFilterEditCol, filterOp, setFilterOp, filterVal, setFilterVal, applyFilter,
  cellMenu, setCellMenu, explainFormula, setAiOpSourceStr, setAiOpTargetStr, setAiOpMode, setAiOpOpen,
  formulaExplanation, setFormulaExplanation, gridRef,
  rowMenu, setRowMenu, rowInsertAbove, rowInsertBelow, rowDuplicate, rowDelete,
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
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[170px] text-sm"
          style={{ left: colMenu.x, top: colMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => colRenameStart(colMenu.colIndex)}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Rename column
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => colInsertAt(colMenu.colIndex)}
          >
            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
            Insert column left
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => colInsertAt(colMenu.colIndex + 1)}
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            Insert column right
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 disabled:opacity-40 disabled:cursor-default"
            onClick={() => colMoveLeft(colMenu.colIndex)}
            disabled={colMenu.colIndex === 0}
          >
            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
            Move left
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 disabled:opacity-40 disabled:cursor-default"
            onClick={() => colMoveRight(colMenu.colIndex)}
            disabled={!activeSheet || colMenu.colIndex >= activeSheet.columns.length - 1}
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            Move right
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => colSort(colMenu.colIndex, true)}
          >
            <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
            Sort ascending
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => colSort(colMenu.colIndex, false)}
          >
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
            Sort descending
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => openFilterEditor(colMenu.colIndex)}
          >
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {filters.has(colMenu.colIndex) ? "Edit filter" : "Filter column"}
          </button>
          {filters.has(colMenu.colIndex) && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-orange-500"
              onClick={() => removeFilter(colMenu.colIndex)}
            >
              <X className="h-3.5 w-3.5" />
              Remove filter
            </button>
          )}
          <div className="border-t border-border my-1" />
          <div className="px-3 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider">AI Tools</div>
          {aiDisabled ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground/50">Disabled for large tables</div>
          ) : (
            <>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 disabled:opacity-40"
                onClick={() => colToolClean(colMenu.colIndex)}
                disabled={aiFilling}
              >
                <Eraser className="h-3.5 w-3.5 text-muted-foreground" />
                Clean data
              </button>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 disabled:opacity-40"
                onClick={() => colToolNormalize(colMenu.colIndex)}
                disabled={aiFilling}
              >
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                Normalize values
              </button>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 disabled:opacity-40"
                onClick={() => colToolCategorize(colMenu.colIndex)}
                disabled={aiFilling}
              >
                <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                Categorize
              </button>
            </>
          )}
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-destructive"
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
          <div className="bg-background border rounded-lg shadow-lg w-[320px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Filter: {activeSheet.columns[filterEditCol]?.name}</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <select
                className="h-8 px-2 text-sm border border-border rounded-md bg-background outline-none"
                value={filterOp}
                onChange={(e) => setFilterOp(e.target.value)}
              >
                <option value="contains">Contains</option>
                <option value="=">=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
              </select>
              <input
                className="flex-1 h-8 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="Value..."
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilter(filterEditCol); if (e.key === "Escape") setFilterEditCol(null); }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFilterEditCol(null)}>Cancel</Button>
              <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => applyFilter(filterEditCol)}>Apply</Button>
            </div>
          </div>
        </div>
      )}

      {/* Cell context menu (formula cells only) */}
      {cellMenu && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[160px] text-sm"
          style={{ left: cellMenu.x, top: cellMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => explainFormula(cellMenu.row, cellMenu.col)}
          >
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            Explain formula
          </button>

          <div className="border-t border-border my-1" />

          <div className="relative group/ai">
            <button className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>AI</span>
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            <div className="absolute left-full top-[-5px] hidden group-hover/ai:block bg-background border border-border rounded-md shadow-lg py-1 min-w-[180px]">
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
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
            className="fixed z-50 bg-background border border-border rounded-lg shadow-lg p-3 max-w-[320px] text-sm"
            style={{ left: x, top: y }}
            data-formula-explanation
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Formula Explanation</span>
              <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setFormulaExplanation(null)}>
                <X className="h-3 w-3" />
              </button>
            </div>
            {formulaExplanation.loading ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-foreground">{formulaExplanation.text}</p>
            )}
          </div>
        );
      })()}

      {/* Row context menu */}
      {rowMenu && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[160px] text-sm"
          style={{ left: rowMenu.x, top: rowMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => rowInsertAbove(rowMenu.rowIndex)}
          >
            <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
            Insert row above
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => rowInsertBelow(rowMenu.rowIndex)}
          >
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
            Insert row below
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => rowDuplicate(rowMenu.rowIndex)}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Duplicate row
          </button>
          {rowMenu.rowIndex in rowHeights && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
              onClick={() => {
                const next = { ...rowHeights };
                delete next[rowMenu.rowIndex];
                setRowHeights(next);
                const sizes = activeSheet!.sizes ?? {};
                const updated: SheetSizes = { ...sizes, colWidths: sizes.colWidths ?? {}, rowHeights: next };
                setSheets(prev => prev.map(s => s.id === activeSheetId ? { ...s, sizes: updated } : s));
                axios.put(`${API_BASE}/sheets/${activeSheetId}/sizes`, updated).catch(() => {});
                setRowMenu(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              Reset row height
            </button>
          )}
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-destructive"
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
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
