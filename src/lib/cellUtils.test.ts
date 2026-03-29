import { describe, it, expect } from "vitest";
import {
  colLetterToIndex,
  idxToCol,
  resolveCellRef,
  resolveRange,
  matchCondRule,
  inferFillSeries,
  ctrlArrowMove,
  parseFormulaRefGroups,
  ConditionalRule
} from "./cellUtils";

describe("Cell Utilities - Indexing", () => {
  it("should convert column letters to indices correctly", () => {
    expect(colLetterToIndex("A")).toBe(0);
    expect(colLetterToIndex("Z")).toBe(25);
    expect(colLetterToIndex("AA")).toBe(26);
    expect(colLetterToIndex("AZ")).toBe(51);
    expect(colLetterToIndex("BA")).toBe(52);
  });

  it("should convert indices to column letters correctly", () => {
    expect(idxToCol(0)).toBe("A");
    expect(idxToCol(25)).toBe("Z");
    expect(idxToCol(26)).toBe("AA");
    expect(idxToCol(51)).toBe("AZ");
    expect(idxToCol(52)).toBe("BA");
  });
});

describe("Cell Utilities - Reference Resolution", () => {
  it("should resolve cell references", () => {
    expect(resolveCellRef("A1")).toEqual({ row: 0, col: 0 });
    expect(resolveCellRef("B10")).toEqual({ row: 9, col: 1 });
    expect(resolveCellRef("Z100")).toEqual({ row: 99, col: 25 });
    expect(resolveCellRef("invalid")).toBeNull();
  });

  it("should resolve ranges", () => {
    expect(resolveRange("A1:B2")).toEqual({ r1: 0, c1: 0, r2: 1, c2: 1 });
    expect(resolveRange("B2:A1")).toEqual({ r1: 0, c1: 0, r2: 1, c2: 1 }); // normalized
    expect(resolveRange("A1")).toEqual({ r1: 0, c1: 0, r2: 0, c2: 0 });
  });
});

describe("Cell Utilities - Conditional Rules", () => {
  it("should match numeric rules correctly", () => {
    const rule: ConditionalRule = { id: "1", col: null, operator: ">", value: "10", format: {} };
    expect(matchCondRule(rule, "15")).toBe(true);
    expect(matchCondRule(rule, "5")).toBe(false);
    expect(matchCondRule(rule, "10")).toBe(false);
  });

  it("should match string rules correctly", () => {
    const rule: ConditionalRule = { id: "1", col: null, operator: "contains", value: "test", format: {} };
    expect(matchCondRule(rule, "This is a test")).toBe(true);
    expect(matchCondRule(rule, "No match here")).toBe(false);
  });

  it("should handle empty checks", () => {
    const rule: ConditionalRule = { id: "1", col: null, operator: "isEmpty", value: "", format: {} };
    expect(matchCondRule(rule, "")).toBe(true);
    expect(matchCondRule(rule, "  ")).toBe(true);
    expect(matchCondRule(rule, "content")).toBe(false);
  });

  it("should match isNotEmpty correctly", () => {
    const rule: ConditionalRule = { id: "1", col: null, operator: "isNotEmpty", value: "", format: {} };
    expect(matchCondRule(rule, "hello")).toBe(true);
    expect(matchCondRule(rule, "")).toBe(false);
    expect(matchCondRule(rule, "  ")).toBe(false);
  });

  it("should match startsWith and endsWith case-insensitively", () => {
    const sw: ConditionalRule = { id: "1", col: null, operator: "startsWith", value: "Hello", format: {} };
    expect(matchCondRule(sw, "hello world")).toBe(true);
    expect(matchCondRule(sw, "world hello")).toBe(false);

    const ew: ConditionalRule = { id: "2", col: null, operator: "endsWith", value: "World", format: {} };
    expect(matchCondRule(ew, "hello world")).toBe(true);
    expect(matchCondRule(ew, "world hello")).toBe(false);
  });

  it("should match == and != operators numerically and by string", () => {
    const eqNum: ConditionalRule = { id: "1", col: null, operator: "==", value: "42", format: {} };
    expect(matchCondRule(eqNum, "42")).toBe(true);
    expect(matchCondRule(eqNum, "42.0")).toBe(true);
    expect(matchCondRule(eqNum, "43")).toBe(false);

    const neqStr: ConditionalRule = { id: "2", col: null, operator: "!=", value: "foo", format: {} };
    expect(matchCondRule(neqStr, "bar")).toBe(true);
    expect(matchCondRule(neqStr, "foo")).toBe(false);
  });

  it("should match >= and <= operators", () => {
    const gte: ConditionalRule = { id: "1", col: null, operator: ">=", value: "10", format: {} };
    expect(matchCondRule(gte, "10")).toBe(true);
    expect(matchCondRule(gte, "11")).toBe(true);
    expect(matchCondRule(gte, "9")).toBe(false);

    const lte: ConditionalRule = { id: "2", col: null, operator: "<=", value: "10", format: {} };
    expect(matchCondRule(lte, "10")).toBe(true);
    expect(matchCondRule(lte, "9")).toBe(true);
    expect(matchCondRule(lte, "11")).toBe(false);
  });
});

