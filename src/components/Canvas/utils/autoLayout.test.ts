import { describe, it, expect } from "vitest";
import { hasCycle } from "./autoLayout";
import type { Edge } from "@xyflow/react";

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target } as Edge;
}

describe("Canvas - hasCycle", () => {
  it("should return false for an empty edge list", () => {
    expect(hasCycle([])).toBe(false);
  });

  it("should return false for a simple acyclic chain (A→B→C)", () => {
    expect(hasCycle([edge("A", "B"), edge("B", "C")])).toBe(false);
  });

  it("should return false for a tree with branching (A→B, A→C)", () => {
    expect(hasCycle([edge("A", "B"), edge("A", "C"), edge("B", "D")])).toBe(false);
  });

  it("should return true for a direct cycle (A→B→A)", () => {
    expect(hasCycle([edge("A", "B"), edge("B", "A")])).toBe(true);
  });

  it("should return true for a self-loop (A→A)", () => {
    expect(hasCycle([edge("A", "A")])).toBe(true);
  });

  it("should return true for an indirect cycle (A→B→C→A)", () => {
    expect(hasCycle([edge("A", "B"), edge("B", "C"), edge("C", "A")])).toBe(true);
  });

  it("should return true for a cycle embedded among disconnected nodes", () => {
    // X→Y is separate, cycle is among A→B→C→A
    expect(hasCycle([edge("X", "Y"), edge("A", "B"), edge("B", "C"), edge("C", "A")])).toBe(true);
  });

  it("should return false for disconnected nodes with no cycles", () => {
    expect(hasCycle([edge("X", "Y"), edge("A", "B")])).toBe(false);
  });
});
