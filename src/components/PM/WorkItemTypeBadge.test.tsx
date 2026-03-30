import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WorkItemTypeBadge, workItemIcon, workItemColor } from "./WorkItemTypeBadge";
import { CheckSquare2 } from "lucide-react";

describe("WorkItemTypeBadge", () => {
  const cases: Array<[import("../../types/pm").PMItemType, string]> = [
    ["epic",    "Epic"],
    ["feature", "Feature"],
    ["story",   "Story"],
    ["task",    "Task"],
    ["bug",     "Bug"],
    ["spike",   "Spike"],
  ];

  for (const [type, label] of cases) {
    it(`renders "${label}" for type="${type}"`, () => {
      render(<WorkItemTypeBadge type={type} />);
      expect(screen.getByText(label)).toBeTruthy();
    });
  }

  it("hides label when iconOnly=true", () => {
    render(<WorkItemTypeBadge type="task" iconOnly />);
    expect(screen.queryByText("Task")).toBeNull();
  });

  it("shows title attribute on span", () => {
    const { container } = render(<WorkItemTypeBadge type="bug" />);
    expect((container.firstChild as HTMLElement).title).toBe("Bug");
  });
});

describe("workItemIcon", () => {
  it("returns CheckSquare2 for task", () => {
    expect(workItemIcon("task")).toBe(CheckSquare2);
  });

  it("falls back to task icon for unknown type", () => {
    // @ts-expect-error intentionally invalid type
    expect(workItemIcon("unknown")).toBe(CheckSquare2);
  });
});

describe("workItemColor", () => {
  it("returns a non-empty string for each type", () => {
    const types: import("../../types/pm").PMItemType[] = ["epic", "feature", "story", "task", "bug", "spike"];
    for (const t of types) {
      expect(workItemColor(t).length).toBeGreaterThan(0);
    }
  });
});
