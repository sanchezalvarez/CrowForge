import { describe, bench } from "vitest";
import { parseMarkdownTasks, toggleMarkdownTask } from "../lib/markdownTasks";
import { PMTask } from "../types/pm";
import { buildTree, flattenTree, filterTree, treeToMarkdown } from "../lib/pmUtils";
import type { PMIssue } from "../types/pm";

// ── Junk Data Generators ─────────────────────────────────────────────────────

/**
 * Generates a massive markdown string with mixed content and many tasks.
 */
function generateMassiveMarkdown(lines: number, taskDensity: number = 0.2): string {
  const result: string[] = [];

  for (let i = 0; i < lines; i++) {
    const rand = Math.random();
    if (rand < taskDensity) {
      const checked = Math.random() > 0.5 ? "x" : " ";
      result.push(`- [${checked}] Task item ${i} with some descriptive text`);
    } else if (rand < 0.4) {
      result.push(`### Heading ${i}`);
    } else if (rand < 0.6) {
      result.push(`This is a regular paragraph on line ${i} that contains some "anti-bloat" keywords.`);
    } else {
      result.push(`* Bullet point ${i}`);
    }
  }
  return result.join("\n");
}

/**
 * Generates a deeply nested task structure.
 */
function generateNestedTasks(depth: number): PMTask[] {
  const tasks: PMTask[] = [];
  for (let i = 1; i <= depth; i++) {
    tasks.push({
      id: i,
      project_id: 1,
      parent_id: i === 1 ? null : i - 1,
      title: `Nested Task Level ${i}`,
      description: "",
      status: "new",
      item_type: "task",
      priority: "medium",
      position: i,
      // ... rest of required PMTask fields
    } as PMTask);
  }
  return tasks;
}

/**
 * Generates a large table (rows x cols) with random data and simulated formulas.
 */
function generateLargeTable(rows: number, cols: number) {
  const data: string[][] = [];
  const formulas: Record<string, string> = {};
  
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      if (Math.random() > 0.8) {
        const val = Math.floor(Math.random() * 100);
        row.push(val.toString());
      } else if (Math.random() > 0.9) {
        const ref = `${String.fromCharCode(65 + Math.floor(Math.random() * 5))}${Math.floor(Math.random() * 10) + 1}`;
        formulas[`${r},${c}`] = `=${ref}*2`;
        row.push("0"); // Placeholder for calculated value
      } else {
        row.push(`Cell ${r},${c}`);
      }
    }
    data.push(row);
  }
  return { data, formulas };
}

/**
 * Generates a large database of tasks for search testing.
 */
function generateTaskDatabase(count: number): PMTask[] {
  const tasks: PMTask[] = [];
  for (let i = 0; i < count; i++) {
    tasks.push({
      id: i,
      title: i === count - 1 ? "Target Keyword Task" : `Task ${i} placeholder`,
      description: `Description for task ${i}`,
      status: "new",
    } as PMTask);
  }
  return tasks;
}

// ── Benchmark Suite ──────────────────────────────────────────────────────────

describe("CrowForge Performance Benchmarks", () => {
  
  // 1. Massive Document Parsing
  const massiveMd = generateMassiveMarkdown(10000, 0.25); // 10k lines, ~2.5k tasks
  bench("Massive Document Parsing (10k lines, 2.5k tasks)", () => {
    parseMarkdownTasks(massiveMd);
  });

  // 2. Deep Task Nesting
  const nestedTasks = generateNestedTasks(15);
  // Mock function to simulate deep update
  const updateNestedStatus = (tasks: PMTask[], parentId: number, newStatus: string) => {
    const children = tasks.filter(t => t.parent_id === parentId);
    children.forEach(child => {
      child.status = newStatus as any;
      updateNestedStatus(tasks, child.id, newStatus);
    });
  };

  bench("Deep Task Nesting (15 levels, status propagation)", () => {
    const tasksCopy = JSON.parse(JSON.stringify(nestedTasks));
    updateNestedStatus(tasksCopy, 1, "resolved");
  });

  // 3. Large Table Processing
  const table = generateLargeTable(50, 20); // 1,000 cells
  const simpleRecalc = (data: string[][], formulas: Record<string, string>) => {
    const newData = [...data.map(r => [...r])];
    Object.entries(formulas).forEach(([key, _formula]) => {
      const [r, c] = key.split(",").map(Number);
      // Simplified mock calculation
      newData[r][c] = "calculated";
    });
    return newData;
  };

  bench("Large Table Processing (50x20, 1,000 cells)", () => {
    simpleRecalc(table.data, table.formulas);
  });

  // 4. Search Latency
  const taskDb = generateTaskDatabase(5000);
  bench("Search Latency (5k tasks, find keyword)", () => {
    taskDb.find(t => t.title.includes("Target Keyword"));
  });

  // 5. Bulk Task Toggling
  const bulkMd = generateMassiveMarkdown(1000, 0.5); // 1k lines, ~500 tasks
  bench("Bulk Toggle All Tasks (1k lines)", () => {
    const tasks = parseMarkdownTasks(bulkMd);
    let md = bulkMd;
    for (const task of tasks) {
      md = toggleMarkdownTask(md, task.lineIndex);
    }
  });
});

// ── PM Data Generators ──────────────────────────────────────────────────────

