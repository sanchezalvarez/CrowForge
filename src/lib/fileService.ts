/**
 * fileService.ts
 *
 * Central file import/export service for Documents and Sheets.
 *
 * Responsibilities:
 *  - Validate file size and format, emit toast on error
 *  - Parse incoming files (DOCX → HTML via mammoth, XLSX/CSV/TSV via SheetJS)
 *  - Generate outgoing files (DOCX via docx, PDF via jsPDF, XLSX/CSV/TSV via SheetJS)
 *  - Provide shared download utilities and format constant tables
 *
 * Components handle API calls and React state; this module handles only
 * file-format I/O and the conversion logic.
 */

import mammoth from "mammoth";
import jsPDF from "jspdf";
import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  TextRun,
  HeadingLevel,
  Packer,
} from "docx";
import * as XLSX from "xlsx";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { toast } from "../hooks/useToast";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

// ─── Shared constants & utilities ─────────────────────────────────────────────

/** Maximum accepted import file size (50 MB). */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const DOCUMENT_IMPORT_ACCEPT = ".docx,.md,.txt";
export const DOCUMENT_IMPORT_EXTS = ["docx", "md", "txt"];

export const SHEET_IMPORT_ACCEPT = ".xlsx,.xls,.csv,.tsv";
export const SHEET_IMPORT_EXTS = ["xlsx", "xls", "csv", "tsv"];

export type DocExportFormat = "docx" | "pdf" | "md" | "txt";
export type SheetExportFormat = "xlsx" | "csv" | "tsv" | "pdf";

export const DOCUMENT_EXPORT_FORMATS: [DocExportFormat, string][] = [
  ["docx", "Word (.docx)"],
  ["pdf",  "PDF (.pdf)"],
  ["md",   "Markdown (.md)"],
  ["txt",  "Plain text (.txt)"],
];

export const SHEET_EXPORT_FORMATS: [SheetExportFormat, string][] = [
  ["xlsx", "Excel (.xlsx)"],
  ["csv",  "CSV (.csv)"],
  ["tsv",  "TSV (.tsv)"],
  ["pdf",  "PDF (.pdf)"],
];

/** Return lowercase file extension, e.g. "xlsx". */
export function getFileExt(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

/** Return filename without extension, used as the default document/sheet title. */
export function getFileStem(file: File): string {
  return file.name.replace(/\.[^.]+$/, "");
}

/** Save bytes to disk using Tauri's native save dialog. Falls back to browser download. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  // Try Tauri native save dialog first
  try {
    const ext = filename.split(".").pop() ?? "";
    const path = await save({
      defaultPath: filename,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!path) return; // user cancelled
    const buf = new Uint8Array(await blob.arrayBuffer());
    await writeFile(path, buf);
    return;
  } catch (e) {
    console.warn("[downloadBlob] Tauri save failed, using browser fallback:", e);
  }
  // Browser fallback — element must be in the DOM for WebView2
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Small delay before cleanup so the browser can start the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Validate that a file meets size and extension requirements.
 * Returns an error string on failure, null on success.
 * Also emits a toast on failure so callers need not repeat that logic.
 */
export function validateImportFile(file: File, allowedExts: string[]): string | null {
  if (file.size > MAX_FILE_SIZE) {
    const msg = `File too large (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB).`;
    toast(msg, "error");
    return msg;
  }
  const ext = getFileExt(file);
  if (!allowedExts.includes(ext)) {
    const msg = `Unsupported format ".${ext}". Allowed: ${allowedExts.map((e) => `.${e}`).join(", ")}.`;
    toast(msg, "error");
    return msg;
  }
  return null;
}

// ─── Document import ──────────────────────────────────────────────────────────

export interface ParsedDocImport {
  /** Filename without extension — use as default document title. */
  title: string;
  /** "html" for DOCX/TXT, "markdown" for .md files. */
  type: "html" | "markdown";
  /** HTML string (for html type) or raw Markdown string (for markdown type). */
  content: string;
}

/**
 * Parse a DOCX, MD, or TXT file into a structure the Documents component
 * can hand off to Tiptap. Throws on unrecoverable parse errors.
 */
export async function parseDocumentImport(file: File): Promise<ParsedDocImport> {
  const ext = getFileExt(file);
  const title = getFileStem(file);

  if (ext === "docx") {
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
    return { title, type: "html", content: result.value };
  }

  if (ext === "md") {
    const text = await file.text();
    return { title, type: "markdown", content: text };
  }

  // txt — map each line to a paragraph
  const text = await file.text();
  const html = text
    .split("\n")
    .map(
      (line) =>
        `<p>${line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;") || "<br>"}</p>`
    )
    .join("");
  return { title, type: "html", content: html };
}

// ─── Document export ──────────────────────────────────────────────────────────

export interface DocExportDeps {
  /** Full HTML of the document (from editor.getHTML()). */
  html: string;
  /** Tiptap JSON AST (from editor.getJSON()). */
  json: Record<string, unknown>;
  /** Plain text (from editor.getText()). */
  text: string;
  /** Markdown source (from editor.storage.markdown.getMarkdown()). */
  markdown: string;
  /** Document title, used as the file stem. */
  title: string;
}

// Internal Tiptap node type used by the DOCX converter.
interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string }[];
  text?: string;
}