describe("Cell Utilities - Fill Series", () => {
  it("should infer arithmetic series", () => {
    expect(inferFillSeries(["1", "2"], 3)).toEqual(["3", "4", "5"]);
    expect(inferFillSeries(["10", "20"], 2)).toEqual(["30", "40"]);
    expect(inferFillSeries(["5"], 3)).toEqual(["5", "5", "5"]); // constant
  });

  it("should cycle text series", () => {
    expect(inferFillSeries(["A", "B"], 3)).toEqual(["A", "B", "A"]);
  });
});

describe("Cell Utilities - Ctrl+Arrow Navigation", () => {
  const cells = ["A", "B", "C", undefined, undefined, "F", "G", undefined];

  it("should jump to the end of a block when starting on a filled cell", () => {
    expect(ctrlArrowMove(cells, 0, cells.length - 1, 1)).toBe(2); // Ends at 'C'
  });

  it("should jump to the next filled cell when starting on an empty cell", () => {
    expect(ctrlArrowMove(cells, 3, cells.length - 1, 1)).toBe(5); // Jumps to 'F'
  });

  it("should jump to the very end if no more filled cells", () => {
    expect(ctrlArrowMove(cells, 6, cells.length - 1, 1)).toBe(7); // Last cell
  });

  it("should jump backward to end of block when starting on a filled cell", () => {
    expect(ctrlArrowMove(cells, 6, cells.length - 1, -1)).toBe(5); // Ends at 'F'
  });

  it("should jump backward to the previous filled cell when starting on an empty cell", () => {
    expect(ctrlArrowMove(cells, 4, cells.length - 1, -1)).toBe(2); // Jumps back to 'C'
  });

  it("should jump to the very start if no more filled cells going backward", () => {
    expect(ctrlArrowMove(cells, 0, cells.length - 1, -1)).toBe(0); // Already at start
  });
});

describe("Cell Utilities - Formula Reference Groups", () => {
  it("should return empty array for non-formula strings", () => {
    expect(parseFormulaRefGroups("", 10, 10)).toEqual([]);
    expect(parseFormulaRefGroups("A1+B2", 10, 10)).toEqual([]); // no leading =
  });

  it("should parse a single cell reference", () => {
    const groups = parseFormulaRefGroups("=A1", 5, 5);
    expect(groups).toHaveLength(1);
    expect(groups[0].cells).toEqual(["0,0"]);
    expect(groups[0].token).toBe("A1");
    expect(groups[0].colorIdx).toBe(0);
  });

  it("should parse a range reference into multiple cells", () => {
    const groups = parseFormulaRefGroups("=A1:B2", 5, 5);
    expect(groups).toHaveLength(1);
    expect(groups[0].cells).toHaveLength(4); // A1, A2, B1, B2
    expect(groups[0].cells).toContain("0,0");
    expect(groups[0].cells).toContain("0,1");
    expect(groups[0].cells).toContain("1,0");
    expect(groups[0].cells).toContain("1,1");
  });

  it("should parse multiple separate references with different color indices", () => {
    const groups = parseFormulaRefGroups("=A1+B2", 5, 5);
    expect(groups).toHaveLength(2);
    expect(groups[0].cells).toEqual(["0,0"]);
    expect(groups[1].cells).toEqual(["1,1"]);
    expect(groups[0].colorIdx).toBe(0);
    expect(groups[1].colorIdx).toBe(1);
  });

  it("should exclude references out of grid bounds", () => {
    // Grid is 2x2, A1:C3 partially out of bounds
    const groups = parseFormulaRefGroups("=A1:C3", 2, 2);
    expect(groups).toHaveLength(1);
    // Only A1, A2, B1, B2 are within 2x2 grid
    expect(groups[0].cells).toHaveLength(4);
  });

  it("should return empty groups array if all refs are out of bounds", () => {
    // Grid is 1x1, Z100 is way out of bounds
    const groups = parseFormulaRefGroups("=Z100", 1, 1);
    expect(groups).toHaveLength(0);
  });
});
