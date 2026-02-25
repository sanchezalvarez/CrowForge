import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { PlusCircle, Table2, Trash2, Plus, X, AlertCircle, Sparkles, Square, Loader2, LayoutTemplate, FileSpreadsheet, ListTodo, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Copy, Pencil, Filter, Eraser, Tags, ListChecks, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Bold, Italic, Paintbrush, Type, WrapText, RotateCcw, Upload, Download, ChevronDown, DollarSign, BarChart2, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { cn } from "../lib/utils";
import { toast } from "../hooks/useToast";
import { useDropImport, IMPORT_FORMAT_LABELS } from "../hooks/useDropImport";
import {
  validateImportFile,
  parseSheetImport,
  exportSheetAs,
  exportAllSheetsXLSX,
  SHEET_IMPORT_ACCEPT,
  SHEET_IMPORT_EXTS,
  SHEET_EXPORT_FORMATS,
  type SheetExportFormat,
} from "../lib/fileService";

const API_BASE = "http://127.0.0.1:8000";

interface SheetTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Table2;
  title: string;
  columns: { name: string; type: string }[];
  rows: string[][];
}

const SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Empty sheet, start from scratch",
    icon: Table2,
    title: "Untitled Sheet",
    columns: [],
    rows: [],
  },
  {
    id: "grid",
    name: "Grid",
    description: "Columns A–F with 30 empty rows, ready for data",
    icon: LayoutTemplate,
    title: "Sheet 1",
    columns: [
      { name: "A", type: "text" },
      { name: "B", type: "text" },
      { name: "C", type: "text" },
      { name: "D", type: "text" },
      { name: "E", type: "text" },
      { name: "F", type: "text" },
    ],
    rows: Array.from({ length: 30 }, () => ["", "", "", "", "", ""]),
  },
  {
    id: "crm",
    name: "Simple CRM",
    description: "Track contacts and deals",
    icon: FileSpreadsheet,
    title: "CRM",
    columns: [
      { name: "Name", type: "text" },
      { name: "Email", type: "text" },
      { name: "Status", type: "text" },
      { name: "Notes", type: "text" },
    ],
    rows: [
      ["Jane Cooper", "jane@example.com", "Lead", "Interested in premium plan"],
      ["John Smith", "john@example.com", "Customer", "Renewed last month"],
      ["Emily Davis", "emily@example.com", "Prospect", "Follow up next week"],
    ],
  },
  {
    id: "tasks",
    name: "Task List",
    description: "Manage tasks and deadlines",
    icon: ListTodo,
    title: "Tasks",
    columns: [
      { name: "Task", type: "text" },
      { name: "Priority", type: "text" },
      { name: "Status", type: "text" },
      { name: "Due Date", type: "date" },
      { name: "Done", type: "boolean" },
    ],
    rows: [
      ["Design mockups", "High", "In Progress", "2025-06-15", "false"],
      ["Write documentation", "Medium", "Todo", "2025-06-20", "false"],
      ["Review pull requests", "Low", "Done", "2025-06-10", "true"],
    ],
  },
  {
    id: "budget",
    name: "Budget",
    description: "Monthly income and expense tracker",
    icon: DollarSign,
    title: "Monthly Budget",
    columns: [
      { name: "Category", type: "text" },
      { name: "Type", type: "text" },
      { name: "Planned", type: "number" },
      { name: "Actual", type: "number" },
      { name: "Difference", type: "number" },
      { name: "Notes", type: "text" },
    ],
    rows: [
      ["Salary", "Income", "5000", "5000", "0", ""],
      ["Freelance", "Income", "500", "750", "250", "Extra project"],
      ["Rent", "Expense", "1200", "1200", "0", ""],
      ["Groceries", "Expense", "400", "380", "-20", ""],
      ["Utilities", "Expense", "150", "165", "15", "Higher this month"],
      ["Transport", "Expense", "100", "90", "-10", ""],
      ["Entertainment", "Expense", "200", "240", "40", "Concert tickets"],
      ["Savings", "Expense", "500", "500", "0", ""],
    ],
  },
  {
    id: "weekly-planner",
    name: "Weekly Planner",
    description: "Plan your week day by day",
    icon: BarChart2,
    title: "Weekly Planner",
    columns: [
      { name: "Time", type: "text" },
      { name: "Monday", type: "text" },
      { name: "Tuesday", type: "text" },
      { name: "Wednesday", type: "text" },
      { name: "Thursday", type: "text" },
      { name: "Friday", type: "text" },
      { name: "Weekend", type: "text" },
    ],
    rows: [
      ["08:00", "", "", "", "", "", ""],
      ["09:00", "", "", "", "", "", ""],
      ["10:00", "", "", "", "", "", ""],
      ["11:00", "", "", "", "", "", ""],
      ["12:00", "Lunch", "Lunch", "Lunch", "Lunch", "Lunch", ""],
      ["13:00", "", "", "", "", "", ""],
      ["14:00", "", "", "", "", "", ""],
      ["15:00", "", "", "", "", "", ""],
      ["16:00", "", "", "", "", "", ""],
      ["17:00", "", "", "", "", "", ""],
      ["18:00", "", "", "", "", "", ""],
      ["19:00", "", "", "", "", "", ""],
    ],
  },
];

interface SheetColumn {
  name: string;
  type: string;
}

interface SheetSizes {
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
}

interface CellFormat {
  b?: boolean;   // bold
  i?: boolean;   // italic
  tc?: string;   // text color hex
  bg?: string;   // background color hex
  wrap?: boolean; // false = nowrap (default true = wrap)
}

interface Sheet {
  id: string;
  title: string;
  columns: SheetColumn[];
  rows: string[][];
  formulas: Record<string, string>; // {"row,col": "=A1+B2"}
  sizes: SheetSizes;
  alignments: Record<string, string>; // {"row,col": "center,middle"}
  formats: Record<string, CellFormat>; // {"row,col": {b,i,tc,bg,wrap}}
  created_at: string;
  updated_at: string;
}

const DEFAULT_COL_WIDTH = 120;
const DEFAULT_ROW_HEIGHT = 28;
const MIN_COL_WIDTH = 50;
const MIN_ROW_HEIGHT = 20;

// Colors for formula reference highlighting (per-range, cycled)
const REF_COLORS = [
  { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.5)', text: '#3b82f6' },   // blue
  { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)', text: '#ef4444' },      // red
  { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.5)', text: '#22c55e' },      // green
  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.5)', text: '#a855f7' },    // purple
  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.5)', text: '#f97316' },    // orange
  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.5)', text: '#ec4899' },    // pink
];

type RefGroup = { cells: string[]; colorIdx: number; token: string; start: number; end: number };

// Parse formula refs into groups with color indices and token positions
function parseFormulaRefGroups(formula: string, numRows: number, numCols: number): RefGroup[] {
  if (!formula.startsWith("=")) return [];
  const groups: RefGroup[] = [];
  const re = /([A-Z]{1,2})(\d+)(?::([A-Z]{1,2})(\d+))?/gi;
  let m: RegExpExecArray | null;
  let colorIdx = 0;
  while ((m = re.exec(formula)) !== null) {
    const cells: string[] = [];
    const colStart = colLetterToIndex(m[1]);
    const rowStart = parseInt(m[2], 10) - 1;
    if (m[3] && m[4]) {
      const colEnd = colLetterToIndex(m[3]);
      const rowEnd = parseInt(m[4], 10) - 1;
      for (let r = Math.min(rowStart, rowEnd); r <= Math.max(rowStart, rowEnd); r++) {
        for (let c = Math.min(colStart, colEnd); c <= Math.max(colStart, colEnd); c++) {
          if (r >= 0 && r < numRows && c >= 0 && c < numCols) cells.push(`${r},${c}`);
        }
      }
    } else {
      if (rowStart >= 0 && rowStart < numRows && colStart >= 0 && colStart < numCols) {
        cells.push(`${rowStart},${colStart}`);
      }
    }
    if (cells.length > 0) {
      groups.push({ cells, colorIdx: colorIdx % REF_COLORS.length, token: m[0], start: m.index, end: m.index + m[0].length });
      colorIdx++;
    }
  }
  return groups;
}

function colLetterToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
  }
  return idx - 1;
}

function resolveCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  if (isNaN(row) || isNaN(col) || row < 0 || col < 0) return null;
  return { row, col };
}

function resolveRange(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const parts = ref.split(":");
  if (parts.length === 1) {
    const res = resolveCellRef(parts[0]);
    if (!res) return null;
    return { r1: res.row, c1: res.col, r2: res.row, c2: res.col };
  }
  if (parts.length === 2) {
    const res1 = resolveCellRef(parts[0]);
    const res2 = resolveCellRef(parts[1]);
    if (!res1 || !res2) return null;
    return {
      r1: Math.min(res1.row, res2.row),
      c1: Math.min(res1.col, res2.col),
      r2: Math.max(res1.row, res2.row),
      c2: Math.max(res1.col, res2.col),
    };
  }
  return null;
}

const idxToCol = (i: number) => { 
  let r="",n=i+1; 
  while(n>0){const m=(n-1)%26;r=String.fromCharCode(65+m)+r;n=Math.floor((n-1)/26);}
  return r; 
};

const ROW_WARN_THRESHOLD = 5000;   // show warning banner
const ROW_AI_LIMIT = 10000;        // disable AI actions
const ROW_RENDER_LIMIT = 500;      // max rows rendered at once (virtual window)

