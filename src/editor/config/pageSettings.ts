/**
 * Editor-specific page settings constants.
 * Re-exports shared types from lib/pageSettings.
 */

export {
  type PageSettings,
  type PageSize,
  type PageOrientation,
  type PageMargins,
  DEFAULT_PAGE_SETTINGS,
  HEADER_FOOTER_HEIGHT,
  MARGIN_PX,
  MARGIN_PT,
  PAGE_DIMS_PT,
  getPageDims,
  getMarginPx,
} from "../../lib/pageSettings";

/** Pixel gap between pages in the editor scroll view. */
export const PAGE_GAP = 80;

/** Runtime settings passed to the page engine plugin. */
export interface PageEngineSettings {
  pageH: number;
  margin: number;
  pageContentH: number;
  gutter: number;
}

/** Build PageEngineSettings from a PageSettings object. */
export function buildEngineSettings(
  pageH: number,
  margin: number,
): PageEngineSettings {
  return {
    pageH,
    margin,
    pageContentH: pageH - 2 * margin,
    gutter: 2 * margin + PAGE_GAP,
  };
}
