import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  const cases: Array<[import("../../types/pm").PMTaskStatus, string]> = [
    ["new",           "New"],
    ["active",        "Active"],
    ["ready_to_go",   "Ready to Go"],
    ["needs_testing", "Needs Testing"],
    ["resolved",      "Resolved"],
    ["rejected",      "Rejected"],
    ["closed",        "Closed"],
  ];

  for (const [status, label] of cases) {
    it(`renders "${label}" for status="${status}"`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    });
  }

  it("applies extra className to the span", () => {
    const { container } = render(<StatusBadge status="new" className="my-cls" />);
    expect((container.firstChild as HTMLElement).className).toContain("my-cls");
  });
});
