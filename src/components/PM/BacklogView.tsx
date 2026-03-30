import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, Plus, Search, Copy, Trash2, Pencil, GripVertical } from "lucide-react";
import axios from "axios";
import { PMTask, PMTaskStatus, PMPriority, PMItemType, PMMember } from "../../types/pm";
import { buildTree, flattenTree, type TreeNode } from "../../lib/pmUtils";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { MemberAvatar } from "./MemberAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const API_BASE = "http://127.0.0.1:8000";

// ── Column definitions ──────────────────────────────────────────────────────

type ColKey = "type" | "title" | "status" | "priority" | "sp" | "assignee" | "due";

const DEFAULT_COL_ORDER: ColKey[] = ["type", "title", "status", "priority", "sp", "assignee", "due"];

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  type: 96, title: 280, status: 112, priority: 96, sp: 48, assignee: 112, due: 112,
};

const COL_LABELS: Record<ColKey, string> = {
  type: "Type", title: "Title", status: "Status", priority: "Priority", sp: "SP", assignee: "Assignee", due: "Due",
};

// Valid parent types for drag & drop reparenting
const VALID_PARENT_TYPES: Partial<Record<PMItemType, PMItemType[]>> = {
  feature: ["epic"],
  story:   ["feature"],
  task:    ["story", "feature"],
  bug:     ["story", "feature"],
  spike:   ["story", "feature"],
};

// Depth tree-line colors: depth 1 = orange, 2 = teal, 3+ = violet
const DEPTH_COLORS = [
  "rgba(224,78,14,0.55)",
  "rgba(11,114,104,0.55)",
  "rgba(92,58,156,0.55)",
];

// ── Props ───────────────────────────────────────────────────────────────────

interface BacklogViewProps {
  tasks: PMTask[];
  members: PMMember[];
  onTaskClick: (task: PMTask) => void;
  onTaskCreate: (status: PMTaskStatus) => void;
  onTaskUpdate: (id: number, data: Partial<PMTask>) => Promise<PMTask | null>;
  onTaskDelete?: (id: number) => Promise<void>;
  onTasksReload?: () => Promise<void>;
}

interface CtxMenu { x: number; y: number; task: PMTask }

// ── Tree helpers imported from pmUtils ───────────────────────────────────────

const ALL_TYPES: PMItemType[] = ["epic", "feature", "story", "task", "bug", "spike"];

// ── Main BacklogView ─────────────────────────────────────────────────────────

