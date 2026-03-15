/**
 * Hook that manages page count based on editor content height,
 * and tracks the current visible page from scroll position.
 *
 * The page count drives the CSS column layout in PageContainer.
 * ProseMirror's scrollHeight gives the unfragmented content height,
 * which we divide by the per-page content zone height.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import type { PageSettings } from "../config/pageSettings";
import {
  PAGE_GAP,
  getPageDims,
  getMarginPx,
} from "../config/pageSettings";

export function usePagination(pageSettings: PageSettings, editor: Editor | null) {
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const rafId = useRef(0);

  const dims = getPageDims(pageSettings);
  const margin = getMarginPx(pageSettings);
  const pageH = dims.h;
  const contentH = pageH - 2 * margin;
  const gap = PAGE_GAP;
  const slotSize = pageH + gap;

  // Observe editor DOM height → compute page count
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom as HTMLElement;

    const update = () => {
      // scrollHeight = unfragmented content height (unaffected by CSS columns)
      const docHeight = dom.scrollHeight;
      // Add small buffer to avoid clipping content at exact boundary
      const pages = Math.max(1, Math.ceil((docHeight + 2) / contentH));
      setPageCount(pages);
    };

    // Initial measurement after fonts load
    update();
    document.fonts.ready.then(update);

    const ro = new ResizeObserver(update);
    ro.observe(dom);

    return () => {
      ro.disconnect();
    };
  }, [editor, contentH]);

  // Scroll handler: determine current page from scroll position
  const handleEditorScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      cancelAnimationFrame(rafId.current);
      const target = e.target as HTMLDivElement;
      rafId.current = requestAnimationFrame(() => {
        const scrollTop = target.scrollTop;
        const page = Math.max(1, Math.floor(scrollTop / slotSize) + 1);
        setCurrentPage(page);
      });
    },
    [slotSize],
  );

  return {
    pageCount,
    currentPage,
    handleEditorScroll,
  };
}
