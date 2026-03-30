import React, { useState } from "react";
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
            className="bg-background border border-border rounded-lg shadow-xl w-[520px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">New Sheet</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
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
                    className="flex flex-col items-start gap-1.5 p-3 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-colors"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    </div>
                  </button>
                );
              })}

              {/* AI Generate */}
              <button
                onClick={() => { setAiGenOpen(true); setPickerOpen(false); }}
                className="flex flex-col items-start gap-1.5 p-3 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-colors"
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 w-full">
                  <p className="text-xs font-medium text-foreground">AI Generate</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Describe a sheet, AI builds it</p>
                </div>
              </button>

              {/* Import */}
              <button
                disabled={importing}
                onClick={() => { importInputRef.current?.click(); setPickerOpen(false); }}
                className="flex flex-col items-start gap-1.5 p-3 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-colors disabled:opacity-50"
              >
                {importing
                  ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                  : <Upload className="h-5 w-5 text-muted-foreground" />}
                <div className="min-w-0 w-full">
                  <p className="text-xs font-medium text-foreground">Import</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">XLSX / CSV / TSV file</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
