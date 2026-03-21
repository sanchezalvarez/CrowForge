import { LayoutTemplate, Sparkles, X, Plus, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { type SheetTemplate, SHEET_TEMPLATES } from "../../lib/sheetTemplates";
import { idxToCol } from "../../lib/cellUtils";

type SelectionRect = { r1: number; c1: number; r2: number; c2: number };

export interface SheetDialogsProps {
  // Template picker
  templatePickerOpen: boolean;
  setTemplatePickerOpen: (open: boolean) => void;
  createFromTemplate: (t: SheetTemplate) => void;

  // AI Generate
  aiGenOpen: boolean;
  setAiGenOpen: (open: boolean) => void;
  aiGenPrompt: string;
  setAiGenPrompt: (v: string) => void;
  aiGenLoading: boolean;
  aiGenError: string | null;
  setAiGenError: (e: string | null) => void;
  aiGenRef: React.RefObject<HTMLInputElement | null>;
  aiGenPreview: { title: string; columns: { name: string; type: string }[] } | null;
  setAiGenPreview: (v: { title: string; columns: { name: string; type: string }[] } | null) => void;
  generateSchema: () => void;
  confirmAiGenCreate: () => void;
  aiGenUpdateCol: (i: number, field: "name" | "type", value: string) => void;
  aiGenRemoveCol: (i: number) => void;
  aiGenAddCol: () => void;

  // AI Range Operation
  aiOpOpen: boolean;
  setAiOpOpen: (open: boolean) => void;
  aiOpMode: "row-wise" | "aggregate" | "matrix";
  setAiOpMode: (mode: "row-wise" | "aggregate" | "matrix") => void;
  aiOpSourceStr: string;
  setAiOpSourceStr: (v: string) => void;
  aiOpTargetStr: string;
  setAiOpTargetStr: (v: string) => void;
  aiOpInstruction: string;
  setAiOpInstruction: (v: string) => void;
  aiOpAction: "translate" | "rewrite" | "summarize" | "custom";
  setAiOpAction: (v: "translate" | "rewrite" | "summarize" | "custom") => void;
  aiOpLanguage: string;
  setAiOpLanguage: (v: string) => void;
  aiOpModel: string;
  setAiOpModel: (v: string) => void;
  aiOpTemp: number;
  setAiOpTemp: (v: number) => void;
  aiOpLoading: boolean;
  availableModels: { name: string; id: string }[];
  runAiOp: () => void;
  selection: SelectionRect | null;

  // Generate Rows
  genRowsOpen: boolean;
  setGenRowsOpen: (open: boolean) => void;
  genRowsInstruction: string;
  setGenRowsInstruction: (v: string) => void;
  genRowsCount: number;
  setGenRowsCount: (v: number) => void;
  genRowsRunning: boolean;
  genRowsProgress: number;
  genRowsError: string | null;
  handleGenerateRows: () => void;
  cancelGenerateRows: () => void;
}

export function SheetDialogs({
  // Template picker
  templatePickerOpen,
  setTemplatePickerOpen,
  createFromTemplate,
  // AI Generate
  aiGenOpen,
  setAiGenOpen,
  aiGenPrompt,
  setAiGenPrompt,
  aiGenLoading,
  aiGenError,
  setAiGenError,
  aiGenRef,
  aiGenPreview,
  setAiGenPreview,
  generateSchema,
  confirmAiGenCreate,
  aiGenUpdateCol,
  aiGenRemoveCol,
  aiGenAddCol,
  // AI Range Operation
  aiOpOpen,
  setAiOpOpen,
  aiOpMode,
  setAiOpMode,
  aiOpSourceStr,
  setAiOpSourceStr,
  aiOpTargetStr,
  setAiOpTargetStr,
  aiOpInstruction,
  setAiOpInstruction,
  aiOpAction,
  setAiOpAction,
  aiOpLanguage,
  setAiOpLanguage,
  aiOpModel,
  setAiOpModel,
  aiOpTemp,
  setAiOpTemp,
  aiOpLoading,
  availableModels,
  runAiOp,
  selection,
  // Generate Rows
  genRowsOpen,
  setGenRowsOpen,
  genRowsInstruction,
  setGenRowsInstruction,
  genRowsCount,
  setGenRowsCount,
  genRowsRunning,
  genRowsProgress,
  genRowsError,
  handleGenerateRows,
  cancelGenerateRows,
}: SheetDialogsProps) {
  return (
    <>
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
                    onChange={(e) => setAiOpMode(e.target.value as "row-wise" | "aggregate" | "matrix")}
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
                    onChange={(e) => setAiOpAction(e.target.value as "translate" | "rewrite" | "summarize" | "custom")}
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

      {/* Generate Rows dialog */}
      {genRowsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!genRowsRunning) { setGenRowsOpen(false); cancelGenerateRows(); } }}>
          <div className="bg-background border rounded-lg shadow-lg w-[420px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Generate Rows with AI</h3>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Number of rows (1–100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="h-8 w-24 px-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40"
                  value={genRowsCount}
                  onChange={(e) => setGenRowsCount(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
                  disabled={genRowsRunning}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Instruction</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {["Random sample data", "Continue the pattern", "Diverse international records"].map((preset) => (
                    <button
                      key={preset}
                      className="px-2 py-0.5 text-xs rounded-full border border-border hover:bg-muted transition-colors"
                      onClick={() => setGenRowsInstruction(preset)}
                      disabled={genRowsRunning}
                    >{preset}</button>
                  ))}
                </div>
                <textarea
                  className="w-full min-h-[72px] p-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  placeholder='e.g. "Generate realistic customer records" or "Continue the pattern"'
                  value={genRowsInstruction}
                  onChange={(e) => setGenRowsInstruction(e.target.value)}
                  disabled={genRowsRunning}
                />
              </div>

              {genRowsRunning && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating... {genRowsProgress}/{genRowsCount} rows
                </div>
              )}
              {genRowsError && (
                <div className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {genRowsError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setGenRowsOpen(false); cancelGenerateRows(); }} disabled={false}>
                {genRowsRunning ? "Stop" : "Cancel"}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleGenerateRows}
                disabled={genRowsRunning || !genRowsInstruction.trim()}
              >
                {genRowsRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