export function BacklogView({
  tasks, members, onTaskClick, onTaskCreate, onTaskUpdate, onTaskDelete, onTasksReload,
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
    } else if (expandInitialized.current) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        tasks.forEach((t) => { if (t.child_count > 0 && !next.has(t.id)) next.add(t.id); });
        return next;
      });
    }
  }, [tasks]);

  // Filters
  const [typeFilter, setTypeFilter] = useState<Set<PMItemType>>(new Set(ALL_TYPES));
  const [statusFilter, setStatusFilter] = useState<PMTaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

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

  // Row drag (reparent)
  const [dragRowId, setDragRowId] = useState<number | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<number | null>(null);

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!typeFilter.has(t.item_type)) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && t.assignee_id?.toString() !== assigneeFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, typeFilter, statusFilter, assigneeFilter, search]);

  const tree = useMemo(() => buildTree(filteredTasks), [filteredTasks]);
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
        priority: task.priority,
        story_points: task.story_points,
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

  // ── Row drag reparent ──
  const handleRowDrop = useCallback(async (targetId: number) => {
    const srcId = dragRowId;
    setDragRowId(null);
    setDragOverRowId(null);
    if (!srcId || srcId === targetId) return;
    const src = tasks.find(t => t.id === srcId);
    const tgt = tasks.find(t => t.id === targetId);
    if (!src || !tgt) return;
    const validParents = VALID_PARENT_TYPES[src.item_type] ?? [];
    if (!validParents.includes(tgt.item_type)) return;
    await onTaskUpdate(srcId, { parent_id: targetId });
  }, [dragRowId, tasks, onTaskUpdate]);

  return (
    <div className="flex flex-col gap-3 h-full" onClick={() => setCtxMenu(null)}>
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search work items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
                typeFilter.has(type)
                  ? "bg-muted border-border text-foreground"
                  : "bg-transparent border-transparent text-muted-foreground/40"
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
      <div className="flex-1 overflow-auto rounded-lg border border-border">
        <div className="overflow-x-auto">
        <table
          className="text-sm border-collapse"
          style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}
        >
          <colgroup>
            <col style={{ width: 20 }} />
            <col style={{ width: 36 }} />
            {colOrder.map((col) => (
              <col key={col} style={{ width: colWidths[col] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-xs font-mono border-b border-border">
              <th className="w-5" />
              <th className="px-3 py-2" />
              {colOrder.map((col) => (
                <th
                  key={col}
                  className="text-left px-2 py-2 relative"
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
              visibleRows.map((row) => (
                <BacklogRow
                  key={row.id}
                  row={row}
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
                  isDragOver={dragOverRowId === row.id && dragRowId !== null && dragRowId !== row.id && (() => {
                    const src = tasks.find(t => t.id === dragRowId);
                    return (VALID_PARENT_TYPES[src?.item_type ?? "epic"] ?? []).includes(row.item_type);
                  })()}
                  isDragging={dragRowId === row.id}
                  onDragStart={() => setDragRowId(row.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverRowId(row.id); }}
                  onDragLeave={() => { if (dragOverRowId === row.id) setDragOverRowId(null); }}
                  onDrop={() => handleRowDrop(row.id)}
                />
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onTaskCreate("new")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          <Plus size={12} /> New work item
        </button>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-[200] bg-background border border-border rounded-md shadow-lg py-1 min-w-[140px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left"
            onClick={() => handleCtxRename(ctxMenu.task)}
          >
            <Pencil size={11} /> Rename
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left"
            onClick={() => handleCtxDuplicate(ctxMenu.task)}
          >
            <Copy size={11} /> Duplicate
          </button>
          <div className="my-1 border-t border-border" />
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-destructive/10 text-destructive transition-colors text-left"
            onClick={() => handleCtxDelete(ctxMenu.task)}
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}
    </div>
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
  isDragOver: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}

function BacklogRow({
  row, colOrder, expanded, onToggleExpand, onClick, onUpdate, members, memberMap,
  onContextMenu, isRenaming, onRenameSubmit, onRenameCancel,
  isDragOver, isDragging, onDragStart, onDragOver, onDragLeave, onDrop,
}: BacklogRowProps) {
  const [renameVal, setRenameVal] = useState(row.title);
  const renameRef = useRef<HTMLInputElement>(null);
  const assignee = row.assignee_id ? memberMap[row.assignee_id] : null;
  const hasChildren = row.children.length > 0 || row.child_count > 0;
  const isDone = row.status === "closed" || row.status === "resolved" || row.status === "rejected";
  const depthColor = row.depth > 0 ? DEPTH_COLORS[Math.min(row.depth, 3) - 1] : undefined;

  useEffect(() => {
    if (isRenaming) {
      setRenameVal(row.title);
      setTimeout(() => renameRef.current?.select(), 10);
    }
  }, [isRenaming, row.title]);

  const renderCell = (col: ColKey) => {
    switch (col) {
      case "type":
        return (
          <td key="type" className="px-2 py-2">
            <WorkItemTypeBadge type={row.item_type} />
          </td>
        );

      case "title":
        return (
          <td
            key="title"
            className="px-2 py-2 overflow-hidden"
            style={{ paddingLeft: `${8 + row.depth * 24}px` }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {row.depth > 0 && (
                <span
                  className="flex-shrink-0 rounded-full"
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 14,
                    backgroundColor: depthColor,
                    verticalAlign: "middle",
                  }}
                />
              )}
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
                  {row.labels?.length > 0 && (
                    <span className="flex-shrink-0 text-[9px] font-mono text-muted-foreground">
                      {row.labels.slice(0, 2).join(", ")}
                    </span>
                  )}
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
          <td key="status" className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <div onDragStart={(e) => e.stopPropagation()}>
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
            </div>
          </td>
        );

      case "priority":
        return (
          <td key="priority" className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <div onDragStart={(e) => e.stopPropagation()}>
            <Select value={row.priority} onValueChange={(v) => onUpdate(row.id, { priority: v as PMPriority })}>
              <SelectTrigger className="h-6 text-[11px] border-0 bg-transparent px-0 w-auto gap-1 hover:bg-muted rounded transition-colors">
                <PriorityBadge priority={row.priority} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </td>
        );

      case "sp":
        return (
          <td key="sp" className="px-2 py-2 text-xs font-mono text-muted-foreground">
            {row.story_points != null ? row.story_points : <span className="text-border">—</span>}
          </td>
        );

      case "assignee":
        return (
          <td key="assignee" className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <div onDragStart={(e) => e.stopPropagation()}>
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
            </div>
          </td>
        );

      case "due":
        return (
          <td key="due" className="px-2 py-2 text-xs text-muted-foreground font-mono">
            {row.due_date ?? <span className="text-border">—</span>}
          </td>
        );

      default:
        return null;
    }
  };

  const isDraggable = !!(VALID_PARENT_TYPES[row.item_type]?.length);

  return (
    <tr
      className="border-b border-border/50 hover:bg-muted/20 transition-colors group"
      style={{
        opacity: isDragging ? 0.45 : 1,
        outline: isDragOver ? "2px dashed var(--accent-orange)" : undefined,
        outlineOffset: isDragOver ? "-2px" : undefined,
        cursor: isDraggable ? "grab" : undefined,
      }}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) { e.preventDefault(); return; }
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onContextMenu={(e) => onContextMenu(e, row)}
    >
      {/* Drag handle — visual affordance only, drag is on <tr> */}
      <td className="py-2 w-5" style={{ paddingLeft: 4 }}>
        <span
          className={`flex items-center transition-colors ${isDraggable ? "text-muted-foreground/25 group-hover:text-muted-foreground/60" : "text-transparent"}`}
        >
          <GripVertical size={12} />
        </span>
      </td>

      {/* Expand toggle — fixed first column, indented by depth */}
      <td
        className="px-3 py-2"
        style={{ paddingLeft: `${10 + row.depth * 24}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : null}
      </td>

      {colOrder.map((col) => renderCell(col))}
    </tr>
  );
}
