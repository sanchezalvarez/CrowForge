/**
 * pageSettings.ts
 *
 * Shared page-size/orientation/margin types and dimension tables.
 * Imported by DocumentsPage (editor preview) and fileService (PDF export).
 */

export type PageSize = "a4" | "letter" | "legal" | "a5";
export type PageOrientation = "portrait" | "landscape";
export type PageMargins = "normal" | "narrow" | "wide";

export interface PageSettings {
  size: PageSize;
  orientation: PageOrientation;
  margins: PageMargins;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  pageNumberPosition: "header" | "footer";
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: "a4",
  orientation: "portrait",
  margins: "normal",
  headerText: "",
  footerText: "",
  showPageNumbers: true,
  pageNumberPosition: "footer",
};

/** Height in px reserved for header/footer rendering within margins. */
export const HEADER_FOOTER_HEIGHT = 28;

// Page dimensions in pixels at 96 DPI (portrait baseline)
const PAGE_DIMS_PX_PORTRAIT: Record<PageSize, { w: number; h: number }> = {
  a4:     { w: 794,  h: 1123 },
  letter: { w: 816,  h: 1056 },
  legal:  { w: 816,  h: 1344 },
  a5:     { w: 559,  h: 794  },
};

// Page dimensions in PDF points (portrait baseline)
export const PAGE_DIMS_PT: Record<PageSize, { w: number; h: number }> = {
  a4:     { w: 595.28, h: 841.89 },
  letter: { w: 612.00, h: 792.00 },
  legal:  { w: 612.00, h: 1008.00 },
  a5:     { w: 419.53, h: 595.28 },
};

// Margin presets in pixels (at 96 DPI)
export const MARGIN_PX: Record<PageMargins, number> = {
  normal: 95,   // ~25 mm
  narrow: 47,   // ~12.5 mm
  wide:   144,  // ~38 mm
};

// Margin presets in PDF points
export const MARGIN_PT: Record<PageMargins, number> = {
  normal: 71,
  narrow: 35,
  wide:   108,
};

/** Return page pixel dimensions accounting for orientation. */
export function getPageDims(settings: PageSettings): { w: number; h: number } {
  const base = PAGE_DIMS_PX_PORTRAIT[settings.size];
  if (settings.orientation === "landscape") {
    return { w: base.h, h: base.w };
  }
  return { w: base.w, h: base.h };
}

/** Return the margin in pixels for the given settings. */
export function getMarginPx(settings: PageSettings): number {
  return MARGIN_PX[settings.margins];
}
