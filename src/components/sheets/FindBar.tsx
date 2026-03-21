import { useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";

export interface FindBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  resultCount: number;
  currentIndex: number;
}

export function FindBar({ query, onQueryChange, onClose, onNext, onPrev, resultCount, currentIndex }: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="absolute top-1 right-2 z-50 flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg px-2 py-1.5">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onClose(); }
          else if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
          else if (e.key === "F3") { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
        }}
        className="h-6 px-2 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40 w-44"
        placeholder="Find in sheet…"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[52px]">
        {query ? (resultCount > 0 ? `${currentIndex + 1} / ${resultCount}` : "0 results") : ""}
      </span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPrev} disabled={resultCount === 0} title="Previous (Shift+Enter)">
        <ChevronUp className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNext} disabled={resultCount === 0} title="Next (Enter / F3)">
        <ChevronDown className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Close (Esc)">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
