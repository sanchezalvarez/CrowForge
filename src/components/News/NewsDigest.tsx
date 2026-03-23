import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, RefreshCw, Newspaper } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "../../lib/utils";

interface NewsDigestProps {
  digest: string;
  isGenerating: boolean;
  lastGenerated: string;
  articleCount: number;
  error: string;
  onGenerate: () => void;
}

function timeAgo(isoStr: string): string {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NewsDigest({ digest, isGenerating, lastGenerated, articleCount, error, onGenerate }: NewsDigestProps) {
  if (!digest && !isGenerating && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="p-4 rounded-2xl bg-muted/40">
          <Newspaper className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-sm">No digest yet</p>
          <p className="text-xs text-muted-foreground mt-1">Generate your first AI news digest from subscribed feeds</p>
        </div>
        <button
          onClick={onGenerate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Generate digest
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isGenerating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Generating digest…</span>
            </>
          ) : lastGenerated ? (
            <span>Updated {timeAgo(lastGenerated)} · {articleCount} articles</span>
          ) : null}
        </div>
        {!isGenerating && (
          <button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/50"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {/* Digest content */}
      {(digest || isGenerating) && (
        <div className={cn(
          "prose prose-sm dark:prose-invert max-w-none text-sm",
          "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5",
          "[&_ul]:space-y-1 [&_li]:text-xs [&_li]:leading-snug",
          "[&_strong]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed",
          "[&_a]:text-primary [&_a]:no-underline [&_a]:hover:underline",
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  onClick={(e) => { e.preventDefault(); if (href) openUrl(href).catch(() => {}); }}
                  className="text-primary hover:underline cursor-pointer"
                >
                  {children}
                </a>
              ),
            }}
          >
            {digest + (isGenerating ? "▌" : "")}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
