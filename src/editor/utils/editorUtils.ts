/**
 * Editor utility functions — outline extraction, HTML parsing, AI block parsing.
 */

import type { Editor } from "@tiptap/react";
import { DOMParser as PmDOMParser } from "@tiptap/pm/model";
import type { Schema, Node as PmNode } from "@tiptap/pm/model";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OutlineItem {
  level: number;
  text: string;
  pos: number;
}

export interface SuggestionBlock {
  title: string;
  description: string;
  html: string;
}

// ── Outline extraction ───────────────────────────────────────────────────────

export function extractOutline(editor: Editor | null): OutlineItem[] {
  if (!editor) return [];
  const items: OutlineItem[] = [];
  editor.state.doc.descendants((node: PmNode, pos: number) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level as number;
      if (level >= 1 && level <= 3) {
        items.push({ level, text: node.textContent, pos });
      }
    }
  });
  return items;
}

// ── HTML → ProseMirror ───────────────────────────────────────────────────────

/** Parse an HTML string into ProseMirror nodes using the editor's schema. */
export function htmlToFragment(schema: Schema, html: string) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  return PmDOMParser.fromSchema(schema).parse(wrapper);
}

// ── AI HTML → presentable blocks ─────────────────────────────────────────────

const TAG_LABELS: Record<string, string> = {
  H1: "Heading 1",
  H2: "Heading 2",
  H3: "Heading 3",
  P: "Paragraph",
  UL: "Bullet List",
  OL: "Numbered List",
  BLOCKQUOTE: "Blockquote",
  LI: "List Item",
};

export function parseHtmlToBlocks(html: string): SuggestionBlock[] {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const blocks: SuggestionBlock[] = [];
  for (let i = 0; i < wrapper.children.length; i++) {
    const el = wrapper.children[i] as HTMLElement;
    const tag = el.tagName;
    const title = TAG_LABELS[tag] ?? tag.toLowerCase();
    const text = el.textContent ?? "";
    const description = text.length > 80 ? text.slice(0, 80) + "..." : text;
    blocks.push({ title, description, html: el.outerHTML });
  }
  if (blocks.length === 0 && html.trim()) {
    const text = wrapper.textContent ?? "";
    blocks.push({
      title: "Text",
      description: text.length > 80 ? text.slice(0, 80) + "..." : text,
      html,
    });
  }
  return blocks;
}
