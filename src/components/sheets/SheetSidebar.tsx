import React from "react";
import { PlusCircle, Sparkles, Upload, Download, Loader2, Table2 } from "lucide-react";
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
  handleExportAllXLSX: () => void;
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
  handleExportAllXLSX,
}: SheetSidebarProps) {
  return (
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
  );
}
