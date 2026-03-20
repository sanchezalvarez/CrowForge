/**
 * Hook that manages editor lifecycle — loading documents, saving,
 * and reporting context to parent.
 */

import { useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { OutlineItem } from "../utils/editorUtils";
import { extractOutline } from "../utils/editorUtils";

export interface EditorDocument {
  id: string;
  title: string;
  content_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentContext {
  title: string;
  outline: string[];
  selectedText: string | null;
  fullText: string | null;
}

interface UseEditorSetupOptions {
  editor: Editor | null;
  activeDoc: EditorDocument | null;
  activeDocId: string | null;
  outline: OutlineItem[];
  selection: { from: number; to: number; text: string } | null;
  wordCount: { words: number; chars: number };
  onContextChange?: (ctx: DocumentContext | null) => void;
  onSave: (docId: string, content: Record<string, unknown>) => void;
  onOutlineChange: (items: OutlineItem[]) => void;
}

export function useEditorSetup({
  editor,
  activeDoc,
  activeDocId,
  outline,
  selection,
  wordCount,
  onContextChange,
  onSave,
  onOutlineChange,
}: UseEditorSetupOptions) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save
  const debouncedSave = useCallback(
    (docId: string, content: Record<string, unknown>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onSave(docId, content);
      }, 1200);
    },
    [onSave],
  );

  // Load document content when activeDocId changes
  useEffect(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!editor) return;
    if (activeDoc) {
      const content = activeDoc.content_json;
      if (content && Object.keys(content).length > 0) {
        editor.commands.setContent(content);
        editor.commands.focus("end");
      } else {
        editor.commands.setContent("");
        editor.commands.focus("start");
      }
    } else {
      editor.commands.setContent("");
    }
    onOutlineChange(extractOutline(editor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, editor]);

  // Report document context to parent (Chat integration)
  useEffect(() => {
    if (!onContextChange) return;
    if (!activeDoc) {
      onContextChange(null);
      return;
    }
    onContextChange({
      title: activeDoc.title,
      outline: outline.map((h) => `${"#".repeat(h.level)} ${h.text}`),
      selectedText: selection?.text ?? null,
      fullText: editor ? editor.getText().slice(0, 8000) : null,
    });
  }, [
    activeDoc?.id,
    activeDoc?.title,
    outline,
    selection,
    onContextChange,
    wordCount,
    editor,
  ]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { debouncedSave };
}
