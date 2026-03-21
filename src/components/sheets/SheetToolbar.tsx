import {
  Plus, Undo2, Redo2, Bold, Italic, Strikethrough, Type, Paintbrush, WrapText,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  Filter, Download, ChevronDown, Sparkles, Square, Loader2, X, ArrowUpDown, Palette,
  ClipboardList, MessageSquare,
} from "lucide-react";
import { Button } from "../ui/button";
import { idxToCol, ROW_AI_LIMIT, type CellFormat, type Sheet } from "../../lib/cellUtils";
import { SHEET_EXPORT_FORMATS, type SheetExportFormat } from "../../lib/fileService";

export interface SheetToolbarProps {
  activeSheet: Sheet;

  // Undo/Redo
  undoSheet: () => void;
  redoSheet: () => void;
  canUndo: boolean;
  canRedo: boolean;
  aiFilling: boolean;

  // Row
  addRow: (id: string) => void;

  // Formatting
  selection: { r1: number; c1: number; r2: number; c2: number } | null;
  getSelectionFormat: () => CellFormat;
  getSelectionAlignment: () => { h: string; v: string };
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrikethrough: () => void;
  applyFormat: (patch: Partial<CellFormat>) => void;
  applyAlignment: (axis: "h" | "v", value: string) => void;
  toggleWrap: () => void;
  colorPickerOpen: "tc" | "bg" | null;
  setColorPickerOpen: (v: "tc" | "bg" | null) => void;

  // Filter
  filters: Map<number, { operator: string; value: string }>;
  setFilters: React.Dispatch<React.SetStateAction<Map<number, { operator: string; value: string }>>>;

  // Export
  exportOpen: boolean;
  setExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleExport: (fmt: SheetExportFormat) => void;

  // AI bar
  aiDisabled: boolean;
  aiFillOpen: boolean;
  setAiFillOpen: (v: boolean) => void;
  cancelAiFill: () => void;
  setAiOpTargetStr: (v: string) => void;
  setAiOpMode: (m: "row-wise" | "aggregate" | "matrix") => void;
  setAiOpSourceStr: (v: string) => void;
  setAiOpOpen: (v: boolean) => void;
  setGenRowsOpen: (v: boolean) => void;
  setGenRowsError: (v: string | null) => void;
  setGenRowsProgress: (v: number) => void;
  activeEngine: string;

  // AI Fill panel
  aiFillCol: number;
  setAiFillCol: (v: number) => void;
  aiFillInstructionRef: React.RefObject<HTMLInputElement | null>;
  aiFillInstruction: string;
  setAiFillInstruction: (v: string) => void;
  startAiFill: () => void;
  aiFillProgress: string | null;
  setAiFillProgress: (v: string | null) => void;
  autoFitAllCols: () => void;
  onOpenMultiSort: () => void;
  onOpenCondFormat: () => void;
  hasCondRules: boolean;
  copyAsMarkdown: () => void;
  onOpenSheetChat: () => void;
  sheetChatOpen: boolean;
}

