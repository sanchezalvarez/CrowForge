import { useState, useEffect } from "react";
import axios from "axios";
import {
  AlertCircle,
  Gauge,
  MessageSquare,
  FileText,
  Table2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import crowforgeLogo from "./assets/crowforge_ico.png";
import { cn } from "./lib/utils";
import { BenchmarkPage } from "./pages/BenchmarkPage";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SheetsPage } from "./pages/SheetsPage";
import { Toaster } from "./components/ui/toaster";
import { AIControlPanel, TuningParams } from "./components/AIControlPanel";

const API_BASE = "http://127.0.0.1:8000";

type AppPage = "chat" | "documents" | "sheets" | "benchmark";

export interface DocumentContext {
  title: string;
  outline: string[];
  selectedText: string | null;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>("chat");
  const [backendOnline, setBackendOnline] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
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

  useEffect(() => {
    axios.get(`${API_BASE}/state`).then(() => setBackendOnline(true)).catch(() => setBackendOnline(false));
  }, []);

  const navItems: { page: AppPage; label: string; icon: typeof MessageSquare }[] = [
    { page: "chat", label: "Chat", icon: MessageSquare },
    { page: "documents", label: "Documents", icon: FileText },
    { page: "sheets", label: "Sheets", icon: Table2 },
    { page: "benchmark", label: "Benchmark", icon: Gauge },
  ];

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
      <main className="flex-1 min-w-0 overflow-y-auto relative">
        {appError && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">{appError}</div>
              <button
                onClick={() => setAppError(null)}
                className="text-destructive/60 hover:text-destructive text-xs font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!backendOnline ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center max-w-sm">
              <AlertCircle className="h-8 w-8 text-destructive/60 mx-auto mb-3" />
              <p className="text-sm font-medium text-destructive">Backend is offline</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Start the backend with:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                  python -m backend.app
                </code>
              </p>
            </div>
          </div>
        ) : currentPage === "chat" ? (
          <ChatPage documentContext={docContext} tuningParams={tuningParams} />
        ) : currentPage === "documents" ? (
          <DocumentsPage onContextChange={setDocContext} tuningParams={tuningParams} />
        ) : currentPage === "sheets" ? (
          <SheetsPage tuningParams={tuningParams} />
        ) : currentPage === "benchmark" ? (
          <BenchmarkPage />
        ) : null}

        <button
          onClick={() => setAiPanelOpen(!aiPanelOpen)}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={aiPanelOpen ? "Hide AI panel" : "Show AI panel"}
        >
          {aiPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </main>

      {aiPanelOpen && (
        <AIControlPanel
          showDebug={showDebug}
          onShowDebugChange={setShowDebug}
          tuningParams={tuningParams}
          onTuningChange={setTuningParams}
        />
      )}
      </div>

      <Toaster />
    </div>
  );
}
