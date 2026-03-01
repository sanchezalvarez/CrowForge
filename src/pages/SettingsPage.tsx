import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Download, CheckCircle2, Loader2, X, AlertCircle, Trash2, ExternalLink } from "lucide-react";
import { toast } from "../hooks/useToast";
import { openUrl } from "@tauri-apps/plugin-opener";

const API_BASE = "http://127.0.0.1:8000";

const USER_AVATARS = [
  { emoji: "🐱", label: "Cat" },
  { emoji: "🐶", label: "Dog" },
  { emoji: "🐰", label: "Rabbit" },
  { emoji: "🦜", label: "Parrot" },
  { emoji: "🐟", label: "Fish" },
  { emoji: "🦊", label: "Fox" },
  { emoji: "🐢", label: "Turtle" },
  { emoji: "🐸", label: "Frog" },
  { emoji: "🐼", label: "Panda" },
  { emoji: "🦋", label: "Butterfly" },
  { emoji: "🐧", label: "Penguin" },
  { emoji: "🦔", label: "Hedgehog" },
];

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
  infoUrl?: string;
  tags?: string[];
}

const GALLERY_MODELS: GalleryModel[] = [
  // ── Agent-capable models (tool calling / function calling) ──
  {
    name: "Qwen2.5 7B Instruct Q4_K_M",
    size: "~4.7 GB",
    license: "Apache 2.0",
    description: "Best local agent model — native tool/function calling, strong coding and math.",
    filename: "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
    tags: ["agent", "coding", "math", "multilingual"],
  },
  {
    name: "Qwen2.5 3B Instruct Q4_K_M",
    size: "~1.9 GB",
    license: "Apache 2.0",
    description: "Lightweight agent model — supports tool calling, good for lower-end hardware.",
    filename: "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct",
    tags: ["agent", "translate", "multilingual", "fast"],
  },
  {
    name: "Hermes 3 Llama 3.1 8B Q4_K_M",
    size: "~4.9 GB",
    license: "Meta Llama 3.1",
    description: "NousResearch fine-tune with excellent structured output and function calling.",
    filename: "Hermes-3-Llama-3.1-8B-Q4_K_M.gguf",
    url: "https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B",
    tags: ["agent", "chat", "reasoning"],
  },
  {
    name: "Mistral Nemo 12B Instruct Q4_K_M",
    size: "~7.1 GB",
    license: "Apache 2.0",
    description: "Mistral + NVIDIA 12B — native function calling, strong reasoning. Needs 12 GB+ RAM.",
    filename: "Mistral-Nemo-Instruct-2407-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/resolve/main/Mistral-Nemo-Instruct-2407-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/mistralai/Mistral-Nemo-Instruct-2407",
    tags: ["agent", "chat", "reasoning"],
  },
  {
    name: "Functionary Small v3.2 Q4_K_M",
    size: "~4.9 GB",
    license: "Meta Llama 3.1",
    description: "Purpose-built for function/tool calling — top accuracy for agent workflows.",
    filename: "functionary-small-v3.2-Q4_K_M.gguf",
    url: "https://huggingface.co/meetkai/functionary-small-v3.2-GGUF/resolve/main/functionary-small-v3.2.Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/meetkai/functionary-small-v3.2",
    tags: ["agent"],
  },
  // ── General-purpose models (no tool calling) ──
  {
    name: "Llama 3.2 3B Instruct Q4_K_M",
    size: "~2.0 GB",
    license: "Meta Llama 3.2",
    description: "Compact and capable general-purpose model from Meta. Great for chat and writing.",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
    tags: ["chat", "general"],
  },
  {
    name: "Llama 3.1 8B Instruct Q4_K_M",
    size: "~4.9 GB",
    license: "Meta Llama 3.1",
    description: "Larger Llama model with stronger reasoning and instruction following.",
    filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct",
    tags: ["chat", "reasoning"],
  },
  {
    name: "Gemma 2 2B Instruct Q4_K_M",
    size: "~1.6 GB",
    license: "Google Gemma",
    description: "Google's lightweight Gemma 2 — fast, multilingual, good for translation.",
    filename: "gemma-2-2b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/google/gemma-2-2b-it",
    tags: ["translate", "multilingual", "fast"],
  },
  {
    name: "Gemma 2 9B Instruct Q4_K_M",
    size: "~5.4 GB",
    license: "Google Gemma",
    description: "Google's full Gemma 2 9B — excellent multilingual, translation and reasoning.",
    filename: "gemma-2-9b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/google/gemma-2-9b-it",
    tags: ["translate", "multilingual", "reasoning"],
  },
  {
    name: "Phi-3.5 mini Instruct Q4_K_M",
    size: "~2.2 GB",
    license: "MIT",
    description: "Microsoft's efficient small model, great for coding and reasoning.",
    filename: "Phi-3.5-mini-instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/microsoft/Phi-3.5-mini-instruct",
    tags: ["coding", "reasoning"],
  },
  {
    name: "Mistral 7B Instruct v0.3 Q4_K_M",
    size: "~4.1 GB",
    license: "Apache 2.0",
    description: "Mistral's flagship 7B instruction model — high quality output.",
    filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3",
    tags: ["chat", "general"],
  },
  {
    name: "Aya Expanse 8B Q4_K_M",
    size: "~4.9 GB",
    license: "CC-BY-NC 4.0",
    description: "Cohere's multilingual model trained on 23 languages — best-in-class for translation.",
    filename: "aya-expanse-8b-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/aya-expanse-8b-GGUF/resolve/main/aya-expanse-8b-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/CohereForAI/aya-expanse-8b",
    tags: ["translate", "multilingual"],
  },
  {
    name: "DeepSeek-R1 Distill Qwen 1.5B Q4_K_M",
    size: "~1.1 GB",
    license: "MIT",
    description: "Tiny but surprisingly capable reasoning model distilled from DeepSeek-R1.",
    filename: "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    tags: ["reasoning", "fast"],
  },
];

