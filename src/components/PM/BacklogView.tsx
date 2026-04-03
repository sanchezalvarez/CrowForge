import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, Plus, Search, Trash2, Pencil, Download, Copy } from "lucide-react";
import axios from "axios";
import { PMTask, PMTaskStatus, PMItemType, PMMember } from "../../types/pm";
import { buildTree, flattenTree, filterTree, treeToMarkdown, type TreeNode } from "../../lib/pmUtils";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { StatusBadge } from "./StatusBadge";
import { MemberAvatar } from "./MemberAvatar";
import { toast } from "../../hooks/useToast";
import { Button } from "../ui/button";
import { API_BASE } from "../../lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// ── Column definitions ──────────────────────────────────────────────────────

type ColKey = "type" | "title" | "status" | "assignee" | "due";

const DEFAULT_COL_ORDER: ColKey[] = ["title", "status", "assignee", "due"];

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  type: 96, title: 320, status: 112, assignee: 112, due: 112,
};

const COL_LABELS: Record<ColKey, string> = {
  type: "Type", title: "Title", status: "Status", assignee: "Assignee", due: "Due",
};

// ── Props ───────────────────────────────────────────────────────────────────

interface BacklogViewProps {
  tasks: PMTask[];
  members: PMMember[];
  onTaskClick: (task: PMTask) => void;
  onTaskCreate: (status: PMTaskStatus) => void;
  onTaskUpdate: (id: number, data: Partial<PMTask>) => Promise<PMTask | null>;
  onTaskDelete?: (id: number) => Promise<void>;
  onTasksReload?: () => Promise<void>;
  onChildCreate?: (parentId: number, title: string, type: PMItemType) => Promise<void>;
}

interface CtxMenu { x: number; y: number; task: PMTask }

// ── Tree helpers imported from pmUtils ───────────────────────────────────────

const ALL_TYPES: PMItemType[] = ["epic", "feature", "story", "task", "spike"];

function defaultChildType(parentType: PMItemType): PMItemType {
  if (parentType === "epic") return "feature";
  if (parentType === "feature") return "story";
  return "task";
}

// ── Main BacklogView ─────────────────────────────────────────────────────────

