/** @vitest-environment jsdom */
import { describe, bench } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { TaskList } from "../components/PM/TaskList";
import { PMTask, PMTaskStatus, PMMember } from "../types/pm";

// ── Helper: Task Generator ───────────────────────────────────────────────────

function generateTasks(count: number): PMTask[] {
  const statuses: PMTaskStatus[] = ["new", "active", "ready_to_go", "needs_testing", "resolved", "rejected"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    project_id: 1,
    title: `Benchmark Task ${i}`,
    status: statuses[i % statuses.length],
    priority: "medium",
    item_type: "task",
    description: "Anti-bloat task description for benchmarking.",
    assignee_id: null,
    position: i,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    labels: [],
    refs: [],
    child_count: 0
  } as PMTask));
}

const mockMembers: PMMember[] = [
  { id: 1, name: "John Doe", email: "john@example.com", avatar_color: "#f00", initials: "JD", created_at: "" }
];

const noop = () => {};

// ── Benchmark Suite ──────────────────────────────────────────────────────────

describe("CrowForge UI Rendering Performance (Raw React 19)", () => {
  let container: HTMLDivElement;

  const setupContainer = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return container;
  };

  const teardownContainer = () => {
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
  };

  // 1. Initial Mount Benchmarks
  const tasks100 = generateTasks(100);
  const tasks1000 = generateTasks(1000);

  bench("Mount 100 tasks", () => {
    const rootContainer = setupContainer();
    const root = createRoot(rootContainer);
    root.render(
      <TaskList 
        tasks={tasks100} 
        members={mockMembers} 
        onTaskClick={noop} 
        onTaskCreate={noop} 
      />
    );
    root.unmount();
    teardownContainer();
  });

  bench("Mount 1,000 tasks", () => {
    const rootContainer = setupContainer();
    const root = createRoot(rootContainer);
    root.render(
      <TaskList 
        tasks={tasks1000} 
        members={mockMembers} 
        onTaskClick={noop} 
        onTaskCreate={noop} 
      />
    );
    root.unmount();
    teardownContainer();
  });

  // 2. Re-render (Update) Benchmark
  const UpdateBenchmark = ({ count }: { count: number }) => {
    const [tasks, setTasks] = React.useState(() => generateTasks(count));
    
    React.useEffect(() => {
      const newTask: PMTask = {
        ...generateTasks(1)[0],
        id: 9999,
        title: "New Task Triggering Update"
      };
      setTasks(prev => [...prev, newTask]);
    }, []);

    return (
      <TaskList 
        tasks={tasks} 
        members={mockMembers} 
        onTaskClick={noop} 
        onTaskCreate={noop} 
      />
    );
  };

  bench("Update: Add 1 task to 1,000 tasks", () => {
    const rootContainer = setupContainer();
    const root = createRoot(rootContainer);
    root.render(<UpdateBenchmark count={1000} />);
    root.unmount();
    teardownContainer();
  });
});
