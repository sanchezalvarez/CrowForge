import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  PlusCircle, FileText, Trash2, Loader2, Type, RefreshCw, AlignLeft,
  Maximize2, SpellCheck, Check, X, AlertCircle, Bold, Italic, Heading1,
  Heading2, List, Upload, Download, ChevronDown, PackageOpen, Pencil, Copy,
  Sparkles, Underline as UnderlineIcon, Strikethrough, AlignLeft as AlignLeftIcon,
  AlignCenter, AlignRight, Highlighter, Image as ImageIcon, Search, ChevronUp,
  Replace,
} from "lucide-react";
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import { DOMParser as PmDOMParser, Fragment } from "@tiptap/pm/model";
import ImageExtension from "@tiptap/extension-image";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { cn } from "../lib/utils";
import { toast } from "../hooks/useToast";
import { useDropImport, IMPORT_FORMAT_LABELS } from "../hooks/useDropImport";
import {
  validateImportFile,
  parseDocumentImport,
  exportDocumentAs,
  exportDocumentsAsZip,
  DOCUMENT_IMPORT_ACCEPT,
  DOCUMENT_IMPORT_EXTS,
  DOCUMENT_EXPORT_FORMATS,
  type DocExportFormat,
} from "../lib/fileService";

// ---- Resizable Image NodeView ----
function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startW = useRef(0);
  const [isResizing, setIsResizing] = useState(false);

  function startResize(e: React.MouseEvent, side: "left" | "right") {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    startW.current = node.attrs.width ?? (imgRef.current?.offsetWidth ?? 300);

    function onMove(me: MouseEvent) {
      const delta = me.clientX - startX.current;
      const newW = Math.max(48, Math.round(startW.current + (side === "right" ? delta : -delta)));
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
    <NodeViewWrapper as="span" className="inline-block relative group/img align-middle select-none" draggable data-drag-handle>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        draggable={false}
        style={{ width: w, maxWidth: "100%", display: "block" }}
        className={showHandles ? "ring-2 ring-primary ring-offset-1 rounded-sm" : ""}
      />
      {/* Left resize handle */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-6 rounded bg-primary/80 cursor-ew-resize transition-opacity ${showHandles ? "opacity-100" : "opacity-0 group-hover/img:opacity-60"}`}
        onMouseDown={(e) => startResize(e, "left")}
      />
      {/* Right resize handle */}
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
      width: { default: null, parseHTML: (el) => el.getAttribute("width"), renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {} },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
}).configure({ inline: true, allowBase64: true });

const editorExtensions = [
  StarterKit,
  Markdown,
  TextStyle,
  Color,
  Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: false }),
  FontFamily,
  ResizableImage,
];

interface OutlineItem {
  level: number;
  text: string;
  pos: number;
}

function extractOutline(editor: ReturnType<typeof useEditor>): OutlineItem[] {
  if (!editor) return [];
  const items: OutlineItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level as number;
      if (level >= 1 && level <= 3) {
        items.push({ level, text: node.textContent, pos });
      }
    }
  });
  return items;
}

/** Parse an HTML string into ProseMirror nodes using the editor's schema. */
function htmlToFragment(schema: import("@tiptap/pm/model").Schema, html: string) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  return PmDOMParser.fromSchema(schema).parse(wrapper);
}

interface SuggestionBlock {
  title: string;
  description: string;
  html: string;
}

const TAG_LABELS: Record<string, string> = {
  H1: "Heading 1", H2: "Heading 2", H3: "Heading 3",
  P: "Paragraph", UL: "Bullet List", OL: "Numbered List",
  BLOCKQUOTE: "Blockquote", LI: "List Item",
};

function parseHtmlToBlocks(html: string): SuggestionBlock[] {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const blocks: SuggestionBlock[] = [];
  for (let i = 0; i < wrapper.children.length; i++) {
    const el = wrapper.children[i] as HTMLElement;
    const tag = el.tagName;
    const title = TAG_LABELS[tag] ?? tag.toLowerCase();
    const text = el.textContent ?? "";
    const description = text.length > 80 ? text.slice(0, 80) + "..." : text;
    blocks.push({ title, description, html: el.outerHTML });
  }
  // If no block-level elements found, treat the whole thing as one block
  if (blocks.length === 0 && html.trim()) {
    const text = wrapper.textContent ?? "";
    blocks.push({
      title: "Text",
      description: text.length > 80 ? text.slice(0, 80) + "..." : text,
      html,
    });
  }
  return blocks;
}

const AI_ACTIONS = [
  { key: "rewrite", label: "Rewrite", icon: RefreshCw },
  { key: "summarize", label: "Summarize", icon: AlignLeft },
  { key: "expand", label: "Expand", icon: Maximize2 },
  { key: "fix_grammar", label: "Fix grammar", icon: SpellCheck },
] as const;

const API_BASE = "http://127.0.0.1:8000";

interface Document {
  id: string;
  title: string;
  content_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EditorSelection {
  from: number;
  to: number;
  text: string;
}

import type { DocumentContext } from "../App";
import type { TuningParams } from "../components/AIControlPanel";

interface DocumentsPageProps {
  onContextChange?: (ctx: DocumentContext | null) => void;
  tuningParams?: TuningParams;
}

// A4 at 96 DPI: 794 × 1123 px. We use this for page-break simulation.
const A4_HEIGHT_PX = 1123;
const A4_WIDTH_PX = 794;

export function DocumentsPage({ onContextChange, tuningParams }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBlocks, setAiBlocks] = useState<SuggestionBlock[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<string>("mock");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [docMenu, setDocMenu] = useState<{ docId: string; x: number; y: number } | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null);
  const [renameDocValue, setRenameDocValue] = useState("");
  const renameDocRef = useRef<HTMLInputElement>(null);
  const [outlineWidth, setOutlineWidth] = useState(180);
  const outlineResizing = useRef(false);
  const outlineResizeStart = useRef(0);
  const outlineWidthStart = useRef(180);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });
  const pendingRange = useRef<{ from: number; to: number } | null>(null);
  const pendingOriginalText = useRef<string | null>(null);
  const pendingDocId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedRecently, setSavedRecently] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [searchMatches, setSearchMatches] = useState<{ from: number; to: number }[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null;

  // Import / Export
  const importDocInputRef = useRef<HTMLInputElement>(null);
  const [exportDocOpen, setExportDocOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Bulk export — checkbox selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkExporting, setBulkExporting] = useState(false);

  // Drag-and-drop import
  const { isDragging, pendingFile, confirmImport, clearPending, dragProps } = useDropImport(
    DOCUMENT_IMPORT_EXTS,
    (file) => handleImportFile(file),
  );

  const runAiActionRef = useRef<(action: string) => void>(() => {});

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-full",
      },
      handleKeyDown: (_view, event) => {
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
    },
    onUpdate: ({ editor }) => {
      setOutline(extractOutline(editor));
      if (!activeDocId) return;
      const json = editor.getJSON();
      debouncedSave(activeDocId, json);
      // Estimate page count from editor DOM height
      const el = editor.view.dom as HTMLElement;
      const h = el.scrollHeight;
      setPageCount(Math.max(1, Math.ceil(h / A4_HEIGHT_PX)));
      // Word/char count
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount({ words, chars: text.length });
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelection(null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, "\n");
      setSelection({ from, to, text });
    },
  });

  // Report document context to parent (for Chat integration)
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
  }, [activeDoc?.id, activeDoc?.title, outline, selection, onContextChange, wordCount, editor]);

  useEffect(() => {
    loadDocuments();
    fetchActiveEngine();
  }, []);

  // Outline panel resize via mouse drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!outlineResizing.current) return;
      const delta = e.clientX - outlineResizeStart.current;
      setOutlineWidth(Math.max(120, Math.min(400, outlineWidthStart.current + delta)));
    };
    const onUp = () => { outlineResizing.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Track current page from scroll position
  function handleEditorScroll(e: React.UIEvent<HTMLDivElement>) {
    const scrollTop = (e.target as HTMLDivElement).scrollTop;
    setCurrentPage(Math.max(1, Math.floor(scrollTop / A4_HEIGHT_PX) + 1));
  }

  async function fetchActiveEngine() {
    try {
      const res = await axios.get(`${API_BASE}/ai/engines`);
      const active = (res.data as { name: string; active: boolean }[]).find((e) => e.active);
      if (active) setActiveEngine(active.name);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Cancel any pending debounced save from the previous document
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    // Dismiss any AI suggestions from the previous document
    setAiBlocks([]);
    setAiError(null);
    pendingRange.current = null;
    pendingOriginalText.current = null;
    pendingDocId.current = null;
    if (!editor) return;
    setSelection(null);
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
    setOutline(extractOutline(editor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, editor]);

  const debouncedSave = useCallback(
    (docId: string, content: Record<string, unknown>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveContent(docId, content);
      }, 1200);
    },
    []
  );

  // Cleanup debounce timer on unmount to prevent saving after component is gone
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function loadDocuments() {
    try {
      const res = await axios.get(`${API_BASE}/documents`);
      setDocuments(res.data);
    } catch {
      // backend offline
    }
  }

  async function createDocument() {
    try {
      const res = await axios.post(`${API_BASE}/documents`, {
        title: "Untitled",
        content_json: {},
      });
      const doc: Document = res.data;
      setDocuments((prev) => [doc, ...prev]);
      setActiveDocId(doc.id);
    } catch {
      toast("Failed to create document.", "error");
    }
  }

  async function deleteDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocId === id) setActiveDocId(null);
    try {
      await axios.delete(`${API_BASE}/documents/${id}`);
    } catch {
      toast("Failed to delete document.", "error");
    }
  }

  async function duplicateDocument(id: string) {
    try {
      const res = await axios.post(`${API_BASE}/documents/${id}/duplicate`);
      const doc: Document = res.data;
      setDocuments((prev) => [doc, ...prev]);
      setActiveDocId(doc.id);
    } catch {
      toast("Failed to duplicate document.", "error");
    }
  }

  function docRenameStart(id: string) {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;
    setRenamingDoc(id);
    setRenameDocValue(doc.title);
  }

  async function docRenameCommit() {
    if (!renamingDoc || !renameDocValue.trim()) { setRenamingDoc(null); return; }
    await updateTitle(renamingDoc, renameDocValue.trim());
    setRenamingDoc(null);
  }

  // Close doc context menu on outside click
  useEffect(() => {
    if (!docMenu) return;
    const close = () => setDocMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [docMenu]);

  // Auto-focus rename input
  useEffect(() => {
    if (renamingDoc && renameDocRef.current) renameDocRef.current.focus();
  }, [renamingDoc]);

  async function saveContent(docId: string, content: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, {
        content_json: content,
      });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? res.data : d)));
      setSavedRecently(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedRecently(false), 3000);
    } catch {
      toast("Failed to save document.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateTitle(docId: string, title: string) {
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, { title });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? res.data : d)));
    } catch {
      toast("Failed to rename document.", "error");
    }
  }

  useEffect(() => {
    runAiActionRef.current = runAiAction;
  });

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
        if (blocks.length > 0) {
          setAiBlocks(blocks);
        } else {
          setAiError("AI returned empty response. No changes were made.");
          pendingRange.current = null;
          pendingOriginalText.current = null;
          pendingDocId.current = null;
        }
      } else {
        setAiError("AI returned empty response. No changes were made.");
        pendingRange.current = null;
        pendingOriginalText.current = null;
        pendingDocId.current = null;
      }
    } catch {
      setAiError("AI request failed. No changes were made.");
      setAiBlocks([]);
      pendingRange.current = null;
      pendingOriginalText.current = null;
      pendingDocId.current = null;
    } finally {
      setAiLoading(false);
      fetchActiveEngine();
    }
  }

  function insertBlock(block: SuggestionBlock) {
    if (!editor || !pendingRange.current) return;
    // Guard: don't insert into a different document than where AI action was triggered
    if (pendingDocId.current !== activeDocId) { dismissSuggestions(); return; }
    const docSize = editor.state.doc.content.size;
    const from = Math.min(pendingRange.current.from, docSize);
    const to = Math.min(pendingRange.current.to, docSize);

    const parsed = htmlToFragment(editor.state.schema, block.html);
    const nodes: import("@tiptap/pm/model").Node[] = [];
    const schema = editor.state.schema;
    if (from > 1) {
      nodes.push(schema.nodes.paragraph.create());
    }
    for (let i = 0; i < parsed.content.childCount; i++) {
      nodes.push(parsed.content.child(i));
    }
    nodes.push(schema.nodes.paragraph.create());

    // Single transaction → single Ctrl+Z undo
    const tr = editor.state.tr;
    tr.delete(from, to);
    tr.insert(from, Fragment.from(nodes));
    editor.view.dispatch(tr);

    // Update pending range to cursor position after insert so subsequent
    // inserts from remaining cards go to the right place.
    const newPos = from + nodes.reduce((s, n) => s + n.nodeSize, 0);
    pendingRange.current = { from: newPos, to: newPos };

    // Remove the inserted block from the list
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
    if (from > 1) {
      nodes.push(schema.nodes.paragraph.create());
    }
    for (let i = 0; i < parsed.content.childCount; i++) {
      nodes.push(parsed.content.child(i));
    }
    nodes.push(schema.nodes.paragraph.create());

    const tr = editor.state.tr;
    tr.delete(from, to);
    tr.insert(from, Fragment.from(nodes));
    editor.view.dispatch(tr);

    setAiBlocks([]);
    setAiError(null);
    pendingRange.current = null;
    pendingOriginalText.current = null;
    pendingDocId.current = null;
  }

  function dismissSuggestions() {
    setAiBlocks([]);
    setAiError(null);
    pendingRange.current = null;
    pendingOriginalText.current = null;
    pendingDocId.current = null;
  }

  // ---- Image insert ----
  function handleImageInsert(file: File) {
    if (!editor) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }

  // ---- Search & Replace ----
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

  function replaceAll() {
    if (!editor || !searchTerm) return;
    const matches = findMatches(searchTerm);
    // Apply in reverse to preserve positions
    const tr = editor.state.tr;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      tr.replaceWith(m.from, m.to, editor.state.schema.text(replaceTerm));
    }
    editor.view.dispatch(tr);
    setSearchMatches([]);
    setSearchIndex(0);
  }

  function openSearch() {
    setSearchOpen(true);
    const matches = findMatches(searchTerm);
    setSearchMatches(matches);
  }

  // ---- Import ----
  async function handleImportFile(file: File) {
    if (!editor) return;
    if (validateImportFile(file, DOCUMENT_IMPORT_EXTS)) return; // toast already fired
    setImporting(true);
    try {
      const parsed = await parseDocumentImport(file);
      const res = await axios.post(`${API_BASE}/documents`, { title: parsed.title, content_json: {} });
      const doc: Document = res.data;
      setDocuments((prev) => [doc, ...prev]);
      setActiveDocId(doc.id);
      setTimeout(() => {
        if (!editor) return;
        if (parsed.type === "markdown") {
          (editor.commands as unknown as { setMarkdown: (s: string) => void }).setMarkdown(parsed.content);
        } else {
          editor.commands.setContent(parsed.content);
        }
        saveContent(doc.id, editor.getJSON());
      }, 50);
      toast(`"${parsed.title}" imported.`);
    } catch {
      toast("Import failed. Please check the file and try again.", "error");
    } finally {
      setImporting(false);
      if (importDocInputRef.current) importDocInputRef.current.value = "";
    }
  }

  // ---- Export ----
  async function handleExportDoc(format: DocExportFormat) {
    setExportDocOpen(false);
    if (!editor || !activeDoc) return;
    await exportDocumentAs(format, {
      html: editor.getHTML(),
      json: editor.getJSON(),
      text: editor.getText(),
      markdown: (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown(),
      title: activeDoc.title,
    });
  }

  // ---- Bulk export ----
  async function handleBulkExport() {
    const selected = documents.filter((d) => selectedIds.has(d.id));
    if (selected.length === 0) return;
    setBulkExporting(true);
    try {
      await exportDocumentsAsZip(selected.map((d) => ({ title: d.title, content_json: d.content_json })));
    } finally {
      setBulkExporting(false);
    }
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleDocSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(documents.map((d) => d.id)));
  }

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportDocOpen) return;
    const close = () => setExportDocOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [exportDocOpen]);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const close = () => setColorPickerOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [colorPickerOpen]);

  const pendingExt = pendingFile ? pendingFile.name.split(".").pop()?.toLowerCase() ?? "" : "";
  const pendingLabel = pendingFile ? (IMPORT_FORMAT_LABELS[pendingExt] ?? pendingExt.toUpperCase()) : "";

  return (
    <div className="flex h-full relative" {...dragProps}>
      {/* Drag-over overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-lg pointer-events-none"
          style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", border: "2px dashed var(--primary)" }}>
          <Upload className="h-10 w-10 text-primary/60" />
          <p className="text-sm font-medium text-primary">Drop file to import</p>
          <p className="text-xs text-muted-foreground">{DOCUMENT_IMPORT_EXTS.map((e) => `.${e}`).join("  ·  ")}</p>
        </div>
      )}

      {/* Drop-confirm dialog */}
      <Dialog open={!!pendingFile} onOpenChange={(o) => { if (!o) clearPending(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import file?</DialogTitle>
            <DialogDescription>
              A new document will be created from this file.
            </DialogDescription>
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

      {/* Documents sidebar */}
      <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="p-3 border-b flex flex-col gap-1.5">
          <Button variant="outline" size="sm" className="w-full" onClick={createDocument}>
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Document
          </Button>
          <input
            ref={importDocInputRef}
            type="file"
            accept={DOCUMENT_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => importDocInputRef.current?.click()}
            disabled={importing}
            title="Import DOCX / MD / TXT"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Import Document
          </Button>
          <Button
            variant={selectMode ? "secondary" : "ghost"}
            size="sm"
            className="w-full text-xs"
            onClick={toggleSelectMode}
          >
            <PackageOpen className="h-3.5 w-3.5 mr-1.5" />
            {selectMode ? "Cancel selection" : "Select for export"}
          </Button>
        </div>

        {/* Bulk-export action bar */}
        {selectMode && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30">
            <button className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" onClick={selectAll}>All</button>
            <button className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" onClick={() => setSelectedIds(new Set())}>None</button>
            <div className="flex-1" />
            <Button size="sm" className="h-6 text-[11px] px-2 gap-1" disabled={selectedIds.size === 0 || bulkExporting} onClick={handleBulkExport}>
              {bulkExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Export ({selectedIds.size})
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                  activeDocId === doc.id && !selectMode
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  selectMode && selectedIds.has(doc.id) && "bg-primary/10 text-primary"
                )}
                onClick={() => { if (selectMode) toggleDocSelect(doc.id); else setActiveDocId(doc.id); }}
                onContextMenu={(e) => {
                  if (selectMode) return;
                  e.preventDefault();
                  setDocMenu({ docId: doc.id, x: e.clientX, y: e.clientY });
                }}
              >
                {selectMode ? (
                  <div className={cn("h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center", selectedIds.has(doc.id) ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                    {selectedIds.has(doc.id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                )}
                {renamingDoc === doc.id ? (
                  <input
                    ref={renameDocRef}
                    className="flex-1 min-w-0 h-5 px-1 text-xs border border-primary/40 rounded bg-background outline-none"
                    value={renameDocValue}
                    onChange={(e) => setRenameDocValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={docRenameCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") docRenameCommit();
                      if (e.key === "Escape") setRenamingDoc(null);
                    }}
                  />
                ) : (
                  <span className="flex-1 truncate">{doc.title}</span>
                )}
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No documents yet.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Document context menu */}
      {docMenu && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px] text-sm"
          style={{ left: docMenu.x, top: docMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => { docRenameStart(docMenu.docId); setDocMenu(null); }}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
          </button>
          <button className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => { duplicateDocument(docMenu.docId); setDocMenu(null); }}>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Duplicate
          </button>
          <div className="border-t border-border my-1" />
          <button className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-destructive"
            onClick={() => { deleteDocument(docMenu.docId); setDocMenu(null); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeDoc ? (
          <>
            {/* Title bar */}
            <div className="border-b px-4 py-2 flex items-center gap-3">
              <input
                value={activeDoc.title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setDocuments((prev) =>
                    prev.map((d) =>
                      d.id === activeDoc.id ? { ...d, title: newTitle } : d
                    )
                  );
                }}
                onBlur={(e) => updateTitle(activeDoc.id, e.target.value)}
                className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                placeholder="Untitled document"
              />
              {selection && (
                <Badge variant="secondary" className="text-[10px] font-mono gap-1 shrink-0">
                  <Type className="h-3 w-3" />
                  {selection.text.length} chars selected
                </Badge>
              )}
              <span className="text-xs text-muted-foreground shrink-0 font-mono">
                Page {currentPage} / {pageCount}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {wordCount.words.toLocaleString()}w · {wordCount.chars.toLocaleString()}c
              </span>
              {saving ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </div>
              ) : savedRecently ? (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 shrink-0">
                  <Check className="h-3 w-3" />
                  Saved
                </div>
              ) : null}
            </div>

            {/* Formatting toolbar */}
            {editor && (
              <div className="border-b px-4 py-1 flex items-center gap-1 bg-background">
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
                <Button
                  variant={editor.isActive("bold") ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={editor.isActive("italic") ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={editor.isActive("underline") ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  title="Underline"
                >
                  <UnderlineIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={editor.isActive("strike") ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  title="Strikethrough"
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().setTextAlign("left").run()}
                  title="Align left"
                >
                  <AlignLeftIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().setTextAlign("center").run()}
                  title="Align center"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().setTextAlign("right").run()}
                  title="Align right"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant={editor.isActive("highlight") ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().toggleHighlight().run()}
                  title="Highlight"
                >
                  <Highlighter className="h-3.5 w-3.5" />
                </Button>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 relative"
                    title="Text color"
                    onClick={() => setColorPickerOpen((o) => !o)}
                  >
                    <Type className="h-3.5 w-3.5" />
                    {editor.getAttributes("textStyle").color && (
                      <div className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded" style={{ backgroundColor: editor.getAttributes("textStyle").color }} />
                    )}
                  </Button>
                  {colorPickerOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-lg p-2 grid grid-cols-6 gap-1 w-[156px]"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {['#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280','#ffffff','#991b1b','#9a3412'].map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: c }}
                          onClick={() => { editor.chain().focus().setColor(c).run(); setColorPickerOpen(false); }}
                        />
                      ))}
                      <button
                        className="col-span-6 text-[10px] text-muted-foreground hover:text-foreground mt-0.5"
                        onClick={() => { editor.chain().focus().unsetColor().run(); setColorPickerOpen(false); }}
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
                <select
                  className="h-7 text-xs border border-border rounded bg-background px-1 cursor-pointer"
                  title="Font family"
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      editor.chain().focus().unsetFontFamily().run();
                    } else {
                      editor.chain().focus().setFontFamily(val).run();
                    }
                  }}
                >
                  <option value="">Default</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Mono</option>
                </select>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageInsert(f); e.target.value = ""; }}
                />
                <Button
                  variant="ghost"
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => imageInputRef.current?.click()}
                  title="Insert image"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={searchOpen ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => { if (searchOpen) setSearchOpen(false); else openSearch(); }}
                  title="Search & Replace (Ctrl+F)"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
                <div className="flex-1" />
                {/* Export dropdown — active document only */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setExportDocOpen((o) => !o)}
                    title="Export document"
                  >
                    <Download className="h-3 w-3" />
                    Export
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  {exportDocOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[140px]">
                      {DOCUMENT_EXPORT_FORMATS.map(([fmt, label]) => (
                        <button
                          key={fmt}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                          onClick={() => handleExportDoc(fmt)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI toolbar */}
            <div className="sticky top-0 z-10 border-b px-4 py-1.5 flex items-center gap-2 bg-background/95 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary mr-1">AI</span>
              {AI_ACTIONS.map((a) => (
                <Button
                  key={a.key}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!selection || aiLoading}
                  onClick={() => runAiAction(a.key)}
                >
                  {a.label}
                  {a.key === "rewrite" && (
                    <kbd className="ml-1 text-[9px] text-muted-foreground/60 font-sans">
                      {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl+"}J
                    </kbd>
                  )}
                </Button>
              ))}
              {aiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                {activeEngine}
              </span>
            </div>

            {/* Search & Replace panel */}
            {searchOpen && (
              <div className="border-b px-4 py-2 bg-background flex flex-col gap-1.5" onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="flex-1 h-7 px-2 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="Find... (Enter to jump)"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      const m = findMatches(e.target.value);
                      setSearchMatches(m);
                      setSearchIndex(0);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? searchPrev() : searchNext(); } }}
                  />
                  <span className="text-[11px] text-muted-foreground shrink-0 min-w-[48px] text-right">
                    {searchMatches.length > 0 ? `${searchIndex + 1}/${searchMatches.length}` : "0/0"}
                  </span>
                  <button onClick={searchPrev} className="p-1 rounded hover:bg-muted" title="Previous"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={searchNext} className="p-1 rounded hover:bg-muted" title="Next"><ChevronDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setSearchOpen(false)} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 h-7 px-2 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="Replace with..."
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") replaceCurrent(); }}
                  />
                  <button onClick={replaceCurrent} disabled={searchMatches.length === 0} className="h-7 px-2 text-xs border border-border rounded hover:bg-muted disabled:opacity-40 flex items-center gap-1">
                    <Replace className="h-3 w-3" /> Replace
                  </button>
                  <button onClick={replaceAll} disabled={searchMatches.length === 0} className="h-7 px-2 text-xs border border-border rounded hover:bg-muted disabled:opacity-40">
                    All
                  </button>
                </div>
              </div>
            )}

            {/* TipTap editor + Outline + AI result panel */}
            <div className="flex-1 flex min-h-0">
              {/* Outline panel — resizable */}
              {outline.length > 0 && (
                <div className="shrink-0 border-r bg-background flex flex-col relative" style={{ width: outlineWidth }}>
                  <div className="px-3 py-2 border-b">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Outline</span>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="py-1">
                      {outline.map((item, i) => (
                        <button
                          key={`${item.pos}-${i}`}
                          className="w-full text-left px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate block"
                          style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
                          onClick={() => {
                            if (!editor) return;
                            editor.chain().focus().setTextSelection(item.pos + 1).run();
                            const dom = editor.view.domAtPos(item.pos + 1);
                            if (dom.node instanceof HTMLElement) {
                              dom.node.scrollIntoView({ behavior: "smooth", block: "center" });
                            } else if (dom.node.parentElement) {
                              dom.node.parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }}
                        >
                          {item.text || "(empty heading)"}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  {/* Resize handle */}
                  <div
                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/40 z-10 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      outlineResizing.current = true;
                      outlineResizeStart.current = e.clientX;
                      outlineWidthStart.current = outlineWidth;
                    }}
                  />
                </div>
              )}

              {/* A4 editor scroll area */}
              <div
                ref={editorScrollRef}
                className="flex-1 overflow-auto bg-muted/30"
                onScroll={handleEditorScroll}
              >
                {/* Page number CSS for print */}
                <style>{`
                  @media print {
                    @page { size: A4; margin: 25mm; }
                    .a4-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
                    .page-break-line { display: none !important; }
                  }
                  .a4-page { page-break-after: always; }
                `}</style>

                <div className="py-8 flex flex-col items-center gap-0">
                  {/* Single A4 "page" — content flows naturally, break lines are visual only */}
                  <div
                    className="a4-page bg-white text-black shadow-lg rounded-sm relative"
                    style={{ width: A4_WIDTH_PX, minHeight: A4_HEIGHT_PX, padding: "25mm 20mm" }}
                  >
                    <EditorContent editor={editor} />

                    {/* Visual page-break lines */}
                    {Array.from({ length: pageCount - 1 }, (_, i) => (
                      <div
                        key={i}
                        className="page-break-line absolute left-0 right-0 border-t-2 border-dashed border-muted-foreground/20 pointer-events-none"
                        style={{ top: A4_HEIGHT_PX * (i + 1) - 95 /* subtract top padding */ }}
                      >
                        <span className="absolute right-2 -top-3 text-[9px] text-muted-foreground/40 font-mono select-none">
                          page {i + 2}
                        </span>
                      </div>
                    ))}
                  </div>
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
                    <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setAiError(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {/* AI suggestion cards */}
              {aiBlocks.length > 0 && (
                <div className="w-[320px] shrink-0 border-l flex flex-col bg-background">
                  <div className="px-3 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      AI Suggestions ({aiBlocks.length})
                    </span>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-2">
                      {pendingOriginalText.current && (
                        <div className="px-2 py-1.5 rounded border border-dashed border-border bg-muted/30">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Replacing</p>
                          <p className="text-xs text-muted-foreground/80 line-through truncate">
                            {pendingOriginalText.current.length > 100
                              ? pendingOriginalText.current.slice(0, 100) + "..."
                              : pendingOriginalText.current}
                          </p>
                        </div>
                      )}
                      {aiBlocks.map((block, i) => (
                        <div key={i} className="rounded border border-border bg-background p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              {block.title}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed mb-2">
                            {block.description}
                          </p>
                          <Button
                            size="sm"
                            className="h-6 text-[11px] gap-1 w-full"
                            onClick={() => insertBlock(block)}
                          >
                            <Check className="h-3 w-3" />
                            Insert
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="border-t px-3 py-2 flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs gap-1.5 flex-1" onClick={insertAll}>
                      <Check className="h-3 w-3" />
                      Insert All
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 flex-1" onClick={dismissSuggestions}>
                      <X className="h-3 w-3" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">No document selected</p>
            <p className="text-xs mt-1">
              Create a new document to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
