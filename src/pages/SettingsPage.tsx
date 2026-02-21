import { useState, useEffect } from "react";
import axios from "axios";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, CheckCircle2 } from "lucide-react";
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

const GALLERY_MODELS = [
  {
    name: "Llama 3.2 3B Instruct Q4_K_M",
    size: "~2.0 GB",
    license: "Meta Llama 3.2",
    description: "Compact and capable general-purpose model from Meta.",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
  },
  {
    name: "Phi-3.5 mini Instruct Q4_K_M",
    size: "~2.2 GB",
    license: "MIT",
    description: "Microsoft's efficient small model, great for coding and reasoning.",
    filename: "Phi-3.5-mini-instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
  },
  {
    name: "Qwen2.5 3B Instruct Q4_K_M",
    size: "~1.9 GB",
    license: "Apache 2.0",
    description: "Alibaba's multilingual model with strong instruction following.",
    filename: "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
  },
  {
    name: "Mistral 7B Instruct v0.3 Q4_K_M",
    size: "~4.1 GB",
    license: "Apache 2.0",
    description: "Mistral's flagship 7B instruction model — high quality output.",
    filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
  },
];

type Section = "ai" | "models" | "about";

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

  function refreshModels() {
    axios.get(`${API_BASE}/ai/models`).then((r) => {
      setInstalledFiles(r.data.models.map((m: { filename: string }) => m.filename));
    }).catch(() => {});
  }

  useEffect(() => {
    axios.get(`${API_BASE}/settings/ai`).then((r) => setConfig(r.data)).catch(() => {});
    refreshModels();
  }, []);

  // Re-scan models when switching to gallery tab
  useEffect(() => {
    if (section === "models") refreshModels();
  }, [section]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/settings/ai`, config);
      toast(`Settings saved — engine: ${res.data.active_engine}`, "success");
    } catch {
      toast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(url: string) {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  const navItems: { id: Section; label: string }[] = [
    { id: "ai", label: "AI Configuration" },
    { id: "models", label: "Model Gallery" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="flex h-full">
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

            {/* Enable LLM */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enable_llm}
                onChange={(e) => setConfig({ ...config, enable_llm: e.target.checked })}
                className="h-4 w-4 rounded border accent-primary"
              />
              <span className="text-sm font-medium">Enable LLM</span>
            </label>

            {/* Engine select */}
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
              />
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
                Place downloaded <code>.gguf</code> files in your Models Directory, then select them in the AI panel.
              </p>
            </div>

            <div className="space-y-3">
              {GALLERY_MODELS.map((m) => {
                const installed = installedFiles.includes(m.filename);
                return (
                  <div key={m.filename} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                        <span>{m.size}</span>
                        <span>·</span>
                        <span>{m.license}</span>
                      </div>
                    </div>
                    {installed ? (
                      <span className="flex items-center gap-1 shrink-0 text-xs font-medium text-green-600">
                        <CheckCircle2 size={14} />
                        Installed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDownload(m.url)}
                        className="flex items-center gap-1.5 shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        <Download size={13} />
                        Download
                      </button>
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
