/**
 * DocumentEditor — main editor component.
 *
 * Composes: Tiptap editor, toolbar, AI actions, search/replace,
 * outline panel, and suggestion panels.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  FileText, Loader2, Type, RefreshCw, AlignLeft, Maximize2, SpellCheck,
  Check, X, AlertCircle, Upload, ChevronDown, ChevronUp,
  Replace, Sparkles,
} from "lucide-react";
import { EditorContent } from "@tiptap/react";
import { Fragment } from "@tiptap/pm/model";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { toast } from "../hooks/useToast";
import { useDropImport, IMPORT_FORMAT_LABELS } from "../hooks/useDropImport";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import {
  validateImportFile,
  parseDocumentImport,
  exportDocumentAs,
  DOCUMENT_IMPORT_EXTS,
  type DocExportFormat,
} from "./services/fileService";
import { useDocumentEditor } from "./core/createEditor";
import { useEditorSetup, type EditorDocument, type DocumentContext } from "./hooks/useEditorSetup";
import { htmlToFragment, parseHtmlToBlocks, type OutlineItem, type SuggestionBlock } from "./utils/editorUtils";
import { EditorToolbar } from "./components/EditorToolbar";
import type { TuningParams } from "../components/AIControlPanel";

const AI_ACTIONS = [
  { key: "rewrite", label: "Rewrite", icon: RefreshCw },
  { key: "summarize", label: "Summarize", icon: AlignLeft },
  { key: "expand", label: "Expand", icon: Maximize2 },
  { key: "fix_grammar", label: "Fix grammar", icon: SpellCheck },
] as const;

const API_BASE = "http://127.0.0.1:8000";

export interface DocumentEditorProps {
  activeDoc: EditorDocument;
  activeDocId: string;
  activeEngine: string;
  tuningParams?: TuningParams;
  onSaveContent: (docId: string, content: Record<string, unknown>) => void;
  onUpdateTitle: (docId: string, title: string) => Promise<void>;
  onDocumentCreated: (doc: EditorDocument) => void;
  onTitleInputChange: (docId: string, newTitle: string) => void;
  onContextChange?: (ctx: DocumentContext | null) => void;
}

export function DocumentEditor({
  activeDoc,
  activeDocId,
  activeEngine,
  tuningParams,
  onSaveContent,
  onUpdateTitle,
  onDocumentCreated,
  onTitleInputChange,
  onContextChange,
}: DocumentEditorProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBlocks, setAiBlocks] = useState<SuggestionBlock[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [outlineWidth, setOutlineWidth] = useState(180);
  const outlineResizing = useRef(false);
  const outlineResizeStart = useRef(0);
  const outlineWidthStart = useRef(180);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });
  const pendingRange = useRef<{ from: number; to: number } | null>(null);
  const pendingOriginalText = useRef<string | null>(null);
  const pendingDocId = useRef<string | null>(null);
  const [savedRecently, setSavedRecently] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [searchMatches, setSearchMatches] = useState<{ from: number; to: number }[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [importing, setImporting] = useState(false);
  const importDocInputRef = useRef<HTMLInputElement>(null);
  const runAiActionRef = useRef<(action: string) => void>(() => {});

  // ── Editor ───────────────────────────────────────────────────────────────
  const editor = useDocumentEditor({
    onOutlineChange: setOutline,
    onContentChange: (json) => {
      if (!activeDocId) return;
      debouncedSave(activeDocId, json);
    },
    onSelectionChange: setSelection,
    onWordCountChange: setWordCount,
    handleKeyDown: (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "j") {
        event.preventDefault();
        runAiActionRef.current("rewrite");
        return true;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        setSearchOpen(true);
        return true;
      }
      return false;
    },
  });

  // ── Setup (document loading, context reporting, etc.) ────────────────────
  const saveContent = useCallback(async (docId: string, content: Record<string, unknown>) => {
    setSaving(true);
    try {
      onSaveContent(docId, content);
      setSavedRecently(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedRecently(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [onSaveContent]);

  const { debouncedSave } = useEditorSetup({
    editor,
    activeDoc,
    activeDocId,
    outline,
    selection,
    wordCount,
    onContextChange,
    onSave: saveContent,
    onOutlineChange: setOutline,
  });

  // Reset AI state when document changes
  useEffect(() => {
    setAiBlocks([]);
    setAiError(null);
    pendingRange.current = null;
    pendingOriginalText.current = null;
    pendingDocId.current = null;
    setSelection(null);
  }, [activeDocId]);

  // Outline panel resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!outlineResizing.current) return;
      const delta = e.clientX - outlineResizeStart.current;
      setOutlineWidth(Math.max(120, Math.min(400, outlineWidthStart.current + delta)));
    };
    const onUp = () => { outlineResizing.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // ── AI Actions ───────────────────────────────────────────────────────────
  useEffect(() => { runAiActionRef.current = runAiAction; });

  async function runAiAction(actionType: string) {
    if (!selection) return;
    pendingRange.current = { from: selection.from, to: selection.to };
    pendingOriginalText.current = selection.text;
    pendingDocId.current = activeDocId;
    setAiLoading(true);
    setAiBlocks([]);
    setAiError(null);
    try {
      const res = await axios.post(`${API_BASE}/documents/ai`, {
        action_type: actionType,
        selected_text: selection.text,
        temperature: tuningParams?.temperature,
        max_tokens: tuningParams?.maxTokens,
      });
      const html = res.data.html as string | undefined;
      if (typeof html === "string" && html.trim()) {
        const blocks = parseHtmlToBlocks(html);
        if (blocks.length > 0) setAiBlocks(blocks);
        else { setAiError("AI returned empty response. No changes were made."); resetPending(); }
      } else { setAiError("AI returned empty response. No changes were made."); resetPending(); }
    } catch {
      setAiError("AI request failed. No changes were made.");
      setAiBlocks([]);
      resetPending();
    } finally {
      setAiLoading(false);
    }
  }

  function resetPending() {
    pendingRange.current = null;
    pendingOriginalText.current = null;
    pendingDocId.current = null;
  }

  function insertBlock(block: SuggestionBlock) {
    if (!editor || !pendingRange.current) return;
    if (pendingDocId.current !== activeDocId) { dismissSuggestions(); return; }
    const docSize = editor.state.doc.content.size;
    const from = Math.min(pendingRange.current.from, docSize);
    const to = Math.min(pendingRange.current.to, docSize);
    const parsed = htmlToFragment(editor.state.schema, block.html);
    const nodes: import("@tiptap/pm/model").Node[] = [];
    const schema = editor.state.schema;
    if (from > 1) nodes.push(schema.nodes.paragraph.create());
    for (let i = 0; i < parsed.content.childCount; i++) nodes.push(parsed.content.child(i));
    nodes.push(schema.nodes.paragraph.create());
    const tr = editor.state.tr;
    tr.delete(from, to);
    tr.insert(from, Fragment.from(nodes));
    editor.view.dispatch(tr);
    const newPos = from + nodes.reduce((s, n) => s + n.nodeSize, 0);
    pendingRange.current = { from: newPos, to: newPos };
    setAiBlocks((prev) => prev.filter((b) => b !== block));
  }

  function insertAll() {
    if (!editor || !pendingRange.current || aiBlocks.length === 0) return;
    if (pendingDocId.current !== activeDocId) { dismissSuggestions(); return; }
    const docSize = editor.state.doc.content.size;
    const from = Math.min(pendingRange.current.from, docSize);
    const to = Math.min(pendingRange.current.to, docSize);
    const fullHtml = aiBlocks.map((b) => b.html).join("");
    const parsed = htmlToFragment(editor.state.schema, fullHtml);
    const nodes: import("@tiptap/pm/model").Node[] = [];
    const schema = editor.state.schema;
    if (from > 1) nodes.push(schema.nodes.paragraph.create());
    for (let i = 0; i < parsed.content.childCount; i++) nodes.push(parsed.content.child(i));
    nodes.push(schema.nodes.paragraph.create());
    const tr = editor.state.tr;
    tr.delete(from, to);
    tr.insert(from, Fragment.from(nodes));
    editor.view.dispatch(tr);
    setAiBlocks([]);
    setAiError(null);
    resetPending();
  }

  function dismissSuggestions() {
    setAiBlocks([]);
    setAiError(null);
    resetPending();
  }

  // ── Image insert ─────────────────────────────────────────────────────────
  function handleImageInsert(file: File) {
    if (!editor) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }

  // ── Search & Replace ─────────────────────────────────────────────────────
  function findMatches(term: string): { from: number; to: number }[] {
    if (!editor || !term) return [];
    const matches: { from: number; to: number }[] = [];
    const lower = term.toLowerCase();
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      const text = (node.text ?? "").toLowerCase();
      let idx = 0;
      while (true) {
        const found = text.indexOf(lower, idx);
        if (found === -1) break;
        matches.push({ from: pos + found, to: pos + found + term.length });
        idx = found + 1;
      }
    });
    return matches;
  }

  function gotoMatch(matches: { from: number; to: number }[], idx: number) {
    if (!editor || matches.length === 0) return;
    const m = matches[idx];
    editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).run();
    const dom = editor.view.domAtPos(m.from);
    const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function searchNext() {
    const matches = findMatches(searchTerm);
    setSearchMatches(matches);
    if (matches.length === 0) return;
    const next = (searchIndex + 1) % matches.length;
    setSearchIndex(next);
    gotoMatch(matches, next);
  }

  function searchPrev() {
    const matches = findMatches(searchTerm);
    setSearchMatches(matches);
    if (matches.length === 0) return;
    const prev = (searchIndex - 1 + matches.length) % matches.length;
    setSearchIndex(prev);
    gotoMatch(matches, prev);
  }

  function replaceCurrent() {
    if (!editor || searchMatches.length === 0) return;
    const m = searchMatches[searchIndex];
    editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).insertContent(replaceTerm).run();
    const newMatches = findMatches(searchTerm);
    setSearchMatches(newMatches);
    const next = Math.min(searchIndex, newMatches.length - 1);
    setSearchIndex(Math.max(0, next));
    if (newMatches.length > 0) gotoMatch(newMatches, Math.max(0, next));
  }

  function replaceAllMatches() {
    if (!editor || !searchTerm) return;
    const matches = findMatches(searchTerm);
    if (matches.length === 0) return;
    const tr = editor.state.tr;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (replaceTerm) tr.replaceWith(m.from, m.to, editor.state.schema.text(replaceTerm));
      else tr.delete(m.from, m.to);
    }
    editor.view.dispatch(tr);
    setSearchMatches([]);
    setSearchIndex(0);
  }

  // ── Import ───────────────────────────────────────────────────────────────
  const { isDragging, pendingFile, confirmImport, clearPending, dragProps } = useDropImport(
    DOCUMENT_IMPORT_EXTS,
    (file) => handleImportFile(file),
  );

  async function handleImportFile(file: File) {
    if (!editor) return;
    if (validateImportFile(file, DOCUMENT_IMPORT_EXTS)) return;
    setImporting(true);
    try {
      const parsed = await parseDocumentImport(file);
      if (parsed.type === "markdown") {
        (editor.commands as unknown as { setMarkdown: (s: string) => void }).setMarkdown(parsed.content);
      } else {
        editor.commands.setContent(parsed.content);
      }
      const contentJson = editor.getJSON();
      const res = await axios.post(`${API_BASE}/documents`, { title: parsed.title, content_json: contentJson });
      const doc: EditorDocument = res.data;
      const docWithContent = { ...doc, content_json: contentJson };
      onDocumentCreated(docWithContent);
      toast(`"${parsed.title}" imported.`);
    } catch {
      toast("Import failed. Please check the file and try again.", "error");
    } finally {
      setImporting(false);
      if (importDocInputRef.current) importDocInputRef.current.value = "";
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────
  async function handleExportDoc(format: DocExportFormat) {
    if (!editor || !activeDoc) return;
    await exportDocumentAs(
      format,
      {
        html: editor.getHTML(),
        json: editor.getJSON(),
        text: editor.getText(),
        markdown: (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown(),
        title: activeDoc.title,
      },
    );
  }

  const pendingExt = pendingFile ? pendingFile.name.split(".").pop()?.toLowerCase() ?? "" : "";
  const pendingLabel = pendingFile ? (IMPORT_FORMAT_LABELS[pendingExt] ?? pendingExt.toUpperCase()) : "";

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-w-0" {...dragProps}>
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-lg pointer-events-none"
          style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", border: "2px dashed var(--primary)" }}>
          <Upload className="h-10 w-10 text-primary/60" />
          <p className="text-sm font-medium text-primary">Drop file to import</p>
          <p className="text-xs text-muted-foreground">{DOCUMENT_IMPORT_EXTS.map((e) => `.${e}`).join("  ·  ")}</p>
        </div>
      )}

      {/* Drop confirm dialog */}
      <Dialog open={!!pendingFile} onOpenChange={(o) => { if (!o) clearPending(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import file?</DialogTitle>
            <DialogDescription>A new document will be created from this file.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 my-1">
            <FileText className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{pendingFile?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{pendingLabel}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={clearPending}>Cancel</Button>
            <Button size="sm" onClick={confirmImport} disabled={importing}>
              {importing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Title bar */}
      <div className="px-4 py-2 flex items-center gap-3">
        <input
          value={activeDoc.title}
          onChange={(e) => onTitleInputChange(activeDoc.id, e.target.value)}
          onBlur={(e) => onUpdateTitle(activeDoc.id, e.target.value)}
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          placeholder="Untitled document"
        />
        {selection && (
          <Badge variant="secondary" className="text-[10px] font-mono gap-1 shrink-0">
            <Type className="h-3 w-3" /> {selection.text.length} chars selected
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {wordCount.words.toLocaleString()}w · {wordCount.chars.toLocaleString()}c
        </span>
        {saving ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving...
          </div>
        ) : savedRecently ? (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 shrink-0">
            <Check className="h-3 w-3" /> Saved
          </div>
        ) : null}
      </div>

      {/* Formatting toolbar */}
      {editor && (
        <EditorToolbar
          editor={editor}
          searchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
          onExport={handleExportDoc}
          onImageInsert={handleImageInsert}
        />
      )}

      {/* AI toolbar */}
      <div className="sticky top-0 z-10 border-b px-4 py-1.5 flex items-center gap-2 bg-background/95 backdrop-blur-sm">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary mr-1">AI</span>
        {AI_ACTIONS.map((a) => (
          <Button key={a.key} variant="outline" size="sm" className="h-7 text-xs" disabled={!selection || aiLoading} onClick={() => runAiAction(a.key)}>
            {a.label}
            {a.key === "rewrite" && (
              <kbd className="ml-1 text-[9px] text-muted-foreground/60 font-sans">
                {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl+"}J
              </kbd>
            )}
          </Button>
        ))}
        {aiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">{activeEngine}</span>
      </div>

      {/* Search & Replace */}
      {searchOpen && (
        <div className="border-b px-4 py-2 bg-background flex flex-col gap-1.5" onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}>
          <div className="flex items-center gap-2">
            <input autoFocus className="flex-1 h-7 px-2 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40" placeholder="Find... (Enter to jump)" value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); const m = findMatches(e.target.value); setSearchMatches(m); setSearchIndex(0); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? searchPrev() : searchNext(); } }} />
            <span className="text-[11px] text-muted-foreground shrink-0 min-w-[48px] text-right">
              {searchMatches.length > 0 ? `${searchIndex + 1}/${searchMatches.length}` : "0/0"}
            </span>
            <button onClick={searchPrev} className="p-1 rounded hover:bg-muted" title="Previous"><ChevronUp className="h-3.5 w-3.5" /></button>
            <button onClick={searchNext} className="p-1 rounded hover:bg-muted" title="Next"><ChevronDown className="h-3.5 w-3.5" /></button>
            <button onClick={() => setSearchOpen(false)} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex items-center gap-2">
            <input className="flex-1 h-7 px-2 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40" placeholder="Replace with..." value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") replaceCurrent(); }} />
            <button onClick={replaceCurrent} disabled={searchMatches.length === 0} className="h-7 px-2 text-xs border border-border rounded hover:bg-muted disabled:opacity-40 flex items-center gap-1">
              <Replace className="h-3 w-3" /> Replace
            </button>
            <button onClick={replaceAllMatches} disabled={searchMatches.length === 0} className="h-7 px-2 text-xs border border-border rounded hover:bg-muted disabled:opacity-40">All</button>
          </div>
        </div>
      )}

      {/* Editor + Outline + AI panels */}
      <div className="flex-1 flex min-h-0">
        {/* Outline panel */}
        {outline.length > 0 && (
          <div className="shrink-0 border-r bg-background flex flex-col relative" style={{ width: outlineWidth }}>
            <div className="px-3 py-2 border-b">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Outline</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="py-1">
                {outline.map((item, i) => (
                  <button key={`${item.pos}-${i}`} className="w-full text-left px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate block"
                    style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
                    onClick={() => {
                      if (!editor) return;
                      editor.chain().focus().setTextSelection(item.pos + 1).run();
                      const dom = editor.view.domAtPos(item.pos + 1);
                      if (dom.node instanceof HTMLElement) dom.node.scrollIntoView({ behavior: "smooth", block: "center" });
                      else if (dom.node.parentElement) dom.node.parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}>
                    {item.text || "(empty heading)"}
                  </button>
                ))}
              </div>
            </ScrollArea>
            <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/40 z-10 transition-colors"
              onMouseDown={(e) => { e.preventDefault(); outlineResizing.current = true; outlineResizeStart.current = e.clientX; outlineWidthStart.current = outlineWidth; }} />
          </div>
        )}

        {/* Editor scroll area */}
        <div ref={editorScrollRef} className="flex-1 overflow-auto doc-riso-bg">
          <div className="max-w-[900px] mx-auto min-h-full shadow-[0_0_24px_rgba(0,0,0,0.12)] px-[95px] py-16 paper-surface">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* AI error banner */}
        {aiError && aiBlocks.length === 0 && (
          <div className="w-[320px] shrink-0 border-l flex flex-col bg-background">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-destructive">Error</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-xs text-center text-muted-foreground">{aiError}</p>
            </div>
            <div className="border-t px-3 py-2">
              <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setAiError(null)}>Dismiss</Button>
            </div>
          </div>
        )}

        {/* AI suggestion cards */}
        {aiBlocks.length > 0 && (
          <div className="w-[320px] shrink-0 border-l flex flex-col bg-background">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">AI Suggestions ({aiBlocks.length})</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {pendingOriginalText.current && (
                  <div className="px-2 py-1.5 rounded border border-dashed border-border bg-muted/30">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Replacing</p>
                    <p className="text-xs text-muted-foreground/80 line-through truncate">
                      {pendingOriginalText.current.length > 100 ? pendingOriginalText.current.slice(0, 100) + "..." : pendingOriginalText.current}
                    </p>
                  </div>
                )}
                {aiBlocks.map((block, i) => (
                  <div key={i} className="rounded border border-border bg-background p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{block.title}</span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed mb-2">{block.description}</p>
                    <Button size="sm" className="h-6 text-[11px] gap-1 w-full" onClick={() => insertBlock(block)}>
                      <Check className="h-3 w-3" /> Insert
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="border-t px-3 py-2 flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1.5 flex-1" onClick={insertAll}><Check className="h-3 w-3" /> Insert All</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 flex-1" onClick={dismissSuggestions}><X className="h-3 w-3" /> Dismiss</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
