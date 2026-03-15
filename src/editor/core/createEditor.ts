/**
 * Custom hook that creates a configured Tiptap editor instance.
 */

import { useRef } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { editorExtensions } from "./editorExtensions";
import { extractOutline } from "../utils/editorUtils";
import type { OutlineItem } from "../utils/editorUtils";

export interface EditorCallbacks {
  onOutlineChange: (items: OutlineItem[]) => void;
  onContentChange: (json: Record<string, unknown>) => void;
  onSelectionChange: (sel: { from: number; to: number; text: string } | null) => void;
  onWordCountChange: (wc: { words: number; chars: number }) => void;
  handleKeyDown?: (event: KeyboardEvent) => boolean;
}

export function useDocumentEditor(
  callbacks: EditorCallbacks,
): Editor | null {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const outlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-full",
      },
      handleKeyDown: (_view, event) => {
        return cbRef.current.handleKeyDown?.(event) ?? false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Debounce outline extraction for large documents
      if (outlineTimer.current) clearTimeout(outlineTimer.current);
      outlineTimer.current = setTimeout(() => {
        cbRef.current.onOutlineChange(extractOutline(ed));
      }, 300);
      cbRef.current.onContentChange(ed.getJSON());
      const chars = ed.storage.characterCount.characters();
      const words = ed.storage.characterCount.words();
      cbRef.current.onWordCountChange({ words, chars });
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      if (from === to) {
        cbRef.current.onSelectionChange(null);
        return;
      }
      const text = ed.state.doc.textBetween(from, to, "\n");
      cbRef.current.onSelectionChange({ from, to, text });
    },
  });

  return editor;
}
