/**
 * Markdown Task Parsing and Manipulation Utility
 */

export interface MarkdownTask {
  id: string;      // Unique ID for the task instance in this string
  text: string;    // Task content
  completed: boolean;
  lineIndex: number; // Line number in the original string
  original: string; // Original line text
}

/**
 * Parses a markdown string and identifies task list items like "- [ ] task" or "* [x] done".
 */
export function parseMarkdownTasks(markdown: string): MarkdownTask[] {
  if (!markdown) return [];
  
  const lines = markdown.split("\n");
  const tasks: MarkdownTask[] = [];
  
  // Matches "- [ ] ", "* [ ] ", "- [x] ", "* [X] " at the start of a line (with optional indentation)
  const taskRegex = /^\s*[-*]\s*\[([ xX])\]\s*(.*)$/;
  
  lines.forEach((line, index) => {
    const match = line.match(taskRegex);
    if (match) {
      tasks.push({
        id: `task-${index}`,
        text: match[2].trim(),
        completed: match[1].toLowerCase() === "x",
        lineIndex: index,
        original: line,
      });
    }
  });
  
  return tasks;
}

/**
 * Toggles a markdown task checkbox at the specified line index.
 * Uses direct string index manipulation to avoid split/join on the entire document.
 */
export function toggleMarkdownTask(markdown: string, lineIndex: number): string {
  if (!markdown) return markdown;

  // Find the start offset of the target line without splitting the whole string
  let lineStart = 0;
  for (let i = 0; i < lineIndex; i++) {
    const next = markdown.indexOf("\n", lineStart);
    if (next === -1) return markdown; // lineIndex out of bounds
    lineStart = next + 1;
  }
  const lineEnd = markdown.indexOf("\n", lineStart);
  const line = lineEnd === -1 ? markdown.slice(lineStart) : markdown.slice(lineStart, lineEnd);

  const taskRegex = /^(\s*[-*]\s*\[)([ xX])(\]\s*.*)$/;
  const match = line.match(taskRegex);
  if (!match) return markdown;

  const currentChecked = match[2].toLowerCase() === "x";
  const newChecked = currentChecked ? " " : "x";
  // match[1].length gives offset of the bracket character within the line
  const bracketOffset = lineStart + match[1].length;

  return markdown.slice(0, bracketOffset) + newChecked + markdown.slice(bracketOffset + 1);
}

/**
 * Updates a specific task's completion state in markdown.
 * Uses direct string index manipulation to avoid split/join on the entire document.
 */
export function setMarkdownTaskState(markdown: string, lineIndex: number, completed: boolean): string {
  if (!markdown) return markdown;

  let lineStart = 0;
  for (let i = 0; i < lineIndex; i++) {
    const next = markdown.indexOf("\n", lineStart);
    if (next === -1) return markdown;
    lineStart = next + 1;
  }
  const lineEnd = markdown.indexOf("\n", lineStart);
  const line = lineEnd === -1 ? markdown.slice(lineStart) : markdown.slice(lineStart, lineEnd);

  const taskRegex = /^(\s*[-*]\s*\[)([ xX])(\]\s*.*)$/;
  const match = line.match(taskRegex);
  if (!match) return markdown;

  const newChecked = completed ? "x" : " ";
  const bracketOffset = lineStart + match[1].length;

  return markdown.slice(0, bracketOffset) + newChecked + markdown.slice(bracketOffset + 1);
}
