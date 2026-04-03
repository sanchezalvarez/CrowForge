import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "../components/ui/card";
import {
  FileText, Table2, MessageSquare, Plus, Sparkles,
  ArrowRight, Loader2, Zap, Clock, Newspaper, Rss, Workflow,
  User, Bug, CheckSquare, AlertTriangle, CircleDot,
} from "lucide-react";
import axios from "axios";
import { NewsDigest } from "../components/News/NewsDigest";
import { NewsFeedCard } from "../components/News/NewsFeedCard";
import { useRssDigest } from "../hooks/useRssDigest";
import type { PMTask, PMMember } from "../types/pm";
import type { DashboardData, NavigateCallback, RssArticle, RssFeed } from "../types/api";
import { RisoBackground } from "../components/RisoBackground";
import { getAPIBase } from "../lib/api";


interface DashboardPageProps { onNavigate: NavigateCallback; }

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

// ── My Work section — quick overview of assigned tasks/bugs per member ────
function MyWorkSection({ onNavigate }: { onNavigate: NavigateCallback }) {
  const [members, setMembers] = useState<PMMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<number>(1);
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    axios.get(`${getAPIBase()}/pm/members`).then((r) => {
      setMembers(r.data);
      if (r.data.length > 0) setSelectedMember(r.data[0].id);
    }).catch(() => {});
  }, []);

  const loadTasks = useCallback(async (memberId: number) => {
    setLoadingTasks(true);
    try {
      const res = await axios.get(`${getAPIBase()}/pm/tasks`, { params: { assignee_id: memberId } });
      setTasks(res.data);
    } catch {
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMember) loadTasks(selectedMember);
  }, [selectedMember, loadTasks]);

  const activeTasks = useMemo(() => tasks.filter((t) => t.item_type !== "bug" && !["resolved", "closed", "rejected"].includes(t.status)), [tasks]);
  const activeBugs = useMemo(() => tasks.filter((t) => t.item_type === "bug" && !["resolved", "closed", "rejected"].includes(t.status)), [tasks]);
  const resolvedCount = useMemo(() => tasks.filter((t) => ["resolved", "closed"].includes(t.status)).length, [tasks]);

  const currentMember = members.find((m) => m.id === selectedMember);

  const statusIcon = (status: string) => {
    if (status === "active") return <CircleDot size={10} style={{ color: "var(--accent-teal)" }} />;
    if (status === "needs_testing") return <AlertTriangle size={10} style={{ color: "var(--accent-orange)" }} />;
    return <CircleDot size={10} className="text-muted-foreground" />;
  };

  const severityColor = (sev: string) => {
    if (sev === "Blocker") return "var(--destructive)";
    if (sev === "Major") return "var(--accent-orange)";
    return "var(--muted-foreground)";
  };

  const severityTagClass = (sev: string) => {
    if (sev === "Blocker") return "tag-riso tag-riso-orange";
    if (sev === "Major") return "tag-riso";
    return "tag-riso tag-riso-muted";
  };

  return (
    <section>
      {/* Section header — label left, member picker right */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="riso-section-label flex items-center gap-2">
          <User className="h-3.5 w-3.5" style={{ color: "var(--accent-teal)" }} />
          My Work
        </h2>
        {/* Member picker pills */}
        <div className="flex items-center gap-2">
          {members.map((m) => {
            const isSelected = selectedMember === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-mono-ui text-[11px] transition-all"
                style={{
                  background: isSelected
                    ? "color-mix(in srgb, var(--accent-teal) 12%, transparent)"
                    : "color-mix(in srgb, var(--foreground) 4%, transparent)",
                  border: isSelected
                    ? "1.5px solid var(--accent-teal)"
                    : "1.5px solid var(--border-strong)",
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "var(--accent-teal)" : "var(--muted-foreground)",
                  boxShadow: isSelected ? "2px 2px 0 var(--riso-teal)" : "none",
                  letterSpacing: "0.03em",
                }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                  style={{ background: m.avatar_color, fontSize: 7 }}
                >
                  {m.initials}
                </span>
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {loadingTasks ? (
        /* Loading skeleton — matches the card structure so layout doesn't jump */
        <Card className="card-riso overflow-hidden">
          <div
            className="flex items-center gap-2 px-4 py-3 surface-noise"
            style={{ borderBottom: "1.5px solid var(--border-strong)", backgroundColor: "var(--background-2)" }}
          >
            <Loader2 size={11} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
            <span className="text-[10px] font-mono-ui font-bold uppercase tracking-widest text-muted-foreground">
              Loading…
            </span>
          </div>
          <CardContent className="p-8 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tasks card */}
          <Card className="card-riso overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3 surface-noise"
              style={{ borderBottom: "1.5px solid var(--border-strong)", backgroundColor: "var(--background-2)" }}
            >
              <CheckSquare size={11} style={{ color: "var(--accent-teal)" }} />
              <span className="text-[10px] font-mono-ui font-bold uppercase tracking-widest" style={{ color: "var(--accent-teal)" }}>
                Tasks
              </span>
              <span
                className="ml-auto text-[9px] font-mono-ui font-bold px-1.5 py-0.5 rounded-sm"
                style={{
                  background: "color-mix(in srgb, var(--accent-teal) 14%, transparent)",
                  color: "var(--accent-teal)",
                  border: "1px solid color-mix(in srgb, var(--accent-teal) 28%, transparent)",
                }}
              >
                {activeTasks.length}
              </span>
            </div>
            <CardContent className="p-0">
              {activeTasks.length === 0 ? (
                <div className="px-4 py-6 flex flex-col items-center gap-1.5">
                  <CheckSquare size={14} className="text-muted-foreground opacity-40" />
                  <span className="text-[11px] font-mono-ui text-muted-foreground tracking-wide">No active tasks</span>
                </div>
              ) : (
                <div className="max-h-[260px] overflow-y-auto divide-y" style={{ "--tw-divide-opacity": 1, borderColor: "var(--border)" } as React.CSSProperties}>
                  {activeTasks.slice(0, 15).map((t) => (
                    <button
                      key={t.id}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "color-mix(in srgb, var(--accent-teal) 5%, transparent)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                      onClick={() => onNavigate("projects")}
                    >
                      <span className="shrink-0 mt-px">{statusIcon(t.status)}</span>
                      <span className="text-xs truncate flex-1 leading-snug">{t.title}</span>
                      <span className="tag-riso tag-riso-teal shrink-0">{t.item_type}</span>
                      <span className="tag-riso tag-riso-muted shrink-0" style={{ minWidth: "fit-content" }}>{t.status.replace(/_/g, " ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bugs card */}
          <Card className="card-riso card-riso-orange overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3 surface-noise"
              style={{ borderBottom: "1.5px solid var(--border-strong)", backgroundColor: "var(--background-2)" }}
            >
              <Bug size={11} style={{ color: "var(--destructive)" }} />
              <span className="text-[10px] font-mono-ui font-bold uppercase tracking-widest" style={{ color: "var(--destructive)" }}>
                Bugs
              </span>
              <span
                className="ml-auto text-[9px] font-mono-ui font-bold px-1.5 py-0.5 rounded-sm"
                style={{
                  background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
                  color: "var(--destructive)",
                  border: "1px solid color-mix(in srgb, var(--destructive) 22%, transparent)",
                }}
              >
                {activeBugs.length}
              </span>
            </div>
            <CardContent className="p-0">
              {activeBugs.length === 0 ? (
                <div className="px-4 py-6 flex flex-col items-center gap-1.5">
                  <Bug size={14} className="text-muted-foreground opacity-40" />
                  <span className="text-[11px] font-mono-ui text-muted-foreground tracking-wide">No open bugs</span>
                </div>
              ) : (
                <div className="max-h-[260px] overflow-y-auto">
                  {activeBugs.slice(0, 15).map((t) => (
                    <button
                      key={t.id}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "color-mix(in srgb, var(--destructive) 5%, transparent)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                      onClick={() => onNavigate("issues")}
                    >
                      <Bug size={10} className="shrink-0 mt-px" style={{ color: severityColor(t.severity) }} />
                      <span className="text-xs truncate flex-1 leading-snug">{t.title}</span>
                      <span className={`${severityTagClass(t.severity)} shrink-0`}>{t.severity}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary stats bar — shown only when there's data */}
          {(activeTasks.length > 0 || activeBugs.length > 0 || resolvedCount > 0) && (
            <div
              className="lg:col-span-2 flex items-center gap-3 px-3 py-2 rounded-sm"
              style={{
                background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
                border: "1px solid var(--border-strong)",
                color: "var(--muted-foreground)",
              }}
            >
              <span className="font-mono-ui text-[10px] font-bold" style={{ color: "var(--foreground)" }}>
                {currentMember?.name ?? "—"}
              </span>
              <span className="w-px self-stretch" style={{ background: "var(--border-strong)" }} />
              <span className="font-mono-ui text-[10px]">{activeTasks.length} active task{activeTasks.length !== 1 ? "s" : ""}</span>
              <span className="w-px self-stretch" style={{ background: "var(--border-strong)" }} />
              <span className="font-mono-ui text-[10px]">{activeBugs.length} open bug{activeBugs.length !== 1 ? "s" : ""}</span>
              <span className="w-px self-stretch" style={{ background: "var(--border-strong)" }} />
              <span className="font-mono-ui text-[10px]" style={{ color: "var(--accent-teal)" }}>
                {resolvedCount} resolved
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Isolated digest section — owns all digest state so streaming chunks
//    never re-render the rest of the Dashboard. ─────────────────────────────
function DigestSection() {
  const [aiAvailable, setAiAvailable] = useState(false);
  const { digest, isGenerating, isFetching, lastGenerated, articleCount, error, loadCached, fetchFeeds, generateDigest } = useRssDigest();
  const [articles, setArticles] = useState<RssArticle[]>([]);
  const [feedCount, setFeedCount] = useState(1);
  const [showFeeds, setShowFeeds] = useState(false);

  const loadArticles = (count?: number) => {
    const fc = count ?? feedCount;
    const perFeed = Math.max(1, Math.floor(40 / Math.max(1, fc)));
    axios.get(`${getAPIBase()}/rss/articles?limit_per_feed=${perFeed}`).then(r => setArticles(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadCached();
    axios.get(`${getAPIBase()}/rss/feeds`).then(r => {
      const active = (r.data || []).filter((f: RssFeed) => f.is_active).length;
      const fc = Math.max(1, active);
      setFeedCount(fc);
      loadArticles(fc);
    }).catch(() => { loadArticles(1); });
    axios.get(`${getAPIBase()}/settings/ai`).then((r) => {
      setAiAvailable(r.data.enable_llm === true);
    }).catch(() => {});
  }, []);

  const handleFetch = async () => {
    await fetchFeeds();
    loadArticles();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="riso-section-label flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange)' }} />
          Today's Digest
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetch}
            disabled={isFetching || isGenerating}
            className="btn-tactile"
          >
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rss className="h-3 w-3" />}
            {isFetching ? "Fetching…" : "Fetch"}
          </button>
          {aiAvailable && (
            <button
              onClick={generateDigest}
              disabled={isGenerating || isFetching}
              className="btn-tactile btn-tactile-orange"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {isGenerating ? "Summarizing…" : "Summarize"}
            </button>
          )}
        </div>
      </div>

      {aiAvailable && (
        <Card className="card-riso card-riso-orange">
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
      )}

      {articles.length > 0 && (
        <div className="mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {articles.slice(0, showFeeds ? 15 : 6).map((a) => <NewsFeedCard key={a.id} article={a} />)}
          </div>
          {articles.length > 6 && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => setShowFeeds((p) => !p)}
                className="btn-tactile btn-tactile-outline gap-1.5"
              >
                {showFeeds ? "Show less" : "Show more"}
              </button>
            </div>
          )}
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
    axios.get(`${getAPIBase()}/dashboard`)
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
    return items.slice(0, 5);
  }, [data]);

  const counts = data?.counts ?? { documents: 0, sheets: 0, chats: 0 };
  const totalItems = counts.documents + counts.sheets + counts.chats;

  const quickActions = [
    {
      title: "New Chat", desc: "Ask AI anything",
      icon: MessageSquare, color: "text-[var(--accent-teal)]", bg: "bg-[var(--accent-teal)]/10", ring: "ring-[var(--accent-teal)]/20",
      onClick: async () => {
        try { const r = await axios.post(`${getAPIBase()}/chat/session`); onNavigate("chat", String(r.data.id)); } catch { /**/ }
      },
    },
    {
      title: "New Document", desc: "Write with AI",
      icon: FileText, color: "text-[var(--accent-violet)]", bg: "bg-[var(--accent-violet)]/10", ring: "ring-[var(--accent-violet)]/20",
      onClick: async () => {
        try { const r = await axios.post(`${getAPIBase()}/documents`, { title: "Untitled Document" }); onNavigate("documents", r.data.id); } catch { /**/ }
      },
    },
    {
      title: "New Sheet", desc: "Data & formulas",
      icon: Table2, color: "text-[var(--accent-teal)]", bg: "bg-[var(--accent-teal)]/10", ring: "ring-[var(--accent-teal)]/20",
      onClick: async () => {
        try { const r = await axios.post(`${getAPIBase()}/sheets`, { title: "Untitled Sheet", columns: [{ name: "Column 1", type: "text" }] }); onNavigate("sheets", r.data.id); } catch { /**/ }
      },
    },
    {
      title: "New Canvas", desc: "Visual flow diagrams",
      icon: Workflow, color: "text-[var(--accent-orange)]", bg: "bg-[var(--accent-orange)]/10", ring: "ring-[var(--accent-orange)]/20",
      onClick: () => { onNavigate("canvas"); },
    },
  ];

  const typeIcon = (type: "doc" | "sheet" | "chat") => {
    if (type === "doc") return <FileText className="h-4 w-4" style={{ color: 'var(--accent-violet)' }} />;
    if (type === "sheet") return <Table2 className="h-4 w-4" style={{ color: 'var(--accent-teal)' }} />;
    return <MessageSquare className="h-4 w-4" style={{ color: 'var(--accent-orange)' }} />;
  };
  const typeBg = (type: "doc" | "sheet" | "chat") => {
    if (type === "doc") return "bg-[var(--accent-violet)]/10";
    if (type === "sheet") return "bg-[var(--accent-teal)]/10";
    return "bg-[var(--accent-orange)]/10";
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto riso-noise riso-noise-live" style={{ position: 'relative' }}>
      <RisoBackground />

      <div className="relative p-10 max-w-7xl mx-auto space-y-10">

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
            {quickActions.map((a, i) => (
              <button
                key={a.title}
                className={`card-riso group flex items-center gap-3 rounded-xl border border-border/50 p-3.5 text-left transition-all hover:border-border hover:shadow-sm hover:ring-2 ${a.ring} active:scale-[0.98] animate-card-in`}
                style={{ animationDelay: `${i * 40}ms` }}
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

        {/* My Work — quick overview of assigned tasks & bugs */}
        <div className="animate-ink-in" style={{ position: 'relative', zIndex: 1, animationDelay: '140ms' }}><MyWorkSection onNavigate={onNavigate} /></div>

        {/* Today's Digest — isolated component, streaming chunks don't re-render above */}
        <div className="animate-ink-in" style={{ position: 'relative', zIndex: 1, animationDelay: '210ms' }}><DigestSection /></div>

        {/* Recent activity */}
        <section className="animate-ink-in" style={{ position: 'relative', zIndex: 1, animationDelay: '280ms' }}>
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
              {activityFeed.map((item, i) => (
                <button
                  key={`${item.type}-${item.id}`}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/60 group transition-colors animate-row-in"
                  style={{ animationDelay: `${i * 25}ms` }}
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
