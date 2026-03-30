import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PriorityBadge } from "./PriorityBadge";

describe("PriorityBadge", () => {
  it("renders Critical label for critical priority", () => {
    render(<PriorityBadge priority="critical" />);
    expect(screen.getByText("Critical")).toBeTruthy();
  });

  it("renders High label for high priority", () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText("High")).toBeTruthy();
  });

  it("renders Medium label for medium priority", () => {
    render(<PriorityBadge priority="medium" />);
    expect(screen.getByText("Medium")).toBeTruthy();
  });

  it("renders Low label for low priority", () => {
    render(<PriorityBadge priority="low" />);
    expect(screen.getByText("Low")).toBeTruthy();
  });

  it("applies extra className", () => {
    const { container } = render(<PriorityBadge priority="low" className="extra-class" />);
    expect(container.firstChild?.toString()).not.toBe(null);
    expect((container.firstChild as HTMLElement).className).toContain("extra-class");
  });
});
