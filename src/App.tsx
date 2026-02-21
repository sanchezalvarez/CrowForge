import { useState, useEffect } from "react";
import axios from "axios";
import {
  Gauge,
  MessageSquare,
  FileText,
  Table2,
  Settings,
  PanelRightClose,
  PanelRightOpen,
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

const API_BASE = "http://127.0.0.1:8000";

type AppStatus = "loading" | "onboarding" | "ready" | "failed";
type AppPage = "chat" | "documents" | "sheets" | "benchmark" | "settings";

export interface DocumentContext {
  title: string;
  outline: string[];
  selectedText: string | null;
}

export default function App() {
  const [appStatus, setAppStatus] = useState<AppStatus>("loading");
  const [currentPage, setCurrentPage] = useState<AppPage>("chat");
  const [docContext, setDocContext] = useState<DocumentContext | null>(null);

  // Tuning params state — persisted to localStorage
  const [tuningParams, setTuningParams] = useState<TuningParams>(() => {
    try {
      const stored = localStorage.getItem("ai_tuning");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { temperature: 0.7, topP: 0.95, maxTokens: 1024, seed: null };
  });

  useEffect(() => {
    localStorage.setItem("ai_tuning", JSON.stringify(tuningParams));
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

  // Backend polling on startup
  useEffect(() => {
    let cancelled = false;
    const MAX_ATTEMPTS = 25;
    const INTERVAL_MS = 600;

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
    <div className="flex h-screen w-full overflow-hidden bg-muted/40 text-foreground font-sans antialiased">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r bg-background">
        <div className="h-20 flex items-center px-5 border-b">
          <div className="flex items-center gap-3 font-bold text-2xl tracking-tight">
            <img src={crowforgeLogo} alt="CrowForge" className="h-12 w-12 rounded-lg" />
            <span>CrowForge</span>
          </div>
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
          {currentPage === "chat" ? (
            <ChatPage documentContext={docContext} tuningParams={tuningParams} />
          ) : currentPage === "documents" ? (
            <DocumentsPage onContextChange={setDocContext} tuningParams={tuningParams} />
          ) : currentPage === "sheets" ? (
            <SheetsPage tuningParams={tuningParams} />
          ) : currentPage === "benchmark" ? (
            <BenchmarkPage />
          ) : currentPage === "settings" ? (
            <SettingsPage />
          ) : null}
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
    </div>
  );
}
