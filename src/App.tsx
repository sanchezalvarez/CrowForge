import { useState, useEffect } from "react";
import axios from "axios";
import {
  PlusCircle,
  Briefcase,
  Sparkles,
  AlertCircle,
  Gauge,
  MessageSquare,
  FileText,
  Table2,
} from "lucide-react";
import crowforgeLogo from "./assets/crowforge_ico.png";
import { cn } from "./lib/utils";
import { Campaign, PromptTemplate } from "./types";
import { MarketingGeneratorPage } from "./pages/MarketingGeneratorPage";
import { BenchmarkPage } from "./pages/BenchmarkPage";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SheetsPage } from "./pages/SheetsPage";
import { Toaster } from "./components/ui/toaster";
import { AIControlPanel } from "./components/AIControlPanel";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./components/ui/dialog";

const API_BASE = "http://127.0.0.1:8000";

type AppPage = "chat" | "documents" | "sheets" | "main" | "benchmark";

export interface DocumentContext {
  title: string;
  outline: string[];
  selectedText: string | null;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>("chat");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
  const [docContext, setDocContext] = useState<DocumentContext | null>(null);

  // Prompt template state
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(() => {
    const v = localStorage.getItem("ai_template_id");
    return v ? parseInt(v) : null;
  });

  useEffect(() => {
    axios.get(`${API_BASE}/prompt-templates`).then((res) => {
      const all: PromptTemplate[] = res.data;
      const visible = all.filter((t) => t.category !== "Refine");
      setTemplates(visible);
      if (selectedTemplateId === null && visible.length > 0) {
        setSelectedTemplateId(visible[0].id);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTemplateId !== null) localStorage.setItem("ai_template_id", String(selectedTemplateId));
  }, [selectedTemplateId]);

  // AI debug toggle
  const [showDebug, setShowDebug] = useState(() =>
    localStorage.getItem("ai_show_debug") === "true"
  );
  useEffect(() => {
    localStorage.setItem("ai_show_debug", String(showDebug));
  }, [showDebug]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogName, setDialogName] = useState("");
  const [dialogBrief, setDialogBrief] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get(`${API_BASE}/campaigns`);
        setCampaigns(res.data);
        setBackendOnline(true);

        const stateRes = await axios.get(`${API_BASE}/state`);
        const { last_campaign_id } = stateRes.data;
        if (last_campaign_id) {
          const campId = parseInt(last_campaign_id);
          const camp = res.data.find((c: Campaign) => c.id === campId);
          if (camp) {
            const fullRes = await axios.get(`${API_BASE}/campaigns/${campId}`);
            setSelectedCampaign(fullRes.data);
          }
        }
      } catch {
        setBackendOnline(false);
      }
    };
    init();
  }, []);

  const handleSelectCampaign = async (campaign: Campaign) => {
    const res = await axios.get(`${API_BASE}/campaigns/${campaign.id}`);
    setSelectedCampaign(res.data);
    await axios.post(`${API_BASE}/state`, { campaign_id: campaign.id });
  };

  const openCreateDialog = () => {
    setDialogName("");
    setDialogBrief("");
    setDialogOpen(true);
  };

  const handleCreateCampaign = async () => {
    const name = dialogName.trim();
    if (!name) return;
    setDialogOpen(false);
    try {
      const res = await axios.post(`${API_BASE}/campaigns`, {
        client_id: 0,
        name,
        brief: dialogBrief.trim(),
        status: "draft",
      });
      setCampaigns((prev) => [res.data, ...prev]);
      setSelectedCampaign(res.data);
    } catch {
      setAppError("We couldn't create this project. Please check your connection and try again.");
    }
  };

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
          {/* Navigation */}
          <div className="p-3 space-y-0.5">
            <button
              onClick={() => setCurrentPage("chat")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                currentPage === "chat"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <MessageSquare size={14} />
              Chat
            </button>
            <button
              onClick={() => setCurrentPage("documents")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                currentPage === "documents"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FileText size={14} />
              Documents
            </button>
            <button
              onClick={() => setCurrentPage("sheets")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                currentPage === "sheets"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Table2 size={14} />
              Sheets
            </button>
            <button
              onClick={() => setCurrentPage("main")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                currentPage === "main"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Sparkles size={14} />
              Generator
            </button>
            <button
              onClick={() => setCurrentPage("benchmark")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                currentPage === "benchmark"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Gauge size={14} />
              Benchmark
            </button>
          </div>

          <div className="mx-3 border-t" />

          {/* Projects (legacy generator) */}
          <div className="p-3 space-y-1">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Projects
              </span>
              <button
                onClick={openCreateDialog}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <PlusCircle size={15} />
              </button>
            </div>
            <div className="space-y-0.5">
              {campaigns.length > 0 ? (
                campaigns.map((camp) => (
                  <button
                    key={camp.id}
                    onClick={() => handleSelectCampaign(camp)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                      selectedCampaign?.id === camp.id
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Briefcase
                      size={13}
                      className={
                        selectedCampaign?.id === camp.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground/60"
                      }
                    />
                    <span className="truncate text-left">{camp.name}</span>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <Briefcase className="h-5 w-5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No projects yet.</p>
                  <button
                    onClick={openCreateDialog}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    + New project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN + AI CONTROLS */}
      <div className="flex flex-1 min-w-0 flex-col lg:flex-row overflow-hidden">
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Inline error banner */}
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

        {currentPage === "chat" ? (
          <ChatPage documentContext={docContext} />
        ) : currentPage === "documents" ? (
          <DocumentsPage onContextChange={setDocContext} />
        ) : currentPage === "sheets" ? (
          <SheetsPage />
        ) : currentPage === "benchmark" ? (
          <BenchmarkPage />
        ) : !backendOnline ? (
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
        ) : selectedCampaign ? (
          <MarketingGeneratorPage
            campaign={selectedCampaign}
            onCampaignUpdate={setSelectedCampaign}
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onTemplateChange={setSelectedTemplateId}
            showDebug={showDebug}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center shadow-lg border mb-6">
              <Sparkles className="h-7 w-7 text-primary/60" />
            </div>
            <h2 className="text-sm font-semibold text-foreground/60">Get Started</h2>
            <p className="text-xs text-muted-foreground mt-2 mb-4">
              Select a project or create a new one to use the generator.
            </p>
            <Button variant="outline" size="sm" onClick={openCreateDialog}>
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              New Project
            </Button>
          </div>
        )}
      </main>

      {/* Right-side AI Controls */}
      <AIControlPanel
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={setSelectedTemplateId}
        showDebug={showDebug}
        onShowDebugChange={setShowDebug}
      />
      </div>

      {/* Create Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Enter project details.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreateCampaign(); }}
            className="space-y-3 mt-2"
          >
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <input
                autoFocus
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                placeholder="Project name"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Goals</label>
              <textarea
                value={dialogBrief}
                onChange={(e) => setDialogBrief(e.target.value)}
                placeholder="Describe the project goals..."
                rows={3}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!dialogName.trim()}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
