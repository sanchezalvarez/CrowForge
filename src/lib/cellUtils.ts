// Cell/grid type definitions and utilities shared across sheets components

export interface SheetColumn {
  name: string;
  type: string;
}

export interface SheetSizes {
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
}

export interface CellFormat {
  b?: boolean;   // bold
  i?: boolean;   // italic
  tc?: string;   // text color hex
  bg?: string;   // background color hex
  wrap?: boolean; // false = nowrap (default true = wrap)
  fs?: number;   // font size in px
}

export interface Sheet {
  id: string;
  title: string;
  columns: SheetColumn[];
  rows: string[][];
  formulas: Record<string, string>; // {"row,col": "=A1+B2"}
  sizes: SheetSizes;
  alignments: Record<string, string>; // {"row,col": "center,middle"}
  formats: Record<string, CellFormat>; // {"row,col": {b,i,tc,bg,wrap}}
  created_at: string;
  updated_at: string;
}

export const DEFAULT_COL_WIDTH = 120;
export const DEFAULT_ROW_HEIGHT = 28;
export const MIN_COL_WIDTH = 50;
export const MIN_ROW_HEIGHT = 20;

export const ROW_WARN_THRESHOLD = 5000;   // show warning banner
export const ROW_AI_LIMIT = 10000;        // disable AI actions
export const ROW_RENDER_LIMIT = 500;      // max rows rendered at once (virtual window)

// Colors for formula reference highlighting (per-range, cycled)
export const REF_COLORS = [
  { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.5)', text: '#3b82f6' },   // blue
  { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)', text: '#ef4444' },      // red
  { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.5)', text: '#22c55e' },      // green
  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.5)', text: '#a855f7' },    // purple
  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.5)', text: '#f97316' },    // orange
  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.5)', text: '#ec4899' },    // pink
];

export type RefGroup = { cells: string[]; colorIdx: number; token: string; start: number; end: number };

export function colLetterToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
  }
  return idx - 1;
}

// Parse formula refs into groups with color indices and token positions
export function parseFormulaRefGroups(formula: string, numRows: number, numCols: number): RefGroup[] {
  if (!formula.startsWith("=")) return [];
  const groups: RefGroup[] = [];
  const re = /([A-Z]{1,2})(\d+)(?::([A-Z]{1,2})(\d+))?/gi;
  let m: RegExpExecArray | null;
  let colorIdx = 0;
  while ((m = re.exec(formula)) !== null) {
    const cells: string[] = [];
    const colStart = colLetterToIndex(m[1]);
    const rowStart = parseInt(m[2], 10) - 1;
    if (m[3] && m[4]) {
      const colEnd = colLetterToIndex(m[3]);
      const rowEnd = parseInt(m[4], 10) - 1;
      for (let r = Math.min(rowStart, rowEnd); r <= Math.max(rowStart, rowEnd); r++) {
        for (let c = Math.min(colStart, colEnd); c <= Math.max(colStart, colEnd); c++) {
          if (r >= 0 && r < numRows && c >= 0 && c < numCols) cells.push(`${r},${c}`);
        }
      }
    } else {
      if (rowStart >= 0 && rowStart < numRows && colStart >= 0 && colStart < numCols) {
        cells.push(`${rowStart},${colStart}`);
      }
    }
    if (cells.length > 0) {
      groups.push({ cells, colorIdx: colorIdx % REF_COLORS.length, token: m[0], start: m.index, end: m.index + m[0].length });
      colorIdx++;
    }
  }
  return groups;
}

export function resolveCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  if (isNaN(row) || isNaN(col) || row < 0 || col < 0) return null;
  return { row, col };
}

export function resolveRange(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const parts = ref.split(":");
  if (parts.length === 1) {
    const res = resolveCellRef(parts[0]);
    if (!res) return null;
    return { r1: res.row, c1: res.col, r2: res.row, c2: res.col };
  }
  if (parts.length === 2) {
    const res1 = resolveCellRef(parts[0]);
    const res2 = resolveCellRef(parts[1]);
    if (!res1 || !res2) return null;
    return {
      r1: Math.min(res1.row, res2.row),
      c1: Math.min(res1.col, res2.col),
      r2: Math.max(res1.row, res2.row),
      c2: Math.max(res1.col, res2.col),
    };
  }
  return null;
}

export const idxToCol = (i: number): string => {
  let r = "", n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); }
  return r;
};
