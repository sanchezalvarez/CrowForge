import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { Table2, X, AlertCircle, Sparkles, Loader2, LayoutTemplate, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { toast } from "../hooks/useToast";
import { useDropImport, IMPORT_FORMAT_LABELS } from "../hooks/useDropImport";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useAiSheet } from "../hooks/useAiSheet";
import {
  validateImportFile,
  parseSheetImport,
  exportSheetAs,
  exportAllSheetsXLSX,
  SHEET_IMPORT_EXTS,
  type SheetExportFormat,
} from "../lib/fileService";
import {
  type Sheet, type CellFormat,
  DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, MIN_COL_WIDTH, MIN_ROW_HEIGHT,
  ROW_WARN_THRESHOLD, ROW_AI_LIMIT, ROW_RENDER_LIMIT,
  idxToCol, inferFillSeries,
} from "../lib/cellUtils";
import type { SheetTemplate } from "../lib/sheetTemplates";
import { SheetDialogs } from "../components/sheets/SheetDialogs";
import { SheetContextMenus } from "../components/sheets/SheetContextMenus";
import { SheetToolbar } from "../components/sheets/SheetToolbar";
import { FormulaBar } from "../components/sheets/FormulaBar";
import { SheetGrid } from "../components/sheets/SheetGrid";
import { FindBar } from "../components/sheets/FindBar";
import { MultiSortDialog, type SortLevel } from "../components/sheets/MultiSortDialog";
import { CondFormatDialog } from "../components/sheets/CondFormatDialog";
import type { TuningParams } from "../components/AIControlPanel";
import { SheetSidebar } from "../components/sheets/SheetSidebar";
import type { ConditionalRule } from "../lib/cellUtils";

const API_BASE = "http://127.0.0.1:8000";

interface SheetsPageProps {
  tuningParams?: TuningParams;
}

