import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { PMIssue, PMTask, PMMember, PMTaskStatus } from "../../types/pm";
import { MemberAvatar } from "./MemberAvatar";
import { useWorkflowConfig } from "../../hooks/useWorkflowConfig";
import { Users, Filter, Layers, ChevronDown, Trash2 } from "lucide-react";

// ── Constants ──

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 32;
const ROW_RENDER_LIMIT = 500;
const BUFFER = 15;

// ── Types ──

type RowItem =
  | { kind: "issue"; data: PMIssue }
  | { kind: "header"; projectName: string; projectCode: string; count: number };

type EditingCell = { issueId: number; col: "severity" | "status" | "assignee" | "title" } | null;

interface Props {
  issues: PMIssue[];
  members: PMMember[];
  loading: boolean;
  currentMemberId: number;
  onUpdate: (id: number, data: Partial<PMTask>) => Promise<PMIssue | null>;
  onBulkUpdate: (ids: number[], data: Partial<PMTask>) => Promise<void>;
  onBulkDelete?: (ids: number[]) => Promise<void>;
  onIssueClick?: (issue: PMIssue) => void;
}

// ── Helpers ──

function formatIssueId(issue: PMIssue): string {
  const code =
    issue.project_code ||
    issue.project_name?.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() ||
    "PROJ";
  const num = issue.project_task_id ?? issue.id;
  return `${code}-${String(num).padStart(3, "0")}`;
}

