/**
 * Hook that tracks which pages are currently visible in the scroll viewport.
 * Uses RAF throttling to avoid layout thrashing on scroll.
 *
 * Returns { startPage, endPage } (1-indexed, inclusive) with configurable
 * overscan so that nearby off-screen pages are pre-rendered.
 */

import { useState, useCallback, useRef } from "react";

export interface ViewportPages {
  /** First visible page (1-indexed), minus overscan */
  startPage: number;
  /** Last visible page (1-indexed), plus overscan */
  endPage: number;
}

const DEFAULT_OVERSCAN = 2;

export function useViewportPages(
  pageContentH: number,
  gutter: number,
  totalPages: number,
  overscan = DEFAULT_OVERSCAN,
) {
  const [viewport, setViewport] = useState<ViewportPages>({
    startPage: 1,
    endPage: Math.min(totalPages, 1 + 2 * overscan),
  });

  const rafId = useRef(0);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      cancelAnimationFrame(rafId.current);
      const target = e.target as HTMLDivElement;

      rafId.current = requestAnimationFrame(() => {
        const scrollTop = target.scrollTop;
        const viewportH = target.clientHeight;
        const slotSize = pageContentH + gutter;

        if (slotSize <= 0) return;

        // Which pages are visible?
        const rawStart = Math.floor(scrollTop / slotSize) + 1;
        const rawEnd = Math.floor((scrollTop + viewportH) / slotSize) + 1;

        const start = Math.max(1, rawStart - overscan);
        const end = Math.min(totalPages, rawEnd + overscan);

        setViewport((prev) => {
          if (prev.startPage === start && prev.endPage === end) return prev;
          return { startPage: start, endPage: end };
        });
      });
    },
    [pageContentH, gutter, totalPages, overscan],
  );

  return { viewport, handleViewportScroll: handleScroll };
}
