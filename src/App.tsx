import { useState, useEffect, useRef, Component, type ReactNode } from "react";
import axios from "axios";
import {
  Gauge,
  MessageSquare,
  FileText,
  Table2,
  Settings,
  PanelRightClose,
  PanelRightOpen,
  CpuIcon,
} from "lucide-react";
import crowforgeLogo from "./assets/crowforge_ico.png";
import { cn } from "./lib/utils";
import { BenchmarkPage } from "./pages/BenchmarkPage";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SheetsPage } from "./pages/SheetsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SplashScreen } from "./components/SplashScreen";
import { OnboardingPage } from "./pages/OnboardingPage";
import { Toaster } from "./components/ui/toaster";
import { AIControlPanel, TuningParams } from "./components/AIControlPanel";
import { ChatStreamProvider } from "./contexts/ChatStreamContext";

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
type AppPage = "chat" | "documents" | "sheets" | "benchmark" | "settings";

export interface DocumentContext {
  title: string;
  outline: string[];
  selectedText: string | null;
  fullText: string | null;
}

export default function App() {
  const [appStatus, setAppStatus] = useState<AppStatus>("loading");
  const [currentPage, setCurrentPage] = useState<AppPage>("chat");
  const [docContext, setDocContext] = useState<DocumentContext | null>(null);
  const [docContextLocked, setDocContextLocked] = useState(false);

  useEffect(() => { setDocContextLocked(false); }, [docContext]);

  // Theme state — persisted to localStorage
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") || "light";
  });

  const [baseColor, setBaseColor] = useState<string>(() => {
    return localStorage.getItem("base_color") || "zinc";
  });

  useEffect(() => {
    function handleUnload() {
      // Best-effort: tell backend to exit when the window closes
      navigator.sendBeacon("http://127.0.0.1:8000/shutdown");
    }
    window.addEventListener("unload", handleUnload);
    return () => window.removeEventListener("unload", handleUnload);
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
    localStorage.setItem("base_color", baseColor);
    // Remove all possible theme classes
    const themes = ["theme-zinc", "theme-slate", "theme-stone", "theme-rose", "theme-orange"];
    document.documentElement.classList.remove(...themes);
    document.documentElement.classList.add(`theme-${baseColor}`);
  }, [baseColor]);

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
    { page: "chat", label: "Chat", icon: MessageSquare },
    { page: "documents", label: "Documents", icon: FileText },
    { page: "sheets", label: "Sheets", icon: Table2 },
    { page: "benchmark", label: "Benchmark", icon: Gauge },
    { page: "settings", label: "Settings", icon: Settings },
  ];

  if (appStatus === "loading") return <SplashScreen />;
  if (appStatus === "failed") return <SplashScreen failed />;
  if (appStatus === "onboarding") return <OnboardingPage onComplete={() => setAppStatus("ready")} />;

  return (
    <ChatStreamProvider>
    <div className="flex h-screen w-full overflow-hidden bg-muted/40 text-foreground font-sans antialiased">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col border-r bg-background">
        <div className="h-16 flex items-center px-4 border-b gap-2.5">
          <img src={crowforgeLogo} alt="CrowForge" className="h-8 w-8 rounded-md shrink-0" />
          <span className="font-bold text-base tracking-tight truncate">CrowForge</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {navItems.map(({ page, label, icon: Icon }) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                  currentPage === page
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN + AI CONTROLS */}
      <div className="flex flex-1 min-w-0 flex-col lg:flex-row overflow-hidden">
        <main className="flex-1 min-w-0 overflow-y-auto">
          <PageErrorBoundary page={currentPage}>
          {currentPage === "chat" ? (
            <ChatPage
              documentContext={docContextLocked ? null : docContext}
              onDisconnectDoc={() => setDocContextLocked(true)}
              onConnectDoc={(ctx) => { setDocContext(ctx); setDocContextLocked(false); }}
              tuningParams={tuningParams}
            />
          ) : currentPage === "documents" ? (
            <DocumentsPage onContextChange={setDocContext} tuningParams={tuningParams} />
          ) : currentPage === "sheets" ? (
            <SheetsPage tuningParams={tuningParams} />
          ) : currentPage === "benchmark" ? (
            <BenchmarkPage />
          ) : currentPage === "settings" ? (
            <SettingsPage
              theme={theme}
              setTheme={setTheme}
              baseColor={baseColor}
              setBaseColor={setBaseColor}
            />
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

      {/* Model status indicator — bottom-center, only shown when not loaded */}
      {modelStatus !== "loaded" && modelStatus !== "no_local" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-background border shadow-md text-muted-foreground pointer-events-none">
          <CpuIcon size={14} className={modelStatus === "unloaded" ? "text-amber-500" : "text-muted-foreground/60"} />
          {modelStatus === "unloaded" ? "Model unloaded (idle)" : "No model loaded"}
        </div>
      )}
    </div>
    </ChatStreamProvider>
  );
}
