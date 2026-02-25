import { useState } from "react";
import axios from "axios";
import { CheckCircle2, AlertCircle } from "lucide-react";
import crowforgeLogo from "../assets/crowforge_ico.png";
import { cn } from "../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

type EngineType = "mock" | "http" | "local";

interface Props {
  onComplete: () => void;
}

export function OnboardingPage({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [engine, setEngine] = useState<EngineType>("mock");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [modelsDir, setModelsDir] = useState("C:/models");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  async function handleApply() {
    setSaving(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/settings/ai`, {
        enable_llm: engine !== "mock",
        engine,
        base_url: baseUrl,
        api_key: apiKey,
        model,
        models_dir: modelsDir,
      });
      await axios.post(`${API_BASE}/state`, { onboarding_completed: true });
      setStep(3);
    } catch (e) {
      console.error(e);
      setError("Failed to save settings. Is the backend running?");
    } finally {
      setSaving(false);
    }
  }

  const engineCards: { id: EngineType; label: string; desc: string }[] = [
    { id: "mock", label: "Mock (No AI)", desc: "Test the app without any AI engine" },
    { id: "http", label: "HTTP / OpenAI-compatible", desc: "Connect to any OpenAI-compatible API" },
    { id: "local", label: "Local GGUF", desc: "Run a local model file on your machine" },
  ];

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background shadow-lg p-8 space-y-6">
        {/* Step 1 — Welcome */}
        {step === 1 && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <img src={crowforgeLogo} alt="CrowForge" className="h-16 w-16 rounded-xl" />
              <h1 className="text-2xl font-bold">Welcome to CrowForge</h1>
              <p className="text-sm text-muted-foreground">A local-first AI workspace</p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started
            </button>
          </>
        )}

        {/* Step 2 — AI Setup */}
        {step === 2 && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Configure AI Engine</h2>
              <p className="text-xs text-muted-foreground">You can change this later in Settings.</p>
            </div>

            <div className="space-y-2">
              {engineCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setEngine(card.id)}
                  className={cn(
                    "w-full text-left rounded-lg border px-4 py-3 transition-colors",
                    engine === card.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  )}
                >
                  <p className="text-sm font-medium">{card.label}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </button>
              ))}
            </div>

            {engine === "http" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Base URL</label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {engine === "local" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Models Directory</label>
                <input
                  value={modelsDir}
                  onChange={(e) => setModelsDir(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={saving}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Apply & Continue"}
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setSkipped(true); axios.post(`${API_BASE}/state`, { onboarding_completed: true }).catch(() => {}); setStep(3); }}
              className="w-full text-xs text-muted-foreground hover:underline"
            >
              Skip for now — configure in Settings later
            </button>
          </>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-bold">You're all set!</h2>
              {skipped && (
                <p className="text-xs text-muted-foreground mt-2">
                  You can configure your AI engine anytime in <strong>Settings → AI Configuration</strong>.
                </p>
              )}
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Chat — conversational AI assistant</li>
              <li>• Documents — AI-enhanced writing</li>
              <li>• Sheets — intelligent spreadsheets</li>
              <li>• Benchmark — compare AI engines</li>
            </ul>
            <button
              onClick={onComplete}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Open CrowForge
            </button>
          </>
        )}
      </div>
    </div>
  );
}