export function SheetToolbar({
  activeSheet,
  undoSheet, redoSheet, canUndo, canRedo, aiFilling,
  addRow,
  selection, getSelectionFormat, getSelectionAlignment,
  toggleBold, toggleItalic, toggleStrikethrough, applyFormat, applyAlignment, toggleWrap,
  colorPickerOpen, setColorPickerOpen,
  filters, setFilters,
  exportOpen, setExportOpen, handleExport,
  aiDisabled, aiFillOpen, setAiFillOpen, cancelAiFill,
  setAiOpTargetStr, setAiOpMode, setAiOpSourceStr, setAiOpOpen,
  setGenRowsOpen, setGenRowsError, setGenRowsProgress, activeEngine,
  aiFillCol, setAiFillCol, aiFillInstructionRef, aiFillInstruction,
  setAiFillInstruction, startAiFill, aiFillProgress, setAiFillProgress,
  autoFitAllCols, onOpenMultiSort, onOpenCondFormat, hasCondRules, copyAsMarkdown,
  onOpenSheetChat, sheetChatOpen,
}: SheetToolbarProps) {
  return (
    <>
      {/* Toolbar */}
      <div className="border-b px-4 py-1.5 flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={undoSheet} disabled={!canUndo || aiFilling} title={aiFilling ? "Cannot undo while AI is running" : "Undo (Ctrl+Z)"}>
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={redoSheet} disabled={!canRedo || aiFilling} title={aiFilling ? "Cannot redo while AI is running" : "Redo (Ctrl+Y)"}>
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
            <Button variant={getSelectionFormat().s ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={toggleStrikethrough} title="Strikethrough (Ctrl+5)">
              <Strikethrough className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={getSelectionFormat().border ? "default" : "outline"}
              size="sm" className="h-7 w-7 p-0"
              title={`Cell border: ${getSelectionFormat().border ?? "none"} → cycle thin→thick→none`}
              onClick={() => {
                const cur = getSelectionFormat().border;
                applyFormat({ border: cur === undefined ? "thin" : cur === "thin" ? "thick" : undefined });
              }}
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm" className="h-7 w-7 p-0"
              title="Copy selection as Markdown table (Ctrl+Shift+M)"
              onClick={copyAsMarkdown}
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </Button>
            <select
              className="h-7 px-1 text-xs border border-border rounded-md bg-background outline-none cursor-pointer"
              value={getSelectionFormat().fs ?? ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                applyFormat({ fs: val });
              }}
              title="Font size"
            >
              <option value="">Size</option>
              {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(s => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
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
            <Button
              variant={getSelectionFormat().numFmt === "pct" ? "default" : "outline"}
              size="sm" className="h-7 w-7 p-0 font-medium text-xs"
              onClick={() => applyFormat({ numFmt: getSelectionFormat().numFmt === "pct" ? undefined : "pct" })}
              title="Format as percent"
            >%</Button>
            <Button
              variant={getSelectionFormat().numFmt === "cur" ? "default" : "outline"}
              size="sm" className="h-7 w-7 p-0 font-medium text-xs"
              onClick={() => applyFormat({ numFmt: getSelectionFormat().numFmt === "cur" ? undefined : "cur" })}
              title="Format as currency ($)"
            >$</Button>
            <Button
              variant="outline" size="sm" className="h-7 w-7 p-0 text-xs font-mono"
              onClick={() => applyFormat({ numDecimals: Math.max(0, (getSelectionFormat().numDecimals ?? 2) - 1) })}
              title="Decrease decimal places"
            >.0</Button>
            <Button
              variant="outline" size="sm" className="h-7 w-7 p-0 text-xs font-mono"
              onClick={() => applyFormat({ numDecimals: Math.min(9, (getSelectionFormat().numDecimals ?? 2) + 1) })}
              title="Increase decimal places"
            >.00</Button>
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
        {filters.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setFilters(new Map())}
            title="Clear all filters"
          >
            <Filter className="h-3 w-3" />
            Clear filters
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={autoFitAllCols} title="Auto-fit all columns to their content">
          ↔
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onOpenMultiSort} title="Multi-level sort">
          <ArrowUpDown className="h-3 w-3" /> Sort
        </Button>
        <Button
          variant={hasCondRules ? "default" : "outline"}
          size="sm" className="h-7 text-xs gap-1"
          onClick={onOpenCondFormat}
          title="Conditional formatting"
        >
          <Palette className="h-3 w-3" /> Cond.
        </Button>
        <Button
          variant={sheetChatOpen ? "default" : "outline"}
          size="sm" className="h-7 text-xs gap-1"
          onClick={onOpenSheetChat}
          title="Chat with this sheet data"
        >
          <MessageSquare className="h-3 w-3" /> Ask AI
        </Button>
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
          <Button
            size="sm"
            className="h-7 text-xs"
            variant="outline"
            onClick={() => { setGenRowsOpen(true); setGenRowsError(null); setGenRowsProgress(0); }}
            disabled={aiDisabled}
            title="Generate new rows with AI"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Generate rows
          </Button>
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
          <div className="flex items-center gap-1 flex-wrap">
            {["Fill with realistic values", "Translate to English", "Categorize", "Extract from context"].map((preset) => (
              <button
                key={preset}
                className="px-1.5 py-0.5 text-[10px] rounded-full border border-border hover:bg-muted transition-colors shrink-0"
                onClick={() => setAiFillInstruction(preset)}
                disabled={aiFilling}
              >{preset}</button>
            ))}
            <input
              ref={aiFillInstructionRef}
              className="h-7 flex-1 min-w-[160px] px-2 text-xs border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
              placeholder='Instruction, e.g. "generate short description"'
              value={aiFillInstruction}
              onChange={(e) => setAiFillInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !aiFilling) startAiFill(); }}
              disabled={aiFilling}
            />
          </div>
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
    </>
  );
}
