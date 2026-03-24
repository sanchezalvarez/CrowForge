/**
 * DocumentsPage — thin page wrapper.
 * Manages the document list and sidebar. Delegates editing to DocumentEditor.
 */

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  PlusCircle, FileText, Trash2, Copy, Pencil,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { cn } from "../lib/utils";
import { toast } from "../hooks/useToast";
import { DocumentEditor } from "../editor";
import type { EditorDocument, DocumentContext } from "../editor";
import type { TuningParams } from "../components/AIControlPanel";

const API_BASE = "http://127.0.0.1:8000";

interface DocumentsPageProps {
  onContextChange?: (ctx: DocumentContext | null) => void;
  tuningParams?: TuningParams;
  initialDocId?: string | null;
}

export function DocumentsPage({ onContextChange, tuningParams, initialDocId }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<EditorDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(initialDocId ?? null);
  const [activeEngine, setActiveEngine] = useState<string>("mock");
  const [docMenu, setDocMenu] = useState<{ docId: string; x: number; y: number } | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null);
  const [renameDocValue, setRenameDocValue] = useState("");
  const renameDocRef = useRef<HTMLInputElement>(null);

  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null;

  // ── Data loading ───────────────────────────────────────────────────────
  useEffect(() => { loadDocuments(); fetchActiveEngine(); }, []);

  // Sync with prop changes
  useEffect(() => {
    if (initialDocId) setActiveDocId(initialDocId);
  }, [initialDocId]);

  useEffect(() => {
    function onDataDeleted(e: Event) {
      const target = (e as CustomEvent).detail?.target;
      if (target === "documents" || target === "all") {
        setDocuments([]);
        setActiveDocId(null);
        loadDocuments();
      }
    }
    window.addEventListener("crowforge:data-deleted", onDataDeleted);
    return () => window.removeEventListener("crowforge:data-deleted", onDataDeleted);
  }, []);

  async function loadDocuments() {
    try {
      const res = await axios.get(`${API_BASE}/documents`);
      const loaded = res.data;
      setDocuments(loaded);
      // Auto-select the most recently opened document
      if (!activeDocId && loaded.length > 0) {
        setActiveDocId(loaded[0].id);
      }
    } catch { /* backend offline */ }
  }

  async function fetchActiveEngine() {
    try {
      const res = await axios.get(`${API_BASE}/ai/engines`);
      const active = (res.data as { name: string; active: boolean }[]).find((e) => e.active);
      if (active) setActiveEngine(active.name);
    } catch { /* ignore */ }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────
  async function createDocument() {
    try {
      const res = await axios.post(`${API_BASE}/documents`, { title: "Untitled", content_json: {} });
      const doc: EditorDocument = res.data;
      setDocuments((prev) => [doc, ...prev]);
      setActiveDocId(doc.id);
    } catch { toast("Failed to create document.", "error"); }
  }

  async function deleteDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocId === id) setActiveDocId(null);
    try { await axios.delete(`${API_BASE}/documents/${id}`); }
    catch { toast("Failed to delete document.", "error"); }
  }

  async function duplicateDocument(id: string) {
    try {
      const res = await axios.post(`${API_BASE}/documents/${id}/duplicate`);
      const doc: EditorDocument = res.data;
      setDocuments((prev) => [doc, ...prev]);
      setActiveDocId(doc.id);
    } catch { toast("Failed to duplicate document.", "error"); }
  }

  async function updateTitle(docId: string, title: string) {
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, { title });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? res.data : d)));
    } catch { toast("Failed to rename document.", "error"); }
  }

  async function saveContent(docId: string, content: Record<string, unknown>) {
    try {
      const res = await axios.put(`${API_BASE}/documents/${docId}`, { content_json: content });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? res.data : d)));
    } catch { toast("Failed to save document.", "error"); }
  }

  // ── Rename ──────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!docMenu) return;
    const close = () => setDocMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [docMenu]);

  useEffect(() => {
    if (renamingDoc && renameDocRef.current) renameDocRef.current.focus();
  }, [renamingDoc]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full relative">
      {/* Documents sidebar */}
      <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="h-20 flex items-center px-3 border-b">
          <Button variant="outline" size="sm" className="w-full" onClick={createDocument}>
            <PlusCircle className="h-4 w-4 mr-1.5" /> New Document
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                  activeDocId === doc.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setActiveDocId(doc.id)}
                onContextMenu={(e) => { e.preventDefault(); setDocMenu({ docId: doc.id, x: e.clientX, y: e.clientY }); }}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {renamingDoc === doc.id ? (
                  <input ref={renameDocRef} className="flex-1 min-w-0 h-5 px-1 text-xs border border-primary/40 rounded bg-background outline-none"
                    value={renameDocValue} onChange={(e) => setRenameDocValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()} onBlur={docRenameCommit}
                    onKeyDown={(e) => { if (e.key === "Enter") docRenameCommit(); if (e.key === "Escape") setRenamingDoc(null); }} />
                ) : (
                  <span className="flex-1 min-w-0 truncate">{doc.title}</span>
                )}
              </div>
            ))}
            {documents.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No documents yet.</p>}
          </div>
        </ScrollArea>
      </div>

      {/* Document context menu */}
      {docMenu && (
        <div className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px] text-sm"
          style={{ left: docMenu.x, top: docMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
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
      {activeDoc ? (
        <DocumentEditor
          activeDoc={activeDoc}
          activeDocId={activeDoc.id}
          activeEngine={activeEngine}
          tuningParams={tuningParams}
          onSaveContent={saveContent}
          onUpdateTitle={updateTitle}
          onDocumentCreated={(doc) => { setDocuments((prev) => [doc, ...prev]); setActiveDocId(doc.id); }}
          onTitleInputChange={(docId, newTitle) => setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, title: newTitle } : d))}
          onContextChange={onContextChange}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No document selected</p>
          <p className="text-xs mt-1">Create a new document to get started.</p>
        </div>
      )}
    </div>
  );
}
