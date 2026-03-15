/**
 * PageContainer — column-based page layout.
 *
 * Uses CSS multi-column with `writing-mode: vertical-lr` to create
 * vertically-stacked columns. Each column is one page's content zone.
 * Text automatically flows from one page to the next when the content
 * zone height (pageH - 2*margin) is exceeded — like Microsoft Word.
 *
 * Structure:
 *   Z-1: Page backgrounds (white + shadow + headers/footers)
 *   Z-2: Column-based editor content (automatic page flow)
 *
 * The column layout fragments ProseMirror's content across pages at
 * the CSS level. ProseMirror remains a single continuous document.
 */

import type { ReactNode } from "react";
import type { PageSettings } from "../config/pageSettings";
import { getPageDims, getMarginPx, PAGE_GAP } from "../config/pageSettings";
import { PageOverlayLayer } from "../../components/PageOverlayLayer";

interface PageContainerProps {
  pageSettings: PageSettings;
  pageCount: number;
  children: ReactNode;
  visibleRange?: { startPage: number; endPage: number };
}

export function PageContainer({
  pageSettings,
  pageCount,
  children,
  visibleRange,
}: PageContainerProps) {
  const dims = getPageDims(pageSettings);
  const margin = getMarginPx(pageSettings);
  const gap = PAGE_GAP;
  const contentH = dims.h - 2 * margin;
  const gutter = 2 * margin + gap;
  const totalHeight = pageCount * dims.h + Math.max(0, pageCount - 1) * gap;

  // Column content area height: N columns of contentH with (N-1) gutters
  const columnAreaHeight = pageCount * contentH + Math.max(0, pageCount - 1) * gutter;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: ${pageSettings.size} ${pageSettings.orientation};
            margin: ${pageSettings.margins === "normal" ? "25mm" : pageSettings.margins === "narrow" ? "12.5mm" : "38mm"};
          }
          .page-background { box-shadow: none !important; }
          .page-column-container {
            writing-mode: horizontal-tb !important;
            columns: unset !important;
            column-gap: unset !important;
            height: auto !important;
            padding: 0 !important;
          }
          .page-column-inner { writing-mode: horizontal-tb !important; }
        }
      `}</style>

      <div
        className="page-root"
        style={{
          position: "relative",
          width: "100%",
          minHeight: totalHeight,
        }}
      >
        {/* Z-1: Page backgrounds with headers/footers */}
        <div
          className="page-overlay"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: totalHeight,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <PageOverlayLayer
            totalPages={pageCount}
            pageW={dims.w}
            pageH={dims.h}
            gap={gap}
            margin={margin}
            headerText={pageSettings.headerText ?? ""}
            footerText={pageSettings.footerText ?? ""}
            showPageNumbers={pageSettings.showPageNumbers ?? true}
            pageNumberPosition={pageSettings.pageNumberPosition ?? "footer"}
            visibleRange={visibleRange}
          />
        </div>

        {/* Z-2: Column-based editor content */}
        <div
          className="page-column-container"
          style={{
            position: "relative",
            zIndex: 2,
            /* vertical-lr makes CSS columns stack vertically (top-to-bottom)
               instead of the default horizontal (left-to-right). */
            writingMode: "vertical-lr",
            /* Each column = one page's content zone height */
            columnWidth: `${contentH}px`,
            columnGap: `${gutter}px`,
            columnFill: "auto",
            /* Physical dimensions */
            width: contentH > 0 ? `${dims.w - 2 * margin}px` : undefined,
            height: `${columnAreaHeight}px`,
            padding: `${margin}px`,
            boxSizing: "content-box",
            margin: "0 auto",
          }}
        >
          {/* Inner wrapper resets writing-mode for normal horizontal text */}
          <div
            className="page-column-inner"
            style={{
              writingMode: "horizontal-tb",
              width: "100%",
              minHeight: `${contentH}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