function generateFlatTasks(count: number): PMTask[] {
  const statuses: PMTask["status"][] = ["new", "active", "ready_to_go", "needs_testing", "resolved", "closed"];
  const priorities: PMTask["priority"][] = ["critical", "high", "medium", "low"];
  const types: PMTask["item_type"][] = ["epic", "feature", "story", "task", "bug"];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    project_id: 1,
    project_task_id: null,
    parent_id: null,
    sprint_id: null,
    item_type: types[i % types.length],
    title: `Task ${i + 1} - ${types[i % types.length]}`,
    description: `Description for task ${i + 1}`,
    acceptance_criteria: "",
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
    severity: "Minor" as const,
    assignee_id: i % 10 === 0 ? null : (i % 5) + 1,
    story_points: null,
    due_date: i % 3 === 0 ? "2026-04-15" : null,
    resolved_date: null,
    position: i + 1,
    labels: [],
    refs: [],
    child_count: 0,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
  } as PMTask));
}

function generateHierarchicalTasks(roots: number, childrenPerRoot: number): PMTask[] {
  const tasks: PMTask[] = [];
  let id = 1;
  for (let r = 0; r < roots; r++) {
    const rootId = id;
    tasks.push({
      id: id++,
      project_id: 1,
      project_task_id: null,
      parent_id: null,
      sprint_id: null,
      item_type: "epic",
      title: `Root ${r}`,
      description: "",
      acceptance_criteria: "",
      status: "active",
      priority: "medium",
      severity: "Minor",
      assignee_id: null,
      story_points: null,
      due_date: null,
      resolved_date: null,
      position: r,
      labels: [],
      refs: [],
      child_count: childrenPerRoot,
      created_at: "2026-01-01T00:00:00",
      updated_at: "2026-01-01T00:00:00",
    } as PMTask);
    for (let c = 0; c < childrenPerRoot; c++) {
      tasks.push({
        id: id++,
        project_id: 1,
        project_task_id: null,
        parent_id: rootId,
        sprint_id: null,
        item_type: "task",
        title: `Child ${c} of Root ${r}`,
        description: "",
        acceptance_criteria: "",
        status: "new",
        priority: "medium",
        severity: "Minor",
        assignee_id: null,
        story_points: null,
        due_date: null,
        resolved_date: null,
        position: c,
        labels: [],
        refs: [],
        child_count: 0,
        created_at: "2026-01-01T00:00:00",
        updated_at: "2026-01-01T00:00:00",
      } as PMTask);
    }
  }
  return tasks;
}

function generateIssues(count: number): PMIssue[] {
  const severities: PMIssue["severity"][] = ["Blocker", "Major", "Minor", "UI/UX"];
  const statuses: PMIssue["status"][] = ["new", "active", "resolved", "closed"];
  const codes = ["PROJ", "CORE", "UI", "API", "DATA"];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    project_id: (i % 5) + 1,
    project_task_id: i + 1,
    parent_id: null,
    sprint_id: null,
    item_type: "bug" as const,
    title: `Issue ${i + 1}`,
    description: `Bug description ${i + 1}`,
    acceptance_criteria: "",
    status: statuses[i % statuses.length],
    priority: "high" as const,
    severity: severities[i % severities.length],
    assignee_id: (i % 8) + 1,
    story_points: null,
    due_date: null,
    resolved_date: null,
    position: i,
    labels: [],
    refs: [],
    child_count: 0,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    project_code: codes[i % codes.length],
    project_name: `Project ${codes[i % codes.length]}`,
  } as PMIssue));
}

// ── PM Module Performance Benchmarks ────────────────────────────────────────

describe("PM Module Performance Benchmarks", () => {
  const flatTasks5k = generateFlatTasks(5000);
  const hierarchicalTasks = generateHierarchicalTasks(100, 10);
  const issues10k = generateIssues(10000);

  const tree5k = buildTree(flatTasks5k);
  const allExpandedIds = new Set(flatTasks5k.map((t) => t.id));
  const tree1k = buildTree(generateFlatTasks(1000));

  bench("buildTree: 5,000 flat tasks", () => {
    buildTree(flatTasks5k);
  });

  bench("buildTree: 1,100 hierarchical tasks (100 roots x 10 children)", () => {
    buildTree(hierarchicalTasks);
  });

  bench("flattenTree: 5,000 nodes all expanded", () => {
    flattenTree(tree5k, allExpandedIds);
  });

  bench("filterTree: 5,000 nodes, filter by status", () => {
    filterTree(tree5k, (n) => n.status === "resolved");
  });

  bench("treeToMarkdown: 1,000 node tree", () => {
    treeToMarkdown(tree1k);
  });

  bench("Issue filtering: 10k issues by severity + status + assignee", () => {
    issues10k.filter(
      (issue) =>
        issue.severity === "Blocker" &&
        issue.status === "active" &&
        issue.assignee_id === 3
    );
  });

  bench("Bulk status update: 1,000 tasks", () => {
    flatTasks5k.slice(0, 1000).map((t) => ({ ...t, status: "resolved" as const }));
  });

  bench("Sort tasks: priority + due_date + position (5k tasks)", () => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    [...flatTasks5k].sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      const aDate = a.due_date ?? "9999-12-31";
      const bDate = b.due_date ?? "9999-12-31";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return a.position - b.position;
    });
  });
});
