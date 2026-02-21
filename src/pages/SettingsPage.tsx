import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Download, CheckCircle2, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "../hooks/useToast";

const API_BASE = "http://127.0.0.1:8000";

type EngineType = "mock" | "http" | "local";

interface AIConfig {
  enable_llm: boolean;
  engine: EngineType;
  base_url: string;
  api_key: string;
  model: string;
  model_path: string;
  models_dir: string;
  ctx_size: number;
}

interface GalleryModel {
  name: string;
  size: string;
  license: string;
  description: string;
  filename: string;
  url: string;
  tags?: string[];
}

const GALLERY_MODELS: GalleryModel[] = [
  {
    name: "Llama 3.2 3B Instruct Q4_K_M",
    size: "~2.0 GB",
    license: "Meta Llama 3.2",
    description: "Compact and capable general-purpose model from Meta. Great for chat and writing.",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    tags: ["chat", "general"],
  },
  {
    name: "Llama 3.1 8B Instruct Q4_K_M",
    size: "~4.9 GB",
    license: "Meta Llama 3.1",
    description: "Larger Llama model with stronger reasoning and instruction following.",
    filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    tags: ["chat", "reasoning"],
  },
  {
    name: "Gemma 2 2B Instruct Q4_K_M",
    size: "~1.6 GB",
    license: "Google Gemma",
    description: "Google's lightweight Gemma 2 — fast, multilingual, good for translation.",
    filename: "gemma-2-2b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
    tags: ["translate", "multilingual", "fast"],
  },
  {
    name: "Gemma 2 9B Instruct Q4_K_M",
    size: "~5.4 GB",
    license: "Google Gemma",
    description: "Google's full Gemma 2 9B — excellent multilingual, translation and reasoning.",
    filename: "gemma-2-9b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf",
    tags: ["translate", "multilingual", "reasoning"],
  },
  {
    name: "Phi-3.5 mini Instruct Q4_K_M",
    size: "~2.2 GB",
    license: "MIT",
    description: "Microsoft's efficient small model, great for coding and reasoning.",
    filename: "Phi-3.5-mini-instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
    tags: ["coding", "reasoning"],
  },
  {
    name: "Qwen2.5 3B Instruct Q4_K_M",
    size: "~1.9 GB",
    license: "Apache 2.0",
    description: "Alibaba's multilingual model with strong instruction following and translation.",
    filename: "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    tags: ["translate", "multilingual"],
  },
  {
    name: "Qwen2.5 7B Instruct Q4_K_M",
    size: "~4.7 GB",
    license: "Apache 2.0",
    description: "Larger Qwen model — strong at coding, math and multilingual tasks.",
    filename: "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    tags: ["coding", "math", "multilingual"],
  },
  {
    name: "Mistral 7B Instruct v0.3 Q4_K_M",
    size: "~4.1 GB",
    license: "Apache 2.0",
    description: "Mistral's flagship 7B instruction model — high quality output.",
    filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    tags: ["chat", "general"],
  },
  {
    name: "Aya Expanse 8B Q4_K_M",
    size: "~4.9 GB",
    license: "CC-BY-NC 4.0",
    description: "Cohere's multilingual model trained on 23 languages — best-in-class for translation.",
    filename: "aya-expanse-8b-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/aya-expanse-8b-GGUF/resolve/main/aya-expanse-8b-Q4_K_M.gguf",
    tags: ["translate", "multilingual"],
  },
  {
    name: "DeepSeek-R1 Distill Qwen 1.5B Q4_K_M",
    size: "~1.1 GB",
    license: "MIT",
    description: "Tiny but surprisingly capable reasoning model distilled from DeepSeek-R1.",
    filename: "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    tags: ["reasoning", "fast"],
  },
];

const ALL_TAGS = ["all", "chat", "translate", "multilingual", "coding", "reasoning", "math", "fast", "general"];

type Section = "ai" | "models" | "about";

interface DownloadState {
  progress: number;
  total: number;
  done: boolean;
  error: string | null;
  running: boolean;
}