function formatDate(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Row Components ──

const IssueRow = React.memo(function IssueRow({
  issue,
  isSelected,
  editingCell,
  members,
  groupByProject,
  statusDisplay,
  severityStyles,
  allSeverities,
  issueStatuses,
  onCheckbox,
  onCellClick,
  onUpdate,
  onEditDone,
  onRowClick,
}: {
  issue: PMIssue;
  isSelected: boolean;
  editingCell: EditingCell;
  members: PMMember[];
  groupByProject: boolean;
  statusDisplay: Record<string, { label: string; color: string }>;
  severityStyles: Record<string, string>;
  allSeverities: string[];
  issueStatuses: string[];
  onCheckbox: (id: number, e: React.MouseEvent) => void;
  onCellClick: (issueId: number, col: EditingCell extends null ? never : NonNullable<EditingCell>["col"]) => void;
  onUpdate: (id: number, data: Partial<PMTask>) => void;
  onEditDone: () => void;
  onRowClick?: (issue: PMIssue) => void;
}) {
  const isEditing = editingCell?.issueId === issue.id;
  const editCol = isEditing ? editingCell!.col : null;
  const assignee = members.find((m) => m.id === issue.assignee_id);
  const statusInfo = statusDisplay[issue.status] ?? { label: issue.status, color: "bg-muted" };

  return (
    <tr
      className="border-b transition-colors cursor-pointer"
      style={{
        height: ROW_HEIGHT,
        borderBottomColor: "rgba(20,16,10,0.08)",
        background: isSelected
          ? "color-mix(in srgb, var(--accent-orange) 8%, var(--background))"
          : undefined,
      }}
      onClick={() => onRowClick?.(issue)}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--background-2)"; }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ""; }}
    >
      {/* Checkbox */}
      <td className="w-8 text-center px-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => { e.stopPropagation(); onCheckbox(issue.id, e); }}
          className="rounded border-border cursor-pointer"
        />
      </td>

      {/* ID */}
      <td className="px-3 whitespace-nowrap">
        <span className="text-[10px] font-mono-ui font-bold" style={{ color: "var(--accent-orange)", letterSpacing: "0.04em" }}>
          {formatIssueId(issue)}
        </span>
      </td>

      {/* Project */}
      {!groupByProject && (
        <td className="px-3 text-xs truncate max-w-[120px]" title={issue.project_name}>
          {issue.project_name}
        </td>
      )}

      {/* Severity */}
      <td className="px-3 relative" onClick={(e) => { e.stopPropagation(); onCellClick(issue.id, "severity"); }}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ${severityStyles[issue.severity] || "bg-muted text-muted-foreground border-border"}`}>
          {issue.severity}
        </span>
        {editCol === "severity" && (
          <InlineDropdown
            options={allSeverities}
            value={issue.severity}
            onSelect={(v) => { onUpdate(issue.id, { severity: v } as Partial<PMTask>); onEditDone(); }}
            onClose={onEditDone}
          />
        )}
      </td>

      {/* Title */}
      <td className="px-3 truncate" onClick={(e) => { e.stopPropagation(); onCellClick(issue.id, "title"); }}>
        {editCol === "title" ? (
          <InlineTextInput
            value={issue.title}
            onCommit={(v) => { onUpdate(issue.id, { title: v }); onEditDone(); }}
            onCancel={onEditDone}
          />
        ) : (
          <span className="text-sm" title={issue.title}>{issue.title}</span>
        )}
      </td>

      {/* Assignee */}
      <td className="px-3 relative" onClick={(e) => { e.stopPropagation(); onCellClick(issue.id, "assignee"); }}>
        <div className="flex items-center gap-1.5">
          {assignee ? (
            <>
              <MemberAvatar member={assignee} size="xs" />
              <span className="text-xs truncate">{assignee.name}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          )}
        </div>
        {editCol === "assignee" && (
          <InlineDropdown
            options={[null, ...members.map((m) => m.id)]}
            labels={["Unassigned", ...members.map((m) => m.name)]}
            value={issue.assignee_id}
            onSelect={(v) => { onUpdate(issue.id, { assignee_id: v as number | null }); onEditDone(); }}
            onClose={onEditDone}
          />
        )}
      </td>

      {/* Status */}
      <td className="px-3 relative" onClick={(e) => { e.stopPropagation(); onCellClick(issue.id, "status"); }}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        {editCol === "status" && (
          <InlineDropdown
            options={issueStatuses}
            labels={issueStatuses.map((s) => statusDisplay[s]?.label ?? s)}
            value={issue.status}
            onSelect={(v) => { onUpdate(issue.id, { status: v } as Partial<PMTask>); onEditDone(); }}
            onClose={onEditDone}
          />
        )}
      </td>

      {/* Created */}
      <td className="px-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(issue.created_at)}
      </td>
    </tr>
  );
});

// ── Inline Dropdown ──

function InlineDropdown<T>({
  options,
  labels,
  value,
  onSelect,
  onClose,
  openUp,
}: {
  options: T[];
  labels?: string[];
  value: T;
  onSelect: (v: T) => void;
  onClose: () => void;
  openUp?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute left-0 z-50 py-1 min-w-[120px] surface-noise ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`}
      style={{
        background: "var(--card)",
        border: "1.5px solid rgba(20,16,10,0.22)",
        borderRadius: "6px",
        boxShadow: "3px 3px 0 rgba(20,16,10,0.18)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt, i) => (
        <button
          key={String(opt ?? "null")}
          className="w-full text-left px-3 py-1.5 text-xs font-mono-ui transition-colors"
          style={opt === value ? { fontWeight: 700, color: "var(--accent-orange)" } : {}}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--background-3)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
          onClick={() => onSelect(opt)}
        >
          {labels ? labels[i] : String(opt)}
        </button>
      ))}
    </div>
  );
}

// ── Inline Text Input ──

function InlineTextInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="w-full bg-transparent border-b border-primary text-sm outline-none py-0.5"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text.trim() && text !== value) onCommit(text.trim()); else onCancel(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); if (text.trim()) onCommit(text.trim()); else onCancel(); }
        if (e.key === "Escape") onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── Main Component ──

