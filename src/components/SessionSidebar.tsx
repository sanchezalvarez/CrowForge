import { useEffect, useRef } from "react";
import { PlusCircle, Trash2, Pencil } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { cn } from "../lib/utils";
import type { ChatSession } from "../types/api";

interface SessionSidebarProps {
  accent: "teal" | "violet";
  icon: React.ElementType;
  newLabel: string;
  sessionsLabel: string;
  emptyLabel: string;
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  sessionMenu: { sessionId: number; x: number; y: number } | null;
  setSessionMenu: (menu: { sessionId: number; x: number; y: number } | null) => void;
  onStartRename: (id: number, title: string) => void;
  renameId: number | null;
  renameValue: string;
  onRenameChange: (val: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  deleteConfirmId: number | null;
  setDeleteConfirmId: (id: number | null) => void;
  onDelete: (id: number) => void;
  sidebarWidth: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

export function SessionSidebar({
  accent,
  icon: Icon,
  newLabel,
  sessionsLabel,
  emptyLabel,
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  sessionMenu,
  setSessionMenu,
  onStartRename,
  renameId,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  deleteConfirmId,
  setDeleteConfirmId,
  onDelete,
  sidebarWidth,
  onResizeStart,
}: SessionSidebarProps) {
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renameId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameId]);

  // Close session context menu on outside click
  useEffect(() => {
    if (!sessionMenu) return;
    const close = () => setSessionMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sessionMenu, setSessionMenu]);

  const isTeal = accent === "teal";
  const accentVar = isTeal ? "--accent-teal" : "--accent-violet";
  const btnClass = isTeal ? "btn-tactile btn-tactile-teal" : "btn-tactile btn-tactile-violet";
  const cardRisoClass = isTeal ? "card-riso" : "card-riso card-riso-violet";
  const resizeHoverClass = isTeal ? "hover:bg-primary/40" : "hover:bg-violet-400/40";
  const renameBorderStyle = isTeal
    ? "border-b border-primary"
    : "";

  return (
    <>
      <div className="shrink-0 border-r flex flex-col relative surface-noise" style={{ width: sidebarWidth, background: 'var(--background-2)' }}>
        <div className="h-14 flex items-center px-3 border-b shrink-0">
          <button className={cn(btnClass, "w-full justify-center")} onClick={onCreate}>
            <PlusCircle className="h-3.5 w-3.5" />
            {newLabel}
          </button>
        </div>
        <div className="px-3 pt-3 pb-1">
          <span className="riso-section-label">{sessionsLabel}</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 pb-2 space-y-0.5">
            {sessions.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors animate-row-in border",
                  activeSessionId === s.id
                    ? "font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
                )}
                style={{
                  animationDelay: `${Math.min(i, 20) * 20}ms`,
                  ...(activeSessionId === s.id ? {
                    background: `color-mix(in srgb, var(${accentVar}) 10%, transparent)`,
                    color: `var(${accentVar})`,
                    borderColor: `color-mix(in srgb, var(${accentVar}) 20%, transparent)`,
                  } : {}),
                }}
                onClick={() => { if (renameId !== s.id) onSelect(s.id); }}
                onDoubleClick={() => onStartRename(s.id, s.title)}
                onContextMenu={(e) => { e.preventDefault(); setSessionMenu({ sessionId: s.id, x: e.clientX, y: e.clientY }); }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {renameId === s.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onBlur={onRenameCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onRenameCommit();
                      if (e.key === "Escape") onRenameCancel();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn("flex-1 bg-transparent outline-none text-xs min-w-0", renameBorderStyle)}
                    style={!isTeal ? { borderBottom: '1px solid', borderColor: `var(${accentVar})` } : undefined}
                  />
                ) : (
                  <span className="flex-1 min-w-0 truncate font-mono-ui text-xs">{s.title}</span>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="font-mono-ui text-[11px] text-muted-foreground text-center py-6 opacity-60">{emptyLabel}</p>
            )}
          </div>
        </ScrollArea>
        {/* Resize handle */}
        <div
          className={cn("absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 transition-colors", resizeHoverClass)}
          onMouseDown={onResizeStart}
        />
      </div>

      {/* Session context menu */}
      {sessionMenu && (
        <div
          className={cn("fixed z-50 bg-card border border-border-strong rounded-md py-1 min-w-[150px] text-sm", cardRisoClass)}
          style={{ left: sessionMenu.x, top: sessionMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 font-mono-ui text-xs transition-colors"
            onClick={() => { onStartRename(sessionMenu.sessionId, sessions.find(s => s.id === sessionMenu.sessionId)?.title ?? ""); setSessionMenu(null); }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-destructive font-mono-ui text-xs transition-colors"
            onClick={() => { setDeleteConfirmId(sessionMenu.sessionId); setSessionMenu(null); }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">Delete Session</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-mono-ui">
            Are you sure? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-tactile btn-tactile-outline px-4 py-1.5 text-xs" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button className="btn-tactile px-4 py-1.5 text-xs" style={{ background: "var(--accent-orange)" }} onClick={() => { onDelete(deleteConfirmId!); setDeleteConfirmId(null); }}>Delete</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
