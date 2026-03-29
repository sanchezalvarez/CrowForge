import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { PlusCircle, Trash2, Loader2, Pencil, Copy, Workflow } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

interface CanvasItem {
  id:         string;
  name:       string;
  updated_at: string;
}

interface CanvasSidebarProps {
  activeId:   string;
  onSelect:   (id: string) => void;
}

export function CanvasSidebar({ activeId, onSelect }: CanvasSidebarProps) {
  const [canvases,    setCanvases]    = useState<CanvasItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [renamingId,  setRenamingId]  = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [canvasMenu,  setCanvasMenu]  = useState<{ id: string; x: number; y: number } | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<CanvasItem[]>(`${API_BASE}/canvas`);
      setCanvases(res.data);
    } catch {
      setCanvases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!canvasMenu) return;
    const close = () => setCanvasMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [canvasMenu]);

  const handleCreate = useCallback(async () => {
    try {
      const res = await axios.post<CanvasItem>(`${API_BASE}/canvas`, { name: "Untitled Canvas" });
      setCanvases((prev) => [...prev, res.data]);
      onSelect(res.data.id);
    } catch (err) {
      console.error("Failed to create canvas", err);
    }
  }, [onSelect]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/canvas/${id}`);
      setCanvases((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (activeId === id && remaining.length > 0) onSelect(remaining[0].id);
        else if (activeId === id) handleCreate();
        return remaining;
      });
    } catch (err) {
      console.error("Failed to delete canvas", err);
    }
  }, [activeId, onSelect, handleCreate]);

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      const res = await axios.post<CanvasItem>(`${API_BASE}/canvas/${id}/duplicate`);
      setCanvases((prev) => [...prev, res.data]);
      onSelect(res.data.id);
    } catch (err) {
      console.error("Failed to duplicate canvas", err);
    }
  }, [onSelect]);

  const startRename = useCallback((id: string, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await axios.patch(`${API_BASE}/canvas/${renamingId}/name`, { name: renameValue.trim() });
      setCanvases((prev) =>
        prev.map((c) => c.id === renamingId ? { ...c, name: renameValue.trim() } : c),
      );
    } catch (err) {
      console.error("Failed to rename canvas", err);
    }
    setRenamingId(null);
  }, [renamingId, renameValue]);

  return (
    <div className="w-[220px] shrink-0 flex flex-col border-r" style={{ background: 'var(--background-2)' }}>
      {/* Header */}
      <div className="h-20 flex items-center px-3 border-b">
        <button className="btn-tactile btn-tactile-orange w-full justify-center" onClick={handleCreate}>
          <PlusCircle className="h-3.5 w-3.5" />
          New Canvas
        </button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && canvases.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No canvases yet.</p>
          )}
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              className={cn(
                "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                activeId === canvas.id
                  ? "font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              style={activeId === canvas.id ? { background: 'color-mix(in srgb, var(--accent-orange) 15%, transparent)', color: 'var(--accent-orange)' } : {}}
              onClick={() => onSelect(canvas.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setCanvasMenu({ id: canvas.id, x: e.clientX, y: e.clientY });
              }}
              onDoubleClick={() => startRename(canvas.id, canvas.name)}
            >
              <Workflow className="h-3.5 w-3.5 shrink-0" />

              {renamingId === canvas.id ? (
                <input
                  ref={renameRef}
                  className="flex-1 min-w-0 h-5 px-1 text-xs border border-primary/40 rounded bg-background outline-none"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 min-w-0 truncate">{canvas.name}</span>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Context menu */}
      {canvasMenu && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px] text-sm"
          style={{ left: canvasMenu.x, top: canvasMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => {
              const c = canvases.find((c) => c.id === canvasMenu.id);
              if (c) startRename(c.id, c.name);
              setCanvasMenu(null);
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => { handleDuplicate(canvasMenu.id); setCanvasMenu(null); }}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Duplicate
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-destructive"
            onClick={() => { handleDelete(canvasMenu.id); setCanvasMenu(null); }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
