/**
 * Formatting toolbar for the document editor.
 */

import { useState, useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Heading1, Heading2, List, Download, ChevronDown,
  Underline as UnderlineIcon, Strikethrough, AlignLeft as AlignLeftIcon,
  AlignCenter, AlignRight, Highlighter, Image as ImageIcon, Search,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  ListOrdered, Quote, Minus, Link as LinkIcon, Unlink, Type,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  DOCUMENT_EXPORT_FORMATS,
  type DocExportFormat,
} from "../services/fileService";

interface EditorToolbarProps {
  editor: Editor;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  onExport: (fmt: DocExportFormat) => void;
  onImageInsert: (file: File) => void;
}

export function EditorToolbar({
  editor,
  searchOpen,
  onSearchOpenChange,
  onExport,
  onImageInsert,
}: EditorToolbarProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [exportDocOpen, setExportDocOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-b px-4 pt-[6px] pb-[8.5px] flex items-center gap-1 bg-background">
      {/* Headings */}
      <Button
        variant={editor.isActive("heading", { level: 1 }) ? "secondary" : "ghost"}
        size="sm" className="h-7 w-7 p-0"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
        size="sm" className="h-7 w-7 p-0"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />

      {/* Inline formatting */}
      <Button variant={editor.isActive("bold") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive("italic") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive("underline") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive("strike") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive("subscript") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript">
        <SubscriptIcon className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive("superscript") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript">
        <SuperscriptIcon className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />

      {/* Alignment */}
      <Button variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">
        <AlignLeftIcon className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center">
        <AlignCenter className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">
        <AlignRight className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />

      {/* Highlight + Color */}
      <Button variant={editor.isActive("highlight") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight">
        <Highlighter className="h-3.5 w-3.5" />
      </Button>
      <div className="relative">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" title="Text color" onClick={() => setColorPickerOpen((o) => !o)}>
          <Type className="h-3.5 w-3.5" />
          {editor.getAttributes("textStyle").color && (
            <div className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded" style={{ backgroundColor: editor.getAttributes("textStyle").color }} />
          )}
        </Button>
        {colorPickerOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-lg p-2 grid grid-cols-6 gap-1 w-[156px]" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            {["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#ffffff", "#991b1b", "#9a3412"].map((c) => (
              <button key={c} className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }} onClick={() => { editor.chain().focus().setColor(c).run(); setColorPickerOpen(false); }} />
            ))}
            <button className="col-span-6 text-[10px] text-muted-foreground hover:text-foreground mt-0.5" onClick={() => { editor.chain().focus().unsetColor().run(); setColorPickerOpen(false); }}>
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Font family */}
      <select
        className="h-7 text-xs border border-border rounded bg-background px-1 cursor-pointer"
        title="Font family"
        value={editor.getAttributes("textStyle").fontFamily ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          if (!val) editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(val).run();
        }}
      >
        <option value="">Default</option>
        <option value="serif">Serif</option>
        <option value="monospace">Mono</option>
      </select>

      {/* Font size */}
      <select
        className="h-7 text-xs border border-border rounded bg-background px-1 cursor-pointer"
        title="Font size"
        value={(() => {
          const fs = editor.getAttributes("textStyle").fontSize;
          return fs ? String(fs) : "";
        })()}
        onChange={(e) => {
          const val = e.target.value;
          if (!val) editor.chain().focus().setMark("textStyle", { fontSize: null }).run();
          else editor.chain().focus().setMark("textStyle", { fontSize: Number(val) }).run();
        }}
      >
        <option value="">Size</option>
        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Line height */}
      <select
        className="h-7 text-xs border border-border rounded bg-background px-1 cursor-pointer"
        title="Line height"
        value={(() => {
          const lh = editor.getAttributes("paragraph").lineHeight ?? editor.getAttributes("heading").lineHeight ?? "";
          return lh ? String(lh) : "";
        })()}
        onChange={(e) => {
          const val = e.target.value;
          if (!val) editor.chain().focus().updateAttributes("paragraph", { lineHeight: null }).updateAttributes("heading", { lineHeight: null }).run();
          else editor.chain().focus().updateAttributes("paragraph", { lineHeight: val }).updateAttributes("heading", { lineHeight: val }).run();
        }}
      >
        <option value="">LH</option>
        {[["1", "1.0"], ["1.15", "1.15"], ["1.5", "1.5"], ["2", "2.0"], ["2.5", "2.5"], ["3", "3.0"]].map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <div className="w-px h-4 bg-border mx-1" />

      {/* Lists + block */}
      <Button variant={editor.isActive("bulletList") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive("orderedList") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
      <Button variant={editor.isActive("blockquote") ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
        <Quote className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />

      {/* Link */}
      <div className="relative">
        <Button
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          size="sm" className="h-7 w-7 p-0" title="Insert link"
          onClick={() => {
            if (editor.isActive("link")) editor.chain().focus().unsetLink().run();
            else { setLinkUrl(editor.getAttributes("link").href ?? ""); setLinkInputOpen((o) => !o); }
          }}
        >
          {editor.isActive("link") ? <Unlink className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
        </Button>
        {linkInputOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-lg p-2 flex gap-1 w-[260px]" onMouseDown={(e) => e.stopPropagation()}>
            <input
              className="flex-1 text-xs border border-border rounded px-1.5 py-1 bg-background"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && linkUrl.trim()) { editor.chain().focus().setLink({ href: linkUrl.trim() }).run(); setLinkInputOpen(false); setLinkUrl(""); }
                else if (e.key === "Escape") setLinkInputOpen(false);
              }}
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => { if (linkUrl.trim()) editor.chain().focus().setLink({ href: linkUrl.trim() }).run(); setLinkInputOpen(false); setLinkUrl(""); }}>
              OK
            </Button>
          </div>
        )}
      </div>
      <div className="w-px h-4 bg-border mx-1" />

      {/* Image insert */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageInsert(f); e.target.value = ""; }} />
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => imageInputRef.current?.click()} title="Insert image">
        <ImageIcon className="h-3.5 w-3.5" />
      </Button>

      {/* Search toggle */}
      <Button variant={searchOpen ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0"
        onClick={() => onSearchOpenChange(!searchOpen)} title="Search & Replace (Ctrl+F)">
        <Search className="h-3.5 w-3.5" />
      </Button>

      <div className="flex-1" />

      {/* Export dropdown */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setExportDocOpen((o) => !o)} title="Export document">
          <Download className="h-3 w-3" /> Export <ChevronDown className="h-3 w-3" />
        </Button>
        {exportDocOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[140px]">
            {DOCUMENT_EXPORT_FORMATS.map(([fmt, label]) => (
              <button key={fmt} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                onClick={() => { onExport(fmt); setExportDocOpen(false); }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
