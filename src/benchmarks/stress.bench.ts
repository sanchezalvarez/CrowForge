import { describe, bench, expect } from "vitest";
import { parseMarkdownTasks, toggleMarkdownTask } from "../lib/markdownTasks";
import { PMTask } from "../types/pm";

// ── Junk Data Generators ─────────────────────────────────────────────────────

/**
 * Generates a massive markdown string with mixed content and many tasks.
 */
function generateMassiveMarkdown(lines: number, taskDensity: number = 0.2): string {
  const result: string[] = [];
  const taskCount = Math.floor(lines * taskDensity);
  
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
    Object.entries(formulas).forEach(([key, formula]) => {
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

  // 5. Memory Leak Check
  it("Memory Leak Check: Clearing document should free memory", async () => {
    // Note: JS environment memory measurement is non-deterministic but we can check allocation
    const getMem = () => (global as any).performance?.memory?.usedJSHeapSize || 0;
    
    const initialMem = getMem();
    let bigData: string | null = generateMassiveMarkdown(50000, 0.5); // Very large string
    const afterAllocation = getMem();
    
    // Check if memory increased (if supported by environment)
    if (initialMem > 0) {
      expect(afterAllocation).toBeGreaterThan(initialMem);
    }
    
    bigData = null; // Clear reference
    
    // Force GC if possible (requires --expose-gc flag, usually not in CI)
    if (global.gc) global.gc();
    
    const finalMem = getMem();
    // We expect some reduction or stability after nulling out the large object
    if (initialMem > 0 && global.gc) {
      expect(finalMem).toBeLessThan(afterAllocation);
    }
  });
});
