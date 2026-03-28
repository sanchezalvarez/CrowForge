import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "../components/ui/card";
import {
  FileText, Table2, MessageSquare, Plus, Sparkles,
  ArrowRight, Loader2, Zap, Clock, Newspaper, Rss, Workflow,
} from "lucide-react";
import axios from "axios";
import { NewsDigest } from "../components/News/NewsDigest";
import { NewsFeedCard } from "../components/News/NewsFeedCard";
import { useRssDigest } from "../hooks/useRssDigest";

const API_BASE = "http://127.0.0.1:8000";

interface RecentDoc { id: string; title: string; updated_at?: string; created_at?: string; }
interface RecentSheet { id: string; title: string; updated_at?: string; columns: number; rows: number; }
interface RecentChat { id: number; title: string; mode: string; created_at?: string; }
interface DashboardData {
  recent_documents: RecentDoc[];
  recent_sheets: RecentSheet[];
  recent_chats: RecentChat[];
  counts: { documents: number; sheets: number; chats: number };
  ai_engine: string;
}
interface DashboardPageProps { onNavigate: (page: any, id?: string) => void; }

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ── Isolated digest section — owns all digest state so streaming chunks
//    never re-render the rest of the Dashboard. ─────────────────────────────
function DigestSection() {
  const { digest, isGenerating, isFetching, lastGenerated, articleCount, error, loadCached, fetchFeeds, generateDigest } = useRssDigest();
  const [articles, setArticles] = useState<any[]>([]);
  const [feedCount, setFeedCount] = useState(1);

  const loadArticles = () => {
    const perFeed = Math.max(1, Math.floor(40 / Math.max(1, feedCount)));
    axios.get(`${API_BASE}/rss/articles?limit_per_feed=${perFeed}`).then(r => setArticles(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadCached();
    axios.get(`${API_BASE}/rss/feeds`).then(r => {
      const active = (r.data || []).filter((f: any) => f.is_active).length;
      setFeedCount(Math.max(1, active));
    }).catch(() => {});
    loadArticles();
  }, []);

  const handleFetch = async () => {
    await fetchFeeds();
    loadArticles();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <span className="riso-section-label" style={{ fontSize: 12, letterSpacing: '0.08em' }}>Today's Digest</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetch}
            disabled={isFetching || isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rss className="h-3 w-3" />}
            {isFetching ? "Fetching…" : "Fetch"}
          </button>
          <button
            onClick={generateDigest}
            disabled={isGenerating || isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {isGenerating ? "Summarizing…" : "Summarize"}
          </button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-6">
          <NewsDigest
            digest={digest}
            isGenerating={isGenerating}
            lastGenerated={lastGenerated}
            articleCount={articleCount}
            error={error}
          />
        </CardContent>
      </Card>

      {articles.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Rss className="h-3 w-3" />
            Latest from feeds
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {articles.map((a) => <NewsFeedCard key={a.id} article={a} />)}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/dashboard`)
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const activityFeed = useMemo(() => {
    if (!data) return [];
    const items: { type: "doc" | "sheet" | "chat"; id: string; title: string; time: string; meta?: string }[] = [];
    for (const d of data.recent_documents || [])
      items.push({ type: "doc", id: d.id, title: d.title || "Untitled", time: d.updated_at || d.created_at || "" });
    for (const s of data.recent_sheets || [])
      items.push({ type: "sheet", id: s.id, title: s.title || "Untitled Sheet", time: s.updated_at || "", meta: `${s.columns} cols, ${s.rows} rows` });
    for (const c of data.recent_chats || [])
      items.push({ type: "chat", id: String(c.id), title: c.title || "New Chat", time: c.created_at || "", meta: c.mode });
    items.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
    return items.slice(0, 8);
  }, [data]);

  const counts = data?.counts ?? { documents: 0, sheets: 0, chats: 0 };
  const totalItems = counts.documents + counts.sheets + counts.chats;

  const quickActions = [
    {
      title: "New Chat", desc: "Ask AI anything",
      icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/20",
      onClick: async () => {
        try { const r = await axios.post(`${API_BASE}/chat/session`); onNavigate("chat", String(r.data.id)); } catch { /**/ }
      },
    },
    {
      title: "New Document", desc: "Write with AI",
      icon: FileText, color: "text-purple-500", bg: "bg-purple-500/10", ring: "ring-purple-500/20",
      onClick: async () => {
        try { const r = await axios.post(`${API_BASE}/documents`, { title: "Untitled Document" }); onNavigate("documents", r.data.id); } catch { /**/ }
      },
    },
    {
      title: "New Sheet", desc: "Data & formulas",
      icon: Table2, color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20",
      onClick: async () => {
        try { const r = await axios.post(`${API_BASE}/sheets`, { title: "Untitled Sheet", columns: [{ name: "Column 1", type: "text" }] }); onNavigate("sheets", r.data.id); } catch { /**/ }
      },
    },
    {
      title: "New Canvas", desc: "Visual flow diagrams",
      icon: Workflow, color: "text-orange-500", bg: "bg-orange-500/10", ring: "ring-orange-500/20",
      onClick: () => { onNavigate("canvas"); },
    },
  ];

  const typeIcon = (type: "doc" | "sheet" | "chat") => {
    if (type === "doc") return <FileText className="h-4 w-4 text-purple-500" />;
    if (type === "sheet") return <Table2 className="h-4 w-4 text-emerald-500" />;
    return <MessageSquare className="h-4 w-4 text-blue-500" />;
  };
  const typeBg = (type: "doc" | "sheet" | "chat") => {
    if (type === "doc") return "bg-purple-500/10";
    if (type === "sheet") return "bg-emerald-500/10";
    return "bg-blue-500/10";
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto riso-noise riso-noise-live">
      {/* Riso background layer — full-width, outside max-w constraint */}
      <div className="pointer-events-none select-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>

        {/* ── 1. Colour blobs ── */}
        <div className="animate-blob-drift" style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'var(--accent-teal)', opacity: 0.10, mixBlendMode: 'multiply', top: -200, right: -180 }} />
        <div className="animate-blob-drift-b" style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'var(--accent-orange)', opacity: 0.09, mixBlendMode: 'multiply', bottom: -160, left: -160 }} />
        <div className="animate-blob-drift-c" style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'var(--accent-violet)', opacity: 0.07, mixBlendMode: 'multiply', bottom: 80, right: -100 }} />
        <div className="animate-blob-drift-d" style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'var(--accent-teal)', opacity: 0.06, mixBlendMode: 'multiply', top: '35%', left: -100 }} />

        {/* ── 2. Registration crosshairs ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
          {/* Top-right — teal */}
          <line x1="calc(100% - 32)" y1="28" x2="calc(100% - 8)" y2="28" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <line x1="calc(100% - 20)" y1="16" x2="calc(100% - 20)" y2="40" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <circle cx="calc(100% - 20)" cy="28" r="5" stroke="rgba(11,114,104,0.3)" strokeWidth="1" fill="none" />
          {/* Bottom-left — orange */}
          <line x1="8" y1="calc(100% - 28)" x2="32" y2="calc(100% - 28)" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <line x1="20" y1="calc(100% - 40)" x2="20" y2="calc(100% - 16)" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <circle cx="20" cy="calc(100% - 28)" r="5" stroke="rgba(224,78,14,0.3)" strokeWidth="1" fill="none" />
          {/* Top-left — violet */}
          <line x1="8" y1="28" x2="32" y2="28" stroke="rgba(92,58,156,0.35)" strokeWidth="1.5" />
          <line x1="20" y1="16" x2="20" y2="40" stroke="rgba(92,58,156,0.35)" strokeWidth="1.5" />
          {/* Bottom-right — teal faint */}
          <line x1="calc(100% - 32)" y1="calc(100% - 28)" x2="calc(100% - 8)" y2="calc(100% - 28)" stroke="rgba(11,114,104,0.25)" strokeWidth="1" />
          <line x1="calc(100% - 20)" y1="calc(100% - 40)" x2="calc(100% - 20)" y2="calc(100% - 16)" stroke="rgba(11,114,104,0.25)" strokeWidth="1" />
        </svg>

        {/* ── 3. Halftone dot clusters ── */}
        <svg style={{ position: 'absolute', right: 40, top: 120, width: 100, height: 100 }} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          {[[20,20,3.5],[38,14,2.5],[12,38,2],[30,35,3],[48,28,2],[55,42,1.5],[22,52,2],[40,50,1.5],[60,30,1],[15,60,1.5]].map(([x,y,r],i) =>
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(224,78,14,0.28)" />)}
        </svg>
        <svg style={{ position: 'absolute', left: 60, bottom: 120, width: 90, height: 90 }} viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
          {[[18,18,3],[34,12,2],[10,32,2.5],[28,30,2],[44,22,1.5],[50,36,2],[16,46,1.5],[36,44,1],[55,28,1],[12,58,1.5]].map(([x,y,r],i) =>
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(11,114,104,0.28)" />)}
        </svg>
        <svg style={{ position: 'absolute', left: 40, top: 50, width: 70, height: 70 }} viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg">
          {[[14,14,2.5],[26,8,1.5],[8,26,2],[22,24,1.5],[36,16,1],[38,30,1.5],[12,38,1],[28,36,1.5]].map(([x,y,r],i) =>
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(92,58,156,0.22)" />)}
        </svg>


        {/* ── 5. Ink splatter dots ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
          <circle cx="18%" cy="12%" r="3" fill="rgba(224,78,14,0.20)" />
          <circle cx="23%" cy="8%"  r="1.5" fill="rgba(224,78,14,0.14)" />
          <circle cx="15%" cy="18%" r="2" fill="rgba(224,78,14,0.12)" />
          <circle cx="72%" cy="55%" r="2.5" fill="rgba(11,114,104,0.18)" />
          <circle cx="76%" cy="60%" r="1.5" fill="rgba(11,114,104,0.12)" />
          <circle cx="68%" cy="62%" r="1" fill="rgba(11,114,104,0.15)" />
          <circle cx="88%" cy="30%" r="2" fill="rgba(92,58,156,0.18)" />
          <circle cx="92%" cy="35%" r="1.5" fill="rgba(92,58,156,0.12)" />
          <circle cx="85%" cy="38%" r="1" fill="rgba(92,58,156,0.15)" />
          <circle cx="40%" cy="85%" r="2.5" fill="rgba(224,78,14,0.16)" />
          <circle cx="44%" cy="90%" r="1.5" fill="rgba(224,78,14,0.10)" />
          <circle cx="36%" cy="88%" r="1" fill="rgba(11,114,104,0.14)" />
          <circle cx="55%" cy="20%" r="2" fill="rgba(92,58,156,0.15)" />
          <circle cx="60%" cy="15%" r="1" fill="rgba(92,58,156,0.10)" />
          <circle cx="10%" cy="70%" r="2" fill="rgba(11,114,104,0.16)" />
          <circle cx="6%"  cy="75%" r="1.5" fill="rgba(11,114,104,0.10)" />
        </svg>

      </div>

      <div className="relative p-8 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <header className="animate-ink-in" style={{ position: 'relative', zIndex: 1, animationDelay: '0ms' }}>
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="font-display font-black tracking-tight leading-none"
                style={{
                  fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
                  textShadow: '3px 3px 0 rgba(224,78,14,0.22), -1.5px -1.5px 0 rgba(11,114,104,0.18)',
                  letterSpacing: '-0.02em',
                }}
              >
                {greeting()}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 font-mono-ui tracking-widest uppercase" style={{ fontSize: 11, letterSpacing: '0.18em' }}>
                Your local-first AI workspace
              </p>
            </div>
            {totalItems > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <span className="riso-stamp riso-stamp-press" style={{ color: 'var(--accent-teal)' }}>{counts.documents} docs</span>
                <span className="riso-stamp riso-stamp-press" style={{ color: 'var(--accent-orange)' }}>{counts.sheets} sheets</span>
                <span className="riso-stamp riso-stamp-press" style={{ color: 'var(--accent-violet)' }}>{counts.chats} chats</span>
              </div>
            )}
          </div>
        </header>

        {/* Quick actions */}
        <section className="riso-frame animate-ink-in" style={{ position: 'relative', zIndex: 1, padding: '2px', animationDelay: '70ms' }}>
          <h2 className="riso-section-label mb-3">Create</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.title}
                className={`card-riso group flex items-center gap-3 rounded-xl border border-border/50 p-4 text-left transition-all hover:border-border hover:shadow-sm hover:ring-2 ${a.ring} active:scale-[0.98]`}
                onClick={a.onClick}
              >
                <div className={`p-2.5 rounded-lg ${a.bg} shrink-0 transition-transform group-hover:scale-110`}>
                  <a.icon className={`h-5 w-5 ${a.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-foreground transition-colors" />
              </button>
            ))}
          </div>
        </section>

        {/* Today's Digest — isolated component, streaming chunks don't re-render above */}
        <div className="animate-ink-in" style={{ position: 'relative', zIndex: 1, animationDelay: '140ms' }}><DigestSection /></div>

        {/* Recent activity */}
        <section className="animate-ink-in" style={{ position: 'relative', zIndex: 1, animationDelay: '210ms' }}>
          <h2 className="riso-section-label mb-3">Recent activity</h2>
          {activityFeed.length === 0 ? (
            <Card className="border-dashed riso-frame">
              <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
                {/* Halftone empty-state background */}
                <div className="halftone-patch" style={{ top: 0, right: 0, width: 120, height: 120, opacity: 0.5, borderRadius: 8 }} />
                <div className="p-3 rounded-full bg-muted relative z-10">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium relative z-10">No activity yet</p>
                <p className="text-xs text-muted-foreground relative z-10">Create a chat, document, or sheet to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {activityFeed.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/60 group transition-colors"
                  onClick={() => onNavigate(item.type === "doc" ? "documents" : item.type === "sheet" ? "sheets" : "chat", item.id)}
                >
                  <div className={`p-1.5 rounded-md ${typeBg(item.type)} shrink-0`}>{typeIcon(item.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.meta && <p className="text-[11px] text-muted-foreground truncate">{item.meta}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{timeAgo(item.time)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        {totalItems > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40" style={{ position: 'relative', zIndex: 1 }}>
            <Sparkles className="h-3 w-3 text-primary/60 shrink-0" />
            <span>Tip: Use <strong>Ask AI</strong> in Sheets to chat about your data, or the <strong>Formula Wizard</strong> to generate formulas with natural language.</span>
          </div>
        )}
      </div>
    </div>
  );
}
