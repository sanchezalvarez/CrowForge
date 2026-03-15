/**
 * ProseMirror plugin for the virtual page engine.
 *
 * Measures top-level blocks, computes page breaks via computePageLayout,
 * and applies Decoration.node margin-top to push blocks across boundaries.
 * Visual page chrome is handled by PageOverlayLayer (React).
 */

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DecorationSet, Decoration } from "@tiptap/pm/view";
import type { PageEngineSettings } from "../config/pageSettings";
import type { PageLayout } from "./computePages";
import { computePageLayout } from "./computePages";
import { measureBlocks, readAppliedMargins } from "./measureBlocks";
import { findScrollParent } from "../utils/domUtils";

export const pageEngineKey = new PluginKey("pageEngine");

export function createPageEnginePlugin(
  getSettings: () => PageEngineSettings,
  onLayoutChange: (layout: PageLayout) => void,
) {
  let currentDecos = DecorationSet.empty;

  return new Plugin({
    key: pageEngineKey,
    props: {
      decorations() {
        return currentDecos;
      },
    },
    view(editorView) {
      let rafId = 0;
      let debounceTimer = 0;
      let lastKey = "";
      let applying = false;
      let destroyed = false;
      let lastBlockCount = 0;
      let cachedDocSize = -1;
      let cachedBlocks: ReturnType<typeof measureBlocks> | null = null;

      const recalc = () => {
        if (applying) return;
        const settings = getSettings();
        const { pageContentH, gutter } = settings;
        const slotSize = pageContentH + gutter;

        const scrollParent = findScrollParent(
          editorView.dom.parentElement as HTMLElement | null,
        );
        const savedScrollTop = scrollParent?.scrollTop ?? 0;

        // Measure blocks with previous-cycle margins subtracted
        // Cache: skip re-measurement if doc size unchanged (pure scroll / no edit)
        const docSize = editorView.state.doc.content.size;
        const knownMargins = readAppliedMargins(currentDecos);
        let blocks: ReturnType<typeof measureBlocks>;
        if (docSize === cachedDocSize && cachedBlocks) {
          blocks = cachedBlocks;
        } else {
          blocks = measureBlocks(editorView, knownMargins);
          cachedDocSize = docSize;
          cachedBlocks = blocks;
        }

        lastBlockCount = blocks.length;

        // Compute page layout
        const layout = computePageLayout(blocks, pageContentH, gutter);

        // Dedupe — skip if nothing changed
        const posKey = layout.breaks
          .map((b) => `${b.blockOffset}:${b.marginTop}`)
          .join(",");
        if (posKey === lastKey) return;
        lastKey = posKey;

        // Build Decoration.node for each break (margin-top to push block down)
        const doc = editorView.state.doc;
        const decorations: Decoration[] = [];
        for (const brk of layout.breaks) {
          decorations.push(
            Decoration.node(
              brk.blockOffset,
              brk.blockOffset + brk.blockNodeSize,
              {
                style: `margin-top: ${brk.marginTop}px`,
                class: "page-engine-shifted",
              },
            ),
          );
        }

        // Performance: content-visibility for off-screen blocks in long documents
        if (scrollParent && blocks.length > 40) {
          const scrollTop = scrollParent.scrollTop;
          const viewportH = scrollParent.clientHeight;
          const twoPages = 2 * slotSize;
          let totalShift = 0;
          let breakIdx = 0;
          for (const block of blocks) {
            if (
              breakIdx < layout.breaks.length &&
              layout.breaks[breakIdx].blockOffset === block.offset
            ) {
              totalShift += layout.breaks[breakIdx].marginTop;
              breakIdx++;
            }
            const adjustedTop = block.top + totalShift;
            const offScreen =
              adjustedTop + block.height < scrollTop - twoPages ||
              adjustedTop > scrollTop + viewportH + twoPages;
            if (offScreen) {
              const pmNode = doc.nodeAt(block.offset);
              if (pmNode) {
                decorations.push(
                  Decoration.node(
                    block.offset,
                    block.offset + pmNode.nodeSize,
                    {
                      style: `content-visibility:auto;contain-intrinsic-size:auto ${block.height}px;`,
                    },
                  ),
                );
              }
            }
          }
        }

        applying = true;
        currentDecos = DecorationSet.create(doc, decorations);
        editorView.updateState(editorView.state);
        applying = false;

        // Restore scroll after decoration update
        if (scrollParent) scrollParent.scrollTop = savedScrollTop;

        // Notify React of layout changes
        onLayoutChange(layout);
      };

      const scheduleRecalc = () => {
        if (applying) return;
        cancelAnimationFrame(rafId);
        clearTimeout(debounceTimer);
        // Invalidate block cache on structural changes
        cachedDocSize = -1;
        cachedBlocks = null;
        const delay = lastBlockCount > 200 ? 400 : lastBlockCount > 100 ? 300 : 200;
        debounceTimer = window.setTimeout(() => {
          rafId = requestAnimationFrame(recalc);
        }, delay);
      };

      const scheduleImmediate = () => {
        if (applying) return;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(recalc);
      };

      const ro = new ResizeObserver(scheduleRecalc);
      ro.observe(editorView.dom);
      window.addEventListener("resize", scheduleRecalc);

      scheduleImmediate();
      document.fonts.ready.then(() => {
        if (!destroyed) scheduleImmediate();
      });

      return {
        update: scheduleRecalc,
        destroy() {
          destroyed = true;
          cancelAnimationFrame(rafId);
          clearTimeout(debounceTimer);
          ro.disconnect();
          window.removeEventListener("resize", scheduleRecalc);
        },
      };
    },
  });
}
