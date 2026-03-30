import type { PMTask, PMSprint } from "../types/pm";

// ── Tree helpers (BacklogView) ────────────────────────────────────────────────

export type TreeNode = PMTask & { depth: number; children: TreeNode[] };

export function buildTree(tasks: PMTask[], parentId: number | null = null, depth = 0): TreeNode[] {
  return tasks
    .filter((t) => t.parent_id === parentId)
    .sort((a, b) => a.position - b.position)
    .map((t) => ({
      ...t,
      depth,
      children: buildTree(tasks, t.id, depth + 1),
    }));
}

export function flattenTree(nodes: TreeNode[], expandedIds: Set<number>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (expandedIds.has(node.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expandedIds));
    }
  }
  return result;
}

// ── Date/time helpers (TaskDetailPanel, SprintView) ──────────────────────────

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "–";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Sprint velocity (SprintView) ──────────────────────────────────────────────

export function velocity(sprint: PMSprint): string {
  if (!sprint.start_date || !sprint.end_date || !sprint.done_sp) return "";
  const days = Math.max(
    1,
    (new Date(sprint.end_date).getTime() - new Date(sprint.start_date).getTime()) / (1000 * 60 * 60 * 24),
  );
  const v = (((sprint.done_sp ?? 0) / days) * 7).toFixed(1);
  return `${v} SP/week`;
}
