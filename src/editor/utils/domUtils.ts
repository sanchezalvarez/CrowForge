/**
 * DOM utility helpers for the editor.
 */

/** Walk up the DOM tree to find the nearest scrollable ancestor. */
export function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el;
  while (node) {
    const ov = getComputedStyle(node).overflowY;
    if (ov === "auto" || ov === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}