export function SheetsPage({ tuningParams }: SheetsPageProps) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const [dismissedWarning, setDismissedWarning] = useState<string | null>(null);

  // Virtual scroll for large tables
  const gridRef = useRef<HTMLDivElement>(null);
  const [scrollRowStart, setScrollRowStart] = useState(0);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editValueRef = useRef("");
  const cellInputRef = useRef<HTMLInputElement>(null);
  const [cellError, setCellError] = useState<string | null>(null);

  // Undo / Redo — managed by useUndoRedo hook

  // Multi-cell selection: normalized rectangle {r1<=r2, c1<=c2}
  // Per-table selection preservation
  type SelectionRect = { r1: number; c1: number; r2: number; c2: number };
  type AnchorPoint = { row: number; col: number };
  const selectionMap = useRef<Map<string, { sel: SelectionRect | null; anchor: AnchorPoint | null }>>(new Map());
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [selAnchor, setSelAnchor] = useState<AnchorPoint | null>(null);
  const selMoving = useRef<AnchorPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<{ type: "row" | "col"; index: number; sheetId: string } | null>(null);

  // Context menus
  const [rowMenu, setRowMenu] = useState<{ rowIndex: number; x: number; y: number } | null>(null);
  const [colMenu, setColMenu] = useState<{ colIndex: number; x: number; y: number } | null>(null);
  const [sheetMenu, setSheetMenu] = useState<{ sheetId: string; x: number; y: number } | null>(null);
  // Cell context menu + formula explanation
  const [cellMenu, setCellMenu] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const [formulaExplanation, setFormulaExplanation] = useState<{ row: number; col: number; text: string; loading: boolean } | null>(null);
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
  const [renameSheetValue, setRenameSheetValue] = useState("");
  const renameSheetRef = useRef<HTMLInputElement>(null);
  const [renamingCol, setRenamingCol] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // Filters: per-column filter config (client-side)
  type ColFilter = { operator: string; value: string };
  const [filters, setFilters] = useState<Map<number, ColFilter>>(new Map());
  const [filterEditCol, setFilterEditCol] = useState<number | null>(null);
  const [filterOp, setFilterOp] = useState("contains");
  const [filterVal, setFilterVal] = useState("");

  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("text");
  const colNameRef = useRef<HTMLInputElement>(null);

  // Template picker state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // AI state — managed by useAiSheet hook (initialized after aiDisabled is computed)

  // Column/row resize state
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [resizing, setResizing] = useState<{ type: 'col' | 'row'; index: number; startPos: number; startSize: number } | null>(null);

  const {
    canUndo, canRedo,
    undoStacks, redoStacks,
    syncUndoRedoState, updateSheet, undoSheet, redoSheet,
  } = useUndoRedo({ sheets, setSheets, activeSheet, setColWidths, setRowHeights });

  // Import / Export
  const importInputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Drag-and-drop import (renamed to avoid collision with resize isDragging)
  const { isDragging: isDropDragging, pendingFile, confirmImport, clearPending, dragProps } = useDropImport(
    SHEET_IMPORT_EXTS,
    (file) => handleImportFile(file),
  );

  // Sync sizes from activeSheet when switching sheets
  useEffect(() => {
    if (activeSheet) {
      setColWidths(activeSheet.sizes?.colWidths ?? {});
      setRowHeights(activeSheet.sizes?.rowHeights ?? {});
    } else {
      setColWidths({});
      setRowHeights({});
    }
  }, [activeSheetId]);

  // Refs to hold latest sizes for resize mouseup handler (avoids re-attaching listeners on every drag frame)
  const colWidthsRef = useRef(colWidths);
  const rowHeightsRef = useRef(rowHeights);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);
  useEffect(() => { rowHeightsRef.current = rowHeights; }, [rowHeights]);

  // Global mousemove/mouseup for resize dragging
  // During drag we mutate the DOM directly (no React re-render) for smooth 60fps,
  // then commit the final size to state + backend on mouseup.
  useEffect(() => {
    if (!resizing) return;
    const table = gridRef.current?.querySelector('table');
    const onMove = (e: MouseEvent) => {
      if (resizing.type === 'col') {
        const newW = Math.max(MIN_COL_WIDTH, resizing.startSize + (e.clientX - resizing.startPos));
        colWidthsRef.current = { ...colWidthsRef.current, [resizing.index]: newW };
        // Direct DOM update — skip React render for smooth resize
        if (table) {
          const ci = resizing.index;
          // Update header th
          const th = table.querySelector(`thead th:nth-child(${ci + 2})`) as HTMLElement | null;
          if (th) { th.style.width = `${newW}px`; }
          // Update body td cells in this column
          const rows = table.querySelectorAll(`tbody tr`);
          for (let i = 0; i < rows.length; i++) {
            const td = rows[i].children[ci + 1] as HTMLElement | undefined;
            if (td) td.style.width = `${newW}px`;
          }
        }
      } else {
        const newH = Math.max(MIN_ROW_HEIGHT, resizing.startSize + (e.clientY - resizing.startPos));
        rowHeightsRef.current = { ...rowHeightsRef.current, [resizing.index]: newH };
        if (table) {
          // Row number cell holds the row height
          const rowEl = table.querySelector(`tbody tr:nth-child(${resizing.index + 1}) td:first-child`) as HTMLElement | null;
          if (rowEl) rowEl.style.height = `${newH}px`;
        }
      }
    };
    const onUp = () => {
      // Commit final sizes to React state + backend
      setColWidths({ ...colWidthsRef.current });
      setRowHeights({ ...rowHeightsRef.current });
      if (activeSheet) {
        const sizes = { colWidths: colWidthsRef.current, rowHeights: rowHeightsRef.current };
        axios.put(`${API_BASE}/sheets/${activeSheet.id}/sizes`, sizes).catch(() => {});
      }
      setResizing(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizing, activeSheet]);

  // Auto-focus sheet rename input
  useEffect(() => {
    if (renamingSheet && renameSheetRef.current) {
      renameSheetRef.current.focus();
      renameSheetRef.current.select();
    }
  }, [renamingSheet]);

  // Auto-focus column rename input
  useEffect(() => {
    if (renamingCol !== null && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingCol]);

  // Auto-focus when editing starts
  useEffect(() => {
    if (editingCell) {
      if (cellInputRef.current) {
        cellInputRef.current.focus();
      }
    } else if (!editingCell && selection) {
      // Return focus to grid so arrow keys work
      gridRef.current?.focus();
    }
  }, [editingCell]);

  // Keep grid focused whenever a selection exists and we're not editing
  useEffect(() => {
    if (selection && !editingCell) {
      gridRef.current?.focus();
    }
  }, [selection]);

  // Auto-focus column name input
  useEffect(() => {
    if (addingColumn && colNameRef.current) {
      colNameRef.current.focus();
    }
  }, [addingColumn]);

  // Save/restore selection when switching sheets
  const prevSheetId = useRef<string | null>(null);
  useEffect(() => {
    // Save selection of previous sheet
    if (prevSheetId.current) {
      selectionMap.current.set(prevSheetId.current, { sel: selection, anchor: selAnchor });
    }

    // Commit any pending cell edit before switching sheets (fire-and-forget)
    if (editingCell && prevSheetId.current) {
      const prevSheet = sheets.find(s => s.id === prevSheetId.current);
      if (prevSheet) {
        const { row, col } = editingCell;
        const original = prevSheet.rows[row]?.[col] ?? "";
        if (editValue !== original) {
          axios.put(`${API_BASE}/sheets/${prevSheet.id}/cell`, {
            row_index: row, col_index: col, value: editValue,
          }).catch(() => {});
        }
      }
    }

    prevSheetId.current = activeSheetId;

    setEditingCell(null);
    setCellError(null);
    setAddingColumn(false);
    cancelAiFill();
    setAiFillOpen(false);
    setFilters(new Map());
    setFilterEditCol(null);

    // Restore selection for new sheet
    const saved = activeSheetId ? selectionMap.current.get(activeSheetId) : null;
    if (saved) {
      setSelection(saved.sel);
      setSelAnchor(saved.anchor);
      selMoving.current = saved.anchor;
    } else {
      setSelection(null);
      setSelAnchor(null);
      selMoving.current = null;
    }

    // Sync undo/redo indicators
    if (activeSheetId) syncUndoRedoState(activeSheetId);
  }, [activeSheetId]);

  const startEditing = useCallback((ri: number, ci: number, currentValue: string) => {
    // If the cell has a formula, edit the formula text instead of computed value
    const formulaKey = `${ri},${ci}`;
    const formula = activeSheet?.formulas?.[formulaKey];
    const val = formula ?? currentValue;
    setEditingCell({ row: ri, col: ci });
    setEditValue(val);
    editValueRef.current = val;
    setSelection({ r1: ri, c1: ci, r2: ri, c2: ci });
    setSelAnchor({ row: ri, col: ci });
  }, [activeSheet]);

  const commitEdit = useCallback(async () => {
    if (!editingCell || !activeSheet) return;
    const { row, col } = editingCell;
    const formulaKey = `${row},${col}`;
    const original = activeSheet.formulas?.[formulaKey] ?? activeSheet.rows[row]?.[col] ?? "";
    const currentValue = editValueRef.current;
    if (currentValue !== original) {
      // Clear editing state synchronously first to prevent clobbering a new edit session
      setEditingCell(null);
      setCellError(null);
      try {
        const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/cell`, {
          row_index: row,
          col_index: col,
          value: currentValue,
        });
        updateSheet(res.data);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        setCellError(detail || "Invalid value");
        // Re-open edit on error so user can fix
        setEditingCell({ row, col });
        setEditValue(currentValue);
        return;
      }
    } else {
      setEditingCell(null);
      setCellError(null);
    }
  }, [editingCell, activeSheet]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Selection helpers
  const makeRect = useCallback((a: { row: number; col: number }, b: { row: number; col: number }) => ({
    r1: Math.min(a.row, b.row),
    c1: Math.min(a.col, b.col),
    r2: Math.max(a.row, b.row),
    c2: Math.max(a.col, b.col),
  }), []);

  const isCellSelected = useCallback((ri: number, ci: number) => {
    if (!selection) return false;
    return ri >= selection.r1 && ri <= selection.r2 && ci >= selection.c1 && ci <= selection.c2;
  }, [selection]);

  const handleCellMouseDown = useCallback((ri: number, ci: number, e: React.MouseEvent) => {
    // If editing a formula, clicking another cell inserts its reference
    if (editingCell && (editingCell.row !== ri || editingCell.col !== ci) && editValue.startsWith("=")) {
      e.preventDefault();
      const ref = `${idxToCol(ci)}${ri + 1}`;
      // Insert reference at cursor position or append
      if (cellInputRef.current) {
        const input = cellInputRef.current;
        const pos = input.selectionStart ?? editValue.length;
        const newVal = editValue.slice(0, pos) + ref + editValue.slice(pos);
        editValueRef.current = newVal;
        setEditValue(newVal);
        // Re-focus the input after state update
        requestAnimationFrame(() => {
          input.focus();
          const newPos = pos + ref.length;
          input.setSelectionRange(newPos, newPos);
        });
      } else {
        const newVal = editValue + ref;
        editValueRef.current = newVal;
        setEditValue(newVal);
      }
      return;
    }

    // If editing a different cell, commit the edit first
    if (editingCell && (editingCell.row !== ri || editingCell.col !== ci)) {
      commitEdit();
    }

    if (e.shiftKey && selAnchor) {
      // Extend selection from anchor
      setSelection(makeRect(selAnchor, { row: ri, col: ci }));
    } else {
      // Start new selection
      setSelAnchor({ row: ri, col: ci });
      selMoving.current = { row: ri, col: ci };
      setSelection({ r1: ri, c1: ci, r2: ri, c2: ci });
      setIsDragging(true);
    }
    gridRef.current?.focus();
  }, [editingCell, editValue, commitEdit, selAnchor, makeRect]);

  const handleCellMouseEnter = useCallback((ri: number, ci: number) => {
    if (!isDragging || !selAnchor) return;
    setSelection(makeRect(selAnchor, { row: ri, col: ci }));
  }, [isDragging, selAnchor, makeRect]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouseup to end drag even when mouse leaves the table
  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [isDragging]);

  // Track copy origin for relative formula adjustment
  const copyOrigin = useRef<{ r1: number; c1: number } | null>(null);
  const copyValues = useRef<string[][] | null>(null);

  const copySelection = useCallback(() => {
    if (!selection || !activeSheet) return;
    copyOrigin.current = { r1: selection.r1, c1: selection.c1 };
    const rows: string[] = [];
    const valueRows: string[][] = [];
    for (let ri = selection.r1; ri <= selection.r2; ri++) {
      const cols: string[] = [];
      const valueCols: string[] = [];
      for (let ci = selection.c1; ci <= selection.c2; ci++) {
        // Copy formula text if cell has one, otherwise the displayed value
        const formulaKey = `${ri},${ci}`;
        const formula = activeSheet.formulas?.[formulaKey];
        const displayVal = activeSheet.rows[ri]?.[ci] ?? "";
        cols.push(formula ?? displayVal);
        valueCols.push(displayVal);
      }
      rows.push(cols.join("\t"));
      valueRows.push(valueCols);
    }
    navigator.clipboard.writeText(rows.join("\n"));
    copyValues.current = valueRows;
  }, [selection, activeSheet]);

  const pasteValuesOnly = useCallback(async () => {
    if (!activeSheet || !selection || !copyValues.current) return;
    const startRow = selection.r1;
    const startCol = selection.c1;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/paste`, {
        start_row: startRow,
        start_col: startCol,
        data: copyValues.current,
        // no source_row/source_col — skip formula adjustment
      });
      updateSheet(res.data);
      setSelection({
        r1: startRow, c1: startCol,
        r2: startRow + copyValues.current.length - 1,
        c2: startCol + (Math.max(...copyValues.current.map((r) => r.length)) - 1),
      });
    } catch { /* ignore */ }
  }, [selection, activeSheet]);

  const autoFitAllCols = useCallback(() => {
    if (!activeSheet) return;
    const canvas = document.createElement("canvas");
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    ctx2d.font = "14px sans-serif";
    const newWidths: Record<number, number> = {};
    for (let ci = 0; ci < activeSheet.columns.length; ci++) {
      let maxW = ctx2d.measureText(activeSheet.columns[ci].name).width + 32;
      for (const row of activeSheet.rows) {
        const val = row[ci] ?? "";
        if (val) {
          const w = ctx2d.measureText(val).width + 24;
          if (w > maxW) maxW = w;
        }
      }
      newWidths[ci] = Math.max(MIN_COL_WIDTH, Math.min(500, Math.ceil(maxW)));
    }
    setColWidths(newWidths);
    const sizes = { ...activeSheet.sizes, colWidths: newWidths, rowHeights };
    axios.put(`${API_BASE}/sheets/${activeSheet.id}/sizes`, sizes).catch(() => {});
  }, [activeSheet, rowHeights]);

  const toggleFreezeCol = useCallback(() => {
    if (!activeSheet) return;
    const sizes = { ...activeSheet.sizes, freezeFirstCol: !activeSheet.sizes?.freezeFirstCol };
    axios.put(`${API_BASE}/sheets/${activeSheet.id}/sizes`, sizes)
      .then((res) => updateSheet(res.data))
      .catch(() => {});
  }, [activeSheet]);

  const toggleFreezeRow = useCallback(() => {
    if (!activeSheet) return;
    const sizes = { ...activeSheet.sizes, freezeFirstRow: !activeSheet.sizes?.freezeFirstRow };
    axios.put(`${API_BASE}/sheets/${activeSheet.id}/sizes`, sizes)
      .then((res) => updateSheet(res.data))
      .catch(() => {});
  }, [activeSheet]);

  type SelectionRect2 = { r1: number; c1: number; r2: number; c2: number };

  const fillDragExecute = useCallback(async (origin: SelectionRect2, fillRect: SelectionRect2) => {
    if (!activeSheet) return;
    const { r1: or1, c1: oc1, r2: or2, c2: oc2 } = origin;
    const { r1: fr1, c1: fc1, r2: fr2, c2: fc2 } = fillRect;

    // Determine direction
    const fillDown = fr2 > or2;
    const fillUp = fr1 < or1;
    const fillRight = !fillDown && !fillUp && fc2 > oc2;
    void fc1; // fill-left not yet implemented

    // Build the data array to paste
    const data: string[][] = [];

    if (fillDown || fillUp) {
      const count = fillDown ? fr2 - or2 : or1 - fr1;
      for (let ci = oc1; ci <= oc2; ci++) {
        // Source column values (top to bottom)
        const srcVals = [];
        const srcForms = [];
        for (let ri = or1; ri <= or2; ri++) {
          srcForms.push(activeSheet.formulas?.[`${ri},${ci}`]);
          srcVals.push(activeSheet.rows[ri]?.[ci] ?? "");
        }
        const hasFormulas = srcForms.some(Boolean);
        const filled = hasFormulas ? srcVals : inferFillSeries(srcVals, count);
        for (let i = 0; i < count; i++) {
          if (!data[i]) data[i] = Array(oc2 - oc1 + 1).fill("");
          data[i][ci - oc1] = hasFormulas
            ? (srcForms[i % srcForms.length] ?? srcVals[i % srcVals.length])
            : filled[i];
        }
      }
      const startRow = fillDown ? or2 + 1 : fr1;
      try {
        const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/paste`, {
          start_row: startRow,
          start_col: oc1,
          data,
          source_row: or1,
          source_col: oc1,
        });
        updateSheet(res.data);
      } catch { /* ignore */ }
    } else if (fillRight) {
      const count = fc2 - oc2;
      for (let ri = or1; ri <= or2; ri++) {
        const srcVals = [];
        const srcForms = [];
        for (let ci = oc1; ci <= oc2; ci++) {
          srcForms.push(activeSheet.formulas?.[`${ri},${ci}`]);
          srcVals.push(activeSheet.rows[ri]?.[ci] ?? "");
        }
        const hasFormulas = srcForms.some(Boolean);
        const filled = hasFormulas ? srcVals : inferFillSeries(srcVals, count);
        const dataRow: string[] = Array(count).fill("");
        for (let i = 0; i < count; i++) {
          dataRow[i] = hasFormulas
            ? (srcForms[i % srcForms.length] ?? srcVals[i % srcVals.length])
            : filled[i];
        }
        if (!data[ri - or1]) data[ri - or1] = dataRow;
        else data[ri - or1] = dataRow;
      }
      try {
        const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/paste`, {
          start_row: or1,
          start_col: oc2 + 1,
          data,
          source_row: or1,
          source_col: oc1,
        });
        updateSheet(res.data);
      } catch { /* ignore */ }
    }
  }, [activeSheet]);

  const cutSelection = useCallback(async () => {
    if (!selection || !activeSheet) return;
    copySelection();
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/clear-range`, {
        r1: selection.r1, c1: selection.c1, r2: selection.r2, c2: selection.c2,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }, [selection, activeSheet, copySelection]);

  const pasteAtSelection = useCallback(async (clipText: string) => {
    if (!activeSheet) return;
    const startRow = selection?.r1 ?? 0;
    const startCol = selection?.c1 ?? 0;
    const lines = clipText.split(/\r?\n/);
    // Strip only trailing empty lines (e.g. trailing newline from clipboard)
    while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();
    const data = lines.map((line) => line.split("\t"));
    if (data.length === 0) return;
    try {
      const payload: Record<string, unknown> = {
        start_row: startRow,
        start_col: startCol,
        data,
      };
      // Send source origin so backend can compute relative formula shifts
      if (copyOrigin.current) {
        payload.source_row = copyOrigin.current.r1;
        payload.source_col = copyOrigin.current.c1;
      }
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/paste`, payload);
      updateSheet(res.data);
      // Update selection to cover pasted area
      setSelection({
        r1: startRow,
        c1: startCol,
        r2: startRow + data.length - 1,
        c2: startCol + (Math.max(...data.map((r) => r.length)) - 1),
      });
    } catch { /* ignore */ }
  }, [selection, activeSheet]);

  const clearSelectedCells = useCallback(async () => {
    if (!selection || !activeSheet) return;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/clear-range`, {
        r1: selection.r1, c1: selection.c1, r2: selection.r2, c2: selection.c2,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }, [selection, activeSheet]);

  const fillDown = useCallback(async () => {
    if (!selection || !activeSheet) return;
    const { r1, c1, r2, c2 } = selection;
    if (r1 === r2) return;
    const firstRow: string[] = [];
    for (let ci = c1; ci <= c2; ci++) {
      const key = `${r1},${ci}`;
      firstRow.push(activeSheet.formulas?.[key] ?? activeSheet.rows[r1]?.[ci] ?? "");
    }
    const data = Array.from({ length: r2 - r1 + 1 }, () => [...firstRow]);
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/paste`, {
        start_row: r1, start_col: c1, data, source_row: r1, source_col: c1,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }, [selection, activeSheet]);

  const fillRight = useCallback(async () => {
    if (!selection || !activeSheet) return;
    const { r1, c1, r2, c2 } = selection;
    if (c1 === c2) return;
    const data: string[][] = [];
    for (let ri = r1; ri <= r2; ri++) {
      const key = `${ri},${c1}`;
      const firstVal = activeSheet.formulas?.[key] ?? activeSheet.rows[ri]?.[c1] ?? "";
      data.push(Array.from({ length: c2 - c1 + 1 }, () => firstVal));
    }
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/paste`, {
        start_row: r1, start_col: c1, data, source_row: r1, source_col: c1,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }, [selection, activeSheet]);

  // Hide/Unhide rows & columns
  const saveSizes = useCallback(async (newHiddenRows: number[], newHiddenCols: number[]) => {
    if (!activeSheet) return;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/sizes`, {
        colWidths, rowHeights, hiddenRows: newHiddenRows, hiddenCols: newHiddenCols,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }, [activeSheet, colWidths, rowHeights]);

  const hideRow = useCallback(async (ri: number) => {
    if (!activeSheet) return;
    const hidden = new Set(activeSheet.sizes?.hiddenRows ?? []);
    hidden.add(ri);
    await saveSizes([...hidden].sort((a, b) => a - b), activeSheet.sizes?.hiddenCols ?? []);
    setRowMenu(null);
  }, [activeSheet, saveSizes]);

  const unhideRows = useCallback(async (rows: number[]) => {
    if (!activeSheet) return;
    const hidden = new Set(activeSheet.sizes?.hiddenRows ?? []);
    for (const r of rows) hidden.delete(r);
    await saveSizes([...hidden].sort((a, b) => a - b), activeSheet.sizes?.hiddenCols ?? []);
  }, [activeSheet, saveSizes]);

  const hideCol = useCallback(async (ci: number) => {
    if (!activeSheet) return;
    const hidden = new Set(activeSheet.sizes?.hiddenCols ?? []);
    hidden.add(ci);
    await saveSizes(activeSheet.sizes?.hiddenRows ?? [], [...hidden].sort((a, b) => a - b));
    setColMenu(null);
  }, [activeSheet, saveSizes]);

  const unhideCol = useCallback(async (ci: number) => {
    if (!activeSheet) return;
    const hidden = new Set(activeSheet.sizes?.hiddenCols ?? []);
    hidden.delete(ci);
    await saveSizes(activeSheet.sizes?.hiddenRows ?? [], [...hidden].sort((a, b) => a - b));
  }, [activeSheet, saveSizes]);

  // Multi-level sort dialog
  const [multiSortOpen, setMultiSortOpen] = useState(false);
  const applyMultiSort = useCallback(async (levels: SortLevel[]) => {
    if (!activeSheet) return;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/columns/sort-multi`, { levels });
      updateSheet(res.data);
    } catch { toast("Sort failed.", "error"); }
  }, [activeSheet]);

  // Conditional formatting dialog
  const [condFormatOpen, setCondFormatOpen] = useState(false);
  const saveCondRules = useCallback(async (rules: ConditionalRule[]) => {
    if (!activeSheet) return;
    const sizes = { ...activeSheet.sizes, condRules: rules };
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/sizes`, sizes);
      updateSheet(res.data);
    } catch { toast("Failed to save rules.", "error"); }
  }, [activeSheet]);

  // Find (Ctrl+F)
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);

  const findResults = useMemo(() => {
    if (!activeSheet || !findQuery.trim()) return [] as { r: number; c: number }[];
    const q = findQuery.toLowerCase();
    const results: { r: number; c: number }[] = [];
    for (let ri = 0; ri < activeSheet.rows.length; ri++) {
      for (let ci = 0; ci < activeSheet.columns.length; ci++) {
        const val = (activeSheet.rows[ri]?.[ci] ?? "").toLowerCase();
        if (val.includes(q)) results.push({ r: ri, c: ci });
      }
    }
    return results;
  }, [activeSheet, findQuery]);

  const findMatches = useMemo(() => {
    const s = new Set<string>();
    for (const { r, c } of findResults) s.add(`${r},${c}`);
    return s;
  }, [findResults]);

  const findCurrentKey = findResults.length > 0 && findIndex < findResults.length
    ? `${findResults[findIndex].r},${findResults[findIndex].c}` : null;

  // Reset index + navigate on query or sheet change
  useEffect(() => {
    setFindIndex(0);
  }, [findQuery, activeSheetId]);

  useEffect(() => {
    if (findResults.length > 0) {
      const idx = Math.min(findIndex, findResults.length - 1);
      const { r, c } = findResults[idx];
      setSelAnchor({ row: r, col: c });
      setSelection({ r1: r, c1: c, r2: r, c2: c });
    }
  }, [findIndex, findResults]);

  const findNext = useCallback(() => {
    if (findResults.length === 0) return;
    setFindIndex((i) => (i + 1) % findResults.length);
  }, [findResults.length]);

  const findPrev = useCallback(() => {
    if (findResults.length === 0) return;
    setFindIndex((i) => (i - 1 + findResults.length) % findResults.length);
  }, [findResults.length]);

  const [replaceQuery, setReplaceQuery] = useState("");
  const [replaceCount, setReplaceCount] = useState<number | null>(null);

  const replaceOne = useCallback(async () => {
    if (!activeSheet || findResults.length === 0 || !findQuery.trim()) return;
    const idx = Math.min(findIndex, findResults.length - 1);
    const { r, c } = findResults[idx];
    const formula = activeSheet.formulas?.[`${r},${c}`];
    const source = formula ?? (activeSheet.rows[r]?.[c] ?? "");
    const newVal = source.replaceAll(findQuery, replaceQuery);
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/cell`, {
        row_index: r, col_index: c, value: newVal,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
    findNext();
  }, [activeSheet, findResults, findIndex, findQuery, replaceQuery, findNext]);

  const replaceAll = useCallback(async () => {
    if (!activeSheet || findResults.length === 0 || !findQuery.trim()) return;
    let updatedSheet = activeSheet;
    let count = 0;
    for (const { r, c } of findResults) {
      const formula = updatedSheet.formulas?.[`${r},${c}`];
      const source = formula ?? (updatedSheet.rows[r]?.[c] ?? "");
      const newVal = source.replaceAll(findQuery, replaceQuery);
      if (newVal !== source) {
        try {
          const res = await axios.put(`${API_BASE}/sheets/${updatedSheet.id}/cell`, {
            row_index: r, col_index: c, value: newVal,
          });
          updatedSheet = res.data;
          count++;
        } catch { /* ignore */ }
      }
    }
    updateSheet(updatedSheet);
    setReplaceCount(count);
    setTimeout(() => setReplaceCount(null), 3000);
  }, [activeSheet, findResults, findQuery, replaceQuery]);

  // Reset replaceCount on query change
  useEffect(() => { setReplaceCount(null); }, [findQuery, replaceQuery]);

  // Row context menu operations
  async function rowInsertAbove(ri: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/rows/insert`, { row_index: ri });
      updateSheet(res.data);
    } catch { toast("Failed to insert row.", "error"); }
    setRowMenu(null);
  }
  async function rowInsertBelow(ri: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/rows/insert`, { row_index: ri + 1 });
      updateSheet(res.data);
    } catch { toast("Failed to insert row.", "error"); }
    setRowMenu(null);
  }
  async function rowDuplicate(ri: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/rows/duplicate`, { row_index: ri });
      updateSheet(res.data);
    } catch { toast("Failed to duplicate row.", "error"); }
    setRowMenu(null);
  }
  function rowDelete(ri: number) {
    if (!activeSheet) return;
    setRowMenu(null);
    setPendingDelete({ type: "row", index: ri, sheetId: activeSheet.id });
  }

  // Close row menu on outside click
  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [rowMenu]);

  // Close cell menu on outside click
  useEffect(() => {
    if (!cellMenu) return;
    const close = () => setCellMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [cellMenu]);

  // Close formula explanation on outside click
  useEffect(() => {
    if (!formulaExplanation) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-formula-explanation]")) setFormulaExplanation(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [formulaExplanation]);

  async function explainFormula(row: number, col: number) {
    if (!activeSheet) return;
    setCellMenu(null);
    setFormulaExplanation({ row, col, text: "", loading: true });
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/explain-formula`, {
        row_index: row, col_index: col,
        temperature: tuningParams?.temperature,
        max_tokens: tuningParams?.maxTokens,
      });
      setFormulaExplanation({ row, col, text: res.data.explanation, loading: false });
    } catch {
      setFormulaExplanation({ row, col, text: "Failed to explain formula.", loading: false });
    }
  }

  // Column context menu operations
  async function colRenameStart(ci: number) {
    if (!activeSheet) return;
    setRenamingCol(ci);
    setRenameValue(activeSheet.columns[ci].name);
    setColMenu(null);
  }
  async function colRenameCommit() {
    if (renamingCol === null || !activeSheet || !renameValue.trim()) {
      setRenamingCol(null);
      return;
    }
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/columns/rename`, {
        col_index: renamingCol, name: renameValue.trim(),
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setRenamingCol(null);
  }
  async function colMoveLeft(ci: number) {
    if (!activeSheet || ci <= 0) return;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/columns/move`, {
        from_index: ci, to_index: ci - 1,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setColMenu(null);
  }
  async function colMoveRight(ci: number) {
    if (!activeSheet || ci >= activeSheet.columns.length - 1) return;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/columns/move`, {
        from_index: ci, to_index: ci + 1,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setColMenu(null);
  }
  async function colInsertAt(ci: number) {
    if (!activeSheet) return;
    const name = idxToCol(activeSheet.columns.length);
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/columns/insert`, {
        col_index: ci, name, type: "text",
      });
      updateSheet(res.data);
    } catch { toast("Failed to insert column.", "error"); }
    setColMenu(null);
  }

  function colDelete(ci: number) {
    if (!activeSheet) return;
    setColMenu(null);
    setPendingDelete({ type: "col", index: ci, sheetId: activeSheet.id });
  }

  // Sort column (server-side, persists)
  async function colSort(ci: number, ascending: boolean) {
    if (!activeSheet) return;
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/columns/sort`, {
        col_index: ci, ascending,
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setColMenu(null);
  }

  // Filter helpers
  function applyFilter(ci: number) {
    if (!filterVal.trim()) {
      removeFilter(ci);
      return;
    }
    setFilters((prev) => new Map(prev).set(ci, { operator: filterOp, value: filterVal }));
    setFilterEditCol(null);
    setColMenu(null);
  }
  function removeFilter(ci: number) {
    setFilters((prev) => { const m = new Map(prev); m.delete(ci); return m; });
    setFilterEditCol(null);
    setColMenu(null);
  }
  function openFilterEditor(ci: number) {
    const existing = filters.get(ci);
    setFilterOp(existing?.operator ?? "contains");
    setFilterVal(existing?.value ?? "");
    setFilterEditCol(ci);
    setColMenu(null);
  }

  // Compute filtered row indices (memoized for performance)
  const filteredRowIndices: number[] = useMemo(() => {
    if (!activeSheet) return [];
    const hiddenRows = new Set(activeSheet.sizes?.hiddenRows ?? []);
    const visible = activeSheet.rows
      .map((_, i) => i)
      .filter((i) => !hiddenRows.has(i));
    if (filters.size === 0) return visible;
    return visible.filter((ri) => {
      const row = activeSheet.rows[ri];
      for (const [ci, f] of filters) {
        const cell = (row[ci] ?? "").toLowerCase();
        const fv = f.value.toLowerCase();
        const colType = activeSheet.columns[ci]?.type ?? "text";
        if (colType === "number") {
          const num = parseFloat(cell);
          const fnum = parseFloat(fv);
          if (isNaN(num) || isNaN(fnum)) return false;
          if (f.operator === ">" && !(num > fnum)) return false;
          if (f.operator === "<" && !(num < fnum)) return false;
          if (f.operator === "=" && !(num === fnum)) return false;
          if (f.operator === "contains" && !cell.includes(fv)) return false;
        } else {
          if (f.operator === "contains" && !cell.includes(fv)) return false;
          if (f.operator === "=" && cell !== fv) return false;
          if (f.operator === ">" && !(cell > fv)) return false;
          if (f.operator === "<" && !(cell < fv)) return false;
        }
      }
      return true;
    });
  }, [activeSheet?.rows, activeSheet?.columns, activeSheet?.sizes?.hiddenRows, filters]);

  // Performance safeguards
  const totalRows = activeSheet?.rows.length ?? 0;
  const isLargeTable = totalRows > ROW_WARN_THRESHOLD;
  const aiDisabled = totalRows > ROW_AI_LIMIT;

  const {
    aiGenOpen, setAiGenOpen, aiGenPrompt, setAiGenPrompt, aiGenLoading, aiGenError, setAiGenError, aiGenRef, aiGenPreview, setAiGenPreview,
    generateSchema, confirmAiGenCreate, aiGenUpdateCol, aiGenRemoveCol, aiGenAddCol,
    aiFillOpen, setAiFillOpen, aiFillCol, setAiFillCol, aiFillInstruction, setAiFillInstruction,
    aiFilling, aiFillProgress, setAiFillProgress, aiFillErrors, aiFilledRows, aiFillInstructionRef,
    startAiFill, cancelAiFill,
    colToolClean, colToolNormalize, colToolCategorize,
    genRowsOpen, setGenRowsOpen, genRowsInstruction, setGenRowsInstruction,
    genRowsCount, setGenRowsCount, genRowsRunning, genRowsProgress, setGenRowsProgress, genRowsError, setGenRowsError,
    handleGenerateRows, cancelGenerateRows,
    aiOpOpen, setAiOpOpen, aiOpMode, setAiOpMode, aiOpSourceStr, setAiOpSourceStr,
    aiOpTargetStr, setAiOpTargetStr, aiOpInstruction, setAiOpInstruction,
    aiOpAction, setAiOpAction, aiOpLanguage, setAiOpLanguage,
    aiOpModel, setAiOpModel, aiOpTemp, setAiOpTemp, aiOpLoading,
    availableModels, activeEngine, runAiOp,
  } = useAiSheet({ activeSheet, setSheets, setActiveSheetId, setColMenu, aiDisabled, undoStacks, redoStacks, syncUndoRedoState, tuningParams });

  useEffect(() => {
    if (aiGenOpen && aiGenRef.current) aiGenRef.current.focus();
  }, [aiGenOpen]);

  // Auto-focus AI fill instruction
  useEffect(() => {
    if (aiFillOpen && aiFillInstructionRef.current) {
      aiFillInstructionRef.current.focus();
    }
  }, [aiFillOpen]);

  // Virtual window: only render ROW_RENDER_LIMIT rows around scroll position
  const visibleRowIndices = filteredRowIndices.length > ROW_RENDER_LIMIT
    ? filteredRowIndices.slice(scrollRowStart, scrollRowStart + ROW_RENDER_LIMIT)
    : filteredRowIndices;

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (filteredRowIndices.length <= ROW_RENDER_LIMIT) return;
    const el = e.currentTarget;
    // Use actual default row height (not hardcoded) — accounts for custom row heights
    const rowHeight = DEFAULT_ROW_HEIGHT + 1; // +1 for border
    const scrollTop = el.scrollTop;
    const newStart = Math.max(0, Math.floor(scrollTop / rowHeight) - 20); // 20-row buffer above
    if (Math.abs(newStart - scrollRowStart) > 10) {
      setScrollRowStart(Math.min(newStart, filteredRowIndices.length - ROW_RENDER_LIMIT));
    }
  }, [filteredRowIndices.length, scrollRowStart]);

  // Reset scroll position when switching sheets or filter changes
  useEffect(() => {
    setScrollRowStart(0);
  }, [activeSheetId, filters]);

  // Close sheet menu on outside click
  useEffect(() => {
    if (!sheetMenu) return;
    const close = () => setSheetMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [sheetMenu]);

  // Close column menu on outside click
  useEffect(() => {
    if (!colMenu) return;
    const close = () => setColMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [colMenu]);

  useEffect(() => {
    loadSheets();
  }, []);

  useEffect(() => {
    function onDataDeleted(e: Event) {
      const target = (e as CustomEvent).detail?.target;
      if (target === "sheets" || target === "all") {
        setSheets([]);
        setActiveSheetId(null);
        loadSheets();
      }
    }
    window.addEventListener("crowforge:data-deleted", onDataDeleted);
    return () => window.removeEventListener("crowforge:data-deleted", onDataDeleted);
  }, []);

  async function loadSheets() {
    try {
      const res = await axios.get(`${API_BASE}/sheets`);
      const loaded: Sheet[] = res.data;
      setSheets(loaded);
      // Auto-select the most recently opened sheet
      if (!activeSheetId && loaded.length > 0) {
        setActiveSheetId(loaded[0].id);
      }
    } catch {
      // backend offline
    }
  }

  async function createFromTemplate(template: SheetTemplate) {
    setTemplatePickerOpen(false);
    try {
      const res = await axios.post(`${API_BASE}/sheets`, {
        title: template.title,
        columns: template.columns,
        rows: template.rows,
        formats: template.formats ?? {},
      });
      const sheet: Sheet = res.data;
      setSheets((prev) => [sheet, ...prev]);
      setActiveSheetId(sheet.id);
    } catch {
      // ignore
    }
  }

  async function deleteSheet(id: string) {
    try {
      await axios.delete(`${API_BASE}/sheets/${id}`);
      setSheets((prev) => prev.filter((s) => s.id !== id));
      if (activeSheetId === id) {
        setActiveSheetId(null);
      }
    } catch {
      // ignore
    }
  }

  async function duplicateSheet(id: string) {
    try {
      const res = await axios.post(`${API_BASE}/sheets/${id}/duplicate`);
      const sheet: Sheet = res.data;
      setSheets((prev) => [sheet, ...prev]);
      setActiveSheetId(sheet.id);
    } catch { /* ignore */ }
  }

  function sheetRenameStart(id: string) {
    const sheet = sheets.find((s) => s.id === id);
    if (!sheet) return;
    setRenamingSheet(id);
    setRenameSheetValue(sheet.title);
    setSheetMenu(null);
  }

  async function sheetRenameCommit() {
    if (!renamingSheet || !renameSheetValue.trim()) {
      setRenamingSheet(null);
      return;
    }
    await updateTitle(renamingSheet, renameSheetValue.trim());
    setRenamingSheet(null);
  }

  async function updateTitle(id: string, title: string) {
    try {
      const res = await axios.put(`${API_BASE}/sheets/${id}/title`, { title });
      setSheets((prev) => prev.map((s) => (s.id === id ? res.data : s)));
    } catch {
      // ignore
    }
  }

  async function addColumn(id: string, name: string, type: string) {
    try {
      const res = await axios.post(`${API_BASE}/sheets/${id}/columns`, { name, type });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }


  async function addRow(id: string) {
    try {
      const res = await axios.post(`${API_BASE}/sheets/${id}/rows`);
      updateSheet(res.data);
    } catch { /* ignore */ }
  }

  function deleteRow(id: string, rowIndex: number) {
    setPendingDelete({ type: "row", index: rowIndex, sheetId: id });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { type, index, sheetId } = pendingDelete;
    setPendingDelete(null);
    try {
      if (type === "row") {
        const res = await axios.delete(`${API_BASE}/sheets/${sheetId}/rows`, { data: { row_index: index } });
        updateSheet(res.data);
      } else {
        const res = await axios.delete(`${API_BASE}/sheets/${sheetId}/columns`, { data: { col_index: index } });
        updateSheet(res.data);
      }
    } catch {
      toast(`Failed to delete ${type}.`, "error");
    }
  }

  function submitNewColumn() {
    if (!activeSheet || !newColName.trim()) return;
    addColumn(activeSheet.id, newColName.trim(), newColType);
    setNewColName("");
    setNewColType("text");
    setAddingColumn(false);
  }

  // ── Alignment helpers ──────────────────────────────────────────
  function getSelectionAlignment(): { h: string; v: string } {
    if (!activeSheet || !selection) return { h: 'left', v: 'top' };
    const key = `${selection.r1},${selection.c1}`;
    const val = activeSheet.alignments?.[key];
    if (!val) return { h: 'left', v: 'top' };
    const [h, v] = val.split(',');
    return { h: h || 'left', v: v || 'top' };
  }

  async function applyAlignment(axis: 'h' | 'v', value: string) {
    if (!activeSheet || !selection) return;
    const newAlignments = { ...(activeSheet.alignments ?? {}) };
    for (let r = selection.r1; r <= selection.r2; r++) {
      for (let c = selection.c1; c <= selection.c2; c++) {
        const key = `${r},${c}`;
        const existing = newAlignments[key] || 'left,top';
        const [h, v] = existing.split(',');
        if (axis === 'h') {
          const newVal = `${value},${v || 'top'}`;
          if (newVal === 'left,top') delete newAlignments[key];
          else newAlignments[key] = newVal;
        } else {
          const newVal = `${h || 'left'},${value}`;
          if (newVal === 'left,top') delete newAlignments[key];
          else newAlignments[key] = newVal;
        }
      }
    }
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/alignments`, { alignments: newAlignments });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }

  // ── Cell formatting helpers ────────────────────────────────────
  function getSelectionFormat(): CellFormat {
    if (!activeSheet || !selection) return {};
    const key = `${selection.r1},${selection.c1}`;
    return activeSheet.formats?.[key] ?? {};
  }

  async function applyFormat(patch: Partial<CellFormat>) {
    if (!activeSheet || !selection) return;
    const newFormats = { ...(activeSheet.formats ?? {}) };
    for (let r = selection.r1; r <= selection.r2; r++) {
      for (let c = selection.c1; c <= selection.c2; c++) {
        const key = `${r},${c}`;
        const existing: CellFormat = { ...(newFormats[key] ?? {}) };
        Object.assign(existing, patch);
        // Clean up falsy/default values
        if (!existing.b) delete existing.b;
        if (!existing.i) delete existing.i;
        if (!existing.tc) delete existing.tc;
        if (!existing.bg) delete existing.bg;
        if (existing.wrap !== false) delete existing.wrap;
        if (!existing.fs) delete existing.fs;
        if (Object.keys(existing).length === 0) delete newFormats[key];
        else newFormats[key] = existing;
      }
    }
    try {
      const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/formats`, { formats: newFormats });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }

  function toggleBold() {
    const cur = getSelectionFormat();
    applyFormat({ b: !cur.b });
  }

  function toggleItalic() {
    const cur = getSelectionFormat();
    applyFormat({ i: !cur.i });
  }

  function toggleStrikethrough() {
    const cur = getSelectionFormat();
    applyFormat({ s: !cur.s });
  }

  function toggleWrap() {
    const cur = getSelectionFormat();
    // wrap defaults to true (normal), toggling sets to false (nowrap)
    applyFormat({ wrap: cur.wrap === false ? undefined : false });
  }

  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState<'tc' | 'bg' | null>(null);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const close = () => setColorPickerOpen(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [colorPickerOpen]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const close = () => setExportOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [exportOpen]);

  // ---- Import ----
  async function handleImportFile(file: File) {
    if (validateImportFile(file, SHEET_IMPORT_EXTS)) return; // toast already fired
    setImporting(true);
    try {
      const parsed = await parseSheetImport(file);
      const created = await axios.post(`${API_BASE}/sheets`, { title: parsed.title, columns: [], rows: [] });
      const sheetId: string = created.data.id;
      const populated = await axios.put(`${API_BASE}/sheets/${sheetId}/data`, {
        columns: parsed.columns,
        rows: parsed.rows,
        formulas: parsed.formulas,
        sizes: parsed.sizes,
        alignments: {},
        formats: {},
      });
      const newSheet: Sheet = populated.data;
      setSheets((prev) => [...prev, newSheet]);
      setActiveSheetId(sheetId);
      toast(`"${parsed.title}" imported.`);
    } catch {
      toast("Import failed. Please check the file and try again.", "error");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleExport(format: SheetExportFormat) {
    setExportOpen(false);
    if (!activeSheet) return;
    await exportSheetAs(format, {
      title: activeSheet.title,
      columns: activeSheet.columns,
      rows: activeSheet.rows,
      formulas: activeSheet.formulas,
      colWidths,
      rowHeights,
      defaultColWidth: DEFAULT_COL_WIDTH,
      defaultRowHeight: DEFAULT_ROW_HEIGHT,
    });
  }

  async function handleExportAllXLSX() {
    if (sheets.length === 0) return;
    await exportAllSheetsXLSX(
      sheets.map((s) => ({
        title: s.title,
        columns: s.columns,
        rows: s.rows,
        formulas: s.formulas,
        colWidths: s.sizes?.colWidths ?? {},
        rowHeights: s.sizes?.rowHeights ?? {},
        defaultColWidth: DEFAULT_COL_WIDTH,
        defaultRowHeight: DEFAULT_ROW_HEIGHT,
      }))
    );
  }

  const pendingExt   = pendingFile ? pendingFile.name.split(".").pop()?.toLowerCase() ?? "" : "";
  const pendingLabel = pendingFile ? (IMPORT_FORMAT_LABELS[pendingExt] ?? pendingExt.toUpperCase()) : "";

  return (
    <div className="flex h-full relative" {...dragProps}>
      {/* Drag-over overlay */}
      {isDropDragging && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-lg pointer-events-none"
          style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", border: "2px dashed var(--primary)" }}>
          <Upload className="h-10 w-10 text-primary/60" />
          <p className="text-sm font-medium text-primary">Drop file to import</p>
          <p className="text-xs text-muted-foreground">{SHEET_IMPORT_EXTS.map((e) => `.${e}`).join("  ·  ")}</p>
        </div>
      )}

      {/* Drop-confirm dialog */}
      <Dialog open={!!pendingFile} onOpenChange={(o) => { if (!o) clearPending(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import file?</DialogTitle>
            <DialogDescription>
              A new sheet will be created from this file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 my-1">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{pendingFile?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{pendingLabel}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={clearPending}>Cancel</Button>
            <Button size="sm" onClick={confirmImport} disabled={importing}>
              {importing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheets sidebar */}
      <SheetSidebar
        sheets={sheets}
        activeSheetId={activeSheetId}
        setActiveSheetId={setActiveSheetId}
        renamingSheet={renamingSheet}
        setRenamingSheet={setRenamingSheet}
        renameSheetValue={renameSheetValue}
        setRenameSheetValue={setRenameSheetValue}
        renameSheetRef={renameSheetRef}
        sheetRenameCommit={sheetRenameCommit}
        setSheetMenu={setSheetMenu}
        setTemplatePickerOpen={setTemplatePickerOpen}
        setAiGenOpen={setAiGenOpen}
        importInputRef={importInputRef}
        handleImportFile={handleImportFile}
        importing={importing}
        handleExportAllXLSX={handleExportAllXLSX}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {activeSheet ? (
          <>
            {/* Title bar */}
            <div className="border-b px-4 py-2 flex items-center gap-3">
              <input
                value={activeSheet.title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setSheets((prev) =>
                    prev.map((s) =>
                      s.id === activeSheet.id ? { ...s, title: newTitle } : s
                    )
                  );
                }}
                onBlur={() => updateTitle(activeSheet.id, activeSheet.title)}
                className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                placeholder="Untitled sheet"
              />
              <span className="text-xs text-muted-foreground">
                {activeSheet.columns.length} cols, {filters.size > 0 ? `${filteredRowIndices.length}/${activeSheet.rows.length}` : activeSheet.rows.length} rows
              </span>
            </div>

            {/* Large table warning */}
            {isLargeTable && dismissedWarning !== activeSheet.id && (
              <div className="border-b px-4 py-1.5 bg-orange-500/10 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">
                  Large table ({totalRows.toLocaleString()} rows).
                  {aiDisabled ? " AI actions are disabled." : " Performance may be affected."}
                  {filteredRowIndices.length > ROW_RENDER_LIMIT && ` Showing ${ROW_RENDER_LIMIT} of ${filteredRowIndices.length} rows.`}
                </span>
                <button onClick={() => setDismissedWarning(activeSheet.id)} className="text-orange-600/60 hover:text-orange-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <SheetToolbar
              activeSheet={activeSheet}
              undoSheet={undoSheet}
              redoSheet={redoSheet}
              canUndo={canUndo}
              canRedo={canRedo}
              aiFilling={aiFilling}
              addRow={addRow}
              selection={selection}
              getSelectionFormat={getSelectionFormat}
              getSelectionAlignment={getSelectionAlignment}
              toggleBold={toggleBold}
              toggleItalic={toggleItalic}
              toggleStrikethrough={toggleStrikethrough}
              applyFormat={applyFormat}
              applyAlignment={applyAlignment}
              toggleWrap={toggleWrap}
              colorPickerOpen={colorPickerOpen}
              setColorPickerOpen={setColorPickerOpen}
              filters={filters}
              setFilters={setFilters}
              exportOpen={exportOpen}
              setExportOpen={setExportOpen}
              handleExport={handleExport}
              aiDisabled={aiDisabled}
              aiFillOpen={aiFillOpen}
              setAiFillOpen={setAiFillOpen}
              cancelAiFill={cancelAiFill}
              setAiOpTargetStr={setAiOpTargetStr}
              setAiOpMode={setAiOpMode}
              setAiOpSourceStr={setAiOpSourceStr}
              setAiOpOpen={setAiOpOpen}
              setGenRowsOpen={setGenRowsOpen}
              setGenRowsError={setGenRowsError}
              setGenRowsProgress={setGenRowsProgress}
              activeEngine={activeEngine}
              aiFillCol={aiFillCol}
              setAiFillCol={setAiFillCol}
              aiFillInstructionRef={aiFillInstructionRef}
              aiFillInstruction={aiFillInstruction}
              setAiFillInstruction={setAiFillInstruction}
              startAiFill={startAiFill}
              aiFillProgress={aiFillProgress}
              setAiFillProgress={setAiFillProgress}
              autoFitAllCols={autoFitAllCols}
              onOpenMultiSort={() => setMultiSortOpen(true)}
              onOpenCondFormat={() => setCondFormatOpen(true)}
              hasCondRules={(activeSheet.sizes?.condRules?.length ?? 0) > 0}
            />

            <FormulaBar
              activeSheet={activeSheet}
              selection={selection}
              editingCell={editingCell}
              editValue={editValue}
              editValueRef={editValueRef}
              setEditValue={setEditValue}
              setCellError={setCellError}
              commitEdit={commitEdit}
              cancelEdit={cancelEdit}
              startEditing={startEditing}
              setAiOpTargetStr={setAiOpTargetStr}
              setAiOpMode={setAiOpMode}
              setAiOpSourceStr={setAiOpSourceStr}
              setAiOpOpen={setAiOpOpen}
            />

            <SheetGrid
              activeSheet={activeSheet}
              selection={selection}
              editingCell={editingCell}
              editValue={editValue}
              editValueRef={editValueRef}
              setEditValue={setEditValue}
              cellError={cellError}
              setCellError={setCellError}
              colWidths={colWidths}
              rowHeights={rowHeights}
              filteredRowIndices={filteredRowIndices}
              visibleRowIndices={visibleRowIndices}
              scrollRowStart={scrollRowStart}
              filters={filters}
              isCellSelected={isCellSelected}
              handleCellMouseDown={handleCellMouseDown}
              handleCellMouseEnter={handleCellMouseEnter}
              handleMouseUp={handleMouseUp}
              handleGridScroll={handleGridScroll}
              startEditing={startEditing}
              commitEdit={commitEdit}
              cancelEdit={cancelEdit}
              pasteAtSelection={pasteAtSelection}
              copySelection={copySelection}
              cutSelection={cutSelection}
              clearSelectedCells={clearSelectedCells}
              toggleBold={toggleBold}
              toggleItalic={toggleItalic}
              toggleStrikethrough={toggleStrikethrough}
              undoSheet={undoSheet}
              redoSheet={redoSheet}
              aiFilling={aiFilling}
              selAnchor={selAnchor}
              setSelAnchor={setSelAnchor}
              selMoving={selMoving}
              setSelection={setSelection}
              makeRect={makeRect}
              aiFillCol={aiFillCol}
              aiFilledRows={aiFilledRows}
              aiFillErrors={aiFillErrors}
              aiOpOpen={aiOpOpen}
              aiOpSourceStr={aiOpSourceStr}
              aiOpTargetStr={aiOpTargetStr}
              aiOpMode={aiOpMode}
              updateSheet={updateSheet}
              deleteRow={deleteRow}
              setColMenu={setColMenu}
              setRowMenu={setRowMenu}
              setCellMenu={setCellMenu}
              renamingCol={renamingCol}
              setRenamingCol={setRenamingCol}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              renameRef={renameRef}
              colRenameCommit={colRenameCommit}
              addingColumn={addingColumn}
              setAddingColumn={setAddingColumn}
              newColName={newColName}
              setNewColName={setNewColName}
              setNewColType={setNewColType}
              colNameRef={colNameRef}
              submitNewColumn={submitNewColumn}
              setResizing={setResizing}
              setColWidths={setColWidths}
              cellInputRef={cellInputRef}
              gridRef={gridRef}
              fillDown={fillDown}
              fillRight={fillRight}
              hiddenCols={new Set(activeSheet.sizes?.hiddenCols ?? [])}
              onUnhideCol={unhideCol}
              onUnhideRows={unhideRows}
              findMatches={findMatches}
              findCurrentKey={findCurrentKey}
              onFindOpen={() => setFindOpen(true)}
              pasteValuesOnly={pasteValuesOnly}
              autoFitAllCols={autoFitAllCols}
              fillDragExecute={fillDragExecute}
              toggleFreezeCol={toggleFreezeCol}
              toggleFreezeRow={toggleFreezeRow}
            />
            {findOpen && (
              <FindBar
                query={findQuery}
                onQueryChange={setFindQuery}
                onClose={() => { setFindOpen(false); setFindQuery(""); setReplaceQuery(""); }}
                onNext={findNext}
                onPrev={findPrev}
                resultCount={findResults.length}
                currentIndex={Math.min(findIndex, Math.max(0, findResults.length - 1))}
                replaceQuery={replaceQuery}
                onReplaceQueryChange={setReplaceQuery}
                onReplace={replaceOne}
                onReplaceAll={replaceAll}
                replaceCount={replaceCount}
              />
            )}
            {multiSortOpen && (
              <MultiSortDialog
                sheet={activeSheet}
                onApply={applyMultiSort}
                onClose={() => setMultiSortOpen(false)}
              />
            )}
            {condFormatOpen && (
              <CondFormatDialog
                sheet={activeSheet}
                rules={activeSheet.sizes?.condRules ?? []}
                onSave={saveCondRules}
                onClose={() => setCondFormatOpen(false)}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Table2 className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">No sheet selected</p>
            <p className="text-xs mt-1 mb-4">Create a new sheet from a template or generate with AI.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTemplatePickerOpen(true)}>
                <LayoutTemplate className="h-3.5 w-3.5" />
                From Template
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAiGenOpen(true)}>
                <Sparkles className="h-3.5 w-3.5" />
                Generate with AI
              </Button>
            </div>
          </div>
        )}
      </div>

      <SheetContextMenus
        sheetMenu={sheetMenu}
        setSheetMenu={setSheetMenu}
        sheetRenameStart={sheetRenameStart}
        duplicateSheet={duplicateSheet}
        deleteSheet={deleteSheet}
        colMenu={colMenu}
        colRenameStart={colRenameStart}
        colInsertAt={colInsertAt}
        colMoveLeft={colMoveLeft}
        colMoveRight={colMoveRight}
        colSort={colSort}
        openFilterEditor={openFilterEditor}
        filters={filters}
        removeFilter={removeFilter}
        colDelete={colDelete}
        colToolClean={colToolClean}
        colToolNormalize={colToolNormalize}
        colToolCategorize={colToolCategorize}
        aiDisabled={aiDisabled}
        aiFilling={aiFilling}
        activeSheet={activeSheet}
        filterEditCol={filterEditCol}
        setFilterEditCol={setFilterEditCol}
        filterOp={filterOp}
        setFilterOp={setFilterOp}
        filterVal={filterVal}
        setFilterVal={setFilterVal}
        applyFilter={applyFilter}
        cellMenu={cellMenu}
        setCellMenu={setCellMenu}
        explainFormula={explainFormula}
        setAiOpSourceStr={setAiOpSourceStr}
        setAiOpTargetStr={setAiOpTargetStr}
        setAiOpMode={setAiOpMode}
        setAiOpOpen={setAiOpOpen}
        formulaExplanation={formulaExplanation}
        setFormulaExplanation={setFormulaExplanation}
        gridRef={gridRef}
        rowMenu={rowMenu}
        setRowMenu={setRowMenu}
        rowInsertAbove={rowInsertAbove}
        rowInsertBelow={rowInsertBelow}
        rowDuplicate={rowDuplicate}
        rowDelete={rowDelete}
        hideRow={hideRow}
        colHide={hideCol}
        rowHeights={rowHeights}
        setRowHeights={setRowHeights}
        setSheets={setSheets}
        activeSheetId={activeSheetId}
        pendingDelete={pendingDelete}
        setPendingDelete={setPendingDelete}
        confirmDelete={confirmDelete}
      />

      <SheetDialogs
        templatePickerOpen={templatePickerOpen}
        setTemplatePickerOpen={setTemplatePickerOpen}
        createFromTemplate={createFromTemplate}
        aiGenOpen={aiGenOpen}
        setAiGenOpen={setAiGenOpen}
        aiGenPrompt={aiGenPrompt}
        setAiGenPrompt={setAiGenPrompt}
        aiGenLoading={aiGenLoading}
        aiGenError={aiGenError}
        setAiGenError={setAiGenError}
        aiGenRef={aiGenRef}
        aiGenPreview={aiGenPreview}
        setAiGenPreview={setAiGenPreview}
        generateSchema={generateSchema}
        confirmAiGenCreate={confirmAiGenCreate}
        aiGenUpdateCol={aiGenUpdateCol}
        aiGenRemoveCol={aiGenRemoveCol}
        aiGenAddCol={aiGenAddCol}
        aiOpOpen={aiOpOpen}
        setAiOpOpen={setAiOpOpen}
        aiOpMode={aiOpMode}
        setAiOpMode={setAiOpMode}
        aiOpSourceStr={aiOpSourceStr}
        setAiOpSourceStr={setAiOpSourceStr}
        aiOpTargetStr={aiOpTargetStr}
        setAiOpTargetStr={setAiOpTargetStr}
        aiOpInstruction={aiOpInstruction}
        setAiOpInstruction={setAiOpInstruction}
        aiOpAction={aiOpAction}
        setAiOpAction={setAiOpAction}
        aiOpLanguage={aiOpLanguage}
        setAiOpLanguage={setAiOpLanguage}
        aiOpModel={aiOpModel}
        setAiOpModel={setAiOpModel}
        aiOpTemp={aiOpTemp}
        setAiOpTemp={setAiOpTemp}
        aiOpLoading={aiOpLoading}
        availableModels={availableModels}
        runAiOp={runAiOp}
        selection={selection}
        genRowsOpen={genRowsOpen}
        setGenRowsOpen={setGenRowsOpen}
        genRowsInstruction={genRowsInstruction}
        setGenRowsInstruction={setGenRowsInstruction}
        genRowsCount={genRowsCount}
        setGenRowsCount={setGenRowsCount}
        genRowsRunning={genRowsRunning}
        genRowsProgress={genRowsProgress}
        genRowsError={genRowsError}
        handleGenerateRows={handleGenerateRows}
        cancelGenerateRows={cancelGenerateRows}
      />
    </div>
  );
}
