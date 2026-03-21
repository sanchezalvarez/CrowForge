import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "../components/ui/card";
import {
  FileText, Table2, MessageSquare, Plus, Sparkles, Cpu,
  ArrowRight, Loader2, Zap, Clock,
} from "lucide-react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

interface RecentDoc {
  id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
}

interface RecentSheet {
  id: string;
  title: string;
  updated_at?: string;
  columns: number;
  rows: number;
}

interface RecentChat {
  id: number;
  title: string;
  mode: string;
  created_at?: string;
}

interface DashboardData {
  recent_documents: RecentDoc[];
  recent_sheets: RecentSheet[];
  recent_chats: RecentChat[];
  counts: { documents: number; sheets: number; chats: number };
  ai_engine: string;
}

interface DashboardPageProps {
  onNavigate: (page: any, id?: string) => void;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "";
  const diff = now - then;
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

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/dashboard`);
        if (!cancelled) setData(res.data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Unified activity feed — mix all recent items, sort by time
  const activityFeed = useMemo(() => {
    if (!data) return [];
    const items: { type: "doc" | "sheet" | "chat"; id: string; title: string; time: string; meta?: string }[] = [];
    for (const d of data.recent_documents) {
      items.push({ type: "doc", id: d.id, title: d.title || "Untitled", time: d.updated_at || d.created_at || "" });
    }
    for (const s of data.recent_sheets) {
      items.push({ type: "sheet", id: s.id, title: s.title || "Untitled Sheet", time: s.updated_at || "", meta: `${s.columns} cols, ${s.rows} rows` });
    }
    for (const c of data.recent_chats) {
      items.push({ type: "chat", id: String(c.id), title: c.title || "New Chat", time: c.created_at || "", meta: c.mode });
    }
    items.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
    return items.slice(0, 8);
  }, [data]);

  const counts = data?.counts ?? { documents: 0, sheets: 0, chats: 0 };
  const totalItems = counts.documents + counts.sheets + counts.chats;

  const quickActions = [
    {
      title: "New Chat",
      desc: "Ask AI anything",
      icon: MessageSquare,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      ring: "ring-blue-500/20",
      onClick: async () => {
        try {
          const res = await axios.post(`${API_BASE}/chat/session`);
          onNavigate("chat", String(res.data.id));
        } catch { /* */ }
      },
    },
    {
      title: "New Document",
      desc: "Write with AI",
      icon: FileText,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      ring: "ring-purple-500/20",
      onClick: async () => {
        try {
          const res = await axios.post(`${API_BASE}/documents`, { title: "Untitled Document" });
          onNavigate("documents", res.data.id);
        } catch { /* */ }
      },
    },
    {
      title: "New Sheet",
      desc: "Data & formulas",
      icon: Table2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      ring: "ring-emerald-500/20",
      onClick: async () => {
        try {
          const res = await axios.post(`${API_BASE}/sheets`, { title: "Untitled Sheet", columns: [{ name: "Column 1", type: "text" }] });
          onNavigate("sheets", res.data.id);
        } catch { /* */ }
      },
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
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{greeting()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your local-first AI workspace — everything runs on your machine.
          </p>
        </header>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Documents", count: counts.documents, icon: FileText, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "Sheets", count: counts.sheets, icon: Table2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Chats", count: counts.chats, icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "AI Engine", count: data?.ai_engine ?? "mock", icon: Cpu, color: "text-orange-500", bg: "bg-orange-500/10", isEngine: true },
          ].map((s) => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg} shrink-0`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  {"isEngine" in s ? (
                    <p className="text-sm font-semibold truncate">{String(s.count)}</p>
                  ) : (
                    <p className="text-xl font-bold tabular-nums">{s.count as number}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick actions */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Create</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.title}
                className={`group relative flex items-center gap-3 rounded-xl border border-border/50 p-4 text-left transition-all hover:border-border hover:shadow-sm hover:ring-2 ${a.ring} active:scale-[0.98]`}
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

        {/* Activity feed */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent activity</h2>
          {activityFeed.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
                <div className="p-3 rounded-full bg-muted">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a chat, document, or sheet to get started.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {activityFeed.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60 group"
                  onClick={() => {
                    const page = item.type === "doc" ? "documents" : item.type === "sheet" ? "sheets" : "chat";
                    onNavigate(page, item.id);
                  }}
                >
                  <div className={`p-1.5 rounded-md ${typeBg(item.type)} shrink-0`}>
                    {typeIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.meta && (
                      <p className="text-[11px] text-muted-foreground truncate">{item.meta}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(item.time)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Footer hint */}
        {totalItems > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
            <Sparkles className="h-3 w-3 text-primary/60 shrink-0" />
            <span>Tip: Use <strong>Ask AI</strong> in Sheets to chat about your data, or the <strong>Formula Wizard</strong> to generate formulas with natural language.</span>
          </div>
        )}
      </div>
    </div>
  );
}
