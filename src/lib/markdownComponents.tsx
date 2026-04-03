import React from "react";
import { CodeBlock } from "../components/CodeBlock";

export function createMarkdownComponents(isDark: boolean) {
  return {
    code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const isBlock = match || codeString.includes("\n");
      if (isBlock) {
        return (
          <CodeBlock
            code={codeString}
            language={match ? match[1] : "text"}
            isDark={isDark}
          />
        );
      }
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-[0.8em] font-mono" {...props}>
          {children}
        </code>
      );
    },
  };
}
