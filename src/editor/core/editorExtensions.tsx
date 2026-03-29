/**
 * Tiptap editor extensions and custom node views.
 *
 * Contains: ResizableImage, FontSize, LineHeight, and the base extensions array.
 * The page engine extension is added dynamically in createEditor.
 */

import { useState, useRef } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import ImageExtension from "@tiptap/extension-image";

// ── Resizable Image NodeView ─────────────────────────────────────────────────

function ResizableImageView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startW = useRef(0);
  const [isResizing, setIsResizing] = useState(false);

  function startResize(e: React.MouseEvent, side: "left" | "right") {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    startW.current =
      node.attrs.width ?? (imgRef.current?.offsetWidth ?? 300);

    function onMove(me: MouseEvent) {
      const delta = me.clientX - startX.current;
      const newW = Math.max(
        48,
        Math.round(startW.current + (side === "right" ? delta : -delta)),
      );
      updateAttributes({ width: newW });
    }
    function onUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const w = node.attrs.width ? `${node.attrs.width}px` : "auto";
  const showHandles = selected || isResizing;

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block relative group/img align-middle select-none"
      draggable
      data-drag-handle
    >
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        draggable={false}
        style={{ width: w, maxWidth: "100%", display: "block" }}
        className={
          showHandles
            ? "ring-2 ring-primary ring-offset-1 rounded-sm"
            : ""
        }
        onLoad={() => window.dispatchEvent(new Event("resize"))}
      />
      <span
        className={`absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-6 rounded bg-primary/80 cursor-ew-resize transition-opacity ${showHandles ? "opacity-100" : "opacity-0 group-hover/img:opacity-60"}`}
        onMouseDown={(e) => startResize(e, "left")}
      />
      <span
        className={`absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-6 rounded bg-primary/80 cursor-ew-resize transition-opacity ${showHandles ? "opacity-100" : "opacity-0 group-hover/img:opacity-60"}`}
        onMouseDown={(e) => startResize(e, "right")}
      />
    </NodeViewWrapper>
  );
}

const ResizableImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("width"),
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
}).configure({ inline: true, allowBase64: true });

// ── FontSize extension ───────────────────────────────────────────────────────

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const raw = el.style.fontSize;
          if (!raw) return null;
          return parseInt(raw, 10) || null;
        },
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.fontSize) return {};
          return { style: `font-size: ${attrs.fontSize}px` };
        },
      },
    };
  },
});

// ── LineHeight / paragraph spacing / indent ──────────────────────────────────

const LineHeight = Extension.create({
  name: "lineHeight",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.lineHeight) return {};
              return { style: `line-height: ${attrs.lineHeight}` };
            },
          },
          marginTop: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const v = el.style.marginTop;
              return v ? parseInt(v, 10) || null : null;
            },
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.marginTop) return {};
              return { style: `margin-top: ${attrs.marginTop}px` };
            },
          },
          marginBottom: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const v = el.style.marginBottom;
              return v ? parseInt(v, 10) || null : null;
            },
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.marginBottom) return {};
              return { style: `margin-bottom: ${attrs.marginBottom}px` };
            },
          },
          indent: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const v = el.style.paddingLeft;
              return v ? parseInt(v, 10) || null : null;
            },
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.indent) return {};
              return { style: `padding-left: ${attrs.indent}px` };
            },
          },
        },
      },
    ];
  },
});

// ── Base extensions array (without page engine) ──────────────────────────────

export const editorExtensions = [
  StarterKit.configure({ dropcursor: false, gapcursor: false }),
  Markdown,
  FontSize,
  Color,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: false }),
  FontFamily,
  Subscript,
  Superscript,
  CharacterCount,
  Typography,
  Dropcursor.configure({ color: "var(--primary)", width: 2 }),
  Gapcursor,
  Placeholder.configure({ placeholder: "Start writing..." }),
  LineHeight,
  ResizableImage,
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
];
