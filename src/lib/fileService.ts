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

import jsPDF from "jspdf";
import { type PageSettings, DEFAULT_PAGE_SETTINGS, PAGE_DIMS_PT, MARGIN_PT } from "./pageSettings";
import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  ExternalHyperlink,
  Header,
  Footer,
  PageNumber,
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

export const DOCUMENT_IMPORT_ACCEPT = ".docx,.md,.txt,.rtf";
export const DOCUMENT_IMPORT_EXTS = ["docx", "md", "txt", "rtf"];

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

// ─── DOCX full-fidelity parser ───────────────────────────────────────────────
//
// Replaces Mammoth. Opens the DOCX ZIP directly and walks word/document.xml,
// resolving style inheritance, numbering, theme colours, embedded images, and
// hyperlinks into Tiptap-compatible HTML.

// ── XML helpers ───────────────────────────────────────────────────────────────

const W_NS  = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_HYPERLINK = `${REL_NS}/hyperlink`;
const REL_IMAGE     = `${REL_NS}/image`;

/** First-level children of `parent` with the given local name (w: namespace). */
function wCh(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter(c => c.localName === name);
}
function wCh1(parent: Element, name: string): Element | null {
  for (const c of Array.from(parent.children)) if (c.localName === name) return c;
  return null;
}
/** Get a w:-prefixed attribute. */
function wA(el: Element, attr: string): string {
  return el.getAttribute(`w:${attr}`) ?? el.getAttributeNS(W_NS, attr) ?? "";
}
/** Get a r:-prefixed attribute. */
function rA(el: Element, attr: string): string {
  return el.getAttribute(`r:${attr}`) ?? el.getAttributeNS(REL_NS, attr) ?? "";
}
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DxRun {
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  color?: string; fontSize?: number; fontFamily?: string;
  highlight?: string; superscript?: boolean; subscript?: boolean;
}
interface DxPara { align?: string; lineHeight?: number; indent?: number; spacingBefore?: number; spacingAfter?: number; }
interface DxStyle { basedOn?: string; headingLevel?: number; rPr?: DxRun; pPr?: DxPara; }
interface DxNumLevel { format: string; }
interface DxRel { target: string; type: string; }
interface DxCtx {
  styles: Map<string, DxStyle>;
  nums: Map<string, DxNumLevel[]>;
  rels: Map<string, DxRel>;
  theme: Map<string, string>;
  media: Map<string, string>;
}

// ── Highlight colour map ───────────────────────────────────────────────────────

const DX_HL: Record<string, string> = {
  yellow: "yellow", green: "#00ff00", cyan: "cyan", magenta: "magenta",
  blue: "blue", red: "red", darkBlue: "#00008b", darkCyan: "#008b8b",
  darkGreen: "#006400", darkMagenta: "#8b008b", darkRed: "#8b0000",
  darkYellow: "#808000", darkGray: "#a9a9a9", lightGray: "#d3d3d3", black: "black",
};

// ── Parse <w:rPr> ──────────────────────────────────────────────────────────────

function parseRPr(el: Element): DxRun {
  const r: DxRun = {};
  const bEl = wCh1(el, "b") ?? wCh1(el, "bCs");
  if (bEl) r.bold = wA(bEl, "val") !== "0" && wA(bEl, "val") !== "false";
  const iEl = wCh1(el, "i") ?? wCh1(el, "iCs");
  if (iEl) r.italic = wA(iEl, "val") !== "0" && wA(iEl, "val") !== "false";
  const uEl = wCh1(el, "u");
  if (uEl) r.underline = wA(uEl, "val") !== "none" && wA(uEl, "val") !== "";
  const sEl = wCh1(el, "strike") ?? wCh1(el, "dstrike");
  if (sEl) r.strike = wA(sEl, "val") !== "0" && wA(sEl, "val") !== "false";
  const cEl = wCh1(el, "color");
  if (cEl) { const v = wA(cEl, "val"); if (v && v !== "auto") r.color = `#${v}`; }
  const szEl = wCh1(el, "sz") ?? wCh1(el, "szCs");
  if (szEl) { const hp = parseInt(wA(szEl, "val"), 10); if (hp) r.fontSize = Math.round(hp * 2 / 3); }
  const fEl = wCh1(el, "rFonts");
  if (fEl) { const ff = wA(fEl, "ascii") || wA(fEl, "hAnsi") || wA(fEl, "cs"); if (ff) r.fontFamily = ff; }
  const hlEl = wCh1(el, "highlight");
  if (hlEl) { const v = wA(hlEl, "val"); if (v && v !== "none") r.highlight = DX_HL[v] ?? v; }
  const vaEl = wCh1(el, "vertAlign");
  if (vaEl) { const v = wA(vaEl, "val"); if (v === "superscript") r.superscript = true; else if (v === "subscript") r.subscript = true; }
  return r;
}

function mergeRun(base: DxRun, over: DxRun): DxRun {
  const r = { ...base };
  for (const [k, v] of Object.entries(over)) if (v !== undefined) (r as Record<string, unknown>)[k] = v;
  return r;
}

// ── Build lookup maps ─────────────────────────────────────────────────────────

