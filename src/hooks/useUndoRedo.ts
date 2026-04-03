import { useState, useRef } from "react";
import axios from "axios";
import type { Sheet, SheetColumn, SheetSizes, CellFormat } from "../lib/cellUtils";
import { API_BASE } from "../lib/constants";

export const MAX_HISTORY = 50;

export type SheetSnapshot = {
  columns: SheetColumn[];
  rows: string[][];
  formulas: Record<string, string>;
  sizes: SheetSizes;
  alignments: Record<string, string>;
  formats: Record<string, CellFormat>;
};

export function useUndoRedo({
  sheets,
  setSheets,
  activeSheet,
  setColWidths,
  setRowHeights,
}: {
  sheets: Sheet[];
  setSheets: React.Dispatch<React.SetStateAction<Sheet[]>>;
  activeSheet: Sheet | null;
  setColWidths: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setRowHeights: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}) {
  const undoStacks = useRef<Map<string, SheetSnapshot[]>>(new Map());
  const redoStacks = useRef<Map<string, SheetSnapshot[]>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const skipHistory = useRef(false);
  const undoRedoInFlight = useRef(false);

  function syncUndoRedoState(sheetId: string) {
    setCanUndo((undoStacks.current.get(sheetId)?.length ?? 0) > 0);
    setCanRedo((redoStacks.current.get(sheetId)?.length ?? 0) > 0);
  }

  function updateSheet(updated: Sheet) {
    if (!skipHistory.current) {
      const prev = sheets.find((s) => s.id === updated.id);
      if (prev) {
        const stack = undoStacks.current.get(updated.id) ?? [];
        stack.push({ columns: prev.columns, rows: prev.rows, formulas: prev.formulas ?? {}, sizes: prev.sizes ?? {}, alignments: prev.alignments ?? {}, formats: prev.formats ?? {} });
        if (stack.length > MAX_HISTORY) stack.shift();
        undoStacks.current.set(updated.id, stack);
        redoStacks.current.set(updated.id, []);
        syncUndoRedoState(updated.id);
      }
    }
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function undoSheet() {
    if (!activeSheet || undoRedoInFlight.current) return;
    const stack = undoStacks.current.get(activeSheet.id);
    if (!stack || stack.length === 0) return;
    const snapshot = stack.pop()!;
    const redoStack = redoStacks.current.get(activeSheet.id) ?? [];
    redoStack.push({ columns: activeSheet.columns, rows: activeSheet.rows, formulas: activeSheet.formulas ?? {}, sizes: activeSheet.sizes ?? {}, alignments: activeSheet.alignments ?? {}, formats: activeSheet.formats ?? {} });
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    redoStacks.current.set(activeSheet.id, redoStack);
    skipHistory.current = true;
    undoRedoInFlight.current = true;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/data`, {
        columns: snapshot.columns,
        rows: snapshot.rows,
        formulas: snapshot.formulas,
        sizes: snapshot.sizes,
        alignments: snapshot.alignments,
        formats: snapshot.formats,
      });
      updateSheet(res.data);
      setColWidths(snapshot.sizes?.colWidths ?? {});
      setRowHeights(snapshot.sizes?.rowHeights ?? {});
    } catch { /* ignore */ }
    skipHistory.current = false;
    undoRedoInFlight.current = false;
    syncUndoRedoState(activeSheet.id);
  }

  async function redoSheet() {
    if (!activeSheet || undoRedoInFlight.current) return;
    const stack = redoStacks.current.get(activeSheet.id);
    if (!stack || stack.length === 0) return;
    const snapshot = stack.pop()!;
    const undoStack = undoStacks.current.get(activeSheet.id) ?? [];
    undoStack.push({ columns: activeSheet.columns, rows: activeSheet.rows, formulas: activeSheet.formulas ?? {}, sizes: activeSheet.sizes ?? {}, alignments: activeSheet.alignments ?? {}, formats: activeSheet.formats ?? {} });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    undoStacks.current.set(activeSheet.id, undoStack);
    skipHistory.current = true;
    undoRedoInFlight.current = true;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/data`, {
        columns: snapshot.columns,
        rows: snapshot.rows,
        formulas: snapshot.formulas,
        sizes: snapshot.sizes,
        alignments: snapshot.alignments,
        formats: snapshot.formats,
      });
      updateSheet(res.data);
      setColWidths(snapshot.sizes?.colWidths ?? {});
      setRowHeights(snapshot.sizes?.rowHeights ?? {});
    } catch { /* ignore */ }
    skipHistory.current = false;
    undoRedoInFlight.current = false;
    syncUndoRedoState(activeSheet.id);
  }

  return {
    canUndo,
    canRedo,
    undoStacks,
    redoStacks,
    skipHistory,
    undoRedoInFlight,
    syncUndoRedoState,
    updateSheet,
    undoSheet,
    redoSheet,
  };
}
