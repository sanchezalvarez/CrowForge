import { useState } from "react";
import axios from "axios";
import { CheckCircle2, AlertCircle } from "lucide-react";
import agentCrowner from "../assets/AgentCrowner_512.png";
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
    <div className="flex h-screen w-full items-center justify-center px-4 riso-noise riso-noise-live" style={{ background: 'var(--background)' }}>
      {/* Riso background blobs */}
      <div className="pointer-events-none select-none" style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <div className="animate-blob-drift" style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'var(--accent-teal)', opacity: 0.10, mixBlendMode: 'multiply', top: -160, right: -160 }} />
        <div className="animate-blob-drift-b" style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'var(--accent-orange)', opacity: 0.09, mixBlendMode: 'multiply', bottom: -140, left: -140 }} />
        <div className="animate-blob-drift-c" style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'var(--accent-violet)', opacity: 0.07, mixBlendMode: 'multiply', bottom: 60, right: -60 }} />
        {/* Crosshairs */}
        <svg style={{ position: 'absolute', top: 8, right: 8, width: 48, height: 48 }} xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="20" x2="28" y2="20" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <line x1="16" y1="8" x2="16" y2="32" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <circle cx="16" cy="20" r="5" stroke="rgba(11,114,104,0.3)" strokeWidth="1" fill="none" />
        </svg>
        <svg style={{ position: 'absolute', bottom: 8, left: 8, width: 48, height: 48 }} xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="28" x2="28" y2="28" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <line x1="16" y1="16" x2="16" y2="40" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <circle cx="16" cy="28" r="5" stroke="rgba(224,78,14,0.3)" strokeWidth="1" fill="none" />
        </svg>
        {/* Halftone dots */}
        <svg style={{ position: 'absolute', right: 40, top: 80, width: 80, height: 80 }} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
          {[[14,14,2.5],[28,10,1.5],[8,28,2],[22,26,1.5],[36,16,1.5],[40,30,1],[12,40,1.5],[30,38,1]].map(([x,y,r],i) => <circle key={i} cx={x} cy={y} r={r} fill="rgba(224,78,14,0.28)" />)}
        </svg>
      </div>

      <div className="card-riso w-full max-w-md rounded-xl border bg-background p-8 space-y-6 animate-ink-in" style={{ position: 'relative', zIndex: 1 }}>
        {/* Step 1 — Welcome */}
        {step === 1 && (
          <>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="animate-crower-pulse-chat" style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: '#0a0806', flexShrink: 0 }}>
                <img src={agentCrowner} alt="AgentCrowner" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <p className="font-mono-ui uppercase opacity-70" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--accent-teal)' }}>v0.1.0</p>
                <h1 className="font-display font-black tracking-tight leading-none mt-1" style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', textShadow: '2px 2px 0 rgba(224,78,14,0.22), -1px -1px 0 rgba(11,114,104,0.16)' }}>CrowForge</h1>
                <p className="text-sm text-muted-foreground mt-2">A local-first AI workspace</p>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--accent-orange)', opacity: 0.75, display: 'block' }} />
                <span style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--accent-teal)', opacity: 0.75, display: 'block' }} />
                <span style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--accent-violet)', opacity: 0.75, display: 'block' }} />
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="btn-tactile btn-tactile-orange w-full justify-center"
              style={{ fontSize: 13, padding: '8px 20px' }}
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