export function BacklogView({
  tasks, members, onTaskClick, onTaskCreate: _onTaskCreate, onTaskUpdate, onTaskDelete, onTasksReload, onChildCreate,
}: BacklogViewProps) {
  // Expand state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const expandInitialized = useRef(false);

  useEffect(() => {
    if (!expandInitialized.current && tasks.length > 0) {
      expandInitialized.current = true;
      setExpandedIds((prev) => {
        const next = new Set(prev);
        tasks.forEach((t) => { if (t.child_count > 0) next.add(t.id); });
        return next;
      });
    }
  }, [tasks]);

  // Filters
  const [typeFilter, setTypeFilter] = useState<Set<PMItemType>>(new Set(ALL_TYPES));
  const [statusFilter, setStatusFilter] = useState<PMTaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Inline child creation
  const [inlineParentId, setInlineParentId] = useState<number | null>(null);

  const handleAddChildInline = (parentId: number) => {
    setExpandedIds((prev) => { const next = new Set(prev); next.add(parentId); return next; });
    setInlineParentId(parentId);
  };

  const handleInlineSubmit = async (parentId: number, title: string, type: PMItemType) => {
    setInlineParentId(null);
    if (onChildCreate) await onChildCreate(parentId, title, type);
  };

  // Context menu / rename
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [renameId, setRenameId] = useState<number | null>(null);

  // Column state
  const [colOrder, setColOrder] = useState<ColKey[]>(DEFAULT_COL_ORDER);
  const [colWidths, setColWidths] = useState({ ...DEFAULT_COL_WIDTHS });
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);
  const [dragColOver, setDragColOver] = useState<ColKey | null>(null);
  const dragColRef = useRef<ColKey | null>(null);
  const resizeRef = useRef<{ col: ColKey; startX: number; startWidth: number } | null>(null);

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  const fullTree = useMemo(() => buildTree(tasks), [tasks]);

  const tree = useMemo(() => {
    return filterTree(fullTree, (node) => {
      if (!typeFilter.has(node.item_type)) return false;
      if (statusFilter !== "all" && node.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && node.assignee_id?.toString() !== assigneeFilter) return false;
      if (search && !node.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [fullTree, typeFilter, statusFilter, assigneeFilter, search]);

  const visibleRows = useMemo(() => flattenTree(tree, expandedIds), [tree, expandedIds]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleType = (type: PMItemType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // ── Context menu handlers ──
  const handleCtxDuplicate = useCallback(async (task: PMTask) => {
    setCtxMenu(null);
    try {
      await axios.post(`${API_BASE}/pm/tasks`, {
        project_id: task.project_id,
        parent_id: task.parent_id,
        title: `${task.title} (copy)`,
        item_type: task.item_type,
        status: task.status,
        description: task.description,
        sprint_id: task.sprint_id,
      });
      await onTasksReload?.();
    } catch {}
  }, [onTasksReload]);

  const handleCtxDelete = useCallback(async (task: PMTask) => {
    setCtxMenu(null);
    await onTaskDelete?.(task.id);
  }, [onTaskDelete]);

  const handleCtxRename = useCallback((task: PMTask) => {
    setCtxMenu(null);
    setRenameId(task.id);
  }, []);

  const handleExport = () => {
    const md = treeToMarkdown(tree);
    navigator.clipboard.writeText(md);
    toast("Backlog exported to clipboard as Markdown", "success");
  };

  // ── Column resize ──
  const startResize = useCallback((e: React.MouseEvent, col: ColKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidthsRef.current[col] ?? (e.currentTarget as HTMLElement).parentElement?.offsetWidth ?? 200;
    resizeRef.current = { col, startX: e.clientX, startWidth };
    const onMove = (ev: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const diff = ev.clientX - r.startX;
      setColWidths((prev) => ({
        ...prev,
        [r.col]: Math.max(50, r.startWidth + diff),
      }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // ── Column reorder ──
  const onColDragStart = (col: ColKey) => { dragColRef.current = col; };
  const onColDragOver = (e: React.DragEvent, col: ColKey) => {
    e.preventDefault();
    if (dragColRef.current && dragColRef.current !== col) setDragColOver(col);
  };
  const onColDrop = (targetCol: ColKey) => {
    const from = dragColRef.current;
    dragColRef.current = null;
    setDragColOver(null);
    if (!from || from === targetCol) return;
    setColOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(targetCol);
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return next;
    });
  };
  const onColDragEnd = () => { dragColRef.current = null; setDragColOver(null); };

  return (
    <div className="flex flex-col gap-4 h-full" onClick={() => setCtxMenu(null)}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap animate-ink-in">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search work items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
          <Download size={13} /> Export
        </Button>

        <div className="flex items-center gap-1.5">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`btn-tactile text-[10px] transition-all ${
                typeFilter.has(type)
                  ? "btn-tactile-orange"
                  : "btn-tactile-outline opacity-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PMTaskStatus | "all")}>
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="ready_to_go">Ready to Go</SelectItem>
            <SelectItem value="needs_testing">Needs Testing</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue placeholder="All assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div
        className="flex-1 overflow-auto rounded-md"
        style={{ border: "1.5px solid rgba(20,16,10,0.18)", boxShadow: "3px 3px 0 var(--riso-teal)" }}
      >
        <div className="overflow-x-auto">
        <table
          className="text-sm border-collapse"
          style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}
        >
          <colgroup>
            <col style={{ width: 24 }} />
            {colOrder.map((col) => (
              <col key={col} style={{ width: colWidths[col] }} />
            ))}
          </colgroup>
          <thead>
            <tr
              className="text-muted-foreground text-[10px] font-mono-ui border-b"
              style={{
                background: "var(--background-3)",
                borderColor: "rgba(20,16,10,0.14)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <th className="w-6" />
              {colOrder.map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2.5 relative"
                  style={{
                    userSelect: "none",
                    cursor: "grab",
                    background: dragColOver === col ? "rgba(224,78,14,0.08)" : undefined,
                  }}
                  draggable
                  onDragStart={() => onColDragStart(col)}
                  onDragOver={(e) => onColDragOver(e, col)}
                  onDrop={() => onColDrop(col)}
                  onDragEnd={onColDragEnd}
                >
                  {COL_LABELS[col]}
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
                    onMouseDown={(e) => startResize(e, col)}
                    draggable={false}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={colOrder.length + 1} className="text-center py-12 text-sm text-muted-foreground">

                  No work items found. Click "+ New Item" to get started.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, idx) => (
                <React.Fragment key={row.id}>
                <BacklogRow
                  row={row}
                  animIndex={idx}
                  colOrder={colOrder}
                  expanded={expandedIds.has(row.id)}
                  onToggleExpand={() => toggleExpand(row.id)}
                  onClick={() => onTaskClick(row)}
                  onUpdate={onTaskUpdate}
                  members={members}
                  memberMap={memberMap}
                  onContextMenu={(e, task) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCtxMenu({ x: e.clientX, y: e.clientY, task });
                  }}
                  isRenaming={renameId === row.id}
                  onRenameSubmit={async (title) => { setRenameId(null); await onTaskUpdate(row.id, { title }); }}
                  onRenameCancel={() => setRenameId(null)}
                  onAddChild={onChildCreate ? () => handleAddChildInline(row.id) : undefined}
                  isLeaf={row.item_type === "task" || row.item_type === "bug" || row.item_type === "spike"}
                />
                {inlineParentId === row.id && (
                  <InlineAddRow
                    parentId={row.id}
                    parentType={row.item_type}
                    depth={row.depth + 1}
                    colCount={colOrder.length}
                    onSubmit={handleInlineSubmit}
                    onCancel={() => setInlineParentId(null)}
                  />
                )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-[200] surface-noise py-1 min-w-[140px]"
          style={{
            top: ctxMenu.y,
            left: ctxMenu.x,
            background: "var(--card)",
            border: "1.5px solid rgba(20,16,10,0.22)",
            borderRadius: "6px",
            boxShadow: "3px 3px 0 rgba(20,16,10,0.18)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono-ui hover:bg-muted/60 transition-colors text-left"
            onClick={() => handleCtxRename(ctxMenu.task)}
          >
            <Pencil size={11} /> Rename
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono-ui hover:bg-muted/60 transition-colors text-left"
            onClick={() => handleCtxDuplicate(ctxMenu.task)}
          >
            <Copy size={11} /> Duplicate
          </button>
          <div className="my-1 border-t" style={{ borderColor: "rgba(20,16,10,0.12)" }} />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono-ui hover:bg-destructive/10 text-destructive transition-colors text-left"
            onClick={() => handleCtxDelete(ctxMenu.task)}
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline add child row ─────────────────────────────────────────────────────

interface InlineAddRowProps {
  parentId: number;
  parentType: PMItemType;
  depth: number;
  colCount: number;
  onSubmit: (parentId: number, title: string, type: PMItemType) => void;
  onCancel: () => void;
}

function InlineAddRow({ parentId, parentType, depth, colCount, onSubmit, onCancel }: InlineAddRowProps) {
  const [value, setValue] = useState("");
  const childType = defaultChildType(parentType);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 10); }, []);

  return (
    <tr className="border-b border-border/50 bg-muted/10">
      <td />
      <td
        className="py-2"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        colSpan={colCount}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-4 shrink-0" />
          <WorkItemTypeBadge type={childType} />
          <input
            ref={inputRef}
            className="w-full max-w-md text-xs border border-primary/40 rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={`New ${childType} title…`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSubmit(parentId, value.trim(), childType);
              if (e.key === "Escape") onCancel();
            }}
            onBlur={() => { if (!value.trim()) onCancel(); }}
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Enter · Esc</span>
        </div>
      </td>
    </tr>
  );
}

// ── Backlog row ─────────────────────────────────────────────────────────────

interface BacklogRowProps {
  row: TreeNode;
  colOrder: ColKey[];
  expanded: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
  onUpdate: (id: number, data: Partial<PMTask>) => Promise<PMTask | null>;
  members: PMMember[];
  memberMap: Record<number, PMMember>;
  onContextMenu: (e: React.MouseEvent, task: PMTask) => void;
  isRenaming: boolean;
  onRenameSubmit: (title: string) => void;
  onRenameCancel: () => void;
  onAddChild?: () => void;
  isLeaf?: boolean;
  animIndex?: number;
}

function BacklogRow({
  row, colOrder, expanded, onToggleExpand, onClick, onUpdate, members, memberMap,
  onContextMenu, isRenaming, onRenameSubmit, onRenameCancel,
  onAddChild, isLeaf, animIndex = 0,
}: BacklogRowProps) {
  const [renameVal, setRenameVal] = useState(row.title);
  const renameRef = useRef<HTMLInputElement>(null);
  const assignee = row.assignee_id ? memberMap[row.assignee_id] : null;
  const hasChildren = row.children.length > 0 || row.child_count > 0;
  const isDone = row.status === "closed" || row.status === "resolved" || row.status === "rejected";

  useEffect(() => {
    if (isRenaming) {
      setRenameVal(row.title);
      setTimeout(() => renameRef.current?.select(), 10);
    }
  }, [isRenaming, row.title]);

  const renderCell = (col: ColKey) => {
    switch (col) {
      case "title":
        return (
          <td
            key="title"
            className="py-2 overflow-hidden"
            style={{ paddingLeft: `${12 + row.depth * 20}px` }}
          >
            <div className="flex items-center gap-1 min-w-0">
              {/* Chevron inline — fixed width so title stays aligned */}
              <button
                className="shrink-0 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                style={{ visibility: hasChildren ? "visible" : "hidden" }}
                onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <WorkItemTypeBadge type={row.item_type} />
              {isRenaming ? (
                <input
                  ref={renameRef}
                  className="text-sm border border-primary/40 rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameVal.trim()) onRenameSubmit(renameVal.trim());
                    if (e.key === "Escape") onRenameCancel();
                  }}
                  onBlur={() => {
                    if (renameVal.trim() && renameVal !== row.title) onRenameSubmit(renameVal.trim());
                    else onRenameCancel();
                  }}
                />
              ) : (
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`cursor-pointer hover:text-primary transition-colors truncate ${isDone ? "line-through text-muted-foreground" : ""}`}
                    onClick={onClick}
                  >
                    {row.title}
                  </span>
                  {row.refs?.length > 0 && (
                    <span className="flex-shrink-0 text-[9px] font-mono text-muted-foreground/60" title={`${row.refs.length} reference${row.refs.length > 1 ? "s" : ""}`}>
                      🔗{row.refs.length}
                    </span>
                  )}
                </span>
              )}
            </div>
          </td>
        );

      case "status":
        return (
          <td key="status" className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
            <Select value={row.status} onValueChange={(v) => onUpdate(row.id, { status: v as PMTaskStatus })}>
              <SelectTrigger className="h-6 text-[11px] border-0 bg-transparent px-0 w-auto gap-1 hover:bg-muted rounded transition-colors">
                <StatusBadge status={row.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ready_to_go">Ready to Go</SelectItem>
                <SelectItem value="needs_testing">Needs Testing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </td>
        );

      case "assignee":
        return (
          <td key="assignee" className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
            <Select
              value={row.assignee_id?.toString() ?? "none"}
              onValueChange={(v) => onUpdate(row.id, { assignee_id: v !== "none" ? parseInt(v) : null })}
            >
              <SelectTrigger className="h-6 border-0 bg-transparent px-0 w-auto hover:bg-muted rounded transition-colors">
                <div className="flex items-center gap-1.5">
                  <MemberAvatar member={assignee} size="sm" />
                  <span className="text-xs truncate max-w-[80px]">
                    {assignee?.name ?? <span className="text-muted-foreground">—</span>}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </td>
        );

      case "due":
        return (
          <td key="due" className="px-3 py-2 text-xs text-muted-foreground font-mono">
            {row.due_date ?? <span className="text-border">—</span>}
          </td>
        );

      default:
        return null;
    }
  };

  return (
    <tr
      className="border-b transition-colors group row-tactile animate-row-in"
      style={{
        borderBottomColor: "rgba(20,16,10,0.08)",
        animationDelay: `${Math.min(animIndex, 30) * 15}ms`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent-orange) 7%, transparent)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
      onContextMenu={(e) => onContextMenu(e, row)}
    >
      {/* Inline add child button */}
      <td className="px-1 py-2 w-6">
        {!isLeaf && onAddChild && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(); }}
            className="opacity-0 group-hover:opacity-70 hover:!opacity-100 text-accent-orange hover:text-accent-orange transition-all rounded hover:bg-orange-500/10 p-0.5"
            style={{ color: 'var(--accent-orange)' }}
            title="Add child"
          >
            <Plus size={16} />
          </button>
        )}
      </td>

      {colOrder.map((col) => renderCell(col))}
    </tr>
  );
}
