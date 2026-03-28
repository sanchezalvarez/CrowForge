import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Plus, Search } from "lucide-react";
import { PMTask, PMTaskStatus, PMPriority, PMItemType, PMMember } from "../../types/pm";
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

interface BacklogViewProps {
  tasks: PMTask[];
  members: PMMember[];
  onTaskClick: (task: PMTask) => void;
  onTaskCreate: (status: PMTaskStatus) => void;
  onTaskUpdate: (id: number, data: Partial<PMTask>) => Promise<PMTask | null>;
}

type TreeNode = PMTask & { depth: number; children: TreeNode[] };

function buildTree(tasks: PMTask[], parentId: number | null = null, depth = 0): TreeNode[] {
  return tasks
    .filter((t) => t.parent_id === parentId)
    .sort((a, b) => a.position - b.position)
    .map((t) => ({
      ...t,
      depth,
      children: buildTree(tasks, t.id, depth + 1),
    }));
}

function flattenTree(nodes: TreeNode[], expandedIds: Set<number>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (expandedIds.has(node.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expandedIds));
    }
  }
  return result;
}

const ALL_TYPES: PMItemType[] = ["epic", "feature", "story", "task", "bug", "spike"];

export function BacklogView({ tasks, members, onTaskClick, onTaskCreate, onTaskUpdate }: BacklogViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    // Default: expand tasks/bugs/spikes/stories, collapse epics/features
    const ids = new Set<number>();
    tasks.forEach((t) => {
      if (t.item_type === "story" || t.item_type === "task" || t.item_type === "bug" || t.item_type === "spike") {
        ids.add(t.id);
      }
    });
    return ids;
  });

  const [typeFilter, setTypeFilter] = useState<Set<PMItemType>>(new Set(ALL_TYPES));
  const [statusFilter, setStatusFilter] = useState<PMTaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

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

  return (
    <div className="flex flex-col gap-3 h-full">
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

        {/* Type toggles */}
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
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
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
        <table className="w-full text-sm border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-xs font-mono border-b border-border">
              <th className="text-left px-3 py-2 w-8" />
              <th className="text-left px-2 py-2 w-20">Type</th>
              <th className="text-left px-2 py-2">Title</th>
              <th className="text-left px-2 py-2 w-28">Status</th>
              <th className="text-left px-2 py-2 w-24">Priority</th>
              <th className="text-left px-2 py-2 w-12">SP</th>
              <th className="text-left px-2 py-2 w-28">Assignee</th>
              <th className="text-left px-2 py-2 w-28">Due</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">
                  No work items found. Click "+ New Task" to get started.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <BacklogRow
                  key={row.id}
                  row={row}
                  expanded={expandedIds.has(row.id)}
                  onToggleExpand={() => toggleExpand(row.id)}
                  onClick={() => onTaskClick(row)}
                  onUpdate={onTaskUpdate}
                  members={members}
                  memberMap={memberMap}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      <button
        onClick={() => onTaskCreate("new")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        <Plus size={12} /> New work item
      </button>
    </div>
  );
}

interface BacklogRowProps {
  row: TreeNode;
  expanded: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
  onUpdate: (id: number, data: Partial<PMTask>) => Promise<PMTask | null>;
  members: PMMember[];
  memberMap: Record<number, PMMember>;
}

function BacklogRow({ row, expanded, onToggleExpand, onClick, onUpdate, members, memberMap }: BacklogRowProps) {
  const assignee = row.assignee_id ? memberMap[row.assignee_id] : null;
  const hasChildren = row.children.length > 0 || row.child_count > 0;
  const isClosed = row.status === "closed";

  return (
    <tr
      className="border-b border-border/50 hover:bg-muted/20 transition-colors group"
    >
      {/* Expand toggle */}
      <td className="px-3 py-2">
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : null}
      </td>

      {/* Type */}
      <td className="px-2 py-2">
        <WorkItemTypeBadge type={row.item_type} />
      </td>

      {/* Title */}
      <td className="px-2 py-2" style={{ paddingLeft: `${8 + row.depth * 20}px` }}>
        <span
          className={`cursor-pointer hover:text-primary transition-colors ${isClosed ? "line-through text-muted-foreground" : ""}`}
          onClick={onClick}
        >
          {row.title}
        </span>
        {row.labels?.length > 0 && (
          <span className="ml-2 text-[9px] font-mono text-muted-foreground">
            {row.labels.slice(0, 2).join(", ")}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <Select value={row.status} onValueChange={(v) => onUpdate(row.id, { status: v as PMTaskStatus })}>
          <SelectTrigger className="h-6 text-[11px] border-0 bg-transparent px-0 w-auto gap-1 hover:bg-muted rounded transition-colors">
            <StatusBadge status={row.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Priority */}
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
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
      </td>

      {/* Story Points */}
      <td className="px-2 py-2 text-xs font-mono text-muted-foreground">
        {row.story_points != null ? row.story_points : <span className="text-border">—</span>}
      </td>

      {/* Assignee */}
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <Select
          value={row.assignee_id?.toString() ?? "none"}
          onValueChange={(v) => onUpdate(row.id, { assignee_id: v !== "none" ? parseInt(v) : null })}
        >
          <SelectTrigger className="h-6 border-0 bg-transparent px-0 w-auto hover:bg-muted rounded transition-colors">
            <div className="flex items-center gap-1.5">
              <MemberAvatar member={assignee} size="sm" />
              <span className="text-xs truncate max-w-[80px]">{assignee?.name ?? <span className="text-muted-foreground">—</span>}</span>
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

      {/* Due date */}
      <td className="px-2 py-2 text-xs text-muted-foreground font-mono">
        {row.due_date ?? <span className="text-border">—</span>}
      </td>
    </tr>
  );
}
