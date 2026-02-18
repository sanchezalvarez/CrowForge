import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  PlusCircle, FileText, Trash2, Loader2, Type, RefreshCw, AlignLeft,
  Maximize2, SpellCheck, Check, X, AlertCircle, Bold, Italic, Heading1,
  Heading2, List,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { DOMParser as PmDOMParser, Fragment } from "@tiptap/pm/model";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";

const editorExtensions = [StarterKit, Markdown];

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

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHtml, setAiHtml] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<string>("mock");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const pendingRange = useRef<{ from: number; to: number } | null>(null);
  const pendingOriginalText = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null;

  const runAiActionRef = useRef<(action: string) => void>(() => {});

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[calc(100vh-10rem)] px-8 py-6",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "j") {
          event.preventDefault();
          runAiActionRef.current("rewrite");
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

  useEffect(() => {
    loadDocuments();
    fetchActiveEngine();
  }, []);

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
    if (!editor) return;
    setSelection(null);
    if (activeDoc) {
      const content = activeDoc.content_json;
      if (content && Object.keys(content).length > 0) {
        editor.commands.setContent(content);
      } else {
        editor.commands.setContent("");
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
      // ignore
    }
  }

  async function deleteDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocId === id) {
      setActiveDocId(null);
    }
  }

  async function saveContent(docId: string, content: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, {
        content_json: content,
      });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? res.data : d)));
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  async function updateTitle(docId: string, title: string) {
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, { title });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? res.data : d)));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    runAiActionRef.current = runAiAction;
  });

  async function runAiAction(actionType: string) {
    if (!selection) return;
    pendingRange.current = { from: selection.from, to: selection.to };
    pendingOriginalText.current = selection.text;
    setAiLoading(true);
    setAiHtml(null);
    setAiError(null);
    try {
      const res = await axios.post(`${API_BASE}/documents/ai`, {
        action_type: actionType,
        selected_text: selection.text,
      });
      const html = res.data.html as string | undefined;
      if (typeof html === "string" && html.trim()) {
        setAiHtml(html);
      } else {
        setAiError("AI returned empty response. No changes were made.");
        pendingRange.current = null;
        pendingOriginalText.current = null;
      }
    } catch {
      setAiError("AI request failed. No changes were made.");
      setAiHtml(null);
      pendingRange.current = null;
      pendingOriginalText.current = null;
    } finally {
      setAiLoading(false);
      fetchActiveEngine();
    }
  }

  function acceptResult() {
    if (!editor || !pendingRange.current || !aiHtml) return;
    const { from, to } = pendingRange.current;

    // Parse AI HTML into ProseMirror nodes
    const parsed = htmlToFragment(editor.state.schema, aiHtml);
    const nodes: import("@tiptap/pm/model").Node[] = [];
    // Leading spacer if mid-document
    const schema = editor.state.schema;
    if (from > 1) {
      nodes.push(schema.nodes.paragraph.create());
    }
    for (let i = 0; i < parsed.content.childCount; i++) {
      nodes.push(parsed.content.child(i));
    }
    // Trailing spacer
    nodes.push(schema.nodes.paragraph.create());

    // Single transaction → single Ctrl+Z undo
    const tr = editor.state.tr;
    tr.delete(from, to);
    tr.insert(from, Fragment.from(nodes));
    editor.view.dispatch(tr);

    setAiHtml(null);
    setAiError(null);
    pendingRange.current = null;
    pendingOriginalText.current = null;
  }

  function rejectResult() {
    setAiHtml(null);
    setAiError(null);
    pendingRange.current = null;
    pendingOriginalText.current = null;
  }

  return (
    <div className="flex h-full">
      {/* Documents sidebar */}
      <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="p-3 border-b">
          <Button variant="outline" size="sm" className="w-full" onClick={createDocument}>
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Document
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                  activeDocId === doc.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setActiveDocId(doc.id)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{doc.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDocument(doc.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No documents yet.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

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
                onBlur={() => updateTitle(activeDoc.id, activeDoc.title)}
                className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                placeholder="Untitled document"
              />
              {selection && (
                <Badge variant="secondary" className="text-[10px] font-mono gap-1 shrink-0">
                  <Type className="h-3 w-3" />
                  {selection.text.length} chars selected
                </Badge>
              )}
              {saving && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </div>
              )}
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
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* AI toolbar */}
            <div className="sticky top-0 z-10 border-b px-4 py-1.5 flex items-center gap-2 bg-background/95 backdrop-blur-sm">
              <span className="text-xs text-muted-foreground mr-1">AI</span>
              {AI_ACTIONS.map((a) => (
                <Button
                  key={a.key}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  disabled={!selection || aiLoading}
                  onClick={() => runAiAction(a.key)}
                >
                  <a.icon className="h-3 w-3" />
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

            {/* TipTap editor + Outline + AI result panel */}
            <div className="flex-1 flex min-h-0">
              {/* Outline panel */}
              {outline.length > 0 && (
                <div className="w-[180px] shrink-0 border-r bg-background">
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
                            // Scroll the heading into view
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
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="max-w-3xl mx-auto">
                  <EditorContent editor={editor} />
                </div>
              </ScrollArea>

              {/* AI error banner */}
              {aiError && !aiHtml && (
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

              {/* AI result sidebar */}
              {aiHtml && (
                <div className="w-[320px] shrink-0 border-l flex flex-col bg-background">
                  <div className="px-3 py-2 border-b">
                    <span className="text-xs font-medium text-muted-foreground">AI Suggestion</span>
                  </div>
                  <ScrollArea className="flex-1 p-3">
                    {pendingOriginalText.current && (
                      <>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Original</p>
                        <div className="text-xs text-muted-foreground/80 leading-relaxed line-through decoration-muted-foreground/30 mb-2">
                          {pendingOriginalText.current.length > 200
                            ? pendingOriginalText.current.slice(0, 200) + "..."
                            : pendingOriginalText.current}
                        </div>
                        <hr className="border-border mb-2" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Suggestion</p>
                      </>
                    )}
                    <div
                      className="prose prose-sm max-w-none text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: aiHtml }}
                    />
                  </ScrollArea>
                  <div className="border-t px-3 py-2 flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs gap-1.5 flex-1" onClick={acceptResult}>
                      <Check className="h-3 w-3" />
                      Accept
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 flex-1" onClick={rejectResult}>
                      <X className="h-3 w-3" />
                      Reject
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