function inlineToTextRun(node: TiptapNode): TextRun {
  if (node.type === "hardBreak") return new TextRun({ break: 1 });
  const marks = node.marks ?? [];
  return new TextRun({
    text: node.text ?? "",
    bold: marks.some((m) => m.type === "bold"),
    italics: marks.some((m) => m.type === "italic"),
    underline: marks.some((m) => m.type === "underline") ? {} : undefined,
    strike: marks.some((m) => m.type === "strike"),
  });
}

function tiptapToDocxParagraphs(node: TiptapNode): DocxParagraph[] {
  const children = node.content ?? [];
  switch (node.type) {
    case "doc":
      return children.flatMap(tiptapToDocxParagraphs);

    case "heading": {
      const lvl = (node.attrs?.level as number) ?? 1;
      const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      };
      return [
        new DocxParagraph({
          heading: headingMap[lvl] ?? HeadingLevel.HEADING_1,
          children: children.map(inlineToTextRun),
        }),
      ];
    }

    case "paragraph":
      return [
        new DocxParagraph({
          children: children.length > 0 ? children.map(inlineToTextRun) : [new TextRun("")],
        }),
      ];

    case "bulletList":
      return children.flatMap((item) => {
        const inlines = (item.content ?? []).flatMap((p) =>
          (p.content ?? []).map(inlineToTextRun)
        );
        return [
          new DocxParagraph({
            bullet: { level: 0 },
            children: inlines.length > 0 ? inlines : [new TextRun("")],
          }),
        ];
      });

    case "orderedList":
      return children.flatMap((item, i) => {
        const inlines = (item.content ?? []).flatMap((p) =>
          (p.content ?? []).map(inlineToTextRun)
        );
        return [
          new DocxParagraph({
            numbering: { reference: "default-numbering", level: 0 },
            children: inlines.length > 0 ? inlines : [new TextRun(`${i + 1}.`)],
          }),
        ];
      });

    case "blockquote":
      return children.flatMap(tiptapToDocxParagraphs);

    default:
      return [];
  }
}

/**
 * Generate and trigger the download of a document in the requested format.
 * Emits a success or error toast when done.
 */
export async function exportDocumentAs(
  format: DocExportFormat,
  deps: DocExportDeps
): Promise<void> {
  const { title } = deps;
  try {
    if (format === "docx") {
      const paragraphs = tiptapToDocxParagraphs(deps.json as unknown as TiptapNode);
      const docxDoc = new DocxDocument({
        numbering: {
          config: [
            {
              reference: "default-numbering",
              levels: [
                {
                  level: 0,
                  format: "decimal" as const,
                  text: "%1.",
                  alignment: "left" as const,
                  style: { paragraph: { indent: { left: 720, hanging: 260 } } },
                },
              ],
            },
          ],
        },
        sections: [
          {
            children: paragraphs.length > 0 ? paragraphs : [new DocxParagraph("")],
          },
        ],
      });
      await downloadBlob(await Packer.toBlob(docxDoc), `${title}.docx`);
    } else if (format === "pdf") {
      await exportDocumentPDF(deps.json as unknown as TiptapNode, title);
    } else if (format === "md") {
      await downloadBlob(
        new Blob([deps.markdown], { type: "text/markdown;charset=utf-8" }),
        `${title}.md`
      );
    } else {
      await downloadBlob(
        new Blob([deps.text], { type: "text/plain;charset=utf-8" }),
        `${title}.txt`
      );
    }
    toast(`Exported "${title}.${format}".`);
  } catch (err) {
    console.error("Document export failed", err);
    toast("Export failed. Please try again.", "error");
  }
}

