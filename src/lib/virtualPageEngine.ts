/**
 * virtualPageEngine.ts
 *
 * Pure layout computation for the virtual page engine.
 * No DOM manipulation — just data in, data out.
 */

export interface BlockMeasurement {
  /** ProseMirror document offset of the top-level node */
  offset: number;
  /** Pixel top relative to editor container (without engine-applied shifts) */
  top: number;
  /** Pixel height of the block */
  height: number;
  /** ProseMirror nodeSize for Decoration.node ranges */
  nodeSize: number;
}

export interface PageBreak {
  /** 1-indexed page number that starts below this break */
  pageBelow: number;
  /** PM offset of the first block on the new page */
  blockOffset: number;
  /** nodeSize of that block (for Decoration.node range) */
  blockNodeSize: number;
  /** The margin-top (px) to apply to push this block to the next page */
  marginTop: number;
  /** Y position (in clean content coords) where the page above ends its content zone */
  contentZoneEnd: number;
}

export interface PageLayout {
  totalPages: number;
  breaks: PageBreak[];
  /** Cumulative shift applied up to each break (for scroll→page mapping) */
  shifts: number[];
}

/**
 * Given measured blocks and page dimensions, compute where page breaks occur.
 *
 * @param blocks - measured top-level blocks (clean positions, no engine shifts)
 * @param pageContentH - usable content height per page (pageH - 2*margin)
 * @param gutter - total dead zone between pages (2*margin + gap)
 */
export function computePageLayout(
  blocks: BlockMeasurement[],
  pageContentH: number,
  gutter: number,
): PageLayout {
  const slotSize = pageContentH + gutter;
  const breaks: PageBreak[] = [];
  let totalShift = 0;

  for (const block of blocks) {
    const adjustedTop = block.top + totalShift;
    const adjustedBottom = adjustedTop + block.height;
    const topPage = Math.floor(adjustedTop / slotSize);
    const pageContentEnd = topPage * slotSize + pageContentH;

    if (adjustedBottom > pageContentEnd && adjustedTop > 0) {
      const remaining = pageContentEnd - adjustedTop;
      const marginTop = remaining + gutter;
      breaks.push({
        pageBelow: topPage + 2, // 1-indexed: page above is topPage+1, below is topPage+2
        blockOffset: block.offset,
        blockNodeSize: block.nodeSize,
        marginTop,
        contentZoneEnd: pageContentEnd,
      });
      totalShift += marginTop;
    }
  }

  const shifts = breaks.map((_, i) =>
    breaks.slice(0, i + 1).reduce((sum, b) => sum + b.marginTop, 0),
  );

  return {
    totalPages: breaks.length > 0 ? breaks[breaks.length - 1].pageBelow : 1,
    breaks,
    shifts,
  };
}

/**
 * Given a scroll position, determine the current visible page number.
 */
export function scrollToPage(
  scrollTop: number,
  pageContentH: number,
  gutter: number,
): number {
  const slotSize = pageContentH + gutter;
  return Math.max(1, Math.floor(scrollTop / slotSize) + 1);
}
