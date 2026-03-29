import { describe, bench } from "vitest";
import {
  inferFillSeries,
  matchCondRule,
  parseFormulaRefGroups,
  colLetterToIndex,
  idxToCol,
  ctrlArrowMove,
  ConditionalRule,
} from "../lib/cellUtils";
import { hasCycle } from "../components/Canvas/utils/autoLayout";
import type { Edge } from "@xyflow/react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNumericCells(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

function makeConditionalRules(count: number): ConditionalRule[] {
  const operators: ConditionalRule["operator"][] = [">", "<", "contains", "startsWith", "isEmpty"];
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    col: null,
    operator: operators[i % operators.length],
    value: String(i * 2),
    format: {},
  }));
}

function makeChainGraph(nodeCount: number): Edge[] {
  return Array.from({ length: nodeCount - 1 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i + 1}`,
  })) as Edge[];
}

function makeComplexFormula(refCount: number): string {
  const refs = Array.from({ length: refCount }, (_, i) => {
    const col = idxToCol(i % 26);
    const row = Math.floor(i / 26) + 1;
    return `${col}${row}`;
  });
  return "=" + refs.join("+");
}

// ── Benchmarks ────────────────────────────────────────────────────────────────

describe("CrowForge Sheets — cellUtils Performance", () => {

  // inferFillSeries: used every time user drags fill handle in SheetsPage
  bench("inferFillSeries: extend 2-value series to 1,000 cells", () => {
    inferFillSeries(["1", "2"], 1000);
  });

  bench("inferFillSeries: extend 10-value series to 5,000 cells", () => {
    inferFillSeries(makeNumericCells(10), 5000);
  });

  bench("inferFillSeries: cycle text series to 2,000 cells", () => {
    inferFillSeries(["Mon", "Tue", "Wed", "Thu", "Fri"], 2000);
  });

  // matchCondRule: called per-cell per-rule when rendering conditional formatting
  const rules = makeConditionalRules(10);
  bench("matchCondRule: evaluate 10 rules × 500 cells", () => {
    const cells = makeNumericCells(500);
    for (const rule of rules) {
      for (const cell of cells) {
        matchCondRule(rule, cell);
      }
    }
  });

  // colLetterToIndex / idxToCol: used heavily during formula parsing and cell navigation
  bench("colLetterToIndex: 10,000 conversions (A–ZZ range)", () => {
    const letters = ["A", "Z", "AA", "AZ", "BA", "ZZ"];
    for (let i = 0; i < 10000; i++) {
      colLetterToIndex(letters[i % letters.length]);
    }
  });

  bench("idxToCol: 10,000 index-to-letter conversions", () => {
    for (let i = 0; i < 10000; i++) {
      idxToCol(i % 702); // 702 = ZZ
    }
  });

  // parseFormulaRefGroups: called on every formula edit keystroke in SheetsPage
  const formula20 = makeComplexFormula(20);
  const formula5 = makeComplexFormula(5);
  bench("parseFormulaRefGroups: formula with 5 refs, 100×100 grid", () => {
    parseFormulaRefGroups(formula5, 100, 100);
  });

  bench("parseFormulaRefGroups: formula with 20 refs, 100×100 grid", () => {
    parseFormulaRefGroups(formula20, 100, 100);
  });

  // ctrlArrowMove: called on each Ctrl+Arrow keypress in SheetsPage
  const sparseCells = Array.from({ length: 1000 }, (_, i) => (i % 7 === 0 ? `val${i}` : undefined));
  bench("ctrlArrowMove: navigate 1,000-cell sparse row", () => {
    ctrlArrowMove(sparseCells, 0, sparseCells.length - 1, 1);
    ctrlArrowMove(sparseCells, sparseCells.length - 1, sparseCells.length - 1, -1);
  });
});

describe("CrowForge Canvas — autoLayout Performance", () => {

  // hasCycle: called before every execution chain trigger in CanvasExecutionContext
  const chain100 = makeChainGraph(100);
  const chain500 = makeChainGraph(500);

  bench("hasCycle: acyclic chain of 100 nodes", () => {
    hasCycle(chain100);
  });

  bench("hasCycle: acyclic chain of 500 nodes", () => {
    hasCycle(chain500);
  });

  bench("hasCycle: cycle detected early in 500-node graph", () => {
    const edges = makeChainGraph(500);
    // Add a short cycle at the start
    edges.push({ id: "cycle", source: "n5", target: "n0" } as Edge);
    hasCycle(edges);
  });
});
