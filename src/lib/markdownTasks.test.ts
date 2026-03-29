import { describe, it, expect } from "vitest";
import { parseMarkdownTasks, toggleMarkdownTask, setMarkdownTaskState } from "./markdownTasks";

describe("Markdown Task Parsing", () => {
  it("should parse multiple tasks with different formats", () => {
    const markdown = `
# Project Plan
- [ ] Task 1
* [x] Task 2 (done)
  - [ ] Indented task
- [X] Task with capital X
    `;
    const tasks = parseMarkdownTasks(markdown);
    
    expect(tasks).toHaveLength(4);
    expect(tasks[0].text).toBe("Task 1");
    expect(tasks[0].completed).toBe(false);
    expect(tasks[1].text).toBe("Task 2 (done)");
    expect(tasks[1].completed).toBe(true);
    expect(tasks[2].text).toBe("Indented task");
    expect(tasks[3].text).toBe("Task with capital X");
    expect(tasks[3].completed).toBe(true);
  });

  it("should handle empty strings and strings without tasks", () => {
    expect(parseMarkdownTasks("")).toEqual([]);
    expect(parseMarkdownTasks("Just some regular text\nNo tasks here")).toEqual([]);
    expect(parseMarkdownTasks("- [] invalid task format")).toEqual([]);
  });

  it("should handle weird characters and multiple spaces", () => {
    const markdown = "- [ ] Task with *formatting* and [links](url)\n- [ ]    Task with extra leading spaces";
    const tasks = parseMarkdownTasks(markdown);
    
    expect(tasks[0].text).toBe("Task with *formatting* and [links](url)");
    expect(tasks[1].text).toBe("Task with extra leading spaces");
  });
});

describe("Markdown Task Toggling", () => {
  it("should toggle task from unchecked to checked", () => {
    const markdown = "- [ ] Task 1\n- [x] Task 2";
    const result = toggleMarkdownTask(markdown, 0); // Toggle Task 1
    
    expect(result).toBe("- [x] Task 1\n- [x] Task 2");
  });

  it("should toggle task from checked to unchecked", () => {
    const markdown = "- [ ] Task 1\n- [x] Task 2";
    const result = toggleMarkdownTask(markdown, 1); // Toggle Task 2
    
    expect(result).toBe("- [ ] Task 1\n- [ ] Task 2");
  });

  it("should do nothing if line index is out of bounds or not a task", () => {
    const markdown = "Regular line\n- [ ] Task";
    expect(toggleMarkdownTask(markdown, 0)).toBe(markdown); // Line 0 is regular text
    expect(toggleMarkdownTask(markdown, 10)).toBe(markdown); // Out of bounds
  });
});

describe("Set Markdown Task State", () => {
  it("should set task state correctly", () => {
    const markdown = "- [ ] Task 1\n- [x] Task 2";
    
    // Set already unchecked to unchecked
    expect(setMarkdownTaskState(markdown, 0, false)).toBe(markdown);
    
    // Set unchecked to checked
    expect(setMarkdownTaskState(markdown, 0, true)).toBe("- [x] Task 1\n- [x] Task 2");
    
    // Set checked to unchecked
    expect(setMarkdownTaskState(markdown, 1, false)).toBe("- [ ] Task 1\n- [ ] Task 2");
  });
});
