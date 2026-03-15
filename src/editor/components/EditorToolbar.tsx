/**
 * Formatting toolbar for the document editor.
 * Receives editor instance and page settings as props.
 */

import { useState, useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Heading1, Heading2, List, Download, ChevronDown,
  Underline as UnderlineIcon, Strikethrough, AlignLeft as AlignLeftIcon,
  AlignCenter, AlignRight, Highlighter, Image as ImageIcon, Search,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  ListOrdered, Quote, Minus, Link as LinkIcon, Unlink, Type, Maximize2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import type { PageSettings } from "../config/pageSettings";
import {
  DOCUMENT_EXPORT_FORMATS,
  type DocExportFormat,
} from "../services/fileService";

interface EditorToolbarProps {
  editor: Editor;
  pageSettings: PageSettings;
  pageSettingsOpen: boolean;
  searchOpen: boolean;
  onPageSettingsOpenChange: (open: boolean) => void;
  onSearchOpenChange: (open: boolean) => void;
  onExport: (fmt: DocExportFormat) => void;
  onImageInsert: (file: File) => void;
  onPageSettingsChange: (ps: PageSettings) => void;
  onSavePageSettings: (ps: PageSettings) => void;
}

export function EditorToolbar({
  editor,
  pageSettings,
  pageSettingsOpen,
  searchOpen,
  onPageSettingsOpenChange,
  onSearchOpenChange,
  onExport,
  onImageInsert,
  onPageSettingsChange,
  onSavePageSettings,
}: EditorToolbarProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [exportDocOpen, setExportDocOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-b px-4 py-1 flex items-center gap-1 bg-background">
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

      {/* Page settings popover */}
      <div className="relative" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <Button variant={pageSettingsOpen ? "secondary" : "ghost"} size="sm" className="h-7 text-xs gap-1 px-2" title="Page settings" onClick={() => onPageSettingsOpenChange(!pageSettingsOpen)}>
          <Maximize2 className="h-3.5 w-3.5" /> Page
        </Button>
        {pageSettingsOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg p-3 w-[220px] flex flex-col gap-3">
            {/* Size */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Size</p>
              <div className="flex flex-wrap gap-1">
                {(["a4", "letter", "legal", "a5"] as const).map((sz) => (
                  <button key={sz} className={`h-6 px-2 rounded text-xs border transition-colors ${pageSettings.size === sz ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    onClick={() => { const next = { ...pageSettings, size: sz }; onPageSettingsChange(next); onSavePageSettings(next); }}>
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {/* Orientation */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Orientation</p>
              <div className="flex gap-1">
                {(["portrait", "landscape"] as const).map((ori) => (
                  <button key={ori} className={`h-6 px-2 rounded text-xs border transition-colors capitalize ${pageSettings.orientation === ori ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    onClick={() => { const next = { ...pageSettings, orientation: ori }; onPageSettingsChange(next); onSavePageSettings(next); }}>
                    {ori}
                  </button>
                ))}
              </div>
            </div>
            {/* Margins */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Margins</p>
              <div className="flex gap-1">
                {(["normal", "narrow", "wide"] as const).map((m) => (
                  <button key={m} className={`h-6 px-2 rounded text-xs border transition-colors capitalize ${pageSettings.margins === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    onClick={() => { const next = { ...pageSettings, margins: m }; onPageSettingsChange(next); onSavePageSettings(next); }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {/* Header */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Header</p>
              <input type="text" className="w-full h-6 px-2 rounded text-xs border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Header text..."
                value={pageSettings.headerText ?? ""}
                onChange={(e) => onPageSettingsChange({ ...pageSettings, headerText: e.target.value })}
                onBlur={() => onSavePageSettings(pageSettings)} />
            </div>
            {/* Footer */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Footer</p>
              <input type="text" className="w-full h-6 px-2 rounded text-xs border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Footer text..."
                value={pageSettings.footerText ?? ""}
                onChange={(e) => onPageSettingsChange({ ...pageSettings, footerText: e.target.value })}
                onBlur={() => onSavePageSettings(pageSettings)} />
            </div>
            {/* Page numbers */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Page Numbers</p>
                <button className={`h-4 w-7 rounded-full transition-colors relative ${(pageSettings.showPageNumbers ?? true) ? "bg-primary" : "bg-border"}`}
                  onClick={() => { const next = { ...pageSettings, showPageNumbers: !(pageSettings.showPageNumbers ?? true) }; onPageSettingsChange(next); onSavePageSettings(next); }}>
                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${(pageSettings.showPageNumbers ?? true) ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </button>
              </div>
              {(pageSettings.showPageNumbers ?? true) && (
                <div className="flex gap-1">
                  {(["header", "footer"] as const).map((pos) => (
                    <button key={pos} className={`h-6 px-2 rounded text-xs border transition-colors capitalize ${(pageSettings.pageNumberPosition ?? "footer") === pos ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      onClick={() => { const next = { ...pageSettings, pageNumberPosition: pos }; onPageSettingsChange(next); onSavePageSettings(next); }}>
                      {pos}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
