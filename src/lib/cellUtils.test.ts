import { describe, it, expect } from "vitest";
import { 
  colLetterToIndex, 
  idxToCol, 
  resolveCellRef, 
  resolveRange, 
  matchCondRule, 
  inferFillSeries, 
  ctrlArrowMove,
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
});