// ─── Document PDF — native jsPDF text renderer ───────────────────────────────
//
// Renders Tiptap JSON directly into jsPDF without going through html2canvas.
// This gives us exact control over A4 margins, heading page-breaks, and
// inline bold/italic marks while keeping the output as searchable vector text.

/** A4 portrait dimensions and layout constants (all in pt). */
const A4 = {
  w: 595.28,
  h: 841.89,
  margin: 56,       // ~20 mm on every side
  footerY: 813.89,  // A4.h - 28
} as const;

const CONTENT_W = A4.w - A4.margin * 2; // 483.28 pt
const BODY_SIZE  = 11;
const LINE_RATIO = 1.35; // line-height multiplier

interface PdfState {
  doc: jsPDF;
  y: number;
  pageNum: number;
  title: string;
}

function pdfNewPage(s: PdfState): void {
  pdfFooter(s);
  s.doc.addPage();
  s.pageNum++;
  s.y = A4.margin;
}

function pdfFooter(s: PdfState): void {
  const { doc, pageNum, title } = s;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(title.slice(0, 70), A4.margin, A4.footerY);
  doc.text(String(pageNum), A4.w - A4.margin, A4.footerY, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

/** Ensure `height` pt fits on the current page; otherwise start a new one. */
function pdfNeedSpace(s: PdfState, height: number): void {
  if (s.y + height > A4.h - A4.margin - 40) pdfNewPage(s);
}

// ── Inline token layout ──────────────────────────────────────────────────────

interface PdfToken {
  text: string;
  bold: boolean;
  italic: boolean;
  color?: string;      // CSS hex color, e.g. "#ff0000"
  isBreak?: boolean;   // hard line-break (shift-enter in Tiptap)
}

function pdfFontStyle(bold: boolean, italic: boolean): string {
  return bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
}

function buildTokens(content: TiptapNode[]): PdfToken[] {
  const tokens: PdfToken[] = [];
  for (const node of content) {
    if (node.type === "hardBreak") {
      tokens.push({ text: "", bold: false, italic: false, isBreak: true });
      continue;
    }
    const marks = node.marks ?? [];
    const bold   = marks.some((m) => m.type === "bold");
    const italic = marks.some((m) => m.type === "italic");
    // Extract text color from textStyle mark if present
    const textStyleMark = marks.find((m) => m.type === "textStyle") as { type: string; attrs?: Record<string, unknown> } | undefined;
    const color = textStyleMark?.attrs?.color as string | undefined;
    // Split on whitespace so each word can be individually measured.
    for (const part of (node.text ?? "").split(/(\s+)/)) {
      if (part.length > 0) tokens.push({ text: part, bold, italic, color });
    }
  }
  return tokens;
}

type PdfLine = { segments: PdfToken[] };

/** Wrap tokens into lines that fit within `maxWidth`. */
function layoutLines(doc: jsPDF, tokens: PdfToken[], fontSize: number, maxWidth: number): PdfLine[] {
  const lines: PdfLine[] = [{ segments: [] }];
  let lineW = 0;

  for (const tok of tokens) {
    if (tok.isBreak) {
      lines.push({ segments: [] });
      lineW = 0;
      continue;
    }
    // Skip leading whitespace at start of a line
    if (lineW === 0 && /^\s+$/.test(tok.text)) continue;

    doc.setFont("helvetica", pdfFontStyle(tok.bold, tok.italic));
    doc.setFontSize(fontSize);
    const tw = doc.getTextWidth(tok.text);

    if (lineW + tw > maxWidth && lineW > 0 && !/^\s+$/.test(tok.text)) {
      lines.push({ segments: [] });
      lineW = 0;
      if (/^\s+$/.test(tok.text)) continue;
    }
    lines[lines.length - 1].segments.push(tok);
    lineW += tw;
  }
  return lines;
}

/**
 * Measure the vertical space a block of tokens will occupy.
 * (Same logic as renderTokenLines — keeps the two in sync.)
 */
function measureTokenBlock(doc: jsPDF, tokens: PdfToken[], fontSize: number, maxWidth: number): number {
  if (tokens.length === 0) return fontSize * LINE_RATIO * 0.6;
  const lines = layoutLines(doc, tokens, fontSize, maxWidth);
  return Math.max(lines.length, 1) * fontSize * LINE_RATIO;
}

/**
 * Render a pre-laid-out list of lines at the current `s.y`.
 * Does NOT call pdfNeedSpace — the caller must do that beforehand.
 */
function renderTokenLines(s: PdfState, lines: PdfLine[], fontSize: number, leftX: number): void {
  const lineH = fontSize * LINE_RATIO;
  if (lines.length === 0 || (lines.length === 1 && lines[0].segments.length === 0)) {
    s.y += lineH * 0.6;
    return;
  }
  for (const line of lines) {
    let x = leftX;
    for (const seg of line.segments) {
      s.doc.setFont("helvetica", pdfFontStyle(seg.bold, seg.italic));
      s.doc.setFontSize(fontSize);
      if (seg.color) {
        // Parse CSS hex color "#rrggbb" or "#rgb"
        const hex = seg.color.replace("#", "");
        if (hex.length === 6) {
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          s.doc.setTextColor(r, g, b);
        } else if (hex.length === 3) {
          const r = parseInt(hex[0] + hex[0], 16);
          const g = parseInt(hex[1] + hex[1], 16);
          const b = parseInt(hex[2] + hex[2], 16);
          s.doc.setTextColor(r, g, b);
        }
      } else {
        s.doc.setTextColor(0, 0, 0);
      }
      s.doc.text(seg.text, x, s.y);
      x += s.doc.getTextWidth(seg.text);
    }
    s.doc.setTextColor(0, 0, 0);
    s.y += lineH;
  }
}

// ── Block renderers ───────────────────────────────────────────────────────────

const HEADING_CFG: Record<number, { size: number; spaceBefore: number; spaceAfter: number }> = {
  1: { size: 22, spaceBefore: 0,  spaceAfter: 8  },
  2: { size: 17, spaceBefore: 10, spaceAfter: 5  },
  3: { size: 13, spaceBefore: 8,  spaceAfter: 3  },
};

function renderHeading(s: PdfState, node: TiptapNode): void {
  const level = (node.attrs?.level as number) ?? 1;
  const cfg   = HEADING_CFG[level] ?? HEADING_CFG[3];

  // H1 always starts a new page (except when already at the top of a fresh page)
  if (level === 1 && s.y > A4.margin + 40) {
    pdfNewPage(s);
  } else {
    s.y += cfg.spaceBefore;
  }

  const text  = (node.content ?? []).map((n) => n.text ?? "").join("");
  const lineH = cfg.size * LINE_RATIO;
  s.doc.setFont("helvetica", "bold");
  s.doc.setFontSize(cfg.size);
  const lines = s.doc.splitTextToSize(text, CONTENT_W);
  pdfNeedSpace(s, lines.length * lineH + cfg.spaceAfter);
  s.doc.text(lines as string[], A4.margin, s.y);
  s.y += (lines as string[]).length * lineH + cfg.spaceAfter;
}

function renderParagraphNode(s: PdfState, node: TiptapNode, indent = 0): void {
  const tokens  = buildTokens(node.content ?? []);
  // Skip empty paragraphs (no text content) to avoid blank leading pages
  if (tokens.length === 0) return;
  const maxW    = CONTENT_W - indent;
  const lines   = layoutLines(s.doc, tokens, BODY_SIZE, maxW);
  const height  = measureTokenBlock(s.doc, tokens, BODY_SIZE, maxW);
  pdfNeedSpace(s, height + 5);
  const textAlign = (node.attrs?.textAlign as string | undefined) ?? "left";
  if (textAlign === "center" || textAlign === "right") {
    // For center/right aligned paragraphs, render each line with jsPDF alignment
    const lineH = BODY_SIZE * LINE_RATIO;
    if (lines.length === 0 || (lines.length === 1 && lines[0].segments.length === 0)) {
      s.y += lineH * 0.6;
    } else {
      for (const line of lines) {
        const lineText = line.segments.map((seg) => seg.text).join("");
        const firstSeg = line.segments[0];
        if (firstSeg) {
          s.doc.setFont("helvetica", pdfFontStyle(firstSeg.bold, firstSeg.italic));
          if (firstSeg.color) {
            const hex = firstSeg.color.replace("#", "");
            if (hex.length === 6) {
              s.doc.setTextColor(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
            }
          } else {
            s.doc.setTextColor(0, 0, 0);
          }
        }
        s.doc.setFontSize(BODY_SIZE);
        const xPos = textAlign === "center"
          ? A4.margin + indent + maxW / 2
          : A4.w - A4.margin;
        s.doc.text(lineText, xPos, s.y, { align: textAlign as "center" | "right" });
        s.doc.setTextColor(0, 0, 0);
        s.y += lineH;
      }
    }
  } else {
    renderTokenLines(s, lines, BODY_SIZE, A4.margin + indent);
  }
  s.y += 5; // paragraph spacing
}

function renderBulletList(s: PdfState, node: TiptapNode): void {
  for (const item of node.content ?? []) {
    for (const para of item.content ?? []) {
      const tokens = buildTokens(para.content ?? []);
      const maxW   = CONTENT_W - 16;
      const lines  = layoutLines(s.doc, tokens, BODY_SIZE, maxW);
      const height = measureTokenBlock(s.doc, tokens, BODY_SIZE, maxW);
      pdfNeedSpace(s, height + 3);
      // Draw bullet at the current y (first line baseline)
      s.doc.setFont("helvetica", "normal");
      s.doc.setFontSize(BODY_SIZE);
      s.doc.text("\u2022", A4.margin + 2, s.y);
      renderTokenLines(s, lines, BODY_SIZE, A4.margin + 16);
    }
  }
  s.y += 3;
}

function renderOrderedList(s: PdfState, node: TiptapNode): void {
  let num = 1;
  for (const item of node.content ?? []) {
    for (const para of item.content ?? []) {
      const tokens = buildTokens(para.content ?? []);
      const maxW   = CONTENT_W - 18;
      const lines  = layoutLines(s.doc, tokens, BODY_SIZE, maxW);
      const height = measureTokenBlock(s.doc, tokens, BODY_SIZE, maxW);
      pdfNeedSpace(s, height + 3);
      s.doc.setFont("helvetica", "normal");
      s.doc.setFontSize(BODY_SIZE);
      s.doc.text(`${num}.`, A4.margin + 2, s.y);
      renderTokenLines(s, lines, BODY_SIZE, A4.margin + 18);
      num++;
    }
  }
  s.y += 3;
}

function renderBlockquote(s: PdfState, node: TiptapNode): void {
  const startY = s.y;
  for (const child of node.content ?? []) {
    renderParagraphNode(s, child, 14);
  }
  // Left accent bar
  s.doc.setDrawColor(180, 180, 180);
  s.doc.setLineWidth(2);
  s.doc.line(A4.margin + 2, startY - 2, A4.margin + 2, s.y - 5);
  s.doc.setLineWidth(0.5);
  s.doc.setDrawColor(0, 0, 0);
  s.y += 3;
}

function renderDocNode(s: PdfState, node: TiptapNode): void {
  switch (node.type) {
    case "heading":     renderHeading(s, node);      break;
    case "paragraph":   renderParagraphNode(s, node); break;
    case "bulletList":  renderBulletList(s, node);    break;
    case "orderedList": renderOrderedList(s, node);   break;
    case "blockquote":  renderBlockquote(s, node);    break;
    // horizontalRule
    case "horizontalRule":
      pdfNeedSpace(s, 16);
      s.doc.setDrawColor(200, 200, 200);
      s.doc.setLineWidth(0.5);
      s.doc.line(A4.margin, s.y, A4.w - A4.margin, s.y);
      s.doc.setDrawColor(0, 0, 0);
      s.y += 16;
      break;
    default: break;
  }
}

async function exportDocumentPDF(json: TiptapNode, title: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const s: PdfState = { doc, y: A4.margin, pageNum: 1, title };

  for (const node of json.content ?? []) {
    renderDocNode(s, node);
  }

  pdfFooter(s);
  const pdfBuf = doc.output("arraybuffer");
  await downloadBlob(
    new Blob([pdfBuf], { type: "application/pdf" }),
    `${title}.pdf`
  );
}

// ─── Sheet import ─────────────────────────────────────────────────────────────

export interface ParsedSheetImport {
  /** Filename without extension — use as default sheet title. */
  title: string;
  columns: { name: string; type: string }[];
  rows: string[][];
  /** Cell formulas extracted from XLSX. Key format: "row,col". */
  formulas: Record<string, string>;
  sizes: {
    colWidths: Record<number, number>;
    rowHeights: Record<number, number>;
  };
}

/**
 * Parse an XLSX, XLS, CSV, or TSV file into a structure the Sheets component
 * can POST to the backend. Throws on parse errors.
 */
export async function parseSheetImport(file: File): Promise<ParsedSheetImport> {
  const ext = getFileExt(file);
  const title = getFileStem(file);
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {
    type: "array",
    cellFormula: true,
    cellStyles: false,
    cellDates: true,
  });

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Workbook contains no sheets.");

  const ref = ws["!ref"];
  if (!ref) throw new Error("Sheet has no data.");

  const range = XLSX.utils.decode_range(ref);
  const numCols = range.e.c - range.s.c + 1;
  const numRows = range.e.r - range.s.r + 1;

  // First row → column headers
  const columns: { name: string; type: string }[] = [];
  for (let c = 0; c < numCols; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + c })];
    columns.push({ name: cell ? String(cell.v ?? "") : `Column ${c + 1}`, type: "text" });
  }

  // Remaining rows → data + formulas
  const rows: string[][] = [];
  const formulas: Record<string, string> = {};
  for (let r = 1; r < numRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < numCols; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c })];
      if (!cell) {
        row.push("");
      } else {
        if ((ext === "xlsx" || ext === "xls") && cell.f) {
          formulas[`${r - 1},${c}`] = `=${cell.f}`;
        }
        row.push(cell.v !== undefined ? String(cell.v) : "");
      }
    }
    rows.push(row);
  }

  // Column widths (Excel char units → px, ~7 px/char)
  const sizes: ParsedSheetImport["sizes"] = { colWidths: {}, rowHeights: {} };
  ws["!cols"]?.forEach((col, i) => {
    if (col?.wch) sizes.colWidths[i] = Math.round(col.wch * 7);
    else if (col?.wpx) sizes.colWidths[i] = col.wpx;
  });
  ws["!rows"]?.forEach((row, i) => {
    if (row?.hpx) sizes.rowHeights[i] = row.hpx;
    else if (row?.hpt) sizes.rowHeights[i] = Math.round(row.hpt * 1.33);
  });

  return { title, columns, rows, formulas, sizes };
}

