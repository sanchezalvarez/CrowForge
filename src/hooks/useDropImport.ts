import { useState, useCallback, useRef } from "react";
import { toast } from "./useToast";
import { getFileExt } from "../lib/fileService";

/** Human-readable labels for each supported import extension. */
export const IMPORT_FORMAT_LABELS: Record<string, string> = {
  xlsx: "Excel Spreadsheet",
  xls:  "Excel Spreadsheet",
  csv:  "CSV File",
  tsv:  "TSV File",
  docx: "Word Document",
  md:   "Markdown File",
  txt:  "Plain Text File",
};

export interface DropImportState {
  /** Whether a file is currently being dragged over the drop zone. */
  isDragging: boolean;
  /** File that was dropped and is awaiting user confirmation (null = no dialog). */
  pendingFile: File | null;
  /** Confirm the pending import — calls the `onConfirm` callback then clears state. */
  confirmImport: () => void;
  /** Dismiss the pending file without importing. */
  clearPending: () => void;
  /** Spread these onto the container element that should accept drops. */
  dragProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver:  (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop:      (e: React.DragEvent) => void;
  };
}

/**
 * Manages drag-and-drop file import for a view.
 *
 * Flow:
 *   1. User drags a file over the container → `isDragging` becomes true
 *      (the component renders a drop overlay).
 *   2. User drops the file → extension is validated; if valid, `pendingFile`
 *      is set (the component shows a confirmation dialog).
 *   3. User clicks "Import" → `confirmImport()` fires `onConfirm(file)`.
 *   4. User clicks "Cancel" → `clearPending()` closes the dialog silently.
 *
 * No import ever happens without user confirmation.
 */
export function useDropImport(
  allowedExts: string[],
  onConfirm: (file: File) => void,
): DropImportState {
  const [isDragging, setIsDragging]   = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // dragEnter fires for every child element; track the count so we only
  // hide the overlay when the cursor truly leaves the container.
  const enterCount = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    enterCount.current += 1;
    if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    enterCount.current -= 1;
    if (enterCount.current <= 0) {
      enterCount.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      enterCount.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];
      const ext  = getFileExt(file);

      if (!allowedExts.includes(ext)) {
        toast(
          `Cannot import ".${ext}" here. Accepted: ${allowedExts.map((x) => `.${x}`).join(", ")}.`,
          "error",
        );
        return;
      }

      // Park the file — the component renders the confirmation dialog.
      setPendingFile(file);
    },
    [allowedExts],
  );

  const confirmImport = useCallback(() => {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    onConfirm(file);
  }, [pendingFile, onConfirm]);

  const clearPending = useCallback(() => setPendingFile(null), []);

  return {
    isDragging,
    pendingFile,
    confirmImport,
    clearPending,
    dragProps: {
      onDragEnter: handleDragEnter,
      onDragOver:  handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop:      handleDrop,
    },
  };
}
