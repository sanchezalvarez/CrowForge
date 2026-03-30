import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildTree, flattenTree, timeAgo, formatDate, velocity } from "./pmUtils";
import type { PMTask, PMSprint } from "../types/pm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<PMTask> & { id: number }): PMTask {
  return {
    project_id: 1,
    parent_id: null,
    sprint_id: null,
    item_type: "task",
    title: `Task ${overrides.id}`,
    description: "",
    acceptance_criteria: "",
    status: "new",
    priority: "medium",
    assignee_id: null,
    story_points: null,
    due_date: null,
    resolved_date: null,
    position: overrides.id,
    labels: [],
    refs: [],
    child_count: 0,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function makeSprint(overrides: Partial<PMSprint> & { id: number }): PMSprint {
  return {
    project_id: 1,
    name: "Sprint 1",
    goal: "",
    start_date: null,
    end_date: null,
    status: "active",
    created_at: "2026-01-01T00:00:00",
    done_sp: 0,
    ...overrides,
  };
}

// ── buildTree ─────────────────────────────────────────────────────────────────

describe("buildTree", () => {
  it("returns empty array for no tasks", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("builds a flat list when no parent_id matches", () => {
    const tasks = [makeTask({ id: 1 }), makeTask({ id: 2 }), makeTask({ id: 3 })];
    const tree = buildTree(tasks);
    expect(tree).toHaveLength(3);
    tree.forEach((n) => expect(n.children).toHaveLength(0));
  });

  it("nests children under their parent", () => {
    const tasks = [
      makeTask({ id: 1, parent_id: null }),
      makeTask({ id: 2, parent_id: 1 }),
      makeTask({ id: 3, parent_id: 1 }),
    ];
    const tree = buildTree(tasks);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].id).toBe(2);
  });

  it("assigns depth correctly for nested levels", () => {
    const tasks = [
      makeTask({ id: 1, parent_id: null }),
      makeTask({ id: 2, parent_id: 1 }),
      makeTask({ id: 3, parent_id: 2 }),
    ];
    const tree = buildTree(tasks);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("sorts siblings by position", () => {
    const tasks = [
      makeTask({ id: 1, parent_id: null, position: 3 }),
      makeTask({ id: 2, parent_id: null, position: 1 }),
      makeTask({ id: 3, parent_id: null, position: 2 }),
    ];
    const tree = buildTree(tasks);
    expect(tree.map((n) => n.id)).toEqual([2, 3, 1]);
  });

  it("handles multiple root nodes each with children", () => {
    const tasks = [
      makeTask({ id: 1, parent_id: null }),
      makeTask({ id: 2, parent_id: null }),
      makeTask({ id: 10, parent_id: 1 }),
      makeTask({ id: 20, parent_id: 2 }),
    ];
    const tree = buildTree(tasks);
    expect(tree).toHaveLength(2);
    expect(tree[0].children[0].id).toBe(10);
    expect(tree[1].children[0].id).toBe(20);
  });
});

// ── flattenTree ───────────────────────────────────────────────────────────────

describe("flattenTree", () => {
  const tasks = [
    makeTask({ id: 1, parent_id: null }),
    makeTask({ id: 2, parent_id: 1 }),
    makeTask({ id: 3, parent_id: 1 }),
  ];

  it("includes all root nodes", () => {
    const tree = buildTree(tasks);
    const flat = flattenTree(tree, new Set());
    expect(flat).toHaveLength(1); // root only, children collapsed
    expect(flat[0].id).toBe(1);
  });

  it("includes children when parent is expanded", () => {
    const tree = buildTree(tasks);
    const flat = flattenTree(tree, new Set([1]));
    expect(flat).toHaveLength(3);
    expect(flat.map((n) => n.id)).toEqual([1, 2, 3]);
  });

  it("does not recurse into collapsed subtrees", () => {
    const deepTasks = [
      makeTask({ id: 1, parent_id: null }),
      makeTask({ id: 2, parent_id: 1 }),
      makeTask({ id: 3, parent_id: 2 }),
    ];
    const tree = buildTree(deepTasks);
    // Expand 1 but not 2 → 3 should not appear
    const flat = flattenTree(tree, new Set([1]));
    expect(flat.map((n) => n.id)).toEqual([1, 2]);
  });

  it("returns empty array for empty tree", () => {
    expect(flattenTree([], new Set())).toEqual([]);
  });
});

// ── timeAgo ───────────────────────────────────────────────────────────────────

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 'just now' for less than 60 seconds ago", () => {
    expect(timeAgo("2026-03-30T11:59:30Z")).toBe("just now");
  });

  it("returns minutes for less than 1 hour ago", () => {
    expect(timeAgo("2026-03-30T11:30:00Z")).toBe("30m ago");
  });

  it("returns hours for less than 1 day ago", () => {
    expect(timeAgo("2026-03-30T06:00:00Z")).toBe("6h ago");
  });

  it("returns days for more than 1 day ago", () => {
    expect(timeAgo("2026-03-27T12:00:00Z")).toBe("3d ago");
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("–");
  });

  it("returns dash for undefined", () => {
    expect(formatDate(undefined)).toBe("–");
  });

  it("formats a valid date as 'Mon D'", () => {
    expect(formatDate("2026-03-15")).toBe("Mar 15");
  });

  it("formats January 1 correctly", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1");
  });

  it("formats December 31 correctly", () => {
    expect(formatDate("2026-12-31")).toBe("Dec 31");
  });
});

// ── velocity ──────────────────────────────────────────────────────────────────

describe("velocity", () => {
  it("returns empty string when no start_date", () => {
    const sprint = makeSprint({ id: 1, start_date: null, end_date: "2026-03-20", done_sp: 10 });
    expect(velocity(sprint)).toBe("");
  });

  it("returns empty string when no end_date", () => {
    const sprint = makeSprint({ id: 1, start_date: "2026-03-01", end_date: null, done_sp: 10 });
    expect(velocity(sprint)).toBe("");
  });

  it("returns empty string when done_sp is 0 or null", () => {
    const sprint = makeSprint({ id: 1, start_date: "2026-03-01", end_date: "2026-03-14", done_sp: 0 });
    expect(velocity(sprint)).toBe("");
  });

  it("calculates SP/week for a 14-day sprint with 14 SP", () => {
    // 14 days → 2 weeks → 14 SP / 2 = 7.0 SP/week
    const sprint = makeSprint({ id: 1, start_date: "2026-03-01", end_date: "2026-03-15", done_sp: 14 });
    expect(velocity(sprint)).toBe("7.0 SP/week");
  });

  it("calculates SP/week for a 7-day sprint with 5 SP", () => {
    // 7 days → 1 week → 5 SP/week
    const sprint = makeSprint({ id: 1, start_date: "2026-03-01", end_date: "2026-03-08", done_sp: 5 });
    expect(velocity(sprint)).toBe("5.0 SP/week");
  });
});
