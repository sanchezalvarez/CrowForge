import { useEffect, useRef, useState } from "react";
import { X, ChevronUp, ChevronDown, Replace } from "lucide-react";
import { Button } from "../ui/button";

export interface FindBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  resultCount: number;
  currentIndex: number;
  replaceQuery: string;
  onReplaceQueryChange: (v: string) => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  replaceCount: number | null;
}

export function FindBar({
  query, onQueryChange, onClose, onNext, onPrev, resultCount, currentIndex,
  replaceQuery, onReplaceQueryChange, onReplace, onReplaceAll, replaceCount,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showReplace, setShowReplace] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="absolute top-1 right-2 z-50 flex flex-col gap-1 bg-background border border-border rounded-lg shadow-lg px-2 py-1.5">
      {/* Find row */}
      <div className="flex items-center gap-1">
        <Button
          variant={showReplace ? "default" : "ghost"}
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setShowReplace((v) => !v)}
          title="Toggle Replace"
        >
          <Replace className="h-3 w-3" />
        </Button>
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

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-1">
          <div className="w-6 shrink-0" />
          <input
            value={replaceQuery}
            onChange={(e) => onReplaceQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
              else if (e.key === "Enter") { e.preventDefault(); onReplace(); }
            }}
            className="h-6 px-2 text-xs border border-border rounded bg-background outline-none focus:ring-1 focus:ring-primary/40 w-44"
            placeholder="Replace with…"
          />
          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={onReplace} disabled={resultCount === 0}>
            Replace
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={onReplaceAll} disabled={resultCount === 0}>
            All
          </Button>
          {replaceCount !== null && (
            <span className="text-xs text-green-600 whitespace-nowrap">✓ {replaceCount}</span>
          )}
        </div>
      )}
    </div>
  );
}