const ALL_TAGS = ["all", "agent", "chat", "translate", "multilingual", "coding", "reasoning", "math", "fast", "general"];

type Section = "ai" | "models" | "appearance" | "user" | "about";

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

interface SettingsPageProps {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  baseColor: string;
  setBaseColor: (c: string) => void;
}

export function SettingsPage({ theme, setTheme, baseColor, setBaseColor }: SettingsPageProps) {
  const [section, setSection] = useState<Section>("ai");
  const [avatarIndex, setAvatarIndex] = useState(() =>
    parseInt(localStorage.getItem("user_avatar_index") ?? "0", 10)
  );
  const [confirmDelete, setConfirmDelete] = useState<"chat" | "documents" | "sheets" | "all" | null>(null);
  const [deleting, setDeleting] = useState(false);

  function selectAvatar(index: number) {
    setAvatarIndex(index);
    localStorage.setItem("user_avatar_index", String(index));
    window.dispatchEvent(new Event("avatarchange"));
  }

  async function deleteData(target: "chat" | "documents" | "sheets" | "all") {
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE}/data/${target}`);
      const labels: Record<string, string> = { chat: "Chat", documents: "Documents", sheets: "Sheets", all: "All data" };
      toast(`${labels[target]} deleted.`);
      // Notify all pages to reload their data
      window.dispatchEvent(new CustomEvent("crowforge:data-deleted", { detail: { target } }));
    } catch {
      toast("Failed to delete data.", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }
  const [config, setConfig] = useState<AIConfig>({
    enable_llm: false,
    engine: "mock",
    base_url: "https://api.openai.com/v1",
    api_key: "",
    model: "gpt-4o-mini",
    model_path: "",
    models_dir: "C:/models",
    ctx_size: 8192,
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

  async function handleDeleteModel(filename: string) {
    try {
      await axios.delete(`${API_BASE}/ai/models/${encodeURIComponent(filename)}`);
      toast(`"${filename}" deleted.`);
      refreshModels();
    } catch {
      toast(`Failed to delete "${filename}".`, "error");
    }
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
    return () => {
      if (reinitPollRef.current) { clearInterval(reinitPollRef.current); reinitPollRef.current = null; }
    };
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
            setSaving(false);
            toast(`Settings applied — engine: ${r.data.active_engine}`, "success");
            setTimeout(() => setReinitStatus("idle"), 2500);
          } else if (r.data.status === "error") {
            clearInterval(reinitPollRef.current!);
            reinitPollRef.current = null;
            setReinitStatus("error");
            setSaving(false);
            setReinitError(r.data.error ?? "Unknown error");
          }
        } catch { /* backend might be briefly busy */ }
      }, 600);
    } catch {
      toast("Failed to save settings", "error");
      setReinitStatus("idle");
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
    { id: "appearance", label: "Appearance" },
    { id: "user", label: "User Settings" },
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
                <label className="text-xs font-medium text-muted-foreground">Context Size (tokens)</label>
                <input
                  type="number"
                  value={config.ctx_size}
                  onChange={(e) => setConfig({ ...config, ctx_size: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Minimum 4096 for agent tool calling. 8192 recommended. Higher values use more RAM.
                </p>
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

        {section === "appearance" && (
          <>
            <h2 className="text-lg font-semibold">Appearance</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Theme</label>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      theme === "light"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="w-full aspect-video rounded-md bg-white border shadow-sm flex items-center justify-center">
                      <div className="w-3/4 h-2 bg-slate-100 rounded-full" />
                    </div>
                    <span className="text-sm font-medium">Light</span>
                  </button>

                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      theme === "dark"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="w-full aspect-video rounded-md bg-slate-950 border border-slate-800 shadow-sm flex items-center justify-center">
                      <div className="w-3/4 h-2 bg-slate-800 rounded-full" />
                    </div>
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preset</label>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { id: "zinc", label: "Zinc", color: "bg-zinc-500" },
                    { id: "slate", label: "Slate", color: "bg-slate-500" },
                    { id: "stone", label: "Stone", color: "bg-stone-500" },
                    { id: "rose", label: "Rose", color: "bg-rose-500" },
                    { id: "orange", label: "Orange", color: "bg-orange-500" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setBaseColor(preset.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        baseColor === preset.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      <div className={`h-3 w-3 rounded-full ${preset.color}`} />
                      <span className="text-xs font-medium">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Avatar</label>
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {USER_AVATARS.map((av, i) => (
                    <button
                      key={i}
                      onClick={() => selectAvatar(i)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-2xl bg-muted hover:bg-muted/80 ${
                        avatarIndex === i ? "ring-2 ring-offset-2 ring-primary" : "opacity-70 hover:opacity-100"
                      }`}
                      title={av.label}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{m.name}</p>
                          {m.infoUrl && (
                            <button
                              onClick={() => openUrl(m.infoUrl!)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="More info on HuggingFace"
                            >
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
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
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                              <CheckCircle2 size={14} />
                              Installed
                            </span>
                            <button
                              onClick={() => handleDeleteModel(m.filename)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete model"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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

        {section === "user" && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="text-lg font-semibold">User Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your data and preferences.</p>
            </div>

            {/* Data Management */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Data Management</h3>
              <p className="text-xs text-muted-foreground">Permanently delete stored data. This cannot be undone.</p>

              {/* Per-module rows */}
              {([
                { key: "chat" as const, label: "Chat history", description: "All chat sessions and messages" },
                { key: "documents" as const, label: "Documents", description: "All documents and their content" },
                { key: "sheets" as const, label: "Sheets", description: "All spreadsheets and their data" },
              ]).map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <button
                    onClick={() => setConfirmDelete(key)}
                    className="text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3 w-3 inline mr-1" />
                    Delete
                  </button>
                </div>
              ))}

              {/* Delete everything */}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-destructive">Delete everything</p>
                  <p className="text-xs text-muted-foreground">Wipe all chat, documents and sheets</p>
                </div>
                <button
                  onClick={() => setConfirmDelete("all")}
                  className="text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
                >
                  <Trash2 className="h-3 w-3 inline mr-1" />
                  Delete all
                </button>
              </div>
            </div>

            {/* Confirm dialog */}
            {confirmDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !deleting && setConfirmDelete(null)}>
                <div className="bg-background border border-border rounded-lg shadow-xl w-[360px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {confirmDelete === "all" ? "Delete all data?" : `Delete ${confirmDelete} data?`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will permanently remove {confirmDelete === "all" ? "all chats, documents and sheets" : `all ${confirmDelete}`}. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      disabled={deleting}
                      className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteData(confirmDelete)}
                      disabled={deleting}
                      className="text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {section === "about" && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="text-lg font-semibold">About CrowForge</h2>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p><span className="text-foreground font-medium">Version</span>&nbsp; 0.1.0</p>
                <p><span className="text-foreground font-medium">Data storage</span>&nbsp; Local SQLite (crowforge.db)</p>
                <p><span className="text-foreground font-medium">Architecture</span>&nbsp; Tauri + React + FastAPI</p>
              </div>
            </div>

            {/* Developer card */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
                  LT
                </div>
                <div>
                  <p className="font-semibold text-sm">Created by Ľubomír Timko — Sanchez</p>
                  <p className="text-xs text-muted-foreground">VFX Partner · 20+ years in 3D, game dev &amp; visual effects · 50+ projects</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => openUrl("https://www.sanchez.sk")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H11.82c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/></svg>
                  sanchez.sk
                </button>
                <button
                  onClick={() => openUrl("https://www.linkedin.com/in/%C4%BEubom%C3%ADr-timko-sanchez/")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/></svg>
                  LinkedIn
                </button>
                <button
                  onClick={() => openUrl("mailto:timko.sanchez@gmail.com")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/></svg>
                  timko.sanchez@gmail.com
                </button>
              </div>
            </div>

            {/* Built with Claude */}
            <div className="rounded-lg border bg-muted/30 p-4 flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-[#D97757]" fill="currentColor" aria-label="Claude">
                <path d="M17.304 3.541 12.836 16.37H10.31L5.842 3.54h2.725l3.017 9.645L14.6 3.54h2.704zM5 20.459h2.548v-2.394H5v2.394zm11.452 0H19v-2.394h-2.548v2.394z"/>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">AI-assisted development by Claude</p>
                <p className="text-xs text-muted-foreground">Built with Anthropic's Claude Code — AI pair programming</p>
              </div>
              <button
                onClick={() => openUrl("https://claude.ai/code")}
                className="text-xs px-2.5 py-1 rounded-md border hover:bg-muted transition-colors shrink-0"
              >
                claude.ai/code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
