/**
 * DOM measurement for ProseMirror blocks.
 * Reads block positions from the editor DOM and returns clean measurements
 * with any engine-applied margin-top decorations subtracted out.
 */

import type { EditorView } from "@tiptap/pm/view";
import { DecorationSet } from "@tiptap/pm/view";
import type { BlockMeasurement } from "./computePages";

/**
 * Extract known margin-top values from existing node decorations.
 * These are the margins the page engine applied on the previous cycle.
 */
export function readAppliedMargins(decos: DecorationSet): Map<number, number> {
  const margins = new Map<number, number>();
  decos.find().forEach((d) => {
    const attrs = (
      d as unknown as { type?: { attrs?: Record<string, string> } }
    ).type?.attrs;
    if (attrs?.style) {
      const m = /margin-top:\s*([\d.]+)px/.exec(attrs.style);
      if (m) margins.set(d.from, parseFloat(m[1]));
    }
  });
  return margins;
}

/**
 * Measure all top-level ProseMirror blocks and return clean positions
 * (with engine-applied margins subtracted).
 */
export function measureBlocks(
  view: EditorView,
  knownMargins: Map<number, number>,
): BlockMeasurement[] {
  const baseTop = (view.dom as HTMLElement).offsetTop;
  const doc = view.state.doc;
  let cumulativeShift = 0;
  const blocks: BlockMeasurement[] = [];

  doc.forEach((node, offset) => {
    const domNode = view.nodeDOM(offset);
    if (!domNode || !(domNode instanceof HTMLElement)) return;

    const appliedMargin = knownMargins.get(offset) ?? 0;
    cumulativeShift += appliedMargin;

    blocks.push({
      offset,
      top: domNode.offsetTop - baseTop - cumulativeShift,
      height: domNode.offsetHeight,
      nodeSize: node.nodeSize,
    });
  });

  return blocks;
}
