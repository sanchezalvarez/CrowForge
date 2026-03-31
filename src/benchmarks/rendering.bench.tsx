/** @vitest-environment jsdom */
import { describe, bench } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { TaskList } from "../components/PM/TaskList";
import { TaskCard } from "../components/PM/TaskCard";
import { MemberAvatar } from "../components/PM/MemberAvatar";
import { ProjectCard } from "../components/PM/ProjectCard";
import { PMTask, PMTaskStatus, PMMember, PMProject } from "../types/pm";

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
    project_task_id: null,
    parent_id: null,
    sprint_id: null,
    acceptance_criteria: '',
    severity: 'Minor',
    story_points: null,
    due_date: null,
    resolved_date: null,
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

// ── PM Component Rendering Performance ──────────────────────────────────────

describe("PM Component Rendering Performance", () => {
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

  const tasks100 = generateTasks(100);
  const tasks500 = generateTasks(500);

  const mockProject: PMProject = {
    id: 1,
    name: "Benchmark Project",
    code: "BENCH",
    description: "A project for benchmarking",
    color: "#3b82f6",
    icon: "clipboard",
    status: "active",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    total_count: 150,
    closed_count: 42,
    open_bug_count: 7,
    active_sprint: null,
  };

  bench("Mount TaskCard x100", () => {
    const rootContainer = setupContainer();
    const root = createRoot(rootContainer);
    root.render(
      <>
        {tasks100.map((t) => (
          <TaskCard key={t.id} task={t} members={mockMembers} onClick={noop} />
        ))}
      </>
    );
    root.unmount();
    teardownContainer();
  });

  bench("Mount TaskCard x500", () => {
    const rootContainer = setupContainer();
    const root = createRoot(rootContainer);
    root.render(
      <>
        {tasks500.map((t) => (
          <TaskCard key={t.id} task={t} members={mockMembers} onClick={noop} />
        ))}
      </>
    );
    root.unmount();
    teardownContainer();
  });

  bench("Mount MemberAvatar x100", () => {
    const rootContainer = setupContainer();
    const root = createRoot(rootContainer);
    root.render(
      <>
        {Array.from({ length: 100 }, (_, i) => (
          <MemberAvatar
            key={i}
            member={{
              id: i,
              name: `User ${i}`,
              email: `user${i}@test.com`,
              avatar_color: `hsl(${(i * 37) % 360}, 70%, 50%)`,
              initials: `U${i % 10}`,
              created_at: "",
            }}
            size="md"
          />
        ))}
      </>
    );
    root.unmount();
    teardownContainer();
  });

  bench("Mount ProjectCard x50", () => {
    const rootContainer = setupContainer();
    const root = createRoot(rootContainer);
    const colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"];
    root.render(
      <>
        {Array.from({ length: 50 }, (_, i) => (
          <ProjectCard
            key={i}
            project={{
              ...mockProject,
              id: i,
              name: `Project ${i}`,
              code: `P${i}`,
              color: colors[i % colors.length],
              total_count: 50 + i * 3,
              closed_count: 10 + i,
              open_bug_count: i % 5,
            }}
            onClick={noop}
          />
        ))}
      </>
    );
    root.unmount();
    teardownContainer();
  });
});
