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
 */
export function toggleMarkdownTask(markdown: string, lineIndex: number): string {
  if (!markdown) return markdown;
  
  const lines = markdown.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return markdown;
  
  const line = lines[lineIndex];
  const taskRegex = /^(\s*[-*]\s*\[)([ xX])(\]\s*.*)$/;
  const match = line.match(taskRegex);
  
  if (!match) return markdown;
  
  const currentChecked = match[2].toLowerCase() === "x";
  const newChecked = currentChecked ? " " : "x";
  
  lines[lineIndex] = `${match[1]}${newChecked}${match[3]}`;
  
  return lines.join("\n");
}

/**
 * Updates a specific task's completion state in markdown.
 */
export function setMarkdownTaskState(markdown: string, lineIndex: number, completed: boolean): string {
  if (!markdown) return markdown;
  
  const lines = markdown.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return markdown;
  
  const line = lines[lineIndex];
  const taskRegex = /^(\s*[-*]\s*\[)([ xX])(\]\s*.*)$/;
  const match = line.match(taskRegex);
  
  if (!match) return markdown;
  
  const newChecked = completed ? "x" : " ";
  lines[lineIndex] = `${match[1]}${newChecked}${match[3]}`;
  
  return lines.join("\n");
}