export function IssueTrackerView({ issues, members, loading, currentMemberId, onUpdate, onBulkUpdate, onBulkDelete, onIssueClick }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [shiftAnchor, setShiftAnchor] = useState<number | null>(null);
  const { issueStatuses, severities } = useWorkflowConfig();

  // Derived from workflow config (replaces hardcoded constants)
  const ISSUE_STATUSES = useMemo(() => issueStatuses.map((s) => s.key), [issueStatuses]);
  const ALL_SEVERITIES = useMemo(() => severities.map((s) => s.key), [severities]);
  const STATUS_DISPLAY = useMemo(() => Object.fromEntries(issueStatuses.map((s) => [s.key, { label: s.label, color: s.color }])), [issueStatuses]);
  const SEVERITY_STYLES = useMemo(() => Object.fromEntries(severities.map((s) => [s.key, s.color])), [severities]);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [filterMyIssues, setFilterMyIssues] = useState(false);
  const [filterHighPriority, setFilterHighPriority] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [groupByProject, setGroupByProject] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bulk action state
  const [bulkDropdown, setBulkDropdown] = useState<"status" | "assignee" | null>(null);

  // ── Filtering ──
  const filteredIssues = useMemo(() => {
    let list = issues;
    if (filterMyIssues) list = list.filter((i) => i.assignee_id === currentMemberId);
    if (filterHighPriority) list = list.filter((i) => i.severity === "Blocker" || i.severity === "Major");
    if (filterStatus) list = list.filter((i) => i.status === filterStatus);
    return list;
  }, [issues, filterMyIssues, filterHighPriority, filterStatus, currentMemberId]);

  // ── Row computation ──
  const allRows = useMemo<RowItem[]>(() => {
    if (!groupByProject) return filteredIssues.map((data) => ({ kind: "issue" as const, data }));
    const grouped: Record<number, PMIssue[]> = {};
    for (const issue of filteredIssues) {
      if (!grouped[issue.project_id]) grouped[issue.project_id] = [];
      grouped[issue.project_id].push(issue);
    }
    const rows: RowItem[] = [];
    for (const projectIssues of Object.values(grouped)) {
      const first = projectIssues[0];
      rows.push({
        kind: "header",
        projectName: first.project_name,
        projectCode: first.project_code || first.project_name?.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "PROJ",
        count: projectIssues.length,
      });
      for (const issue of projectIssues) rows.push({ kind: "issue", data: issue });
    }
    return rows;
  }, [filteredIssues, groupByProject]);

  // ── Virtual scroll ──
  const scrollRow = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleStart = Math.max(0, scrollRow - BUFFER);
  const visibleEnd = Math.min(allRows.length, scrollRow + ROW_RENDER_LIMIT + BUFFER);
  const rowPx = (r: RowItem) => r.kind === "header" ? HEADER_HEIGHT : ROW_HEIGHT;
  const topSpacerPx = allRows.slice(0, visibleStart).reduce((h, r) => h + rowPx(r), 0);
  const bottomSpacerPx = Math.max(0, allRows.slice(visibleEnd).reduce((h, r) => h + rowPx(r), 0));
  const visibleRows = allRows.slice(visibleStart, visibleEnd);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Selection ──
  const handleCheckbox = useCallback(
    (issueId: number, e: React.MouseEvent) => {
      if (e.shiftKey && shiftAnchor !== null) {
        const ids = filteredIssues.map((i) => i.id);
        const a = ids.indexOf(shiftAnchor);
        const b = ids.indexOf(issueId);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
          const rangeIds = new Set(ids.slice(lo, hi + 1));
          setSelectedIds((prev) => new Set([...prev, ...rangeIds]));
        }
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.has(issueId) ? next.delete(issueId) : next.add(issueId);
          return next;
        });
        setShiftAnchor(issueId);
      }
    },
    [shiftAnchor, filteredIssues]
  );

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredIssues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIssues.map((i) => i.id)));
    }
  }, [selectedIds.size, filteredIssues]);

  // ── Cell editing ──
  const handleCellClick = useCallback((issueId: number, col: NonNullable<EditingCell>["col"]) => {
    setEditingCell({ issueId, col });
  }, []);

  const handleUpdate = useCallback(
    (id: number, data: Partial<PMTask>) => {
      onUpdate(id, data);
    },
    [onUpdate]
  );

  const handleEditDone = useCallback(() => setEditingCell(null), []);

  // ── Bulk actions ──
  const handleBulkStatus = useCallback(
    async (status: PMTaskStatus) => {
      await onBulkUpdate([...selectedIds], { status });
      setSelectedIds(new Set());
      setBulkDropdown(null);
    },
    [selectedIds, onBulkUpdate]
  );

  const handleBulkAssign = useCallback(
    async (assigneeId: number | null) => {
      await onBulkUpdate([...selectedIds], { assignee_id: assigneeId });
      setSelectedIds(new Set());
      setBulkDropdown(null);
    },
    [selectedIds, onBulkUpdate]
  );

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleBulkDeleteClick = useCallback(async () => {
    if (!onBulkDelete) return;
    await onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }, [selectedIds, onBulkDelete]);

  // ── Severity stats ──
  const stats = useMemo(() => {
    const s = { Blocker: 0, Major: 0, Minor: 0, "UI/UX": 0, total: filteredIssues.length };
    for (const i of filteredIssues) {
      if (i.severity in s) (s as Record<string, number>)[i.severity]++;
    }
    return s;
  }, [filteredIssues]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Filter Toolbar — riso styled ── */}
      <div
        className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0 flex-wrap surface-noise animate-ink-in"
        style={{ borderBottom: "1.5px solid rgba(20,16,10,0.14)", background: "var(--background-2)" }}
      >
        <button
          onClick={() => setGroupByProject((p) => !p)}
          className={`btn-tactile gap-1 ${groupByProject ? "btn-tactile-teal" : ""}`}
        >
          <Layers size={11} /> Group by Project
        </button>

        <div className="w-px h-5" style={{ background: "rgba(20,16,10,0.18)" }} />

        <button
          onClick={() => setFilterMyIssues((p) => !p)}
          className={`btn-tactile gap-1 ${filterMyIssues ? "btn-tactile-teal" : ""}`}
        >
          <Users size={11} /> My Issues
        </button>

        <button
          onClick={() => setFilterHighPriority((p) => !p)}
          className={`btn-tactile gap-1 ${filterHighPriority ? "btn-tactile-orange" : ""}`}
        >
          <Filter size={11} /> High Priority
        </button>

        <div className="w-px h-5" style={{ background: "rgba(20,16,10,0.18)" }} />

        {/* Status filter pills */}
        {ISSUE_STATUSES.map((s) => {
          const info = STATUS_DISPLAY[s];
          const active = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(active ? null : s)}
              className={`btn-tactile text-[10px] ${active ? "" : "btn-tactile-outline"}`}
              style={active ? { background: "var(--background-3)", fontWeight: 600 } : {}}
            >
              {info.label}
            </button>
          );
        })}

        <div className="w-px h-5" style={{ background: "rgba(20,16,10,0.18)" }} />

        {ALL_SEVERITIES.map((s) => (
          <span key={s} className={`text-[10px] font-mono-ui px-1.5 py-0.5 rounded-sm border ${SEVERITY_STYLES[s]}`}>
            {s}: {(stats as Record<string, number>)[s]}
          </span>
        ))}

        <span className="ml-auto text-[10px] font-mono-ui" style={{ color: "var(--muted-foreground)" }}>
          {stats.total} issue{stats.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-auto animate-column-in" style={{ animationDelay: "80ms" }}>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 96 }} />
            {!groupByProject && <col style={{ width: 130 }} />}
            <col style={{ width: 92 }} />
            <col />
            <col style={{ width: 130 }} />
            <col style={{ width: 112 }} />
            <col style={{ width: 88 }} />
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr
              className="text-[10px] uppercase font-mono-ui tracking-wider"
              style={{
                background: "var(--background-3)",
                borderBottom: "1.5px solid rgba(20,16,10,0.14)",
                color: "var(--muted-foreground)",
              }}
            >
              <th className="px-2 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={filteredIssues.length > 0 && selectedIds.size === filteredIssues.length}
                  onChange={selectAll}
                  className="rounded border-border cursor-pointer"
                />
              </th>
              <th className="px-3 py-2.5 text-left">ID</th>
              {!groupByProject && <th className="px-2 py-2 text-left">Project</th>}
              <th className="px-3 py-2.5 text-left">Severity</th>
              <th className="px-3 py-2.5 text-left">Title</th>
              <th className="px-3 py-2.5 text-left">Assignee</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-left">Created</th>
            </tr>
          </thead>

          <tbody>
            {topSpacerPx > 0 && (
              <tr><td colSpan={groupByProject ? 7 : 8} style={{ height: topSpacerPx, padding: 0 }} /></tr>
            )}

            {loading && issues.length === 0 ? (
              <tr><td colSpan={groupByProject ? 7 : 8} className="py-20 text-center text-sm text-muted-foreground">Loading issues...</td></tr>
            ) : allRows.length === 0 ? (
              <tr><td colSpan={groupByProject ? 7 : 8} className="py-20 text-center text-sm text-muted-foreground">No issues found</td></tr>
            ) : (
              visibleRows.map((row) =>
                row.kind === "header" ? (
                  <tr
                    key={`hdr-${row.projectCode}-${row.projectName}`}
                    style={{
                      height: HEADER_HEIGHT,
                      background: "var(--background-2)",
                      borderBottom: "1px solid rgba(20,16,10,0.10)",
                    }}
                  >
                    <td colSpan={groupByProject ? 7 : 8} className="px-4 py-1.5">
                      <span className="text-[10px] font-mono-ui font-black uppercase tracking-widest" style={{ color: "var(--accent-orange)" }}>
                        {row.projectCode}
                      </span>
                      <span className="text-xs ml-2 font-display font-black tracking-tight">{row.projectName}</span>
                      <span className="text-[10px] ml-2 font-mono-ui" style={{ color: "var(--muted-foreground)" }}>{row.count} issue{row.count !== 1 ? "s" : ""}</span>
                    </td>
                  </tr>
                ) : (
                  <IssueRow
                    key={row.data.id}
                    issue={row.data}
                    isSelected={selectedIds.has(row.data.id)}
                    editingCell={editingCell}
                    members={members}
                    groupByProject={groupByProject}
                    statusDisplay={STATUS_DISPLAY}
                    severityStyles={SEVERITY_STYLES}
                    allSeverities={ALL_SEVERITIES}
                    issueStatuses={ISSUE_STATUSES}
                    onCheckbox={handleCheckbox}
                    onCellClick={handleCellClick}
                    onUpdate={handleUpdate}
                    onEditDone={handleEditDone}
                    onRowClick={onIssueClick}
                  />
                )
              )
            )}

            {bottomSpacerPx > 0 && (
              <tr><td colSpan={groupByProject ? 7 : 8} style={{ height: bottomSpacerPx, padding: 0 }} /></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bulk Action Bar — riso styled ── */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0 surface-noise"
          style={{
            borderTop: "1.5px solid rgba(20,16,10,0.14)",
            background: "var(--background-2)",
            boxShadow: "0 -2px 0 var(--riso-orange)",
          }}
        >
          <span
            className="text-[11px] font-mono-ui font-bold px-2 py-0.5 rounded-sm"
            style={{ background: "color-mix(in srgb, var(--accent-orange) 12%, transparent)", color: "var(--accent-orange)", border: "1px solid rgba(224,78,14,0.30)" }}
          >{selectedIds.size} issue{selectedIds.size !== 1 ? "s" : ""} selected</span>

          <div className="relative">
            <button
              className="btn-tactile gap-1"
              onClick={() => setBulkDropdown(bulkDropdown === "assignee" ? null : "assignee")}
            >
              Assign to... <ChevronDown size={10} />
            </button>
            {bulkDropdown === "assignee" && (
              <InlineDropdown
                options={[null, ...members.map((m) => m.id)]}
                labels={["Unassigned", ...members.map((m) => m.name)]}
                value={null}
                onSelect={(v) => handleBulkAssign(v as number | null)}
                onClose={() => setBulkDropdown(null)}
                openUp
              />
            )}
          </div>

          <div className="relative">
            <button
              className="btn-tactile gap-1"
              onClick={() => setBulkDropdown(bulkDropdown === "status" ? null : "status")}
            >
              Set Status... <ChevronDown size={10} />
            </button>
            {bulkDropdown === "status" && (
              <InlineDropdown
                options={ISSUE_STATUSES}
                labels={ISSUE_STATUSES.map((s) => STATUS_DISPLAY[s]?.label ?? s)}
                value={null}
                onSelect={(v) => handleBulkStatus(v as PMTaskStatus)}
                onClose={() => setBulkDropdown(null)}
                openUp
              />
            )}
          </div>

          {onBulkDelete && !confirmDelete && (
            <button
              className="btn-tactile gap-1"
              style={{ color: "var(--destructive)" }}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={11} /> Delete
            </button>
          )}
          {onBulkDelete && confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-ui" style={{ color: "var(--destructive)" }}>
                Delete {selectedIds.size} issue{selectedIds.size !== 1 ? "s" : ""}?
              </span>
              <button className="btn-tactile btn-tactile-outline text-[10px]" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="btn-tactile text-[10px]"
                style={{ background: "var(--destructive)", color: "#fff" }}
                onClick={handleBulkDeleteClick}
              >
                Confirm Delete
              </button>
            </div>
          )}

          <button
            className="btn-tactile btn-tactile-outline ml-auto text-[10px]"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
