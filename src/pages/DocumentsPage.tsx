/**
 * DocumentsPage — thin page wrapper.
 * Manages the document list and sidebar. Delegates editing to DocumentEditor.
 */

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  PlusCircle, FileText, Trash2, Copy, Pencil,
} from "lucide-react";
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
    <div className="flex h-full relative overflow-hidden">
      {/* Documents sidebar */}
      <div className="w-[220px] shrink-0 border-r flex flex-col" style={{ background: 'var(--background-2)' }}>
        <div className="h-20 flex items-center px-3 border-b">
          <button className="btn-tactile btn-tactile-violet w-full justify-center" onClick={createDocument}>
            <PlusCircle className="h-3.5 w-3.5" /> New Document
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                  activeDocId === doc.id ? "font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={activeDocId === doc.id ? { background: 'color-mix(in srgb, var(--accent-violet) 15%, transparent)', color: 'var(--accent-violet)' } : {}}
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
        <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none relative riso-noise riso-noise-live">
          {/* Riso background blobs */}
          <div className="pointer-events-none select-none" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <div className="animate-blob-drift" style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'var(--accent-violet)', opacity: 0.09, mixBlendMode: 'multiply', top: -120, right: -120 }} />
            <div className="animate-blob-drift-b" style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'var(--accent-orange)', opacity: 0.08, mixBlendMode: 'multiply', bottom: -100, left: -100 }} />
          </div>
          <svg width="100" height="120" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative', zIndex: 1 }}>
            <rect x="14" y="12" width="72" height="92" rx="4"
              fill="rgba(224,78,14,0.12)" stroke="rgba(224,78,14,0.35)" strokeWidth="1.5" />
            <rect x="8" y="8" width="72" height="92" rx="4"
              fill="rgba(11,114,104,0.08)" stroke="rgba(11,114,104,0.25)" strokeWidth="1.5" />
            <rect x="2" y="4" width="72" height="92" rx="4"
              fill="var(--background)" stroke="rgba(20,16,10,0.25)" strokeWidth="1.5" />
            <line x1="12" y1="24" x2="64" y2="24" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="12" y1="34" x2="64" y2="34" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
            <line x1="12" y1="44" x2="50" y2="44" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
            <circle cx="58" cy="70" r="2" fill="rgba(224,78,14,0.4)" />
            <circle cx="66" cy="66" r="1.5" fill="rgba(224,78,14,0.25)" />
            <circle cx="62" cy="76" r="1" fill="rgba(224,78,14,0.2)" />
            <circle cx="70" cy="74" r="2" fill="rgba(11,114,104,0.3)" />
            <line x1="72" y1="4" x2="76" y2="4" stroke="rgba(11,114,104,0.4)" strokeWidth="1" />
            <line x1="74" y1="2" x2="74" y2="6" stroke="rgba(11,114,104,0.4)" strokeWidth="1" />
          </svg>
          <div className="text-center space-y-1" style={{ position: 'relative', zIndex: 1 }}>
            <p className="text-sm font-semibold font-display">No document selected</p>
            <p className="text-xs text-muted-foreground">Create a new document to get started.</p>
          </div>
          <span className="riso-stamp" style={{ color: 'var(--accent-orange)', position: 'relative', zIndex: 1 }}>Documents</span>
        </div>
      )}
    </div>
  );
}