import type { TuningParams } from "../components/AIControlPanel";

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
  const cellInputRef = useRef<HTMLInputElement>(null);
  const [cellError, setCellError] = useState<string | null>(null);

  // Undo / Redo — per-sheet snapshot stacks (local only, max 50)
  const MAX_HISTORY = 50;
  type SheetSnapshot = { columns: SheetColumn[]; rows: string[][]; formulas: Record<string, string>; sizes: SheetSizes; alignments: Record<string, string>; formats: Record<string, CellFormat> };
  const undoStacks = useRef<Map<string, SheetSnapshot[]>>(new Map());
  const redoStacks = useRef<Map<string, SheetSnapshot[]>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const skipHistory = useRef(false); // flag to skip pushing history during undo/redo restore

  // Multi-cell selection: normalized rectangle {r1<=r2, c1<=c2}
  // Per-table selection preservation
  type SelectionRect = { r1: number; c1: number; r2: number; c2: number };
  type AnchorPoint = { row: number; col: number };
  const selectionMap = useRef<Map<string, { sel: SelectionRect | null; anchor: AnchorPoint | null }>>(new Map());
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [selAnchor, setSelAnchor] = useState<AnchorPoint | null>(null);
  const selMoving = useRef<AnchorPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  // AI Generate state (two-phase: prompt → preview → create)
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiGenPrompt, setAiGenPrompt] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const aiGenRef = useRef<HTMLInputElement>(null);
  const [aiGenPreview, setAiGenPreview] = useState<{ title: string; columns: { name: string; type: string }[] } | null>(null);

  // AI Fill state
  const [aiFillOpen, setAiFillOpen] = useState(false);
  const [aiFillCol, setAiFillCol] = useState<number>(0);
  const [aiFillInstruction, setAiFillInstruction] = useState("");
  const [aiFilling, setAiFilling] = useState(false);
  const [aiFillProgress, setAiFillProgress] = useState<string | null>(null);
  const [aiFillErrors, setAiFillErrors] = useState<Map<number, string>>(new Map());
  const [aiFilledRows, setAiFilledRows] = useState<Set<number>>(new Set());
  const aiFillRef = useRef<EventSource | null>(null);
  const aiFillInstructionRef = useRef<HTMLInputElement>(null);

  // AI Operation state
  const [aiOpOpen, setAiOpOpen] = useState(false);
  const [aiOpMode, setAiOpMode] = useState<"row-wise" | "aggregate" | "matrix">("row-wise");
  const [aiOpSourceStr, setAiOpSourceStr] = useState("");
  const [aiOpTargetStr, setAiOpTargetStr] = useState("");
  const [aiOpInstruction, setAiOpInstruction] = useState("");
  const [aiOpAction, setAiOpAction] = useState<"translate" | "rewrite" | "summarize" | "custom">("translate");
  const [aiOpLanguage, setAiOpLanguage] = useState("Slovak");
  const [aiOpModel, setAiOpModel] = useState<string>("");
  const [aiOpTemp, setAiOpTemp] = useState(0.7);
  const [aiOpLoading, setAiOpLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<{name: string, id: string}[]>([]);

  const [activeEngine, setActiveEngine] = useState<string>("mock");

  // Load models on mount
  useEffect(() => {
    axios.get(`${API_BASE}/ai/engines`).then(res => {
      const active = (res.data as { name: string; active: boolean }[]).find(e => e.active);
      if (active) setActiveEngine(active.name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/ai/models`).then(res => {
      // res.data.models is a list of {filename, ...}
      // backend/app.py: _scan_local_models returns dicts
      const models = res.data.models.map((m: any) => ({ name: m.filename, id: m.filename }));
      setAvailableModels(models);
      if (models.length > 0) setAiOpModel(models[0].id);
    }).catch(() => {});
  }, []);

  // Column/row resize state
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [resizing, setResizing] = useState<{ type: 'col' | 'row'; index: number; startPos: number; startSize: number } | null>(null);

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
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      if (resizing.type === 'col') {
        const newW = Math.max(MIN_COL_WIDTH, resizing.startSize + (e.clientX - resizing.startPos));
        setColWidths(prev => ({ ...prev, [resizing.index]: newW }));
      } else {
        const newH = Math.max(MIN_ROW_HEIGHT, resizing.startSize + (e.clientY - resizing.startPos));
        setRowHeights(prev => ({ ...prev, [resizing.index]: newH }));
      }
    };
    const onUp = () => {
      // Persist sizes to backend using refs for latest values
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
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
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

  useEffect(() => {
    if (aiGenOpen && aiGenRef.current) aiGenRef.current.focus();
  }, [aiGenOpen]);

  // Auto-focus AI fill instruction
  useEffect(() => {
    if (aiFillOpen && aiFillInstructionRef.current) {
      aiFillInstructionRef.current.focus();
    }
  }, [aiFillOpen]);

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
    setEditingCell({ row: ri, col: ci });
    setEditValue(formula ?? currentValue);
    setSelection({ r1: ri, c1: ci, r2: ri, c2: ci });
    setSelAnchor({ row: ri, col: ci });
  }, [activeSheet]);

  const commitEdit = useCallback(async () => {
    if (!editingCell || !activeSheet) return;
    const { row, col } = editingCell;
    const original = activeSheet.rows[row]?.[col] ?? "";
    if (editValue !== original) {
      try {
        const res = await axios.put(`${API_BASE}/sheets/${activeSheet.id}/cell`, {
          row_index: row,
          col_index: col,
          value: editValue,
        });
        updateSheet(res.data);
        setCellError(null);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        setCellError(detail || "Invalid value");
        return; // keep editing open on error
      }
    }
    setEditingCell(null);
    setCellError(null);
  }, [editingCell, editValue, activeSheet]);

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
  }, [editingCell, commitEdit, selAnchor, makeRect]);

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

  const copySelection = useCallback(() => {
    if (!selection || !activeSheet) return;
    copyOrigin.current = { r1: selection.r1, c1: selection.c1 };
    const rows: string[] = [];
    for (let ri = selection.r1; ri <= selection.r2; ri++) {
      const cols: string[] = [];
      for (let ci = selection.c1; ci <= selection.c2; ci++) {
        // Copy formula text if cell has one, otherwise the displayed value
        const formulaKey = `${ri},${ci}`;
        const formula = activeSheet.formulas?.[formulaKey];
        cols.push(formula ?? (activeSheet.rows[ri]?.[ci] ?? ""));
      }
      rows.push(cols.join("\t"));
    }
    navigator.clipboard.writeText(rows.join("\n"));
  }, [selection, activeSheet]);

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
    const data = clipText.split(/\r?\n/).filter((line) => line.length > 0).map((line) => line.split("\t"));
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

  // Row context menu operations
  async function rowInsertAbove(ri: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/rows/insert`, { row_index: ri });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setRowMenu(null);
  }
  async function rowInsertBelow(ri: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/rows/insert`, { row_index: ri + 1 });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setRowMenu(null);
  }
  async function rowDuplicate(ri: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets/${activeSheet.id}/rows/duplicate`, { row_index: ri });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setRowMenu(null);
  }
  async function rowDelete(ri: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.delete(`${API_BASE}/sheets/${activeSheet.id}/rows`, { data: { row_index: ri } });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setRowMenu(null);
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
  async function colDelete(ci: number) {
    if (!activeSheet) return;
    try {
      const res = await axios.delete(`${API_BASE}/sheets/${activeSheet.id}/columns`, {
        data: { col_index: ci },
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
    setColMenu(null);
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

  // Compute filtered row indices
  const filteredRowIndices: number[] = (() => {
    if (!activeSheet || filters.size === 0) return activeSheet?.rows.map((_, i) => i) ?? [];
    return activeSheet.rows.reduce<number[]>((acc, row, ri) => {
      for (const [ci, f] of filters) {
        const cell = (row[ci] ?? "").toLowerCase();
        const fv = f.value.toLowerCase();
        const colType = activeSheet.columns[ci]?.type ?? "text";
        if (colType === "number") {
          const num = parseFloat(cell);
          const fnum = parseFloat(fv);
          if (isNaN(num) || isNaN(fnum)) return acc;
          if (f.operator === ">" && !(num > fnum)) return acc;
          if (f.operator === "<" && !(num < fnum)) return acc;
          if (f.operator === "=" && !(num === fnum)) return acc;
          if (f.operator === "contains" && !cell.includes(fv)) return acc;
        } else {
          if (f.operator === "contains" && !cell.includes(fv)) return acc;
          if (f.operator === "=" && cell !== fv) return acc;
          if (f.operator === ">" && !(cell > fv)) return acc;
          if (f.operator === "<" && !(cell < fv)) return acc;
        }
      }
      acc.push(ri);
      return acc;
    }, []);
  })();

  // Performance safeguards
  const totalRows = activeSheet?.rows.length ?? 0;
  const isLargeTable = totalRows > ROW_WARN_THRESHOLD;
  const aiDisabled = totalRows > ROW_AI_LIMIT;

  // Virtual window: only render ROW_RENDER_LIMIT rows around scroll position
  const visibleRowIndices = filteredRowIndices.length > ROW_RENDER_LIMIT
    ? filteredRowIndices.slice(scrollRowStart, scrollRowStart + ROW_RENDER_LIMIT)
    : filteredRowIndices;

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (filteredRowIndices.length <= ROW_RENDER_LIMIT) return;
    const el = e.currentTarget;
    const rowHeight = 29; // approximate row height in px
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

  async function loadSheets() {
    try {
      const res = await axios.get(`${API_BASE}/sheets`);
      setSheets(res.data);
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

  function syncUndoRedoState(sheetId: string) {
    setCanUndo((undoStacks.current.get(sheetId)?.length ?? 0) > 0);
    setCanRedo((redoStacks.current.get(sheetId)?.length ?? 0) > 0);
  }

  function updateSheet(updated: Sheet) {
    // Push previous state to undo stack (unless we're restoring from undo/redo)
    if (!skipHistory.current) {
      const prev = sheets.find((s) => s.id === updated.id);
      if (prev) {
        const stack = undoStacks.current.get(updated.id) ?? [];
        stack.push({ columns: prev.columns, rows: prev.rows, formulas: prev.formulas ?? {}, sizes: prev.sizes ?? {}, alignments: prev.alignments ?? {}, formats: prev.formats ?? {} });
        if (stack.length > MAX_HISTORY) stack.shift();
        undoStacks.current.set(updated.id, stack);
        // Clear redo on new action
        redoStacks.current.set(updated.id, []);
        syncUndoRedoState(updated.id);
      }
    }
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function undoSheet() {
    if (!activeSheet) return;
    const stack = undoStacks.current.get(activeSheet.id);
    if (!stack || stack.length === 0) return;
    const snapshot = stack.pop()!;
    // Push current state to redo
    const redoStack = redoStacks.current.get(activeSheet.id) ?? [];
    redoStack.push({ columns: activeSheet.columns, rows: activeSheet.rows, formulas: activeSheet.formulas ?? {}, sizes: activeSheet.sizes ?? {}, alignments: activeSheet.alignments ?? {}, formats: activeSheet.formats ?? {} });
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    redoStacks.current.set(activeSheet.id, redoStack);
    // Restore via API
    skipHistory.current = true;
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
    syncUndoRedoState(activeSheet.id);
  }

  async function redoSheet() {
    if (!activeSheet) return;
    const stack = redoStacks.current.get(activeSheet.id);
    if (!stack || stack.length === 0) return;
    const snapshot = stack.pop()!;
    // Push current state to undo
    const undoStack = undoStacks.current.get(activeSheet.id) ?? [];
    undoStack.push({ columns: activeSheet.columns, rows: activeSheet.rows, formulas: activeSheet.formulas ?? {}, sizes: activeSheet.sizes ?? {}, alignments: activeSheet.alignments ?? {}, formats: activeSheet.formats ?? {} });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    undoStacks.current.set(activeSheet.id, undoStack);
    // Restore via API
    skipHistory.current = true;
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
    syncUndoRedoState(activeSheet.id);
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

  async function deleteRow(id: string, rowIndex: number) {
    try {
      const res = await axios.delete(`${API_BASE}/sheets/${id}/rows`, {
        data: { row_index: rowIndex },
      });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }

  function submitNewColumn() {
    if (!activeSheet || !newColName.trim()) return;
    addColumn(activeSheet.id, newColName.trim(), newColType);
    setNewColName("");
    setNewColType("text");
    setAddingColumn(false);
  }

  async function generateSchema() {
    if (!aiGenPrompt.trim()) return;
    setAiGenLoading(true);
    setAiGenError(null);
    setAiGenPreview(null);
    try {
      const res = await axios.post(`${API_BASE}/sheets/ai-schema`, {
        prompt: aiGenPrompt.trim(),
        temperature: tuningParams?.temperature,
        max_tokens: tuningParams?.maxTokens,
      });
      setAiGenPreview(res.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setAiGenError(detail || "Failed to generate schema");
    } finally {
      setAiGenLoading(false);
    }
  }

  async function confirmAiGenCreate() {
    if (!aiGenPreview) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets`, {
        title: aiGenPreview.title,
        columns: aiGenPreview.columns,
        rows: [],
      });
      const sheet: Sheet = res.data;
      setSheets((prev) => [sheet, ...prev]);
      setActiveSheetId(sheet.id);
      setAiGenPrompt("");
      setAiGenPreview(null);
      setAiGenOpen(false);
    } catch {
      // ignore
    }
  }

  function aiGenUpdateCol(idx: number, field: "name" | "type", value: string) {
    if (!aiGenPreview) return;
    const cols = [...aiGenPreview.columns];
    cols[idx] = { ...cols[idx], [field]: value };
    setAiGenPreview({ ...aiGenPreview, columns: cols });
  }

  function aiGenRemoveCol(idx: number) {
    if (!aiGenPreview) return;
    setAiGenPreview({ ...aiGenPreview, columns: aiGenPreview.columns.filter((_, i) => i !== idx) });
  }

  function aiGenAddCol() {
    if (!aiGenPreview) return;
    setAiGenPreview({ ...aiGenPreview, columns: [...aiGenPreview.columns, { name: "New Column", type: "text" }] });
  }

  function runAiFillStream(colIndex: number, instruction: string, label?: string) {
    if (!activeSheet || aiDisabled) return;
    // Push snapshot before AI fill modifies cells (AI fill bypasses updateSheet)
    const stack = undoStacks.current.get(activeSheet.id) ?? [];
    stack.push({ columns: activeSheet.columns, rows: activeSheet.rows, formulas: activeSheet.formulas ?? {}, sizes: activeSheet.sizes ?? {}, alignments: activeSheet.alignments ?? {}, formats: activeSheet.formats ?? {} });
    if (stack.length > MAX_HISTORY) stack.shift();
    undoStacks.current.set(activeSheet.id, stack);
    redoStacks.current.set(activeSheet.id, []);
    syncUndoRedoState(activeSheet.id);
    setAiFilling(true);
    setAiFillProgress("Starting...");
    setAiFillErrors(new Map());
    setAiFilledRows(new Set());

    const params = new URLSearchParams({
      col_index: String(colIndex),
      instruction,
    });
    if (tuningParams?.temperature !== undefined) params.set("temperature", String(tuningParams.temperature));
    if (tuningParams?.maxTokens !== undefined) params.set("max_tokens", String(tuningParams.maxTokens));
    const es = new EventSource(`${API_BASE}/sheets/${activeSheet.id}/ai-fill?${params}`);
    aiFillRef.current = es;

    let filledCount = 0;

    es.onmessage = (event) => {
      const data = event.data;
      if (data === "[DONE]") {
        es.close();
        aiFillRef.current = null;
        setAiFilling(false);
        setAiFillProgress(`Done — ${label ? label.toLowerCase() + ": " : "filled "}${filledCount} cells`);
        return;
      }
      try {
        const msg = JSON.parse(data);
        if (msg.type === "cell") {
          filledCount++;
          setAiFillProgress(`${label ?? "Filling"} row ${msg.row + 1}...`);
          setAiFilledRows((prev) => new Set(prev).add(msg.row));
          setSheets((prev) =>
            prev.map((s) => {
              if (s.id !== activeSheet.id) return s;
              const newRows = s.rows.map((r, ri) => {
                if (ri !== msg.row) return r;
                const nr = [...r];
                nr[msg.col] = msg.value;
                return nr;
              });
              return { ...s, rows: newRows };
            })
          );
        } else if (msg.type === "error") {
          setAiFillErrors((prev) => new Map(prev).set(msg.row, msg.error));
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      aiFillRef.current = null;
      setAiFilling(false);
      setAiFillProgress("Connection lost");
    };
  }

  function startAiFill() {
    if (!aiFillInstruction.trim()) return;
    runAiFillStream(aiFillCol, aiFillInstruction.trim());
  }

  async function runAiOp() {
    if (!activeSheet) return;

    if (!aiOpSourceStr.trim() || !aiOpTargetStr.trim()) {
      toast("Please specify both source and target cell references.", "error");
      return;
    }

    let finalInstruction = aiOpInstruction.trim();
    if (aiOpAction === "translate") {
      finalInstruction = `Translate to ${aiOpLanguage}`;
    } else if (aiOpAction === "rewrite") {
      finalInstruction = "Rewrite this text to be clearer and more professional.";
    } else if (aiOpAction === "summarize") {
      finalInstruction = "Summarize this text concisely.";
    }

    if (!finalInstruction) {
      toast("Please provide an instruction or prompt.", "error");
      return;
    }

    const source = resolveRange(aiOpSourceStr);
    const target = resolveCellRef(aiOpTargetStr);

    if (!source || !target) {
      toast("Invalid source or target cell reference format (e.g. A1 or A1:B5).", "error");
      return;
    }

    // Cell count check
    const cellCount = (source.r2 - source.r1 + 1) * (source.c2 - source.c1 + 1);
    if (cellCount > 50) {
      toast("Operation exceeds limit of 50 cells.", "error");
      return;
    }

    // Overlap validation
    // Source: {r1, c1, r2, c2}
    // Target: depends on mode
    let targetR2 = target.row;
    let targetC2 = target.col;
    if (aiOpMode === "row-wise") {
      targetR2 = target.row + (source.r2 - source.r1);
    } else if (aiOpMode === "matrix") {
      targetR2 = target.row + (source.r2 - source.r1);
      targetC2 = target.col + (source.c2 - source.c1);
    }
    // Rect intersection check
    const overlap = !(target.col > source.c2 || targetC2 < source.c1 || target.row > source.r2 || targetR2 < source.r1);
    if (overlap) {
      toast("Target range overlaps with source range. Please choose a different target.", "error");
      return;
    }

    setAiOpLoading(true);
    setAiOpOpen(false); // Close dialog

    const params = new URLSearchParams({
      mode: aiOpMode,
      r1: String(source.r1),
      c1: String(source.c1),
      r2: String(source.r2),
      c2: String(source.c2),
      tr: String(target.row),
      tc: String(target.col),
      instruction: finalInstruction,
      temperature: String(aiOpTemp),
    });
    if (aiOpModel) params.set("model", aiOpModel);
    if (tuningParams?.maxTokens) params.set("max_tokens", String(tuningParams.maxTokens));

    const es = new EventSource(`${API_BASE}/sheets/${activeSheet.id}/ai-op?${params}`);
    aiFillRef.current = es; // Allow cancellation via Stop button
    
    setAiFilling(true);
    setAiFillProgress("Starting AI operation...");

    es.onmessage = (event) => {
      const data = event.data;
      if (data === "[DONE]") {
        es.close();
        aiFillRef.current = null;
        setAiFilling(false);
        setAiFillProgress(`Operation complete.`);
        setAiOpLoading(false);
        return;
      }
      try {
        const msg = JSON.parse(data);
        if (msg.type === "cell") {
          setAiFillProgress(`Updating cell ${idxToCol(msg.col)}${msg.row + 1}...`);
          setSheets((prev) =>
            prev.map((s) => {
              if (s.id !== activeSheet.id) return s;
              const newRows = [...s.rows];
              while (newRows.length <= msg.row) newRows.push([]);
              newRows[msg.row] = [...(newRows[msg.row] || [])];
              while (newRows[msg.row].length <= msg.col) newRows[msg.row].push("");
              
              newRows[msg.row][msg.col] = msg.value;
              return { ...s, rows: newRows };
            })
          );
        } else if (msg.type === "error") {
           toast(`Error at ${msg.row !== undefined ? `row ${msg.row + 1}` : 'operation'}: ${msg.error}`, "error");
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      es.close();
      aiFillRef.current = null;
      setAiFilling(false);
      setAiOpLoading(false);
      toast("AI operation interrupted.", "error");
    };
  }

  // AI Column Tools — predefined instructions
  function colToolClean(ci: number) {
    if (!activeSheet) return;
    const col = activeSheet.columns[ci];
    setColMenu(null);
    runAiFillStream(ci,
      `Clean the existing value in column "${col.name}": trim whitespace, fix capitalization (proper Title Case for names, sentence case for text), fix obvious typos. Return ONLY the cleaned value. If already clean, return unchanged.`,
      "Cleaning"
    );
  }
  function colToolNormalize(ci: number) {
    if (!activeSheet) return;
    const col = activeSheet.columns[ci];
    const existing = activeSheet.rows.map((r) => r[ci] ?? "").filter(Boolean);
    const unique = [...new Set(existing)].slice(0, 20).join(", ");
    setColMenu(null);
    runAiFillStream(ci,
      `Normalize the value in column "${col.name}". Existing values in this column: [${unique}]. Map similar/variant values to a single canonical form (e.g. "in progress"/"In Progress"/"WIP" → "In Progress"). Return ONLY the normalized value.`,
      "Normalizing"
    );
  }
  function colToolCategorize(ci: number) {
    if (!activeSheet) return;
    const col = activeSheet.columns[ci];
    setColMenu(null);
    runAiFillStream(ci,
      `Categorize the value in column "${col.name}" into a short category label (1-3 words). Analyze the free text and assign a concise category. Return ONLY the category label, nothing else.`,
      "Categorizing"
    );
  }

  function cancelAiFill() {
    if (aiFillRef.current) {
      aiFillRef.current.close();
      aiFillRef.current = null;
    }
    setAiFilling(false);
    setAiFillProgress(null);
    setAiFillErrors(new Map());
    setAiFilledRows(new Set());
    setAiOpLoading(false);
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
      <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="p-3 border-b flex flex-col gap-1.5">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setTemplatePickerOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Sheet
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAiGenOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            AI Generate
          </Button>
          {/* Import — always reachable, creates a new sheet from file */}
          <input
            ref={importInputRef}
            type="file"
            accept={SHEET_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            title="Import XLSX / CSV / TSV"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Import Sheet
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            disabled={sheets.length === 0}
            onClick={handleExportAllXLSX}
            title="Export every sheet as one XLSX workbook"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export all as XLSX
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                  activeSheetId === sheet.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setActiveSheetId(sheet.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSheetMenu({ sheetId: sheet.id, x: e.clientX, y: e.clientY });
                }}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0" />
                {renamingSheet === sheet.id ? (
                  <input
                    ref={renameSheetRef}
                    className="flex-1 min-w-0 h-5 px-1 text-xs border border-primary/40 rounded bg-background outline-none"
                    value={renameSheetValue}
                    onChange={(e) => setRenameSheetValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={sheetRenameCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sheetRenameCommit();
                      if (e.key === "Escape") setRenamingSheet(null);
                    }}
                  />
                ) : (
                  <span className="flex-1 truncate">{sheet.title}</span>
                )}
              </div>
            ))}
            {sheets.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No sheets yet.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
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

            {/* Toolbar */}
            <div className="border-b px-4 py-1.5 flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={undoSheet} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={redoSheet} disabled={!canRedo} title="Redo (Ctrl+Y)">
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addRow(activeSheet.id)}>
                <Plus className="h-3 w-3" />
                Row
              </Button>
              {selection && (
                <>
                  <div className="w-px h-5 bg-border mx-1" />
                  <Button variant={getSelectionFormat().b ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={toggleBold} title="Bold (Ctrl+B)">
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant={getSelectionFormat().i ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={toggleItalic} title="Italic (Ctrl+I)">
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <div className="relative">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setColorPickerOpen(colorPickerOpen === 'tc' ? null : 'tc')} title="Text color">
                      <Type className="h-3.5 w-3.5" />
                      {getSelectionFormat().tc && <div className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded" style={{ backgroundColor: getSelectionFormat().tc }} />}
                    </Button>
                    {colorPickerOpen === 'tc' && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-lg p-2 grid grid-cols-6 gap-1 w-[156px]" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                        {['#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280','#ffffff','#991b1b','#9a3412'].map(c => (
                          <button key={c} className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }} onClick={() => { applyFormat({ tc: c }); setColorPickerOpen(null); }} />
                        ))}
                        <button className="col-span-6 text-[10px] text-muted-foreground hover:text-foreground mt-0.5" onClick={() => { applyFormat({ tc: undefined }); setColorPickerOpen(null); }}>Reset</button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setColorPickerOpen(colorPickerOpen === 'bg' ? null : 'bg')} title="Background color">
                      <Paintbrush className="h-3.5 w-3.5" />
                      {getSelectionFormat().bg && <div className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded" style={{ backgroundColor: getSelectionFormat().bg }} />}
                    </Button>
                    {colorPickerOpen === 'bg' && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-lg p-2 grid grid-cols-6 gap-1 w-[156px]" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                        {['#fef2f2','#fff7ed','#fefce8','#f0fdf4','#eff6ff','#f5f3ff','#fdf2f8','#f9fafb','#fecaca','#fed7aa','#fde68a','#bbf7d0'].map(c => (
                          <button key={c} className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }} onClick={() => { applyFormat({ bg: c }); setColorPickerOpen(null); }} />
                        ))}
                        <button className="col-span-6 text-[10px] text-muted-foreground hover:text-foreground mt-0.5" onClick={() => { applyFormat({ bg: undefined }); setColorPickerOpen(null); }}>Reset</button>
                      </div>
                    )}
                  </div>
                  <Button variant={getSelectionFormat().wrap === false ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={toggleWrap} title="Toggle text wrap">
                    <WrapText className="h-3.5 w-3.5" />
                  </Button>
                  <div className="w-px h-5 bg-border mx-0.5" />
                  {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([val, Icon]) => (
                    <Button key={val} variant={getSelectionAlignment().h === val ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={() => applyAlignment('h', val)} title={`Align ${val}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                  <div className="w-px h-5 bg-border mx-0.5" />
                  {([['top', AlignVerticalJustifyStart], ['middle', AlignVerticalJustifyCenter], ['bottom', AlignVerticalJustifyEnd]] as const).map(([val, Icon]) => (
                    <Button key={val} variant={getSelectionAlignment().v === val ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={() => applyAlignment('v', val)} title={`Align ${val}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                </>
              )}
              <div className="flex-1" />
              {/* Export dropdown — active sheet only */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setExportOpen((o) => !o)}
                  title="Export sheet"
                >
                  <Download className="h-3 w-3" />
                  Export
                  <ChevronDown className="h-3 w-3" />
                </Button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[130px]">
                    {SHEET_EXPORT_FORMATS.map(([fmt, label]) => (
                      <button
                        key={fmt}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                        onClick={() => handleExport(fmt)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI bar */}
            {activeSheet.columns.length > 0 && (
              <div className="sticky top-0 z-10 border-b px-4 py-1.5 flex items-center gap-2 bg-background/95 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary mr-1">AI</span>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  variant={aiFillOpen ? "default" : "outline"}
                  onClick={() => { setAiFillOpen(!aiFillOpen); if (aiFillOpen) cancelAiFill(); }}
                  disabled={aiDisabled}
                  title={aiDisabled ? `AI disabled for tables > ${ROW_AI_LIMIT.toLocaleString()} rows` : undefined}
                >Fill</Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  variant="outline"
                  onClick={() => {
                    if (selection) {
                      setAiOpTargetStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                      if (selection.r1 !== selection.r2 || selection.c1 !== selection.c2) {
                        setAiOpMode("row-wise");
                        setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}:${idxToCol(selection.c2)}${selection.r2 + 1}`);
                      } else if (selection.c1 > 0) {
                        setAiOpMode("row-wise");
                        setAiOpSourceStr(`${idxToCol(selection.c1 - 1)}${selection.r1 + 1}`);
                      } else {
                        setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                      }
                    } else {
                      setAiOpTargetStr("");
                      setAiOpSourceStr("");
                    }
                    setAiOpOpen(true);
                  }}
                  disabled={aiDisabled}
                  title="Process a single cell or range with AI"
                >Range</Button>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">{activeEngine}</span>
              </div>
            )}

            {/* AI Fill panel */}
            {aiFillOpen && (
              <div className="border-b px-4 py-2 bg-muted/30 flex items-center gap-2 flex-wrap">
                <label className="text-xs text-muted-foreground shrink-0">Column:</label>
                <select
                  className="h-7 px-1.5 text-xs border border-border rounded-md bg-background outline-none"
                  value={aiFillCol}
                  onChange={(e) => setAiFillCol(Number(e.target.value))}
                  disabled={aiFilling}
                >
                  {activeSheet.columns.map((col, ci) => (
                    <option key={ci} value={ci}>{col.name}</option>
                  ))}
                </select>
                <input
                  ref={aiFillInstructionRef}
                  className="h-7 flex-1 min-w-[200px] px-2 text-xs border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                  placeholder='Instruction, e.g. "generate short description"'
                  value={aiFillInstruction}
                  onChange={(e) => setAiFillInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !aiFilling) startAiFill(); }}
                  disabled={aiFilling}
                />
                {aiFilling ? (
                  <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={cancelAiFill}>
                    <Square className="h-3 w-3" />
                    Stop
                  </Button>
                ) : (
                  <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={startAiFill} disabled={!aiFillInstruction.trim()}>
                    <Sparkles className="h-3 w-3" />
                    Fill
                  </Button>
                )}
                {aiFillProgress && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {aiFilling && <Loader2 className="h-3 w-3 animate-spin" />}
                    {aiFillProgress}
                  </span>
                )}
              </div>
            )}

            {/* AI Tool progress bar (shown when tool runs without AI Fill panel) */}
            {aiFilling && !aiFillOpen && (
              <div className="border-b px-4 py-1.5 bg-muted/30 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {aiFillProgress}
                </span>
                <Button variant="destructive" size="sm" className="h-6 text-xs gap-1" onClick={cancelAiFill}>
                  <Square className="h-2.5 w-2.5" />
                  Cancel
                </Button>
              </div>
            )}
            {/* AI Tool done message (shown briefly after tool finishes) */}
            {!aiFilling && !aiFillOpen && aiFillProgress && (
              <div className="border-b px-4 py-1.5 bg-muted/30 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground flex-1">{aiFillProgress}</span>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setAiFillProgress(null)}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Formula bar */}
            {activeSheet.columns.length > 0 && (() => {
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
              // Convert column index to letter(s): 0→A, 25→Z, 26→AA …

              return (
                <div className="border-b px-2 py-1 flex items-center gap-1 bg-muted/20 shrink-0">
                  <span className="text-[11px] font-mono text-muted-foreground w-10 text-center shrink-0 bg-muted rounded px-1 py-0.5">{displayLabel}</span>
                  <div className="w-px h-5 bg-border mx-1" />
                  {/* Function buttons: select a range then click to insert formula below/right */}
                  {FUNS.map((fn) => (
                    <button
                      key={fn}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/20 text-muted-foreground hover:text-foreground font-mono shrink-0 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!selection) return;
                        const { r1, c1, r2, c2 } = selection;
                        const rangeStr = `${idxToCol(c1)}${r1+1}:${idxToCol(c2)}${r2+1}`;
                        const formula = `=${fn}(${rangeStr})`;
                        // Place formula in the cell below the selection if it exists,
                        // otherwise to the right of the selection.
                        if (r2 + 1 < activeSheet.rows.length) {
                          startEditing(r2 + 1, c1, formula);
                        } else if (c2 + 1 < activeSheet.columns.length) {
                          startEditing(r1, c2 + 1, formula);
                        } else {
                          // Just pre-fill the formula bar for the current cell
                          startEditing(r1, c1, formula);
                        }
                      }}
                    >
                      {fn}
                    </button>
                  ))}
                  <button
                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary font-medium shrink-0 transition-colors flex items-center gap-1"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (selection) {
                        setAiOpTargetStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                        if (selection.r1 !== selection.r2 || selection.c1 !== selection.c2) {
                          setAiOpMode("row-wise");
                          setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}:${idxToCol(selection.c2)}${selection.r2 + 1}`);
                        } else {
                          setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                        }
                      } else {
                        setAiOpSourceStr("");
                        setAiOpTargetStr("");
                      }
                      setAiOpOpen(true);
                    }}
                    title="AI Cell Action"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    AI
                  </button>
                  <div className="w-px h-5 bg-border mx-1" />
                  {/* Editable formula input */}
                  <input
                    className="flex-1 text-xs font-mono bg-transparent outline-none text-foreground px-1"
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
                        setEditValue(e.target.value);
                        setCellError(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                    }}
                  />
                </div>
              );
            })()}

            {/* Grid */}
            <div
              ref={gridRef}
              className="flex-1 overflow-auto"
              tabIndex={-1}
              onScroll={handleGridScroll}
              onKeyDown={(e) => {
                if (editingCell) return; // let cell input handle its own keys

                // Bold / Italic
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

                // Undo / Redo
                if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
                  e.preventDefault();
                  undoSheet();
                  return;
                }
                if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
                  e.preventDefault();
                  redoSheet();
                  return;
                }
                const maxRow = (activeSheet?.rows.length ?? 1) - 1;
                const maxCol = (activeSheet?.columns.length ?? 1) - 1;

                // Arrow / Enter / Tab navigation
                const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
                const isNav = isArrow || e.key === "Enter" || e.key === "Tab";
                if (isNav && activeSheet && maxRow >= 0 && maxCol >= 0) {
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
                    // Extend selection: anchor stays fixed, moving end shifts
                    const mov = selMoving.current ?? { ...anchor };
                    if (e.key === "ArrowUp") mov.row = Math.max(0, mov.row - 1);
                    else if (e.key === "ArrowDown") mov.row = Math.min(maxRow, mov.row + 1);
                    else if (e.key === "ArrowLeft") mov.col = Math.max(0, mov.col - 1);
                    else if (e.key === "ArrowRight") mov.col = Math.min(maxCol, mov.col + 1);
                    selMoving.current = { ...mov };
                    setSelection(makeRect(anchor, mov));
                  } else {
                    // Move single-cell selection
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
                }
                // Start editing on printable character
                if (selection && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
                  startEditing(selection.r1, selection.c1, "");
                  // Let the character propagate to the new input
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
                <table className="border-collapse text-sm select-none" style={{ tableLayout: 'fixed', width: 'max-content' }} onMouseUp={handleMouseUp}>
                  <thead>
                    <tr>
                      <th className="border border-border bg-muted px-2 py-1.5 text-left text-xs font-medium text-muted-foreground w-10">#</th>
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
                              setResizing({ type: 'col', index: ci, startPos: e.clientX, startSize: colWidths[ci] ?? DEFAULT_COL_WIDTH });
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
                    {/* Compute formula ref highlights and AI ghost overlay once per render */}
                    {(() => {
                      const formulaRefMap = new Map<string, number>();
                      let refGroups: RefGroup[] = [];
                      try {
                        if (editingCell && editValue.startsWith("=")) {
                          refGroups = parseFormulaRefGroups(editValue, activeSheet.rows.length, activeSheet.columns.length);
                          for (const g of refGroups) {
                            for (const k of g.cells) {
                              if (!formulaRefMap.has(k)) formulaRefMap.set(k, g.colorIdx);
                            }
                          }
                        }
                      } catch { /* never crash rendering */ }

                      // AI Ghost Overlay Calculation
                      let aiTargetRect: { r1: number, c1: number, r2: number, c2: number } | null = null;
                      if (aiOpOpen && aiOpSourceStr && aiOpTargetStr) {
                        const s = resolveRange(aiOpSourceStr);
                        const t = resolveCellRef(aiOpTargetStr);
                        if (s && t) {
                          if (aiOpMode === "row-wise") {
                            // Target is height of source, but only 1 column wide
                            const h = s.r2 - s.r1;
                            aiTargetRect = { r1: t.row, c1: t.col, r2: t.row + h, c2: t.col }; 
                          } else if (aiOpMode === "aggregate") {
                            // Target is single cell
                            aiTargetRect = { r1: t.row, c1: t.col, r2: t.row, c2: t.col };
                          } else if (aiOpMode === "matrix") {
                            // Target shape usually matches source (N->N)
                            const h = s.r2 - s.r1;
                            const w = s.c2 - s.c1;
                            aiTargetRect = { r1: t.row, c1: t.col, r2: t.row + h, c2: t.col + w };
                          }
                        }
                      }

                      return visibleRowIndices.map((ri) => {
                      const row = activeSheet.rows[ri];
                      return (
                      <tr key={ri}>
                        <td
                          className="border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground text-center cursor-context-menu select-none relative"
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
                              setResizing({ type: 'row', index: ri, startPos: e.clientY, startSize: rowHeights[ri] ?? DEFAULT_ROW_HEIGHT });
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
                          const isErrorValue = hasFormula && typeof cell === 'string' && cell.startsWith("#");
                          const refColor = isFormulaRef ? REF_COLORS[refColorIdx] : null;
                          
                          const isAiTarget = aiTargetRect && ri >= aiTargetRect.r1 && ri <= aiTargetRect.r2 && ci >= aiTargetRect.c1 && ci <= aiTargetRect.c2;

                          return (
                            <td
                              key={ci}
                              className={cn(
                                "border p-0 overflow-hidden relative", // Added relative for overlay if needed, though using classes
                                !isFormulaRef && "border-border",
                                isEditing && "ring-2 ring-primary/40 ring-inset",
                                isEditing && cellError && "ring-destructive/60",
                                selected && !isFormulaRef && "bg-primary/10",
                                justFilled && "bg-green-500/10",
                                fillError && "bg-destructive/10",
                                isAiTarget && "bg-purple-500/10" // Ghost highlight
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
                                // Overlay dashed border for AI target
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
                                if (colType === "boolean") {
                                  const next = cell.toLowerCase() === "true" ? "false" : "true";
                                  axios.put(`${API_BASE}/sheets/${activeSheet.id}/cell`, {
                                    row_index: ri, col_index: ci, value: next,
                                  }).then((res) => updateSheet(res.data)).catch(() => {});
                                } else if (!isEditing && selection && selection.r1 === ri && selection.c1 === ci && selection.r2 === ri && selection.c2 === ci) {
                                  // Start editing on second click (cell already selected)
                                  startEditing(ri, ci, cell);
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="relative">
                                  <input
                                    ref={cellInputRef}
                                    type={editValue.startsWith("=") ? "text" : colType === "number" ? "number" : colType === "date" ? "date" : "text"}
                                    step={colType === "number" ? "any" : undefined}
                                    className="w-full px-2 py-1 text-sm bg-transparent outline-none"
                                    value={editValue}
                                    onChange={(e) => { setEditValue(e.target.value); setCellError(null); }}
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
                                <div className="px-2 py-1 text-sm cursor-text select-none flex gap-1" style={(() => { const a = activeSheet.alignments?.[`${ri},${ci}`]; const [h, v] = a ? a.split(',') : ['left', 'top']; const fmt: CellFormat = activeSheet.formats?.[`${ri},${ci}`] ?? {}; const noWrap = fmt.wrap === false; const manualH = ri in rowHeights; return { ...(manualH ? { height: rowHeights[ri], overflow: 'hidden' as const } : { minHeight: DEFAULT_ROW_HEIGHT }), whiteSpace: noWrap ? 'nowrap' as const : 'normal' as const, wordBreak: noWrap ? undefined : 'break-word' as const, lineBreak: noWrap ? undefined : 'anywhere' as const, ...(noWrap ? { overflow: 'hidden' as const, textOverflow: 'ellipsis' as const } : {}), textAlign: (h || 'left') as any, justifyContent: h === 'center' ? 'center' : h === 'right' ? 'flex-end' : 'flex-start', alignItems: v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : 'flex-start', fontWeight: fmt.b ? 700 : undefined, fontStyle: fmt.i ? 'italic' as const : undefined, color: fmt.tc || undefined, backgroundColor: fmt.bg || undefined }; })()}>
                                  {hasFormula && !isErrorValue && (
                                    <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0 leading-none">fx</span>
                                  )}
                                  {colType === "boolean" ? (
                                    <span className={cell.toLowerCase() === "true" ? "text-green-500" : "text-muted-foreground/50"}>
                                      {cell.toLowerCase() === "true" ? "Yes" : "No"}
                                    </span>
                                  ) : isErrorValue ? (
                                    <span className="text-destructive font-mono text-xs cursor-help" title={`${cell}\nFormula: ${activeSheet.formulas[`${ri},${ci}`]}`}>{cell}</span>
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
                    })()}
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
                const updated = { ...sizes, colWidths: sizes.colWidths ?? {}, rowHeights: next };
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

      {/* Template picker overlay */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTemplatePickerOpen(false)}>
          <div className="bg-background border rounded-lg shadow-lg w-[480px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Create from Template</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SHEET_TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => createFromTemplate(t)}
                    className="flex items-start gap-3 p-3 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-colors"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                      {t.columns.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1 truncate">
                          {t.columns.map((c) => c.name).join(" · ")}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setTemplatePickerOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate overlay — two-phase: prompt → preview → create */}
      {aiGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!aiGenLoading) { setAiGenOpen(false); setAiGenError(null); setAiGenPreview(null); } }}>
          <div className="bg-background border rounded-lg shadow-lg w-[480px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">
                {aiGenPreview ? "Review Table Schema" : "Generate Table with AI"}
              </h3>
            </div>

            {!aiGenPreview ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Describe the table you need. AI will suggest a name and columns for your review.
                </p>
                <input
                  ref={aiGenRef}
                  className="w-full h-8 px-3 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 mb-2"
                  placeholder='e.g. "CRM for small business" or "weekly meal planner"'
                  value={aiGenPrompt}
                  onChange={(e) => { setAiGenPrompt(e.target.value); setAiGenError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !aiGenLoading) generateSchema(); if (e.key === "Escape" && !aiGenLoading) setAiGenOpen(false); }}
                  disabled={aiGenLoading}
                />
                {aiGenError && (
                  <p className="text-xs text-destructive flex items-center gap-1 mb-2">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {aiGenError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAiGenOpen(false); setAiGenError(null); }} disabled={aiGenLoading}>
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={generateSchema} disabled={!aiGenPrompt.trim() || aiGenLoading}>
                    {aiGenLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {aiGenLoading ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Preview phase: editable title + columns */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1 block">Table name</label>
                  <input
                    className="w-full h-8 px-3 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    value={aiGenPreview.title}
                    onChange={(e) => setAiGenPreview({ ...aiGenPreview, title: e.target.value })}
                  />
                </div>

                <label className="text-xs text-muted-foreground mb-1 block">Columns</label>
                <div className="border border-border rounded-md mb-3 max-h-[240px] overflow-auto">
                  {aiGenPreview.columns.map((col, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border last:border-b-0">
                      <input
                        className="flex-1 h-6 px-1.5 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40"
                        value={col.name}
                        onChange={(e) => aiGenUpdateCol(i, "name", e.target.value)}
                      />
                      <select
                        className="h-6 px-1 text-xs border border-border rounded bg-background outline-none"
                        value={col.type}
                        onChange={(e) => aiGenUpdateCol(i, "type", e.target.value)}
                      >
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="date">date</option>
                      </select>
                      <button onClick={() => aiGenRemoveCol(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={aiGenAddCol}
                    className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 justify-center"
                  >
                    <Plus className="h-3 w-3" /> Add column
                  </button>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAiGenPreview(null)}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAiGenOpen(false); setAiGenPreview(null); }}>
                      Cancel
                    </Button>
                    <Button
                      variant="default" size="sm" className="h-7 text-xs gap-1"
                      onClick={confirmAiGenCreate}
                      disabled={aiGenPreview.columns.length === 0 || aiGenPreview.columns.some((c) => !c.name.trim())}
                    >
                      Create Table
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI Cell overlay */}
      {/* AI Range Operation Modal */}
      {aiOpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!aiOpLoading) setAiOpOpen(false); }}>
          <div className="bg-background border rounded-lg shadow-lg w-[440px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">AI Range Operation</h3>
            </div>
            
            <div className="space-y-4 mb-4">
              {/* Mode Selection */}
              <div className="grid grid-cols-4 items-center gap-3">
                <label className="text-xs text-muted-foreground text-right">Mode</label>
                <div className="col-span-3">
                  <select
                    className="w-full h-8 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    value={aiOpMode}
                    onChange={(e) => setAiOpMode(e.target.value as any)}
                  >
                    <option value="row-wise">Row-wise (1 → 1)</option>
                    <option value="aggregate">Aggregate (Range → 1)</option>
                    <option value="matrix">Matrix (Table → Table)</option>
                  </select>
                </div>
              </div>

              {/* Action Selection */}
              <div className="grid grid-cols-4 items-center gap-3">
                <label className="text-xs text-muted-foreground text-right">Action</label>
                <div className="col-span-3 flex gap-2">
                  <select
                    className="flex-1 h-8 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    value={aiOpAction}
                    onChange={(e) => setAiOpAction(e.target.value as any)}
                  >
                    <option value="translate">Translate</option>
                    <option value="rewrite">Rewrite</option>
                    <option value="summarize">Summarize</option>
                    <option value="custom">Custom Instruction</option>
                  </select>
                  {aiOpAction === "translate" && (
                    <select
                      className="flex-1 h-8 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                      value={aiOpLanguage}
                      onChange={(e) => setAiOpLanguage(e.target.value)}
                    >
                      <option value="Slovak">Slovak</option>
                      <option value="English">English</option>
                      <option value="German">German</option>
                      <option value="French">French</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Italian">Italian</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Chinese">Chinese</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Source & Target */}
              <div className="grid grid-cols-4 items-center gap-3">
                <label className="text-xs text-muted-foreground text-right">Source</label>
                <div className="col-span-3 flex gap-2">
                  <input
                    className="flex-1 h-8 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="e.g. A1:A10"
                    value={aiOpSourceStr}
                    onChange={(e) => setAiOpSourceStr(e.target.value)}
                  />
                  <Button variant="outline" size="sm" className="h-8 text-[10px] px-2" onClick={() => {
                    if (selection) {
                      if (selection.r1 === selection.r2 && selection.c1 === selection.c2) {
                        setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                      } else {
                        setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}:${idxToCol(selection.c2)}${selection.r2 + 1}`);
                      }
                    }
                  }}>Select</Button>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <label className="text-xs text-muted-foreground text-right">Target</label>
                <div className="col-span-3 flex gap-2">
                  <input
                    className="flex-1 h-8 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="Start cell (e.g. B1)"
                    value={aiOpTargetStr}
                    onChange={(e) => setAiOpTargetStr(e.target.value)}
                  />
                  <Button variant="outline" size="sm" className="h-8 text-[10px] px-2" onClick={() => {
                    if (selection) {
                      setAiOpTargetStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                    }
                  }}>Select</Button>
                </div>
              </div>

              {/* Instruction */}
              <div className="grid grid-cols-4 items-start gap-3">
                <label className="text-xs text-muted-foreground text-right mt-1.5">Prompt</label>
                <textarea
                  className="col-span-3 min-h-[80px] w-full p-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  placeholder={aiOpAction === "custom" ? 'e.g. "Fix formatting", "Make it more professional"' : 'Autogenerated from action'}
                  value={aiOpAction === "custom" ? aiOpInstruction : ""}
                  onChange={(e) => setAiOpInstruction(e.target.value)}
                  disabled={aiOpAction !== "custom"}
                />
              </div>

              {/* Model & Creativity */}
              <div className="grid grid-cols-4 items-center gap-3">
                <label className="text-xs text-muted-foreground text-right">Model</label>
                <div className="col-span-3">
                  <select
                    className="w-full h-8 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    value={aiOpModel}
                    onChange={(e) => setAiOpModel(e.target.value)}
                  >
                    <option value="">Default (Auto)</option>
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <label className="text-xs text-muted-foreground text-right">Creativity</label>
                <div className="col-span-3 flex items-center gap-3">
                  <input
                    type="range"
                    min="0" max="1" step="0.1"
                    className="flex-1 h-2"
                    value={aiOpTemp}
                    onChange={(e) => setAiOpTemp(parseFloat(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{aiOpTemp}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAiOpOpen(false)} disabled={aiOpLoading}>
                Cancel
              </Button>
              <Button variant="default" size="sm" className="h-8 text-xs gap-1.5" onClick={runAiOp} disabled={aiOpLoading}>
                {aiOpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Run
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
