import { describe, it, expect, vi } from "vitest";
import { parseHtmlToBlocks } from "./editorUtils";

// Mock document for JSDOM environment
describe("Editor Utilities - HTML Block Parsing", () => {
  it("should parse multiple tags into separate blocks", () => {
    const html = "<h1>Title</h1><p>Paragraph 1</p><ul><li>Item</li></ul>";
    const blocks = parseHtmlToBlocks(html);
    
    expect(blocks).toHaveLength(3);
    expect(blocks[0].title).toBe("Heading 1");
    expect(blocks[0].description).toBe("Title");
    expect(blocks[1].title).toBe("Paragraph");
    expect(blocks[1].description).toBe("Paragraph 1");
    expect(blocks[2].title).toBe("Bullet List");
  });

  it("should truncate long descriptions", () => {
    const longText = "A".repeat(100);
    const html = `<p>${longText}</p>`;
    const blocks = parseHtmlToBlocks(html);
    
    expect(blocks[0].description).toHaveLength(83); // 80 chars + "..."
    expect(blocks[0].description).toContain("...");
  });

  it("should handle plain text without tags", () => {
    const text = "Just some plain text";
    const blocks = parseHtmlToBlocks(text);
    
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe("Text");
    expect(blocks[0].description).toBe(text);
  });

  it("should handle empty strings", () => {
    expect(parseHtmlToBlocks("")).toEqual([]);
  });
});
