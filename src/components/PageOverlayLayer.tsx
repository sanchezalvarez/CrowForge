/**
 * PageOverlayLayer.tsx
 *
 * Renders page background elements (white rectangles with shadows,
 * headers, and footers) as an absolutely-positioned overlay behind
 * the editor content. The column layout on the editor layer ensures
 * content only appears in content zones, so headers/footers in the
 * margin areas are always visible.
 *
 * When a `visibleRange` is provided, pages outside the viewport are
 * rendered as lightweight placeholders (position + size only, no
 * shadow / header / footer children) for O(visible) rendering cost.
 */

import React from "react";

interface PageOverlayLayerProps {
  totalPages: number;
  pageW: number;
  pageH: number;
  gap: number;
  margin: number;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  pageNumberPosition: "header" | "footer";
  visibleRange?: { startPage: number; endPage: number };
}

function PageOverlayLayerInner({
  totalPages,
  pageW,
  pageH,
  gap,
  margin,
  headerText,
  footerText,
  showPageNumbers,
  pageNumberPosition,
  visibleRange,
}: PageOverlayLayerProps) {
  if (totalPages <= 0) return null;

  const slotH = pageH + gap;
  const hasHeader = headerText || (showPageNumbers && pageNumberPosition === "header");
  const hasFooter = footerText || (showPageNumbers && pageNumberPosition === "footer");

  const pages = [];
  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;

    // If visibleRange is provided, render lightweight placeholder for off-screen pages
    const isVisible = !visibleRange || (pageNum >= visibleRange.startPage && pageNum <= visibleRange.endPage);

    if (!isVisible) {
      pages.push(
        <div
          key={i}
          style={{
            position: "absolute",
            top: i * slotH,
            left: "50%",
            transform: "translateX(-50%)",
            width: pageW,
            height: pageH,
          }}
        />,
      );
      continue;
    }

    pages.push(
      <div
        key={i}
        className="page-background"
        style={{
          position: "absolute",
          top: i * slotH,
          left: "50%",
          transform: "translateX(-50%)",
          width: pageW,
          height: pageH,
          background: "white",
          boxShadow: "0 1px 8px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.08)",
          borderRadius: 2,
        }}
      >
        {/* Header */}
        {hasHeader && (
          <div
            style={{
              position: "absolute",
              top: margin * 0.25,
              left: margin,
              right: margin,
              fontSize: 9,
              color: "hsl(var(--muted-foreground))",
              display: "flex",
              justifyContent: "space-between",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <span>{headerText}</span>
            {showPageNumbers && pageNumberPosition === "header" && (
              <span>{pageNum}</span>
            )}
          </div>
        )}

        {/* Footer */}
        {hasFooter && (
          <div
            style={{
              position: "absolute",
              bottom: margin * 0.25,
              left: margin,
              right: margin,
              fontSize: 9,
              color: "hsl(var(--muted-foreground))",
              display: "flex",
              justifyContent: "space-between",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <span>{footerText}</span>
            {showPageNumbers && pageNumberPosition === "footer" && (
              <span>{pageNum}</span>
            )}
          </div>
        )}
      </div>,
    );
  }

  return <>{pages}</>;
}

export const PageOverlayLayer = React.memo(PageOverlayLayerInner);
