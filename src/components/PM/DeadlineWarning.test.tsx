import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeadlineWarning } from "./DeadlineWarning";

describe("DeadlineWarning Component", () => {
  beforeEach(() => {
    // Set a fixed date for consistent tests (March 29, 2026)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return null if no due date or status is resolved", () => {
    const { container } = render(<DeadlineWarning dueDate={null} status="new" />);
    expect(container.firstChild).toBeNull();

    const { container: container2 } = render(<DeadlineWarning dueDate="2026-03-20" status="resolved" />);
    expect(container2.firstChild).toBeNull();
  });

  it("should show overdue label for past dates", () => {
    render(<DeadlineWarning dueDate="2026-03-25" status="active" />);
    expect(screen.getByText("4d overdue")).toBeDefined();
  });

  it("should show 'Due today' label", () => {
    render(<DeadlineWarning dueDate="2026-03-29" status="active" />);
    expect(screen.getByText("Due today")).toBeDefined();
  });

  it("should show 'Due in Nd' label for upcoming dates (within 3 days)", () => {
    render(<DeadlineWarning dueDate="2026-03-31" status="active" />);
    expect(screen.getByText("Due in 2d")).toBeDefined();
  });

  it("should return null for dates more than 3 days in the future", () => {
    const { container } = render(<DeadlineWarning dueDate="2026-04-10" status="active" />);
    expect(container.firstChild).toBeNull();
  });
});
