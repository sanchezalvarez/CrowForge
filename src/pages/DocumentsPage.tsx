import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { PlusCircle, FileText, Trash2, Loader2 } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { cn } from "../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

interface Document {
  id: string;
  title: string;
  content_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null;

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[calc(100vh-10rem)] px-8 py-6",
      },
    },
    onUpdate: ({ editor }) => {
      if (!activeDocId) return;
      const json = editor.getJSON();
      debouncedSave(activeDocId, json);
    },
  });

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // When active doc changes, load its content into editor
  useEffect(() => {
    if (!editor) return;
    if (activeDoc) {
      const content = activeDoc.content_json;
      // Only replace if content is non-empty TipTap JSON
      if (content && Object.keys(content).length > 0) {
        editor.commands.setContent(content);
      } else {
        editor.commands.setContent("");
      }
    } else {
      editor.commands.setContent("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, editor]);

  const debouncedSave = useCallback(
    (docId: string, content: Record<string, unknown>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveContent(docId, content);
      }, 800);
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
    // No delete endpoint yet — remove from list only
    // TODO: add DELETE endpoint
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocId === id) {
      setActiveDocId(null);
    }
  }

  async function saveContent(
    docId: string,
    content: Record<string, unknown>
  ) {
    setSaving(true);
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, {
        content_json: content,
      });
      // Update local state with server response
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? res.data : d))
      );
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  async function updateTitle(docId: string, title: string) {
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, { title });
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? res.data : d))
      );
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full">
      {/* Documents sidebar */}
      <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="p-3 border-b">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={createDocument}
          >
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
              {saving && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>

            {/* TipTap editor */}
            <ScrollArea className="flex-1">
              <div className="max-w-3xl mx-auto">
                <EditorContent editor={editor} />
              </div>
            </ScrollArea>
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