// ─── Sheet export ─────────────────────────────────────────────────────────────

export interface SheetExportDeps {
  title: string;
  columns: { name: string; type: string }[];
  rows: string[][];
  formulas?: Record<string, string>;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  defaultColWidth: number;
  defaultRowHeight: number;
}

/**
 * Generate and trigger the download of a sheet in the requested format.
 * Emits a success or error toast when done.
 */
export async function exportSheetAs(format: SheetExportFormat, deps: SheetExportDeps): Promise<void> {
  const { title, columns, rows, formulas, colWidths, rowHeights, defaultColWidth, defaultRowHeight } =
    deps;
  try {
    if (format === "xlsx") {
      const aoa: unknown[][] = [
        columns.map((c) => c.name),
        ...rows.map((row, r) =>
          columns.map((_, c) => formulas?.[`${r},${c}`] ?? row[c] ?? "")
        ),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = columns.map((_, i) => ({
        wch: Math.round((colWidths[i] ?? defaultColWidth) / 7),
      }));
      ws["!rows"] = [
        {} as XLSX.RowInfo,
        ...rows.map((_, r) => ({ hpx: rowHeights[r] ?? defaultRowHeight })),
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
      const xlsxBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      await downloadBlob(
        new Blob([xlsxBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `${title}.xlsx`
      );
    } else if (format === "csv" || format === "tsv") {
      const delimiter = format === "tsv" ? "\t" : ",";
      const aoa: string[][] = [
        columns.map((c) => c.name),
        ...rows.map((row) => columns.map((_, c) => row[c] ?? "")),
      ];
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(aoa), { FS: delimiter });
      await downloadBlob(
        new Blob([csv], { type: "text/plain;charset=utf-8" }),
        `${title}.${format}`
      );
    } else {
      // pdf — A4 landscape, scaled column widths, consistent 40 pt margins
      const SHEET_MARGIN = 40;
      // A4 landscape: 841.89 × 595.28 pt
      const PAGE_W = 841.89;
      const HEADER_H = 28; // space above table for title
      const tableWidth = PAGE_W - SHEET_MARGIN * 2;

      // Scale each column proportionally to its on-screen width
      const totalPx = columns.reduce((s, _, i) => s + (colWidths[i] ?? defaultColWidth), 0);
      const columnStyles: Record<number, { cellWidth: number }> = {};
      columns.forEach((_, i) => {
        const px = colWidths[i] ?? defaultColWidth;
        columnStyles[i] = { cellWidth: (px / totalPx) * tableWidth };
      });

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageNumInternal = doc as unknown as {
        internal: { getCurrentPageInfo: () => { pageNumber: number } };
      };

      autoTable(doc, {
        head: [columns.map((c) => c.name)],
        body: rows.map((row) => columns.map((_, c) => row[c] ?? "")),
        startY: SHEET_MARGIN + HEADER_H,
        margin: { top: SHEET_MARGIN + HEADER_H, right: SHEET_MARGIN, bottom: SHEET_MARGIN, left: SHEET_MARGIN },
        tableWidth,
        columnStyles,
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak", minCellHeight: 14 },
        headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold", minCellHeight: 16 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        tableLineColor: [180, 180, 180],
        tableLineWidth: 0.4,
        // Keep each data row on one page — never slice a row across pages
        rowPageBreak: "avoid",
        didDrawPage: (data) => {
          const pn = pageNumInternal.internal.getCurrentPageInfo().pageNumber;
          // Title bar
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text(title, data.settings.margin.left, SHEET_MARGIN + 14);
          // Page number (right-aligned)
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(130, 130, 130);
          doc.text(`Page ${pn}`, PAGE_W - data.settings.margin.right, SHEET_MARGIN + 14, { align: "right" });
          doc.setTextColor(0, 0, 0);
          // Thin separator under header
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.line(data.settings.margin.left, SHEET_MARGIN + 18, PAGE_W - data.settings.margin.right, SHEET_MARGIN + 18);
          doc.setDrawColor(0, 0, 0);
        },
      });
      const pdfBuf = doc.output("arraybuffer");
      await downloadBlob(
        new Blob([pdfBuf], { type: "application/pdf" }),
        `${title}.pdf`
      );
    }
    toast(`Exported "${title}.${format}".`);
  } catch (err) {
    console.error("Sheet export failed", err);
    toast("Export failed. Please try again.", "error");
  }
}

// ─── Bulk export ──────────────────────────────────────────────────────────────

/**
 * Export every sheet as one worksheet inside a single XLSX workbook.
 * Sheet names are truncated to 31 characters (Excel limit).
 */
export async function exportAllSheetsXLSX(sheets: SheetExportDeps[]): Promise<void> {
  try {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const { title, columns, rows, formulas, colWidths, rowHeights, defaultColWidth, defaultRowHeight } = s;
      const aoa: unknown[][] = [
        columns.map((c) => c.name),
        ...rows.map((row, r) =>
          columns.map((_, c) => formulas?.[`${r},${c}`] ?? row[c] ?? "")
        ),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = columns.map((_, i) => ({
        wch: Math.round((colWidths[i] ?? defaultColWidth) / 7),
      }));
      ws["!rows"] = [
        {} as XLSX.RowInfo,
        ...rows.map((_, r) => ({ hpx: rowHeights[r] ?? defaultRowHeight })),
      ];
      // Deduplicate sheet names within the workbook
      let sheetName = title.slice(0, 31) || "Sheet";
      const existing = wb.SheetNames;
      if (existing.includes(sheetName)) {
        let n = 2;
        while (existing.includes(`${sheetName.slice(0, 28)} (${n})`)) n++;
        sheetName = `${sheetName.slice(0, 28)} (${n})`;
      }
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    const xlsxBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    await downloadBlob(
      new Blob([xlsxBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "sheets-export.xlsx"
    );
    toast(`Exported ${sheets.length} sheet${sheets.length !== 1 ? "s" : ""} to XLSX.`);
  } catch (err) {
    console.error("Bulk sheet export failed", err);
    toast("Export failed. Please try again.", "error");
  }
}

// Internal Tiptap node type (same shape as TiptapNode above, duplicated here
// so the bulk-export helper can use it without re-declaring in module scope).
interface BulkTiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BulkTiptapNode[];
  marks?: { type: string }[];
  text?: string;
}

/** Convert a Tiptap JSON node to a plain Markdown string (no editor required). */
function tiptapNodeToMd(node: BulkTiptapNode, ctx: { listType?: "bullet" | "ordered"; index?: number } = {}): string {
  const children = node.content ?? [];
  switch (node.type) {
    case "doc":
      return children.map((c) => tiptapNodeToMd(c)).join("\n\n");

    case "heading": {
      const lvl = (node.attrs?.level as number) ?? 1;
      const prefix = "#".repeat(lvl);
      const text = children.map((c) => tiptapInlineMd(c)).join("");
      return `${prefix} ${text}`;
    }

    case "paragraph": {
      const text = children.map((c) => tiptapInlineMd(c)).join("");
      if (!text.trim()) return "";
      if (ctx.listType === "bullet") return `- ${text}`;
      if (ctx.listType === "ordered") return `${(ctx.index ?? 1)}. ${text}`;
      return text;
    }

    case "bulletList":
      return children.map((c) => tiptapNodeToMd(c, { listType: "bullet" })).join("\n");

    case "orderedList":
      return children.map((c, i) => tiptapNodeToMd(c, { listType: "ordered", index: i + 1 })).join("\n");

    case "listItem": {
      const inner = children.map((c) => tiptapNodeToMd(c, ctx)).join("\n");
      return inner;
    }

    case "blockquote": {
      const inner = children.map((c) => tiptapNodeToMd(c)).join("\n\n");
      return inner.split("\n").map((l) => `> ${l}`).join("\n");
    }

    case "horizontalRule":
      return "---";

    case "hardBreak":
      return "  \n";

    default:
      return children.map((c) => tiptapNodeToMd(c)).join("");
  }
}

function tiptapInlineMd(node: BulkTiptapNode): string {
  if (node.type === "hardBreak") return "  \n";
  const text = node.text ?? node.content?.map(tiptapInlineMd).join("") ?? "";
  const marks = node.marks ?? [];
  const bold = marks.some((m) => m.type === "bold");
  const italic = marks.some((m) => m.type === "italic");
  let out = text;
  if (italic) out = `_${out}_`;
  if (bold) out = `**${out}**`;
  return out;
}

export interface BulkDocExportItem {
  title: string;
  content_json: Record<string, unknown>;
}

/**
 * Export selected documents as a ZIP archive.
 * Each document is saved as a Markdown (.md) file.
 */
export async function exportDocumentsAsZip(docs: BulkDocExportItem[]): Promise<void> {
  try {
    const zip = new JSZip();
    const usedNames = new Set<string>();
    for (const doc of docs) {
      const md = tiptapNodeToMd(doc.content_json as unknown as BulkTiptapNode);
      let filename = (doc.title.trim() || "Untitled").replace(/[/\\:*?"<>|]/g, "_") + ".md";
      if (usedNames.has(filename)) {
        let n = 2;
        const stem = filename.slice(0, -3);
        while (usedNames.has(`${stem} (${n}).md`)) n++;
        filename = `${stem} (${n}).md`;
      }
      usedNames.add(filename);
      zip.file(filename, `# ${doc.title}\n\n${md}`);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    await downloadBlob(blob, "documents-export.zip");
    toast(`Exported ${docs.length} document${docs.length !== 1 ? "s" : ""} to ZIP.`);
  } catch (err) {
    console.error("Bulk document export failed", err);
    toast("Export failed. Please try again.", "error");
  }
}
