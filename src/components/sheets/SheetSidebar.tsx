import React, { useState, useRef, useEffect } from "react";
import { PlusCircle, Sparkles, Upload, Loader2, Table2, FileSpreadsheet, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { SHEET_IMPORT_ACCEPT } from "../../lib/fileService";
import { type Sheet } from "../../lib/cellUtils";

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
  setTemplatePickerOpen,
  setAiGenOpen,
  importInputRef,
  handleImportFile,
  importing,
}: SheetSidebarProps) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNewMenu) return;
    const close = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showNewMenu]);

  return (
    <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
      <div className="h-20 flex items-center px-3 border-b">
        {/* Hidden file input */}
        <input
          ref={importInputRef}
          type="file"
          accept={SHEET_IMPORT_ACCEPT}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
        />

        {/* New Sheet button + dropdown */}
        <div className="relative" ref={newMenuRef}>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={() => setShowNewMenu((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4" />
              New Sheet
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>

          {showNewMenu && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-background border border-border rounded-md shadow-lg py-1 text-sm">
              <button
                className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2.5"
                onClick={() => { setTemplatePickerOpen(true); setShowNewMenu(false); }}
              >
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <div className="font-medium text-xs">Blank / Template</div>
                  <div className="text-[11px] text-muted-foreground">Start from scratch or a preset</div>
                </div>
              </button>
              <button
                className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2.5"
                onClick={() => { setAiGenOpen(true); setShowNewMenu(false); }}
              >
                <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <div className="font-medium text-xs">AI Generate</div>
                  <div className="text-[11px] text-muted-foreground">Describe a sheet, AI builds it</div>
                </div>
              </button>
              <button
                className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2.5"
                disabled={importing}
                onClick={() => { importInputRef.current?.click(); setShowNewMenu(false); }}
              >
                {importing
                  ? <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                  : <Upload className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div>
                  <div className="font-medium text-xs">Import</div>
                  <div className="text-[11px] text-muted-foreground">XLSX / CSV / TSV file</div>
                </div>
              </button>
            </div>
          )}
        </div>
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
    </div>
  );
}
