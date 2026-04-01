import React, { useState, useEffect } from "react";
import { PlusCircle, Sparkles, Upload, Loader2, Table2, X } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { SHEET_IMPORT_ACCEPT } from "../../lib/fileService";
import { type Sheet } from "../../lib/cellUtils";
import { SHEET_TEMPLATES, type SheetTemplate } from "../../lib/sheetTemplates";

interface SheetSidebarProps {
  sheets: Sheet[];
  activeSheetId: string | null;
  setActiveSheetId: (id: string) => void;
  renamingSheet: string | null;
  setRenamingSheet: (id: string | null) => void;
  renameSheetValue: string;
  setRenameSheetValue: (val: string) => void;
  renameSheetRef: React.RefObject<HTMLInputElement | null>;
  sheetRenameCommit: () => void;
  setSheetMenu: (menu: { sheetId: string; x: number; y: number } | null) => void;
  setTemplatePickerOpen: (open: boolean) => void;
  setAiGenOpen: (open: boolean) => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportFile: (file: File) => void;
  importing: boolean;
  createFromTemplate: (t: SheetTemplate) => void;
}

export function SheetSidebar({
  sheets,
  activeSheetId,
  setActiveSheetId,
  renamingSheet,
  setRenamingSheet,
  renameSheetValue,
  setRenameSheetValue,
  renameSheetRef,
  sheetRenameCommit,
  setSheetMenu,
  setAiGenOpen,
  importInputRef,
  handleImportFile,
  importing,
  createFromTemplate,
}: SheetSidebarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPickerOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pickerOpen]);

  return (
    <div className="w-[220px] shrink-0 border-r flex flex-col" style={{ background: 'var(--background-2)' }}>
      <div className="h-20 flex items-center px-3 border-b">
        {/* Hidden file input */}
        <input
          ref={importInputRef}
          type="file"
          accept={SHEET_IMPORT_ACCEPT}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
        />

        {/* New Sheet button */}
        <button
          className="btn-tactile btn-tactile-teal w-full justify-center"
          onClick={() => setPickerOpen(true)}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          New Sheet
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className={cn(
                "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                activeSheetId === sheet.id
                  ? "font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={activeSheetId === sheet.id ? { background: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)', color: 'var(--accent-teal)' } : {}}
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
                <span className="flex-1 min-w-0 truncate">{sheet.title}</span>
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

      {/* New Sheet Picker modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="card-riso card-riso-teal surface-noise riso-frame w-[520px] p-5 rounded-lg relative overflow-hidden animate-ink-in"
            style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-teal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Riso color strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
            <div className="flex items-center justify-between mb-4 mt-1">
              <h3 className="font-display font-black text-sm tracking-tight">New Sheet</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="btn-tactile btn-tactile-outline h-6 w-6 p-0 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Templates */}
              {SHEET_TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => { createFromTemplate(t); setPickerOpen(false); }}
                    className="flex flex-col items-start gap-1.5 p-3 rounded-md text-left transition-all duration-100"
                    style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-teal)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 var(--riso-teal)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 var(--riso-teal)"; }}
                  >
                    <Icon className="h-5 w-5" style={{ color: "var(--accent-teal)" }} />
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                      <p className="font-mono-ui text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    </div>
                  </button>
                );
              })}

              {/* AI Generate */}
              <button
                onClick={() => { setAiGenOpen(true); setPickerOpen(false); }}
                className="flex flex-col items-start gap-1.5 p-3 rounded-md text-left transition-all duration-100"
                style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 var(--riso-violet)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 var(--riso-violet)"; }}
              >
                <Sparkles className="h-5 w-5" style={{ color: "var(--accent-violet)" }} />
                <div className="min-w-0 w-full">
                  <p className="text-xs font-medium text-foreground">AI Generate</p>
                  <p className="font-mono-ui text-[10px] text-muted-foreground mt-0.5">Describe a sheet, AI builds it</p>
                </div>
              </button>

              {/* Import */}
              <button
                disabled={importing}
                onClick={() => { importInputRef.current?.click(); setPickerOpen(false); }}
                className="flex flex-col items-start gap-1.5 p-3 rounded-md text-left transition-all duration-100 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-orange)" }}
                onMouseEnter={(e) => { if (!importing) { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 var(--riso-orange)"; }}}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 var(--riso-orange)"; }}
              >
                {importing
                  ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--accent-orange)" }} />
                  : <Upload className="h-5 w-5" style={{ color: "var(--accent-orange)" }} />}
                <div className="min-w-0 w-full">
                  <p className="text-xs font-medium text-foreground">Import</p>
                  <p className="font-mono-ui text-[10px] text-muted-foreground mt-0.5">XLSX / CSV / TSV file</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