function fmt_bytes(b: number) {
  if (b === 0) return "0 B";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function SettingsPage() {
  const [section, setSection] = useState<Section>("ai");
  const [config, setConfig] = useState<AIConfig>({
    enable_llm: false,
    engine: "mock",
    base_url: "https://api.openai.com/v1",
    api_key: "",
    model: "gpt-4o-mini",
    model_path: "",
    models_dir: "C:/models",
    ctx_size: 2048,
  });
  const [installedFiles, setInstalledFiles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [reinitStatus, setReinitStatus] = useState<"idle" | "reinitializing" | "done" | "error">("idle");
  const [reinitError, setReinitError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [tagFilter, setTagFilter] = useState("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reinitPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refreshModels() {
    axios.get(`${API_BASE}/ai/models`).then((r) => {
      setInstalledFiles(r.data.models.map((m: { filename: string }) => m.filename));
    }).catch(() => {});
  }

  function refreshDownloads() {
    axios.get(`${API_BASE}/ai/models/download/status`).then((r) => {
      setDownloads(r.data.downloads ?? {});
      // If any download just finished, rescan installed models
      const states: DownloadState[] = Object.values(r.data.downloads ?? {});
      if (states.some((s) => s.done)) refreshModels();
    }).catch(() => {});
  }

  useEffect(() => {
    axios.get(`${API_BASE}/settings/ai`).then((r) => setConfig(r.data)).catch(() => {});
    refreshModels();
  }, []);

  useEffect(() => {
    if (section === "models") {
      refreshModels();
      refreshDownloads();
    }
  }, [section]);

  // Poll downloads while any are running
  useEffect(() => {
    const anyRunning = Object.values(downloads).some((d) => d.running);
    if (anyRunning && !pollRef.current) {
      pollRef.current = setInterval(refreshDownloads, 800);
    } else if (!anyRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [downloads]);

  async function handleSave() {
    setSaving(true);
    setReinitError(null);
    try {
      await axios.post(`${API_BASE}/settings/ai`, config);
      setReinitStatus("reinitializing");
      // Poll until backend finishes re-initializing engines
      reinitPollRef.current = setInterval(async () => {
        try {
          const r = await axios.get(`${API_BASE}/settings/ai/status`);
          if (r.data.status === "ready") {
            clearInterval(reinitPollRef.current!);
            reinitPollRef.current = null;
            setReinitStatus("done");
            toast(`Settings applied — engine: ${r.data.active_engine}`, "success");
            setTimeout(() => setReinitStatus("idle"), 2500);
          } else if (r.data.status === "error") {
            clearInterval(reinitPollRef.current!);
            reinitPollRef.current = null;
            setReinitStatus("error");
            setReinitError(r.data.error ?? "Unknown error");
          }
        } catch { /* backend might be briefly busy */ }
      }, 600);
    } catch {
      toast("Failed to save settings", "error");
      setReinitStatus("idle");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(model: GalleryModel) {
    try {
      await axios.post(`${API_BASE}/ai/models/download`, {
        url: model.url,
        filename: model.filename,
      });
      setDownloads((prev) => ({
        ...prev,
        [model.filename]: { progress: 0, total: 0, done: false, error: null, running: true },
      }));
      // Start polling
      refreshDownloads();
    } catch (e: any) {
      toast(`Failed to start download: ${e?.response?.data?.detail ?? e.message}`, "error");
    }
  }

  async function handleCancelDownload(filename: string) {
    await axios.delete(`${API_BASE}/ai/models/download/${encodeURIComponent(filename)}`).catch(() => {});
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
  }

  const navItems: { id: Section; label: string }[] = [
    { id: "ai", label: "AI Configuration" },
    { id: "models", label: "Model Gallery" },
    { id: "about", label: "About" },
  ];

  const filteredModels = tagFilter === "all"
    ? GALLERY_MODELS
    : GALLERY_MODELS.filter((m) => m.tags?.includes(tagFilter));

  return (
    <div className="flex h-full relative">
      {/* Re-init overlay */}
      {(reinitStatus === "reinitializing" || reinitStatus === "done" || reinitStatus === "error") && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-background shadow-xl px-10 py-8 max-w-xs text-center">
            {reinitStatus === "reinitializing" && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div>
                  <p className="font-semibold text-sm">Applying settings…</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The AI engine is restarting. This may take a few seconds if a local model is loading.
                  </p>
                </div>
              </>
            )}
            {reinitStatus === "done" && (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="font-semibold text-sm">Settings applied!</p>
              </>
            )}
            {reinitStatus === "error" && (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-sm">Engine failed to start</p>
                  <p className="text-xs text-muted-foreground mt-1">{reinitError}</p>
                </div>
                <button
                  onClick={() => setReinitStatus("idle")}
                  className="text-xs px-4 py-1.5 rounded-md border hover:bg-muted transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Side tabs */}
      <nav className="w-44 shrink-0 border-r p-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
              section === item.id
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl space-y-6">
        {section === "ai" && (
          <>
            <h2 className="text-lg font-semibold">AI Configuration</h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enable_llm}
                onChange={(e) => setConfig({ ...config, enable_llm: e.target.checked })}
                className="h-4 w-4 rounded border accent-primary"
              />
              <span className="text-sm font-medium">Enable LLM</span>
            </label>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Engine</label>
              <select
                value={config.engine}
                onChange={(e) => setConfig({ ...config, engine: e.target.value as EngineType })}
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="mock">Mock (no AI)</option>
                <option value="http">HTTP / OpenAI-compatible</option>
                <option value="local">Local GGUF</option>
              </select>
            </div>

            {config.engine === "http" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Base URL</label>
                  <input
                    value={config.base_url}
                    onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">API Key</label>
                  <input
                    type="password"
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <input
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Models Directory</label>
              <input
                value={config.models_dir}
                onChange={(e) => setConfig({ ...config, models_dir: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                placeholder="C:/models"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Downloads will be saved here.</p>
            </div>

            {config.engine === "local" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Context Size</label>
                <input
                  type="number"
                  value={config.ctx_size}
                  onChange={(e) => setConfig({ ...config, ctx_size: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </>
        )}

        {section === "models" && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Free GGUF Models</h2>
              <p className="text-xs text-muted-foreground">
                Downloads go to your <span className="font-mono text-foreground">{config.models_dir || "Models Directory"}</span>. Change it in AI Configuration.
              </p>
            </div>

            {/* Tag filter */}
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    tagFilter === tag
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredModels.map((m) => {
                const installed = installedFiles.includes(m.filename);
                const dl = downloads[m.filename];
                const pct = dl && dl.total > 0 ? Math.round((dl.progress / dl.total) * 100) : 0;

                return (
                  <div key={m.filename} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                          <span>{m.size}</span>
                          <span>·</span>
                          <span>{m.license}</span>
                          {m.tags && m.tags.map((t) => (
                            <span key={t} className="px-1.5 py-0 rounded-full bg-muted text-muted-foreground/70">{t}</span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {installed && !dl?.running ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle2 size={14} />
                            Installed
                          </span>
                        ) : dl?.running ? (
                          <button
                            onClick={() => handleCancelDownload(m.filename)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X size={13} />
                            Cancel
                          </button>
                        ) : dl?.error ? (
                          <button
                            onClick={() => handleDownload(m)}
                            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-destructive border-destructive/30"
                          >
                            <AlertCircle size={13} />
                            Retry
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDownload(m)}
                            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                          >
                            <Download size={13} />
                            Download
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {dl?.running && (
                      <div className="space-y-1">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: dl.total > 0 ? `${pct}%` : "0%" }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" />
                            Downloading…
                          </span>
                          <span>
                            {dl.total > 0
                              ? `${fmt_bytes(dl.progress)} / ${fmt_bytes(dl.total)} (${pct}%)`
                              : fmt_bytes(dl.progress)}
                          </span>
                        </div>
                      </div>
                    )}
                    {dl?.error && (
                      <p className="text-[11px] text-destructive">{dl.error}</p>
                    )}
                    {dl?.done && !installed && (
                      <p className="text-[11px] text-green-600">Download complete — rescanning…</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {section === "about" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">About CrowForge</h2>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Version</span> 0.1.0</p>
              <p><span className="text-muted-foreground">Data storage</span> Local SQLite (campaigns.db)</p>
              <p><span className="text-muted-foreground">Architecture</span> Tauri + React + FastAPI</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
