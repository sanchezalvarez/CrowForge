import { LayoutTemplate, Sparkles, X, Plus, AlertCircle, Loader2 } from "lucide-react";
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
          <div
            className="card-riso card-riso-teal surface-noise riso-frame w-[480px] p-5 rounded-lg relative overflow-hidden animate-ink-in"
            style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-teal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Riso color strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
            <div className="flex items-center gap-2 mb-4 mt-1">
              <LayoutTemplate className="h-4 w-4" style={{ color: "var(--accent-teal)" }} />
              <h3 className="font-display font-black text-sm tracking-tight">Create from Template</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SHEET_TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => createFromTemplate(t)}
                    className="flex items-start gap-3 p-3 rounded-md text-left transition-all duration-100"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-teal)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 var(--riso-teal)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 var(--riso-teal)"; }}
                  >
                    <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--accent-teal)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                      {t.columns.length > 0 && (
                        <p className="font-mono-ui text-[10px] text-muted-foreground/60 mt-1 truncate">
                          {t.columns.map((c) => c.name).join(" · ")}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button className="btn-tactile btn-tactile-outline" onClick={() => setTemplatePickerOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate overlay — two-phase: prompt → preview → create */}
      {aiGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!aiGenLoading) { setAiGenOpen(false); setAiGenError(null); setAiGenPreview(null); } }}>
          <div
            className="card-riso card-riso-violet surface-noise riso-frame w-[480px] p-5 rounded-lg relative overflow-hidden animate-ink-in"
            style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-violet)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Riso color strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
            <div className="flex items-center gap-2 mb-4 mt-1">
              <Sparkles className="h-4 w-4" style={{ color: "var(--accent-violet)" }} />
              <h3 className="font-display font-black text-sm tracking-tight">
                {aiGenPreview ? "Review Table Schema" : "Generate Table with AI"}
              </h3>
            </div>

            {!aiGenPreview ? (
              <>
                <p className="font-mono-ui text-xs text-muted-foreground mb-3">
                  Describe the table you need. AI will suggest a name and columns for your review.
                </p>
                <input
                  ref={aiGenRef}
                  className="w-full h-8 px-3 font-mono-ui text-xs rounded-md outline-none mb-2 transition-all"
                  style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
                  placeholder='e.g. "CRM for small business" or "weekly meal planner"'
                  value={aiGenPrompt}
                  onChange={(e) => { setAiGenPrompt(e.target.value); setAiGenError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !aiGenLoading) generateSchema(); if (e.key === "Escape" && !aiGenLoading) setAiGenOpen(false); }}
                  disabled={aiGenLoading}
                />
                {aiGenError && (
                  <p className="font-mono-ui text-xs text-destructive flex items-center gap-1 mb-2">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {aiGenError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button className="btn-tactile btn-tactile-outline" onClick={() => { setAiGenOpen(false); setAiGenError(null); }} disabled={aiGenLoading}>
                    Cancel
                  </button>
                  <button className="btn-tactile btn-tactile-violet gap-1" onClick={generateSchema} disabled={!aiGenPrompt.trim() || aiGenLoading}>
                    {aiGenLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {aiGenLoading ? "Generating..." : "Generate"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Preview phase: editable title + columns */}
                <div className="mb-3">
                  <label className="riso-section-label mb-1 block">Table name</label>
                  <input
                    className="w-full h-8 px-3 font-mono-ui text-xs rounded-md outline-none"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
                    value={aiGenPreview.title}
                    onChange={(e) => setAiGenPreview({ ...aiGenPreview, title: e.target.value })}
                  />
                </div>

                <label className="riso-section-label mb-1 block">Columns</label>
                <div className="rounded-md mb-3 max-h-[240px] overflow-auto" style={{ border: "1.5px solid var(--border-strong)" }}>
                  {aiGenPreview.columns.map((col, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                      <input
                        className="flex-1 h-6 px-1.5 font-mono-ui text-xs rounded outline-none"
                        style={{ border: "1px solid var(--border-strong)", background: "var(--background)" }}
                        value={col.name}
                        onChange={(e) => aiGenUpdateCol(i, "name", e.target.value)}
                      />
                      <select
                        className="h-6 px-1 font-mono-ui text-xs rounded outline-none"
                        style={{ border: "1px solid var(--border-strong)", background: "var(--background)" }}
                        value={col.type}
                        onChange={(e) => aiGenUpdateCol(i, "type", e.target.value)}
                      >
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="date">date</option>
                      </select>
                      <button onClick={() => aiGenRemoveCol(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={aiGenAddCol}
                    className="w-full px-2 py-1.5 font-mono-ui text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 justify-center transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add column
                  </button>
                </div>

                <div className="flex justify-between">
                  <button className="btn-tactile btn-tactile-outline" onClick={() => setAiGenPreview(null)}>
                    Back
                  </button>
                  <div className="flex gap-2">
                    <button className="btn-tactile btn-tactile-outline" onClick={() => { setAiGenOpen(false); setAiGenPreview(null); }}>
                      Cancel
                    </button>
                    <button
                      className="btn-tactile btn-tactile-violet gap-1"
                      onClick={confirmAiGenCreate}
                      disabled={aiGenPreview.columns.length === 0 || aiGenPreview.columns.some((c) => !c.name.trim())}
                    >
                      Create Table
                    </button>
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
          <div
            className="card-riso card-riso-violet surface-noise riso-frame w-[440px] p-5 rounded-lg relative overflow-hidden animate-ink-in"
            style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-violet)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Riso color strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
            <div className="flex items-center gap-2 mb-4 mt-1">
              <Sparkles className="h-4 w-4" style={{ color: "var(--accent-violet)" }} />
              <h3 className="font-display font-black text-sm tracking-tight">AI Range Operation</h3>
            </div>

            <div className="space-y-3 mb-4">
              {/* Mode Selection */}
              <div className="grid grid-cols-4 items-center gap-3">
                <label className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground text-right">Mode</label>
                <div className="col-span-3">
                  <select
                    className="w-full h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
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
                <label className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground text-right">Action</label>
                <div className="col-span-3 flex gap-2">
                  <select
                    className="flex-1 h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
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
                      className="flex-1 h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                      style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)" }}
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
                <label className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground text-right">Source</label>
                <div className="col-span-3 flex gap-2">
                  <input
                    className="flex-1 h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-teal)" }}
                    placeholder="e.g. A1:A10"
                    value={aiOpSourceStr}
                    onChange={(e) => setAiOpSourceStr(e.target.value)}
                  />
                  <button className="btn-tactile btn-tactile-teal" onClick={() => {
                    if (selection) {
                      if (selection.r1 === selection.r2 && selection.c1 === selection.c2) {
                        setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                      } else {
                        setAiOpSourceStr(`${idxToCol(selection.c1)}${selection.r1 + 1}:${idxToCol(selection.c2)}${selection.r2 + 1}`);
                      }
                    }
                  }}>Select</button>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <label className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground text-right">Target</label>
                <div className="col-span-3 flex gap-2">
                  <input
                    className="flex-1 h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-teal)" }}
                    placeholder="Start cell (e.g. B1)"
                    value={aiOpTargetStr}
                    onChange={(e) => setAiOpTargetStr(e.target.value)}
                  />
                  <button className="btn-tactile btn-tactile-teal" onClick={() => {
                    if (selection) {
                      setAiOpTargetStr(`${idxToCol(selection.c1)}${selection.r1 + 1}`);
                    }
                  }}>Select</button>
                </div>
              </div>

              {/* Instruction */}
              <div className="grid grid-cols-4 items-start gap-3">
                <label className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground text-right mt-1.5">Prompt</label>
                <textarea
                  className="col-span-3 min-h-[72px] w-full p-2 font-mono-ui text-xs rounded-md outline-none resize-none"
                  style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
                  placeholder={aiOpAction === "custom" ? 'e.g. "Fix formatting", "Make it more professional"' : 'Autogenerated from action'}
                  value={aiOpAction === "custom" ? aiOpInstruction : ""}
                  onChange={(e) => setAiOpInstruction(e.target.value)}
                  disabled={aiOpAction !== "custom"}
                />
              </div>

              {/* Model & Creativity */}
              <div className="grid grid-cols-4 items-center gap-3">
                <label className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground text-right">Model</label>
                <div className="col-span-3">
                  <select
                    className="w-full h-7 px-2 font-mono-ui text-xs rounded-md outline-none"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)" }}
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
                <label className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground text-right">Creativity</label>
                <div className="col-span-3 flex items-center gap-3">
                  <input
                    type="range"
                    min="0" max="1" step="0.1"
                    className="flex-1 h-2"
                    value={aiOpTemp}
                    onChange={(e) => setAiOpTemp(parseFloat(e.target.value))}
                  />
                  <span className="font-mono-ui text-xs text-muted-foreground w-8 text-right">{aiOpTemp}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn-tactile btn-tactile-outline" onClick={() => setAiOpOpen(false)} disabled={aiOpLoading}>
                Cancel
              </button>
              <button className="btn-tactile btn-tactile-violet gap-1" onClick={runAiOp} disabled={aiOpLoading}>
                {aiOpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Rows dialog */}
      {genRowsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!genRowsRunning) { setGenRowsOpen(false); cancelGenerateRows(); } }}>
          <div
            className="card-riso card-riso-orange surface-noise riso-frame w-[420px] p-5 rounded-lg relative overflow-hidden animate-ink-in"
            style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-orange)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Riso color strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
            <div className="flex items-center gap-2 mb-4 mt-1">
              <Sparkles className="h-4 w-4" style={{ color: "var(--accent-orange)" }} />
              <h3 className="font-display font-black text-sm tracking-tight">Generate Rows with AI</h3>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="riso-section-label mb-1.5 block">Number of rows (1–100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="h-7 w-24 px-2 font-mono-ui text-xs rounded-md outline-none"
                  style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-orange)" }}
                  value={genRowsCount}
                  onChange={(e) => setGenRowsCount(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
                  disabled={genRowsRunning}
                />
              </div>

              <div>
                <label className="riso-section-label mb-1.5 block">Instruction</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {["Random sample data", "Continue the pattern", "Diverse international records"].map((preset) => (
                    <button
                      key={preset}
                      className="px-2 py-0.5 font-mono-ui text-[10px] rounded-full transition-colors"
                      style={{ border: "1px solid var(--border-strong)", background: "var(--background-2)" }}
                      onClick={() => setGenRowsInstruction(preset)}
                      disabled={genRowsRunning}
                    >{preset}</button>
                  ))}
                </div>
                <textarea
                  className="w-full min-h-[72px] p-2 font-mono-ui text-xs rounded-md outline-none resize-none"
                  style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-orange)" }}
                  placeholder='e.g. "Generate realistic customer records" or "Continue the pattern"'
                  value={genRowsInstruction}
                  onChange={(e) => setGenRowsInstruction(e.target.value)}
                  disabled={genRowsRunning}
                />
              </div>

              {genRowsRunning && (
                <div className="flex items-center gap-2 font-mono-ui text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--accent-orange)" }} />
                  Generating... {genRowsProgress}/{genRowsCount} rows
                </div>
              )}
              {genRowsError && (
                <div className="font-mono-ui text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {genRowsError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn-tactile btn-tactile-outline" onClick={() => { setGenRowsOpen(false); cancelGenerateRows(); }}>
                {genRowsRunning ? "Stop" : "Cancel"}
              </button>
              <button
                className="btn-tactile btn-tactile-orange gap-1"
                onClick={handleGenerateRows}
                disabled={genRowsRunning || !genRowsInstruction.trim()}
              >
                {genRowsRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
