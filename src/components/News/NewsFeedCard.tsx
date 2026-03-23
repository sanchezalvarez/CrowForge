import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink } from "lucide-react";

interface Article {
  id: number;
  title: string;
  url: string;
  feed_title: string;
  summary?: string;
  fetched_at: string;
  published_at?: string;
  image_url?: string | null;
}

function timeAgo(str?: string | null): string {
  if (!str) return "";
  const diff = Date.now() - new Date(str).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const FEED_COLORS: string[] = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-rose-500",
];

function feedColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
  return FEED_COLORS[Math.abs(hash) % FEED_COLORS.length];
}

export function NewsFeedCard({ article }: { article: Article }) {
  const color = feedColor(article.feed_title);
  const time = timeAgo(article.published_at || article.fetched_at);

  return (
    <button
      className="group w-full text-left rounded-xl border border-border/50 overflow-hidden hover:border-border hover:shadow-sm transition-all bg-background active:scale-[0.99]"
      onClick={() => article.url && openUrl(article.url).catch(() => {})}
    >
      {article.image_url && (
        <img
          src={article.image_url}
          alt=""
          className="w-full h-36 object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
            {article.feed_title}
          </span>
          {time && (
            <>
              <span className="text-muted-foreground/40 text-[10px]">·</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
            </>
          )}
        </div>
        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {article.title || "Untitled"}
        </p>
        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="h-3 w-3" />
          Read article
        </div>
      </div>
    </button>
  );
}