function buildStyleMap(doc: Document): Map<string, DxStyle> {
  const map = new Map<string, DxStyle>();
  for (const el of Array.from(doc.getElementsByTagName("w:style"))) {
    const id = wA(el, "styleId"); if (!id) continue;
    const def: DxStyle = {};
    const nameEl = wCh1(el, "name");
    if (nameEl) {
      const n = wA(nameEl, "val").toLowerCase();
      const m = n.match(/^heading\s*(\d)/);
      if (m) def.headingLevel = parseInt(m[1], 10);
    }
    const basedOnEl = wCh1(el, "basedOn");
    if (basedOnEl) def.basedOn = wA(basedOnEl, "val");
    const rPrEl = wCh1(el, "rPr");
    if (rPrEl) def.rPr = parseRPr(rPrEl);
    const pPrEl = wCh1(el, "pPr");
    if (pPrEl) {
      const pPr: DxPara = {};
      const jc = wCh1(pPrEl, "jc");
      if (jc) { const v = wA(jc, "val"); pPr.align = (v === "both" || v === "distribute") ? "justify" : v; }
      const sp = wCh1(pPrEl, "spacing");
      if (sp) {
        const ln = wA(sp, "line"); const rule = wA(sp, "lineRule"); if (ln && rule !== "exact") pPr.lineHeight = parseFloat((parseInt(ln, 10) / 240).toFixed(2));
        const bef = wA(sp, "before"); if (bef) pPr.spacingBefore = Math.round(parseInt(bef, 10) / 20 * 96 / 72);
        const aft = wA(sp, "after"); if (aft) pPr.spacingAfter = Math.round(parseInt(aft, 10) / 20 * 96 / 72);
      }
      if (Object.keys(pPr).length) def.pPr = pPr;
    }
    map.set(id, def);
  }
  return map;
}

function effectiveRun(styleId: string, styles: Map<string, DxStyle>, depth = 0): DxRun {
  if (depth > 10) return {};
  const s = styles.get(styleId); if (!s) return {};
  const base = s.basedOn ? effectiveRun(s.basedOn, styles, depth + 1) : {};
  return mergeRun(base, s.rPr ?? {});
}

function effectivePara(styleId: string, styles: Map<string, DxStyle>, depth = 0): DxPara {
  if (depth > 10) return {};
  const s = styles.get(styleId); if (!s) return {};
  const base = s.basedOn ? effectivePara(s.basedOn, styles, depth + 1) : {};
  return { ...base, ...s.pPr };
}

function buildRelMap(doc: Document): Map<string, DxRel> {
  const map = new Map<string, DxRel>();
  for (const el of Array.from(doc.getElementsByTagName("Relationship"))) {
    const id = el.getAttribute("Id"); if (!id) continue;
    map.set(id, { target: el.getAttribute("Target") ?? "", type: el.getAttribute("Type") ?? "" });
  }
  return map;
}

function buildThemeColors(doc: Document): Map<string, string> {
  const map = new Map<string, string>();
  const scheme = doc.getElementsByTagName("a:clrScheme")[0]; if (!scheme) return map;
  for (const child of Array.from(scheme.children)) {
    const name = child.localName;
    const srgb = child.getElementsByTagName("a:srgbClr")[0];
    const sys  = child.getElementsByTagName("a:sysClr")[0];
    const hex  = srgb?.getAttribute("val") ?? sys?.getAttribute("lastClr") ?? "";
    if (hex) map.set(name, `#${hex}`);
  }
  return map;
}

function buildNumberingMap(doc: Document): Map<string, DxNumLevel[]> {
  const abstracts = new Map<string, DxNumLevel[]>();
  for (const el of Array.from(doc.getElementsByTagName("w:abstractNum"))) {
    const id = wA(el, "abstractNumId"); if (!id) continue;
    const levels: DxNumLevel[] = [];
    for (const lvl of Array.from(el.getElementsByTagName("w:lvl"))) {
      const fmtEl = wCh1(lvl, "numFmt");
      levels.push({ format: fmtEl ? wA(fmtEl, "val") : "bullet" });
    }
    abstracts.set(id, levels);
  }
  const map = new Map<string, DxNumLevel[]>();
  for (const el of Array.from(doc.getElementsByTagName("w:num"))) {
    const numId = wA(el, "numId"); if (!numId) continue;
    const abIdEl = wCh1(el, "abstractNumId");
    if (abIdEl) map.set(numId, abstracts.get(wA(abIdEl, "val")) ?? []);
  }
  return map;
}

// ── Run → HTML ────────────────────────────────────────────────────────────────

function runToHtml(text: string, run: DxRun): string {
  if (!text) return "";
  const escaped = escHtml(text);
  const styles: string[] = [];
  if (run.color) styles.push(`color:${run.color}`);
  if (run.fontSize) styles.push(`font-size:${run.fontSize}px`);
  if (run.fontFamily) {
    const ff = run.fontFamily.includes(" ") ? `"${run.fontFamily}"` : run.fontFamily;
    styles.push(`font-family:${ff}`);
  }
  let html = styles.length ? `<span style="${styles.join(";")}">${escaped}</span>` : escaped;
  if (run.highlight) html = `<mark>${html}</mark>`;
  if (run.underline) html = `<u>${html}</u>`;
  if (run.strike)    html = `<s>${html}</s>`;
  if (run.italic)    html = `<em>${html}</em>`;
  if (run.bold)      html = `<strong>${html}</strong>`;
  if (run.superscript) html = `<sup>${html}</sup>`;
  if (run.subscript)   html = `<sub>${html}</sub>`;
  return html;
}

// ── Convert a single <w:r> ────────────────────────────────────────────────────

function convertRun(rEl: Element, ctx: DxCtx, paraStyleId?: string): string {
  const rPrEl = wCh1(rEl, "rPr");

  // Resolve: paragraph style → run character style → explicit rPr
  let run: DxRun = paraStyleId ? effectiveRun(paraStyleId, ctx.styles) : {};
  if (rPrEl) {
    const rStyleEl = wCh1(rPrEl, "rStyle");
    if (rStyleEl) run = mergeRun(run, effectiveRun(wA(rStyleEl, "val"), ctx.styles));
    run = mergeRun(run, parseRPr(rPrEl));
  }

  let text = "";
  for (const child of Array.from(rEl.children)) {
    switch (child.localName) {
      case "t":   text += child.textContent ?? ""; break;
      case "tab": text += " "; break;
      case "br":  text += "\n"; break;
      case "drawing": return convertDrawing(child, ctx);
      case "pict":
      case "object": return ""; // skip OLE objects
    }
  }

  if (!text) return "";
  if (text.includes("\n")) {
    return text.split("\n").map(p => runToHtml(p, run)).join("<br>");
  }
  return runToHtml(text, run);
}

