import { useState, useEffect, useRef, Component, Fragment, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import axios from "axios";
import {
  Gauge,
  MessageSquare,
  FileText,
  Table2,
  Settings,
  PanelRightClose,
  PanelRightOpen,
  Bot,
  Wrench,
  Workflow,
  HelpCircle,
  KanbanSquare,
  Bug,
} from "lucide-react";
import { cn } from "./lib/utils";
import DashboardPage from "./pages/DashboardPage";
import { BenchmarkPage } from "./pages/BenchmarkPage";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SheetsPage } from "./pages/SheetsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AgentPage } from "./pages/AgentPage";
import { ToolsPage } from "./pages/ToolsPage";
import { CanvasPage } from "./pages/CanvasPage";
import { HelpPage } from "./pages/HelpPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { IssueTrackerPage } from "./pages/IssueTrackerPage";
import { SplashScreen } from "./components/SplashScreen";
import { OnboardingPage } from "./pages/OnboardingPage";
import { Toaster } from "./components/ui/toaster";
import { AIControlPanel, TuningParams } from "./components/AIControlPanel";
import { ChatStreamProvider } from "./contexts/ChatStreamContext";
import { Home } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

class PageErrorBoundary extends Component<{ children: ReactNode; page: string }, { error: Error | null }> {
  constructor(props: { children: ReactNode; page: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary:${this.props.page}]`, error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-destructive">Something went wrong in {this.props.page}</p>
          <p className="text-xs text-muted-foreground font-mono max-w-md break-all">{this.state.error.message}</p>
          <button
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type AppStatus = "loading" | "onboarding" | "ready" | "failed";
type AppPage = "home" | "chat" | "agent" | "documents" | "sheets" | "tools" | "benchmark" | "settings" | "canvas" | "help" | "projects" | "project_detail" | "issues";

export interface DocumentContext {
  title: string;
  outline: string[];
  selectedText: string | null;
  fullText: string | null;
}

export default function App() {
  const [appStatus, setAppStatus] = useState<AppStatus>("loading");
  const [currentPage, setCurrentPage] = useState<AppPage>("home");
  const [docContext, setDocContext] = useState<DocumentContext | null>(null);
  const [docContextLocked, setDocContextLocked] = useState(false);

  // Persistence of active IDs to allow Dashboard -> Page navigation
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const handleNavigate = (page: string, id?: string) => {
    if (id) {
      if (page === "chat") setActiveChatId(id);
      if (page === "documents") setActiveDocId(id);
      if (page === "sheets") setActiveSheetId(id);
      if (page === "project_detail") setActiveProjectId(Number(id));
    }
    setCurrentPage(page as AppPage);
  };
  
  // ... rest of state ...

  useEffect(() => { setDocContextLocked(false); }, [docContext]);

  // Disable browser spellcheck globally (no red underlines)
  useEffect(() => {
    const disable = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el && el.setAttribute) el.setAttribute("spellcheck", "false");
    };
    document.addEventListener("focusin", disable);
    return () => document.removeEventListener("focusin", disable);
  }, []);

  // Theme state — persisted to localStorage
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") || "light";
  });


  useEffect(() => {
    function handleHide() {
      // Best-effort: tell backend to exit when the window closes
      navigator.sendBeacon("http://127.0.0.1:8000/shutdown");
    }
    window.addEventListener("pagehide", handleHide);
    return () => window.removeEventListener("pagehide", handleHide);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    // Remove legacy theme classes that could override riso design tokens
    const themes = ["theme-zinc", "theme-slate", "theme-stone", "theme-rose", "theme-orange"];
    document.documentElement.classList.remove(...themes);
  }, []);

  // Tuning params state — persisted to both localStorage and backend DB
  const [tuningParams, setTuningParams] = useState<TuningParams>(() => {
    try {
      const stored = localStorage.getItem("ai_tuning");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { temperature: 0.7, topP: 0.95, maxTokens: 1024, seed: null };
  });
  const tuningLoadedFromBackend = useRef(false);

  // Load tuning from backend on startup (backend DB is the source of truth)
  useEffect(() => {
    if (appStatus !== "ready") return;
    axios.get(`${API_BASE}/ai/tuning`).then((r) => {
      tuningLoadedFromBackend.current = true;
      setTuningParams(r.data);
    }).catch(() => {});
  }, [appStatus]);

  // Persist tuning to localStorage + backend on change
  const tuningDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    localStorage.setItem("ai_tuning", JSON.stringify(tuningParams));
    // Don't save to backend until we've loaded the backend value first
    if (!tuningLoadedFromBackend.current) return;
    // Debounce backend save to avoid hammering during slider drags
    if (tuningDebounceRef.current) clearTimeout(tuningDebounceRef.current);
    tuningDebounceRef.current = setTimeout(() => {
      axios.post(`${API_BASE}/ai/tuning`, tuningParams).catch(() => {});
    }, 500);
    return () => {
      if (tuningDebounceRef.current) clearTimeout(tuningDebounceRef.current);
    };
  }, [tuningParams]);

  // AI panel visibility
  const [aiPanelOpen, setAiPanelOpen] = useState(() =>
    localStorage.getItem("ai_panel_open") !== "false"
  );
  useEffect(() => {
    localStorage.setItem("ai_panel_open", String(aiPanelOpen));
  }, [aiPanelOpen]);

  // AI debug toggle
  const [showDebug, setShowDebug] = useState(() =>
    localStorage.getItem("ai_show_debug") === "true"
  );
  useEffect(() => {
    localStorage.setItem("ai_show_debug", String(showDebug));
  }, [showDebug]);

  // Model status indicator — polls every 15s when app is ready
  type ModelStatus = "loaded" | "not_loaded" | "unloaded" | "no_local";
  const [modelStatus, setModelStatus] = useState<ModelStatus>("no_local");
  const prevModelLoadedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (appStatus !== "ready") return;
    let cancelled = false;

    async function checkModelStatus() {
      if (cancelled) return;
      try {
        const res = await axios.get(`${API_BASE}/ai/model/status`);
        const { loaded, is_local_engine } = res.data;
        if (!is_local_engine) {
          setModelStatus("no_local");
        } else if (loaded) {
          prevModelLoadedRef.current = true;
          setModelStatus("loaded");
        } else {
          const wasLoaded = prevModelLoadedRef.current;
          prevModelLoadedRef.current = false;
          setModelStatus(wasLoaded ? "unloaded" : "not_loaded");
        }
      } catch {
        // backend offline — leave status as-is
      }
    }

    checkModelStatus();
    const interval = setInterval(checkModelStatus, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [appStatus]);

  // Backend polling on startup
  useEffect(() => {
    let cancelled = false;
    const MAX_ATTEMPTS = 60;
    const INTERVAL_MS = 1000;

    async function poll(attempt: number) {
      if (cancelled) return;
      try {
        const res = await axios.get(`${API_BASE}/state`, { timeout: 2000 });
        if (cancelled) return;
        const onboarded = res.data.onboarding_completed === true;
        setAppStatus(onboarded ? "ready" : "onboarding");
      } catch {
        if (attempt >= MAX_ATTEMPTS) {
          setAppStatus("failed");
          return;
        }
        setTimeout(() => poll(attempt + 1), INTERVAL_MS);
      }
    }

    poll(0);
    return () => { cancelled = true; };
  }, []);

  const navItems: { page: AppPage; label: string; icon: typeof MessageSquare }[] = [
    { page: "home", label: "Home", icon: Home },
    { page: "chat", label: "Chat", icon: MessageSquare },
    { page: "agent", label: "Agent", icon: Bot },
    { page: "projects", label: "Management", icon: KanbanSquare },
    { page: "issues", label: "Issues", icon: Bug },
    { page: "documents", label: "Documents", icon: FileText },
    { page: "sheets", label: "Sheets", icon: Table2 },
    { page: "canvas", label: "Canvas", icon: Workflow },
    { page: "tools", label: "Tools", icon: Wrench },
  ];

  const bottomNavItems: { page: AppPage; label: string; icon: typeof MessageSquare }[] = [
    { page: "benchmark", label: "Benchmark", icon: Gauge },
    { page: "settings", label: "Settings", icon: Settings },
    { page: "help", label: "Help", icon: HelpCircle },
  ];

  if (appStatus === "loading") return <SplashScreen />;
  if (appStatus === "failed") return <SplashScreen failed />;
  if (appStatus === "onboarding") return <OnboardingPage onComplete={() => setAppStatus("ready")} />;

  return (
    <ChatStreamProvider>
    <div className="flex flex-col h-screen w-full overflow-hidden text-foreground font-sans antialiased" onContextMenu={(e) => e.preventDefault()}>
      {/* Custom title bar */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between shrink-0 select-none"
        style={{ height: 32, background: 'var(--topbar-bg)', borderBottom: '1px solid var(--topbar-border)', paddingLeft: 12, paddingRight: 0, zIndex: 100 }}
      >
        <span data-tauri-drag-region className="font-mono-ui uppercase pointer-events-none" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--topbar-muted)' }}>
          CrowForge
        </span>
        <div className="flex h-full">
          <button
            onClick={() => getCurrentWindow().minimize()}
            className="h-full px-4 flex items-center justify-center transition-colors hover:bg-white/8"
            style={{ color: 'var(--topbar-muted)' }}
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
          </button>
          <button
            onClick={() => getCurrentWindow().toggleMaximize()}
            className="h-full px-4 flex items-center justify-center transition-colors hover:bg-white/8"
            style={{ color: 'var(--topbar-muted)' }}
            title="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" /></svg>
          </button>
          <button
            onClick={() => getCurrentWindow().close()}
            className="h-full px-4 flex items-center justify-center transition-colors"
            style={{ color: 'var(--topbar-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(224,78,14,0.85)', e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = 'var(--topbar-muted)')}
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" /><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
        </div>
      </div>
      <div className="riso-strip" />
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col relative overflow-hidden" style={{ background: 'var(--topbar-bg)', borderRight: '1px solid var(--topbar-border)' }}>

        {/* ── Riso sidebar BG elements ── */}
        {/* Teal glow — top, large */}
        <div className="absolute pointer-events-none animate-blob-drift-b" style={{ top: -100, left: '50%', transform: 'translateX(-50%)', width: 480, height: 360, background: 'rgba(11,114,104,0.22)', borderRadius: '50%', mixBlendMode: 'screen', filter: 'blur(50px)', zIndex: 0 }} />
        {/* Orange glow — bottom, large */}
        <div className="absolute pointer-events-none animate-blob-drift-c" style={{ bottom: -80, left: -70, width: 400, height: 320, background: 'rgba(224,78,14,0.20)', borderRadius: '50%', mixBlendMode: 'screen', filter: 'blur(45px)', zIndex: 0 }} />
        {/* Violet glow — mid right */}
        <div className="absolute pointer-events-none animate-blob-drift" style={{ top: '36%', right: -80, width: 300, height: 300, background: 'rgba(92,58,156,0.18)', borderRadius: '50%', mixBlendMode: 'screen', filter: 'blur(40px)', zIndex: 0 }} />
        {/* Registration crosshair — top right corner, above content */}
        <svg className="absolute pointer-events-none" style={{ top: 8, right: 8, opacity: 0.30, zIndex: 2 }} width="16" height="16" viewBox="0 0 16 16">
          <line x1="8" y1="0" x2="8" y2="16" stroke="#E04E0E" strokeWidth="1" className="animate-reg-draw" />
          <line x1="0" y1="8" x2="16" y2="8" stroke="#E04E0E" strokeWidth="1" className="animate-reg-draw" style={{ animationDelay: '0.12s' }} />
          <circle cx="8" cy="8" r="3.5" fill="none" stroke="#E04E0E" strokeWidth="1" className="animate-reg-draw" style={{ animationDelay: '0.24s' }} />
        </svg>
        {/* Registration crosshair — bottom left corner, above content */}
        <svg className="absolute pointer-events-none" style={{ bottom: 8, left: 8, opacity: 0.24, zIndex: 2 }} width="16" height="16" viewBox="0 0 16 16">
          <line x1="8" y1="0" x2="8" y2="16" stroke="#0B7268" strokeWidth="1" className="animate-reg-draw" style={{ animationDelay: '0.35s' }} />
          <line x1="0" y1="8" x2="16" y2="8" stroke="#0B7268" strokeWidth="1" className="animate-reg-draw" style={{ animationDelay: '0.47s' }} />
          <circle cx="8" cy="8" r="3.5" fill="none" stroke="#0B7268" strokeWidth="1" className="animate-reg-draw" style={{ animationDelay: '0.58s' }} />
        </svg>
        {/* Halftone cluster 1 — bottom, right side */}
        <div className="absolute pointer-events-none" style={{ bottom: 0, right: 0, width: 160, height: 200, opacity: 0.06, backgroundImage: 'radial-gradient(circle, rgba(240,232,220,0.9) 1.8px, transparent 1.8px)', backgroundSize: '11px 11px', zIndex: 0 }} />
        {/* Halftone cluster 2 — lower nav area, left side */}
        <div className="absolute pointer-events-none" style={{ top: '50%', left: 0, width: 140, height: 180, opacity: 0.10, backgroundImage: 'radial-gradient(circle, rgba(224,78,14,0.85) 1.7px, transparent 1.7px)', backgroundSize: '10px 10px', zIndex: 0 }} />
        {/* Halftone cluster 3 — mascot area, right — bigger */}
        <div className="absolute pointer-events-none" style={{ top: 60, right: 0, width: 180, height: 180, opacity: 0.11, backgroundImage: 'radial-gradient(circle, rgba(11,114,104,0.9) 1.7px, transparent 1.7px)', backgroundSize: '9px 9px', zIndex: 0 }} />

        <div className="flex-1 overflow-y-auto relative" style={{ zIndex: 1 }}>
          <div className="p-3 space-y-0.5">
            {navItems.map(({ page, label, icon: Icon }, i) => (
              <Fragment key={page}>
                {page === "projects" && <div className="mx-1 my-1.5" style={{ borderTop: '1px solid var(--topbar-border)' }} />}
                <button
                  onClick={() => setCurrentPage(page)}
                  className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors animate-row-in", currentPage === page ? "font-semibold" : "")}
                  style={{
                    animationDelay: `${i * 25}ms`,
                    ...(page === "agent"
                      ? currentPage === page
                        ? { background: 'rgba(139,98,212,0.25)', color: '#c4a8f0', boxShadow: '0 0 0 1px rgba(139,98,212,0.40)' }
                        : { color: 'var(--topbar-muted)' }
                      : currentPage === page
                        ? { background: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--accent-orange)' }
                        : { color: 'var(--topbar-muted)' }),
                  }}
                  onMouseEnter={(e) => { if (currentPage !== page) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--topbar-fg)'; } }}
                  onMouseLeave={(e) => { if (currentPage !== page) { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--topbar-muted)'; } }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              </Fragment>
            ))}
          </div>
        </div>

        {/* Riso color chips — print registration marks */}
        <div className="flex items-center justify-between px-4 py-1.5 relative" style={{ zIndex: 1 }}>
          <div className="riso-color-chips">
            <span style={{ background: 'var(--accent-orange)' }} />
            <span style={{ background: 'var(--accent-teal)' }} />
            <span style={{ background: 'var(--accent-violet)' }} />
          </div>
          <span className="font-mono-ui" style={{ fontSize: 8, color: 'var(--topbar-muted)', letterSpacing: '0.08em' }}>v0.4.1</span>
        </div>

        <div className="p-3 space-y-0.5 relative" style={{ borderTop: '1px solid var(--topbar-border)', zIndex: 1 }}>
          {bottomNavItems.map(({ page, label, icon: Icon }, i) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors animate-row-in", currentPage === page ? "font-semibold" : "")}
              style={{
                animationDelay: `${(i + 10) * 25}ms`,
                ...(currentPage === page
                  ? { background: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--accent-orange)' }
                  : { color: 'var(--topbar-muted)' }),
              }}
              onMouseEnter={(e) => { if (currentPage !== page) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--topbar-fg)'; } }}
              onMouseLeave={(e) => { if (currentPage !== page) { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--topbar-muted)'; } }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </aside>

      {/* MAIN + AI CONTROLS */}
      <div className="flex flex-1 min-w-0 flex-col lg:flex-row overflow-hidden">
        <main className={`flex-1 min-w-0 ${["canvas", "settings", "chat", "agent", "tools", "help", "project_detail", "projects", "issues"].includes(currentPage) ? "overflow-hidden" : "overflow-y-auto"}`}>
          <PageErrorBoundary page={currentPage}>
          {currentPage === "home" ? (
            <DashboardPage onNavigate={handleNavigate} />
          ) : currentPage === "chat" ? (
            <ChatPage
              documentContext={docContextLocked ? null : docContext}
              onDisconnectDoc={() => setDocContextLocked(true)}
              onConnectDoc={(ctx) => { setDocContext(ctx); setDocContextLocked(false); }}
              tuningParams={tuningParams}
              initialSessionId={activeChatId}
            />
          ) : currentPage === "agent" ? (
            <AgentPage tuningParams={tuningParams} />
          ) : currentPage === "documents" ? (
            <DocumentsPage
              onContextChange={setDocContext}
              tuningParams={tuningParams}
              initialDocId={activeDocId}
            />
          ) : currentPage === "sheets" ? (
            <SheetsPage
              tuningParams={tuningParams}
              initialSheetId={activeSheetId}
            />
          ) : currentPage === "tools" ? (
            <ToolsPage />
          ) : currentPage === "benchmark" ? (
            <BenchmarkPage />
          ) : currentPage === "canvas" ? (
            <CanvasPage onNavigate={handleNavigate} />
          ) : currentPage === "projects" ? (
            <ProjectsPage
              onNavigateToProject={(id) => handleNavigate("project_detail", String(id))}
              onNavigate={(page) => handleNavigate(page)}
            />
          ) : currentPage === "project_detail" && activeProjectId ? (
            <ProjectDetailPage
              projectId={activeProjectId}
              onBack={() => setCurrentPage("projects")}
              onNavigate={handleNavigate}
            />
          ) : currentPage === "issues" ? (
            <IssueTrackerPage />
          ) : currentPage === "settings" ? (
            <SettingsPage
              theme={theme}
              setTheme={setTheme}
            />
          ) : currentPage === "help" ? (
            <HelpPage />
          ) : null}
          </PageErrorBoundary>
        </main>

        {currentPage !== "settings" && (
          <div className={`shrink-0 flex flex-col bg-background${aiPanelOpen ? "" : " border-l"}`}>
            {aiPanelOpen && (
              <AIControlPanel
                showDebug={showDebug}
                onShowDebugChange={setShowDebug}
                tuningParams={tuningParams}
                onTuningChange={setTuningParams}
                modelStatus={modelStatus}
              />
            )}
            <div className="mt-auto p-2 border-t">
              <button
                onClick={() => setAiPanelOpen(!aiPanelOpen)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={aiPanelOpen ? "Hide AI panel" : "Show AI panel"}
              >
                {aiPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>

      <Toaster />

      </div>
    </div>
    </ChatStreamProvider>
  );
}
