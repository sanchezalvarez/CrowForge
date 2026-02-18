import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { PlusCircle, Table2, Trash2, Plus, X, AlertCircle, Sparkles, Square, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { cn } from "../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

interface SheetColumn {
  name: string;
  type: string;
}

interface Sheet {
  id: string;
  title: string;
  columns: SheetColumn[];
  rows: string[][];
  created_at: string;
  updated_at: string;
}

export function SheetsPage() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const cellInputRef = useRef<HTMLInputElement>(null);
  const [cellError, setCellError] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("text");
  const colNameRef = useRef<HTMLInputElement>(null);

  // AI Generate state
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiGenPrompt, setAiGenPrompt] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const aiGenRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus when editing starts
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

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

  // Clear editing state when switching sheets
  useEffect(() => {
    setEditingCell(null);
    setAddingColumn(false);
    cancelAiFill();
    setAiFillOpen(false);
  }, [activeSheetId]);

  const startEditing = useCallback((ri: number, ci: number, currentValue: string) => {
    setEditingCell({ row: ri, col: ci });
    setEditValue(currentValue);
  }, []);

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

  async function createSheet() {
    try {
      const res = await axios.post(`${API_BASE}/sheets`, {
        title: "Untitled Sheet",
        columns: [],
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

  async function updateTitle(id: string, title: string) {
    try {
      const res = await axios.put(`${API_BASE}/sheets/${id}/title`, { title });
      setSheets((prev) => prev.map((s) => (s.id === id ? res.data : s)));
    } catch {
      // ignore
    }
  }

  function updateSheet(updated: Sheet) {
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function addColumn(id: string, name: string, type: string) {
    try {
      const res = await axios.post(`${API_BASE}/sheets/${id}/columns`, { name, type });
      updateSheet(res.data);
    } catch { /* ignore */ }
  }

  async function deleteColumn(id: string, colIndex: number) {
    try {
      const res = await axios.delete(`${API_BASE}/sheets/${id}/columns`, {
        data: { col_index: colIndex },
      });
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

  async function generateSheet() {
    if (!aiGenPrompt.trim()) return;
    setAiGenLoading(true);
    setAiGenError(null);
    try {
      const res = await axios.post(`${API_BASE}/sheets/ai-generate`, { prompt: aiGenPrompt.trim() });
      const sheet: Sheet = res.data;
      setSheets((prev) => [sheet, ...prev]);
      setActiveSheetId(sheet.id);
      setAiGenPrompt("");
      setAiGenOpen(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setAiGenError(detail || "Failed to generate table");
    } finally {
      setAiGenLoading(false);
    }
  }

  function startAiFill() {
    if (!activeSheet || !aiFillInstruction.trim()) return;
    setAiFilling(true);
    setAiFillProgress("Starting...");
    setAiFillErrors(new Map());
    setAiFilledRows(new Set());

    const params = new URLSearchParams({
      col_index: String(aiFillCol),
      instruction: aiFillInstruction.trim(),
    });
    const es = new EventSource(`${API_BASE}/sheets/${activeSheet.id}/ai-fill?${params}`);
    aiFillRef.current = es;

    let filledCount = 0;

    es.onmessage = (event) => {
      const data = event.data;
      if (data === "[DONE]") {
        es.close();
        aiFillRef.current = null;
        setAiFilling(false);
        setAiFillProgress(`Done — filled ${filledCount} cells`);
        return;
      }
      try {
        const msg = JSON.parse(data);
        if (msg.type === "cell") {
          filledCount++;
          setAiFillProgress(`Filling row ${msg.row + 1}...`);
          setAiFilledRows((prev) => new Set(prev).add(msg.row));
          // Update the cell in local state
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

  function cancelAiFill() {
    if (aiFillRef.current) {
      aiFillRef.current.close();
      aiFillRef.current = null;
    }
    setAiFilling(false);
    setAiFillProgress(null);
    setAiFillErrors(new Map());
    setAiFilledRows(new Set());
  }

  return (
    <div className="flex h-full">
      {/* Sheets sidebar */}
      <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="p-3 border-b">
          <Button variant="outline" size="sm" className="w-full" onClick={createSheet}>
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Sheet
          </Button>
          <Button variant="outline" size="sm" className="w-full mt-1.5" onClick={() => setAiGenOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            AI Generate
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
              >
                <Table2 className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{sheet.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSheet(sheet.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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
                {activeSheet.columns.length} cols, {activeSheet.rows.length} rows
              </span>
            </div>

            {/* Toolbar */}
            <div className="border-b px-4 py-1.5 flex items-center gap-2">
              {addingColumn ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={colNameRef}
                    className="h-7 px-2 text-xs border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 w-28"
                    placeholder="Column name"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNewColumn();
                      if (e.key === "Escape") setAddingColumn(false);
                    }}
                  />
                  <select
                    className="h-7 px-1.5 text-xs border border-border rounded-md bg-background outline-none"
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value)}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="date">Date</option>
                  </select>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={submitNewColumn}>
                    Add
                  </Button>
                  <button onClick={() => setAddingColumn(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingColumn(true)}>
                  <Plus className="h-3 w-3" />
                  Column
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addRow(activeSheet.id)}>
                <Plus className="h-3 w-3" />
                Row
              </Button>
              {activeSheet.columns.length > 0 && (
                <>
                  <div className="w-px h-5 bg-border mx-1" />
                  <Button
                    variant={aiFillOpen ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setAiFillOpen(!aiFillOpen); if (aiFillOpen) cancelAiFill(); }}
                  >
                    <Sparkles className="h-3 w-3" />
                    AI Fill
                  </Button>
                </>
              )}
            </div>

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

            {/* Grid */}
            <div className="flex-1 overflow-auto">
              {activeSheet.columns.length === 0 ? (
                <div className="flex-1 flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Table2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No columns yet</p>
                    <p className="text-xs mt-1">Add a column to get started.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border border-border bg-muted px-2 py-1.5 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                      {activeSheet.columns.map((col, ci) => (
                        <th key={ci} className="group border border-border bg-muted px-2 py-1.5 text-left text-xs font-medium text-muted-foreground min-w-[120px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{col.name}</span>
                            {col.type !== "text" && (
                              <span className="text-[10px] px-1 py-0 rounded bg-muted-foreground/10 text-muted-foreground/60 shrink-0">
                                {col.type}
                              </span>
                            )}
                            <button
                              onClick={() => deleteColumn(activeSheet.id, ci)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity ml-1 shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="border border-border bg-muted w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {activeSheet.rows.map((row, ri) => (
                      <tr key={ri}>
                        <td className="border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground text-center">
                          {ri + 1}
                        </td>
                        {row.map((cell, ci) => {
                          const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                          const colType = activeSheet.columns[ci]?.type ?? "text";
                          const justFilled = ci === aiFillCol && aiFilledRows.has(ri);
                          const fillError = ci === aiFillCol && aiFillErrors.has(ri);
                          return (
                            <td
                              key={ci}
                              className={cn(
                                "border border-border p-0 min-w-[120px]",
                                isEditing && "ring-2 ring-primary/40 ring-inset",
                                isEditing && cellError && "ring-destructive/60",
                                justFilled && "bg-green-500/10",
                                fillError && "bg-destructive/10"
                              )}
                              onClick={() => {
                                if (!isEditing) {
                                  if (colType === "boolean") {
                                    // Toggle on click
                                    const next = cell.toLowerCase() === "true" ? "false" : "true";
                                    axios.put(`${API_BASE}/sheets/${activeSheet.id}/cell`, {
                                      row_index: ri, col_index: ci, value: next,
                                    }).then((res) => updateSheet(res.data)).catch(() => {});
                                  } else {
                                    startEditing(ri, ci, cell);
                                  }
                                }
                              }}
                              onDoubleClick={() => { if (colType !== "boolean") startEditing(ri, ci, cell); }}
                            >
                              {isEditing ? (
                                <div className="relative">
                                  <input
                                    ref={cellInputRef}
                                    type={colType === "number" ? "number" : colType === "date" ? "date" : "text"}
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
                                <div className="px-2 py-1 text-sm min-h-[28px] cursor-text select-none truncate">
                                  {colType === "boolean" ? (
                                    <span className={cell.toLowerCase() === "true" ? "text-green-500" : "text-muted-foreground/50"}>
                                      {cell.toLowerCase() === "true" ? "Yes" : "No"}
                                    </span>
                                  ) : (
                                    cell || <span className="text-muted-foreground/30">&nbsp;</span>
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
                    ))}
                    {activeSheet.rows.length === 0 && (
                      <tr>
                        <td colSpan={activeSheet.columns.length + 2} className="border border-border px-4 py-6 text-center text-xs text-muted-foreground">
                          No rows yet. Click "+ Row" to add one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Table2 className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">No sheet selected</p>
            <p className="text-xs mt-1 mb-4">Create a new sheet or generate one with AI.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAiGenOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" />
              Generate with AI
            </Button>
          </div>
        )}
      </div>

      {/* AI Generate overlay */}
      {aiGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!aiGenLoading) { setAiGenOpen(false); setAiGenError(null); } }}>
          <div className="bg-background border rounded-lg shadow-lg w-[420px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Generate Table with AI</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Describe the table you need and AI will create columns, types, and example data.
            </p>
            <input
              ref={aiGenRef}
              className="w-full h-8 px-3 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 mb-2"
              placeholder='e.g. "CRM for small business" or "weekly meal planner"'
              value={aiGenPrompt}
              onChange={(e) => { setAiGenPrompt(e.target.value); setAiGenError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !aiGenLoading) generateSheet(); if (e.key === "Escape" && !aiGenLoading) setAiGenOpen(false); }}
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
              <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={generateSheet} disabled={!aiGenPrompt.trim() || aiGenLoading}>
                {aiGenLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {aiGenLoading ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