// ── Images ────────────────────────────────────────────────────────────────────

function convertDrawing(drawingEl: Element, ctx: DxCtx): string {
  // Find a:blip r:embed (namespace-prefixed or plain tagName)
  const blips = drawingEl.getElementsByTagName("a:blip");
  const blip  = blips[0] ?? Array.from(drawingEl.getElementsByTagName("blip"))[0];
  if (!blip) return "";
  const rId = rA(blip, "embed"); if (!rId) return "";
  const rel = ctx.rels.get(rId);
  if (!rel || rel.type !== REL_IMAGE) return "";
  // rels target can be "../media/..." or "media/..."
  const mediaKey = rel.target.replace(/^.*media\//, "media/");
  const src = ctx.media.get(mediaKey); if (!src) return "";
  // Try to read width from wp:extent cx (EMUs; 914400 = 1 inch = 96 CSS px)
  const extents = drawingEl.getElementsByTagName("wp:extent");
  const cx = extents[0]?.getAttribute("cx");
  const wPx = cx ? Math.round(parseInt(cx, 10) / 9525) : undefined; // 914400/96 = 9525
  return wPx ? `<img src="${src}" width="${wPx}" alt="">` : `<img src="${src}" alt="">`;
}

// ── Hyperlinks ────────────────────────────────────────────────────────────────

function convertHyperlink(hlEl: Element, ctx: DxCtx, paraStyleId?: string): string {
  const rId = rA(hlEl, "id");
  let href = "";
  if (rId) { const rel = ctx.rels.get(rId); if (rel?.type === REL_HYPERLINK) href = rel.target; }
  const anchor = wA(hlEl, "anchor");
  if (!href && anchor) href = `#${anchor}`;
  const content = wCh(hlEl, "r").map(r => convertRun(r, ctx, paraStyleId)).join("");
  return href ? `<a href="${escHtml(href)}">${content}</a>` : content;
}

// ── Inline children of a paragraph-level element ──────────────────────────────

function convertInline(el: Element, ctx: DxCtx, paraStyleId?: string): string {
  let html = "";
  for (const child of Array.from(el.children)) {
    switch (child.localName) {
      case "r":          html += convertRun(child, ctx, paraStyleId); break;
      case "hyperlink":  html += convertHyperlink(child, ctx, paraStyleId); break;
      case "ins":        html += convertInline(child, ctx, paraStyleId); break; // tracked insert
      case "del":        break; // skip deleted text
      case "smartTag":   html += convertInline(child, ctx, paraStyleId); break;
      case "sdt": {      // structured document tag
        const content = wCh1(child, "sdtContent");
        if (content) html += convertInline(content, ctx, paraStyleId);
        break;
      }
      case "bookmarkStart": case "bookmarkEnd": case "proofErr": case "rPr": break;
    }
  }
  return html;
}

// ── Parse <w:pPr> ──────────────────────────────────────────────────────────────

interface ParagraphInfo {
  para: DxPara; styleId?: string; headingLevel?: number;
  numId?: string; ilvl: number; isOrdered: boolean;
}

function parsePPr(pPrEl: Element | null, ctx: DxCtx): ParagraphInfo {
  if (!pPrEl) return { para: {}, ilvl: 0, isOrdered: false };

  const pStyleEl = wCh1(pPrEl, "pStyle");
  const styleId  = pStyleEl ? wA(pStyleEl, "val") : undefined;

  const para: DxPara = styleId ? { ...effectivePara(styleId, ctx.styles) } : {};
  let headingLevel: number | undefined;
  if (styleId) headingLevel = ctx.styles.get(styleId)?.headingLevel;

  // Explicit jc overrides style
  const jc = wCh1(pPrEl, "jc");
  if (jc) { const v = wA(jc, "val"); para.align = (v === "both" || v === "distribute") ? "justify" : v; }

  // Line spacing + paragraph spacing
  const sp = wCh1(pPrEl, "spacing");
  if (sp) {
    const line = wA(sp, "line"); const rule = wA(sp, "lineRule");
    if (line && rule !== "exact") para.lineHeight = parseFloat((parseInt(line, 10) / 240).toFixed(2));
    const bef = wA(sp, "before"); if (bef) para.spacingBefore = Math.round(parseInt(bef, 10) / 20 * 96 / 72);
    const aft = wA(sp, "after"); if (aft) para.spacingAfter = Math.round(parseInt(aft, 10) / 20 * 96 / 72);
  }

  // Indentation (twips; 1440 twips = 1 inch = 96px → 1 twip ≈ 0.0667px)
  const ind = wCh1(pPrEl, "ind");
  if (ind) { const left = wA(ind, "left"); if (left) para.indent = Math.round(parseInt(left, 10) / 15); }

  // Numbering
  const numPr = wCh1(pPrEl, "numPr");
  let numId: string | undefined;
  let ilvl = 0;
  if (numPr) {
    const ni = wCh1(numPr, "numId"); const il = wCh1(numPr, "ilvl");
    numId = ni ? wA(ni, "val") : undefined;
    if (numId === "0") numId = undefined;
    ilvl  = il ? parseInt(wA(il, "val"), 10) : 0;
  }

  const levels   = numId ? ctx.nums.get(numId) : undefined;
  const lvlDef   = levels?.[ilvl];
  const isOrdered = lvlDef ? lvlDef.format !== "bullet" && lvlDef.format !== "none" : false;

  return { para, styleId, headingLevel, numId, ilvl, isOrdered };
}

// ── Paragraph ────────────────────────────────────────────────────────────────

interface ParaResult {
  html: string; innerHtml: string;
  numId?: string; ilvl: number; isOrdered: boolean; headingLevel?: number;
}

function convertDocxParagraph(pEl: Element, ctx: DxCtx): ParaResult {
  const pPrEl = wCh1(pEl, "pPr");
  const { para, styleId, headingLevel, numId, ilvl, isOrdered } = parsePPr(pPrEl, ctx);

  const inner = convertInline(pEl, ctx, styleId);

  const pStyle: string[] = [];
  if (para.align && para.align !== "left") pStyle.push(`text-align:${para.align}`);
  if (para.lineHeight && Math.abs(para.lineHeight - 1.0) > 0.05) pStyle.push(`line-height:${para.lineHeight}`);
  if (para.indent) pStyle.push(`padding-left:${para.indent}px`);
  if (para.spacingBefore) pStyle.push(`margin-top:${para.spacingBefore}px`);
  if (para.spacingAfter) pStyle.push(`margin-bottom:${para.spacingAfter}px`);
  const sa = pStyle.length ? ` style="${pStyle.join(";")}"` : "";

  const tag  = headingLevel ? `h${Math.min(headingLevel, 6)}` : "p";
  const html = `<${tag}${sa}>${inner}</${tag}>`;

  return { html, innerHtml: inner, numId, ilvl, isOrdered, headingLevel };
}

// ── Table ─────────────────────────────────────────────────────────────────────

function convertDocxTable(tblEl: Element, ctx: DxCtx): string {
  const rows = wCh(tblEl, "tr").map(tr => {
    const cells = wCh(tr, "tc").map(tc => {
      const content = wCh(tc, "p").map(p => convertDocxParagraph(p, ctx).html).join("");
      const tcs = wCh(tc, "tcPr");
      const gridSpan = tcs.length ? wA(wCh1(tcs[0], "gridSpan") ?? tc, "val") : "";
      const colSpanAttr = gridSpan ? ` colspan="${gridSpan}"` : "";
      return `<td${colSpanAttr}>${content}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `<table><tbody>${rows}</tbody></table>`;
}

// ── Walk document body ────────────────────────────────────────────────────────

function walkDocxBody(children: Element[], ctx: DxCtx): string {
  let html = "";
  let i = 0;

  while (i < children.length) {
    const child = children[i];

    if (child.localName === "tbl") {
      html += convertDocxTable(child, ctx);
      i++; continue;
    }

    if (child.localName === "sdt") {
      const content = wCh1(child, "sdtContent");
      if (content) html += walkDocxBody(Array.from(content.children), ctx);
      i++; continue;
    }

    if (child.localName === "p") {
      const result = convertDocxParagraph(child, ctx);

      if (result.numId) {
        // Collect consecutive paragraphs belonging to the same list
        const startNumId  = result.numId;
        const startOrdered = result.isOrdered;
        const listTag     = startOrdered ? "ol" : "ul";
        let items         = `<li>${result.innerHtml}</li>`;
        i++;

        while (i < children.length) {
          const next = children[i];
          if (next.localName !== "p") break;
          const nr = convertDocxParagraph(next, ctx);
          if (!nr.numId) break;
          // Different list ID → close and let outer loop handle
          if (nr.numId !== startNumId) break;
          items += `<li>${nr.innerHtml}</li>`;
          i++;
        }

        html += `<${listTag}>${items}</${listTag}>`;
        continue;
      }

      html += result.html;
      i++; continue;
    }

    // sectPr and other structural elements — skip
    i++;
  }

  return html;
}

// ── Main entry point ──────────────────────────────────────────────────────────

async function parseDocxToHtml(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);

  const readXml = async (path: string): Promise<Document | null> => {
    const file = zip.file(path);
    if (!file) return null;
    const text = await file.async("text");
    return new DOMParser().parseFromString(text, "text/xml");
  };

  const [docXml, stylesXml, numXml, relsXml, themeXml] = await Promise.all([
    readXml("word/document.xml"),
    readXml("word/styles.xml"),
    readXml("word/numbering.xml"),
    readXml("word/_rels/document.xml.rels"),
    readXml("word/theme/theme1.xml"),
  ]);

  if (!docXml) throw new Error("Invalid DOCX: missing word/document.xml");

  // Build lookup maps
  const styles = stylesXml  ? buildStyleMap(stylesXml)       : new Map<string, DxStyle>();
  const nums   = numXml     ? buildNumberingMap(numXml)       : new Map<string, DxNumLevel[]>();
  const rels   = relsXml    ? buildRelMap(relsXml)            : new Map<string, DxRel>();
  const theme  = themeXml   ? buildThemeColors(themeXml)      : new Map<string, string>();

  // Apply theme colours to any styles that reference them
  for (const style of Array.from(styles.values())) {
    if (style.rPr?.color?.startsWith("#") && style.rPr.color.length === 7) continue;
    // (theme colour resolution for runs happens inline via ctx.theme)
  }

  // Load all media files as base64 data URIs
  const media = new Map<string, string>();
  const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
  for (const [path, zipFile] of Object.entries(zip.files)) {
    if (!path.startsWith("word/media/")) continue;
    const ext  = path.split(".").pop()?.toLowerCase() ?? "png";
    const mime = MIME[ext] ?? "image/png";
    const b64  = await zipFile.async("base64");
    media.set(path.replace("word/", ""), `data:${mime};base64,${b64}`);
    // Yield to main thread between media files to prevent UI freeze on large DOCX
    await new Promise<void>(r => setTimeout(r, 0));
  }

  const ctx: DxCtx = { styles, nums, rels, theme, media };

  const body = docXml.getElementsByTagName("w:body")[0]
    ?? Array.from(docXml.getElementsByTagName("body")).find(el => el.localName === "body");
  if (!body) return "";

  return walkDocxBody(Array.from(body.children), ctx);
}

// ─── RTF parser ──────────────────────────────────────────────────────────────

/**
 * Lightweight RTF → HTML converter.
 *
 * Supports: paragraphs (\par), bold/italic/underline (\b, \i, \ul),
 * font size (\fs), colour tables (\colortbl + \cf), font tables (\fonttbl),
 * headings (\outlinelevel), tabs (\tab), line breaks (\line),
 * hex escapes (\'xx), and Unicode escapes (\uN).
 *
 * Gracefully ignores: OLE objects, tables (\trowd), images (\pict).
 */
export function parseRtfToHtml(rtf: string): string {
  // ── Colour table ──────────────────────────────────────────────────────
  const colors: string[] = [""];          // index 0 = auto / default
  const ctMatch = rtf.match(/\{\\colortbl\s*;?([^}]*)}/);
  if (ctMatch) {
    const entries = ctMatch[1].split(";").filter(Boolean);
    for (const entry of entries) {
      const r = entry.match(/\\red(\d+)/)?.[1] ?? "0";
      const g = entry.match(/\\green(\d+)/)?.[1] ?? "0";
      const b = entry.match(/\\blue(\d+)/)?.[1] ?? "0";
      colors.push(`rgb(${r},${g},${b})`);
    }
  }

  // ── Strip header groups we can't use ──────────────────────────────────
  // Remove {\fonttbl ...}, {\stylesheet ...}, {\info ...}, {\*\... } etc.
  let body = rtf;
  // Remove the leading {\rtf1 wrapper (keep content after the first group-close of the preamble)
  body = body.replace(/^\{\\rtf\d?\s*/, "");
  // Remove the trailing }
  if (body.endsWith("}")) body = body.slice(0, -1);

  // Remove known preamble groups (nested braces handled by counting)
  const stripGroups = ["\\fonttbl", "\\colortbl", "\\stylesheet", "\\info", "\\*\\generator", "\\*\\listtable", "\\*\\listoverridetable"];
  for (const prefix of stripGroups) {
    let idx = body.indexOf(`{${prefix}`);
    while (idx !== -1) {
      let depth = 0;
      let end = idx;
      for (let j = idx; j < body.length; j++) {
        if (body[j] === "{") depth++;
        else if (body[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
      }
      body = body.slice(0, idx) + body.slice(end);
      idx = body.indexOf(`{${prefix}`);
    }
  }

  // ── Tokenise and walk ─────────────────────────────────────────────────
  const html: string[] = [];
  let bold = false, italic = false, underline = false;
  let fontSize = 0, colorIdx = 0;
  let outlineLevel = -1;
  let paraContent = "";
  let inIgnoredGroup = 0;     // depth inside \trowd, \pict, \object, etc.

  const flushSpan = (text: string): string => {
    if (!text) return "";
    let span = escHtml(text);
    const styles: string[] = [];
    if (bold) styles.push("font-weight:bold");
    if (italic) styles.push("font-style:italic");
    if (underline) styles.push("text-decoration:underline");
    if (fontSize > 0) styles.push(`font-size:${fontSize / 2}pt`);
    if (colorIdx > 0 && colorIdx < colors.length) styles.push(`color:${colors[colorIdx]}`);
    if (styles.length > 0) span = `<span style="${styles.join(";")}">${span}</span>`;
    return span;
  };

  const flushPara = () => {
    const content = paraContent || "<br>";
    if (outlineLevel >= 0 && outlineLevel <= 5) {
      const level = Math.min(outlineLevel + 1, 6);
      html.push(`<h${level}>${content}</h${level}>`);
    } else {
      html.push(`<p>${content}</p>`);
    }
    paraContent = "";
    outlineLevel = -1;
  };

  // Simple regex tokeniser
  const tokenRe = /(\{|\}|\\[a-z]+[-]?\d*\s?|\\'[0-9a-fA-F]{2}|\\u-?\d+[ ?]?|\\[^a-z]|[^{}\\]+)/g;
  let m: RegExpExecArray | null;
  let groupDepth = 0;

  while ((m = tokenRe.exec(body)) !== null) {
    const tok = m[1];

    if (tok === "{") {
      groupDepth++;
      if (inIgnoredGroup > 0) inIgnoredGroup++;
      continue;
    }
    if (tok === "}") {
      groupDepth--;
      if (inIgnoredGroup > 0) inIgnoredGroup--;
      continue;
    }
    if (inIgnoredGroup > 0) continue;

    // Control words
    if (tok.startsWith("\\")) {
      const cwMatch = tok.match(/^\\([a-z]+)(-?\d+)?\s?$/);
      if (cwMatch) {
        const word = cwMatch[1];
        const param = cwMatch[2] !== undefined ? parseInt(cwMatch[2], 10) : undefined;

        switch (word) {
          case "par": case "pard":
            flushPara();
            if (word === "pard") { bold = false; italic = false; underline = false; fontSize = 0; colorIdx = 0; }
            break;
          case "b":
            bold = param !== 0;
            break;
          case "i":
            italic = param !== 0;
            break;
          case "ul": case "ulnone":
            underline = word === "ul" && param !== 0;
            break;
          case "fs":
            fontSize = param ?? 0;
            break;
          case "cf":
            colorIdx = param ?? 0;
            break;
          case "outlinelevel":
            outlineLevel = param ?? -1;
            break;
          case "tab":
            paraContent += "\t";
            break;
          case "line":
            paraContent += "<br>";
            break;
          case "trowd": case "pict": case "object":
            inIgnoredGroup = 1;
            break;
          default:
            break;
        }
        continue;
      }

      // Hex escape \'xx
      if (tok.startsWith("\\'")) {
        const code = parseInt(tok.slice(2), 16);
        if (!isNaN(code)) paraContent += flushSpan(String.fromCharCode(code));
        continue;
      }

      // Unicode escape \uN
      if (tok.startsWith("\\u")) {
        const uMatch = tok.match(/^\\u(-?\d+)/);
        if (uMatch) {
          let code = parseInt(uMatch[1], 10);
          if (code < 0) code += 65536;
          paraContent += flushSpan(String.fromCodePoint(code));
        }
        continue;
      }

      // Other escaped chars like \\ \{ \}
      if (tok.length === 2 && !tok[1].match(/[a-z]/)) {
        paraContent += flushSpan(tok[1]);
        continue;
      }

      continue;
    }

    // Plain text
    paraContent += flushSpan(tok);
  }

  // Flush remaining paragraph
  if (paraContent) flushPara();

  return html.join("");
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
    const html = await parseDocxToHtml(buf);
    return { title, type: "html", content: html };
  }

  if (ext === "rtf") {
    const text = await file.text();
    const html = parseRtfToHtml(text);
    return { title, type: "html", content: html };
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

function inlineRunOpts(node: TiptapNode) {
  const marks = (node.marks ?? []) as { type: string; attrs?: Record<string, unknown> }[];
  const textStyleMark = marks.find((m) => m.type === "textStyle");
  const fontSize = textStyleMark?.attrs?.fontSize as number | undefined;
  const color = textStyleMark?.attrs?.color as string | undefined;
  const isHighlighted = marks.some((m) => m.type === "highlight");
  return {
    text: node.text ?? "",
    bold: marks.some((m) => m.type === "bold"),
    italics: marks.some((m) => m.type === "italic"),
    underline: marks.some((m) => m.type === "underline") ? {} as Record<string, unknown> : undefined,
    strike: marks.some((m) => m.type === "strike"),
    superScript: marks.some((m) => m.type === "superscript"),
    subScript: marks.some((m) => m.type === "subscript"),
    size: fontSize ? fontSize * 2 : undefined,
    color: color ? color.replace("#", "") : undefined,
    highlight: isHighlighted ? "yellow" as const : undefined,
    _marks: marks,
  };
}

function inlineToDocxChild(node: TiptapNode): TextRun | ExternalHyperlink {
  if (node.type === "hardBreak") return new TextRun({ break: 1 });
  const opts = inlineRunOpts(node);
  const linkMark = opts._marks.find((m) => m.type === "link");
  const href = linkMark?.attrs?.href as string | undefined;
  const { _marks, ...runOpts } = opts;
  void _marks;
  if (href) {
    return new ExternalHyperlink({
      link: href,
      children: [new TextRun({ ...runOpts, style: "Hyperlink" })],
    });
  }
  return new TextRun(runOpts);
}

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

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
      const align = ALIGN_MAP[(node.attrs?.textAlign as string) ?? ""];
      const lh = parseFloat(node.attrs?.lineHeight as string);
      return [
        new DocxParagraph({
          heading: headingMap[lvl] ?? HeadingLevel.HEADING_1,
          alignment: align,
          spacing: lh ? { line: Math.round(lh * 240) } : undefined,
          children: children.map(inlineToDocxChild),
        }),
      ];
    }

    case "paragraph": {
      const align = ALIGN_MAP[(node.attrs?.textAlign as string) ?? ""];
      const lh = parseFloat(node.attrs?.lineHeight as string);
      return [
        new DocxParagraph({
          alignment: align,
          spacing: lh ? { line: Math.round(lh * 240) } : undefined,
          children: children.length > 0 ? children.map(inlineToDocxChild) : [new TextRun("")],
        }),
      ];
    }

    case "bulletList":
      return children.flatMap((item) => {
        const inlines = (item.content ?? []).flatMap((p) =>
          (p.content ?? []).map(inlineToDocxChild)
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
          (p.content ?? []).map(inlineToDocxChild)
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
  deps: DocExportDeps,
  pageSettings?: PageSettings
): Promise<void> {
  const { title } = deps;
  try {
    if (format === "docx") {
      const paragraphs = tiptapToDocxParagraphs(deps.json as unknown as TiptapNode);
      const ps = pageSettings ?? DEFAULT_PAGE_SETTINGS;

      // Build header children
      const headerChildren: DocxParagraph[] = [];
      if (ps.headerText) {
        headerChildren.push(new DocxParagraph({ children: [new TextRun({ text: ps.headerText, size: 16, color: "999999" })] }));
      }
      if ((ps.showPageNumbers ?? true) && (ps.pageNumberPosition ?? "footer") === "header") {
        headerChildren.push(new DocxParagraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" })] }));
      }

      // Build footer children
      const footerChildren: DocxParagraph[] = [];
      const footerParts: (TextRun | string)[] = [];
      if (ps.footerText) {
        footerParts.push(new TextRun({ text: ps.footerText, size: 16, color: "999999" }));
      }
      if (footerParts.length > 0) {
        footerChildren.push(new DocxParagraph({ children: footerParts as TextRun[] }));
      }
      if ((ps.showPageNumbers ?? true) && (ps.pageNumberPosition ?? "footer") === "footer") {
        footerChildren.push(new DocxParagraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" })] }));
      }

      const sectionProps: Record<string, unknown> = {
        children: paragraphs.length > 0 ? paragraphs : [new DocxParagraph("")],
      };
      if (headerChildren.length > 0) {
        sectionProps.headers = { default: new Header({ children: headerChildren }) };
      }
      if (footerChildren.length > 0) {
        sectionProps.footers = { default: new Footer({ children: footerChildren }) };
      }

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
        sections: [sectionProps as { children: DocxParagraph[] }],
      });
      await downloadBlob(await Packer.toBlob(docxDoc), `${title}.docx`);
    } else if (format === "pdf") {
      await exportDocumentPDF(deps.json as unknown as TiptapNode, title, pageSettings ?? DEFAULT_PAGE_SETTINGS);
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
// This gives us exact control over page margins, heading page-breaks, and
// inline bold/italic marks while keeping the output as searchable vector text.

const BODY_SIZE  = 11;
const LINE_RATIO = 1.35; // line-height multiplier

interface PdfState {
  doc: jsPDF;
  y: number;
  pageNum: number;
  title: string;
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
  footerY: number;
  headerY: number;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  pageNumberPosition: "header" | "footer";
}

function pdfNewPage(s: PdfState): void {
  pdfFooter(s);
  s.doc.addPage();
  s.pageNum++;
  s.y = s.margin;
  pdfHeader(s);
}

function pdfHeader(s: PdfState): void {
  const { doc, pageNum, margin, pageW, headerY, headerText, showPageNumbers, pageNumberPosition } = s;
  if (!headerText && !(showPageNumbers && pageNumberPosition === "header")) return;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  if (headerText) doc.text(headerText.slice(0, 70), margin, headerY);
  if (showPageNumbers && pageNumberPosition === "header") {
    doc.text(String(pageNum), pageW - margin, headerY, { align: "right" });
  }
  doc.setTextColor(0, 0, 0);
}

function pdfFooter(s: PdfState): void {
  const { doc, pageNum, margin, pageW, footerY, footerText, showPageNumbers, pageNumberPosition } = s;
  const hasFooterText = !!footerText;
  const hasPageNum = showPageNumbers && pageNumberPosition === "footer";
  if (!hasFooterText && !hasPageNum) return;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  if (hasFooterText) doc.text(footerText.slice(0, 70), margin, footerY);
  if (hasPageNum) doc.text(String(pageNum), pageW - margin, footerY, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

/** Ensure `height` pt fits on the current page; otherwise start a new one. */
function pdfNeedSpace(s: PdfState, height: number): void {
  if (s.y + height > s.pageH - s.margin - 40) pdfNewPage(s);
}

// ── Inline token layout ──────────────────────────────────────────────────────

interface PdfToken {
  text: string;
  bold: boolean;
  italic: boolean;
  color?: string;      // CSS hex color, e.g. "#ff0000"
  isBreak?: boolean;   // hard line-break (shift-enter in Tiptap)
  superscript?: boolean;
  subscript?: boolean;
  fontSize?: number;   // explicit pt override from textStyle
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
    const sup    = marks.some((m) => m.type === "superscript");
    const sub    = marks.some((m) => m.type === "subscript");
    // Extract text color and fontSize from textStyle mark if present
    const textStyleMark = marks.find((m) => m.type === "textStyle") as { type: string; attrs?: Record<string, unknown> } | undefined;
    const color = textStyleMark?.attrs?.color as string | undefined;
    const fontSize = textStyleMark?.attrs?.fontSize as number | undefined;
    // Split on whitespace so each word can be individually measured.
    for (const part of (node.text ?? "").split(/(\s+)/)) {
      if (part.length > 0) tokens.push({ text: part, bold, italic, color, superscript: sup || undefined, subscript: sub || undefined, fontSize: fontSize || undefined });
    }
  }
  return tokens;
}

type PdfLine = { segments: PdfToken[] };

/** Compute the effective font size for a token given the base paragraph size. */
function effectiveFontSize(tok: PdfToken, baseFontSize: number): number {
  if (tok.fontSize) return tok.fontSize;
  if (tok.superscript || tok.subscript) return baseFontSize * 0.6;
  return baseFontSize;
}

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
    doc.setFontSize(effectiveFontSize(tok, fontSize));
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
function measureTokenBlock(doc: jsPDF, tokens: PdfToken[], fontSize: number, maxWidth: number, lr = LINE_RATIO): number {
  if (tokens.length === 0) return fontSize * lr * 0.6;
  const lines = layoutLines(doc, tokens, fontSize, maxWidth);
  let total = 0;
  for (const line of lines) {
    let maxSz = fontSize;
    for (const seg of line.segments) {
      const sz = effectiveFontSize(seg, fontSize);
      if (sz > maxSz) maxSz = sz;
    }
    total += maxSz * lr;
  }
  return total || fontSize * lr;
}

/**
 * Render a pre-laid-out list of lines at the current `s.y`.
 * Does NOT call pdfNeedSpace — the caller must do that beforehand.
 */
function renderTokenLines(s: PdfState, lines: PdfLine[], fontSize: number, leftX: number, lr = LINE_RATIO): void {
  const lineH = fontSize * lr;
  if (lines.length === 0 || (lines.length === 1 && lines[0].segments.length === 0)) {
    s.y += lineH * 0.6;
    return;
  }
  for (const line of lines) {
    let x = leftX;
    for (const seg of line.segments) {
      const effSize = effectiveFontSize(seg, fontSize);
      s.doc.setFont("helvetica", pdfFontStyle(seg.bold, seg.italic));
      s.doc.setFontSize(effSize);
      if (seg.color) {
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
      // Vertical offset for superscript / subscript
      let yOff = 0;
      if (seg.superscript) yOff = -fontSize * 0.35;
      else if (seg.subscript) yOff = fontSize * 0.15;
      s.doc.text(seg.text, x, s.y + yOff);
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
  const lr    = parseFloat(node.attrs?.lineHeight as string) || LINE_RATIO;

  // H1 always starts a new page (except when already at the top of a fresh page)
  if (level === 1 && s.y > s.margin + 40) {
    pdfNewPage(s);
  } else {
    s.y += cfg.spaceBefore;
  }

  const text  = (node.content ?? []).map((n) => n.text ?? "").join("");
  const lineH = cfg.size * lr;
  s.doc.setFont("helvetica", "bold");
  s.doc.setFontSize(cfg.size);
  const lines = s.doc.splitTextToSize(text, s.contentW);
  pdfNeedSpace(s, lines.length * lineH + cfg.spaceAfter);
  s.doc.text(lines as string[], s.margin, s.y);
  s.y += (lines as string[]).length * lineH + cfg.spaceAfter;
}

function renderParagraphNode(s: PdfState, node: TiptapNode, indent = 0): void {
  const tokens  = buildTokens(node.content ?? []);
  // Skip empty paragraphs (no text content) to avoid blank leading pages
  if (tokens.length === 0) return;
  const lr      = parseFloat(node.attrs?.lineHeight as string) || LINE_RATIO;
  const maxW    = s.contentW - indent;
  const lines   = layoutLines(s.doc, tokens, BODY_SIZE, maxW);
  const height  = measureTokenBlock(s.doc, tokens, BODY_SIZE, maxW, lr);
  pdfNeedSpace(s, height + 5);
  const textAlign = (node.attrs?.textAlign as string | undefined) ?? "left";
  if (textAlign === "center" || textAlign === "right") {
    // For center/right aligned paragraphs, render each line with jsPDF alignment
    const lineH = BODY_SIZE * lr;
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
          ? s.margin + indent + maxW / 2
          : s.pageW - s.margin;
        s.doc.text(lineText, xPos, s.y, { align: textAlign as "center" | "right" });
        s.doc.setTextColor(0, 0, 0);
        s.y += lineH;
      }
    }
  } else {
    renderTokenLines(s, lines, BODY_SIZE, s.margin + indent, lr);
  }
  s.y += 5; // paragraph spacing
}

function renderBulletList(s: PdfState, node: TiptapNode): void {
  for (const item of node.content ?? []) {
    for (const para of item.content ?? []) {
      const tokens = buildTokens(para.content ?? []);
      const maxW   = s.contentW - 16;
      const lines  = layoutLines(s.doc, tokens, BODY_SIZE, maxW);
      const height = measureTokenBlock(s.doc, tokens, BODY_SIZE, maxW);
      pdfNeedSpace(s, height + 3);
      // Draw bullet at the current y (first line baseline)
      s.doc.setFont("helvetica", "normal");
      s.doc.setFontSize(BODY_SIZE);
      s.doc.text("\u2022", s.margin + 2, s.y);
      renderTokenLines(s, lines, BODY_SIZE, s.margin + 16);
    }
  }
  s.y += 3;
}

function renderOrderedList(s: PdfState, node: TiptapNode): void {
  let num = 1;
  for (const item of node.content ?? []) {
    for (const para of item.content ?? []) {
      const tokens = buildTokens(para.content ?? []);
      const maxW   = s.contentW - 18;
      const lines  = layoutLines(s.doc, tokens, BODY_SIZE, maxW);
      const height = measureTokenBlock(s.doc, tokens, BODY_SIZE, maxW);
      pdfNeedSpace(s, height + 3);
      s.doc.setFont("helvetica", "normal");
      s.doc.setFontSize(BODY_SIZE);
      s.doc.text(`${num}.`, s.margin + 2, s.y);
      renderTokenLines(s, lines, BODY_SIZE, s.margin + 18);
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
  s.doc.line(s.margin + 2, startY - 2, s.margin + 2, s.y - 5);
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
      s.doc.line(s.margin, s.y, s.pageW - s.margin, s.y);
      s.doc.setDrawColor(0, 0, 0);
      s.y += 16;
      break;
    default: break;
  }
}

async function exportDocumentPDF(json: TiptapNode, title: string, ps: PageSettings): Promise<void> {
  const basePt = PAGE_DIMS_PT[ps.size];
  const landscape = ps.orientation === "landscape";
  const pageW = landscape ? basePt.h : basePt.w;
  const pageH = landscape ? basePt.w : basePt.h;
  const margin = MARGIN_PT[ps.margins];
  const contentW = pageW - margin * 2;
  const footerY = pageH - 28;
  const headerY = 20;

  const doc = new jsPDF({
    unit: "pt",
    format: [pageW, pageH],
  });

  const s: PdfState = {
    doc,
    y: margin,
    pageNum: 1,
    title,
    pageW,
    pageH,
    margin,
    contentW,
    footerY,
    headerY,
    headerText: ps.headerText ?? "",
    footerText: ps.footerText ?? "",
    showPageNumbers: ps.showPageNumbers ?? true,
    pageNumberPosition: (ps.pageNumberPosition ?? "footer") as "header" | "footer",
  };

  // Render page 1 header
  pdfHeader(s);

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

  // For CSV/TSV: detect encoding from BOM, otherwise assume UTF-8.
  // SheetJS defaults to Latin-1 for text files which breaks Slovak/Polish/Chinese etc.
  const isCsvLike = ext === "csv" || ext === "tsv";
  const bytes = new Uint8Array(buf);
  const hasUtf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const hasUtf16LeBom = bytes[0] === 0xff && bytes[1] === 0xfe;
  const hasUtf16BeBom = bytes[0] === 0xfe && bytes[1] === 0xff;

  let wb: XLSX.WorkBook;
  if (isCsvLike && !hasUtf8Bom && !hasUtf16LeBom && !hasUtf16BeBom) {
    // No BOM — decode manually as UTF-8 then hand the string to SheetJS
    const text = new TextDecoder("utf-8").decode(buf);
    wb = XLSX.read(text, { type: "string", cellFormula: true, cellStyles: false, cellDates: true });
  } else {
    wb = XLSX.read(buf, { type: "array", cellFormula: true, cellStyles: false, cellDates: true });
  }

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

/** Convert a Tiptap JSON node to a plain Markdown string (no editor required). */
function tiptapNodeToMd(node: TiptapNode, ctx: { listType?: "bullet" | "ordered"; index?: number } = {}): string {
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

function tiptapInlineMd(node: TiptapNode): string {
  if (node.type === "hardBreak") return "  \n";
  const text = node.text ?? node.content?.map(tiptapInlineMd).join("") ?? "";
  const marks = node.marks ?? [];
  let out = text;
  if (marks.some((m) => m.type === "subscript")) out = `<sub>${out}</sub>`;
  if (marks.some((m) => m.type === "superscript")) out = `<sup>${out}</sup>`;
  if (marks.some((m) => m.type === "italic")) out = `_${out}_`;
  if (marks.some((m) => m.type === "bold")) out = `**${out}**`;
  if (marks.some((m) => m.type === "strike")) out = `~~${out}~~`;
  const linkMark = marks.find((m) => m.type === "link") as { type: string; attrs?: Record<string, unknown> } | undefined;
  if (linkMark?.attrs?.href) out = `[${out}](${linkMark.attrs.href})`;
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
      const md = tiptapNodeToMd(doc.content_json as unknown as TiptapNode);
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
