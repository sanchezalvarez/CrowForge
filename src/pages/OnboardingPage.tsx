import { useState } from "react";
import axios from "axios";
import { AlertCircle } from "lucide-react";
import crowforgeIco from "../assets/crowforge_ico.png";
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

  const engineCards: { id: EngineType; label: string; desc: string; accentClass: string; accentColor: string }[] = [
    {
      id: "mock",
      label: "Mock (No AI)",
      desc: "Test the app without any AI engine",
      accentClass: "card-riso",
      accentColor: "var(--muted-foreground)",
    },
    {
      id: "http",
      label: "HTTP / OpenAI-compatible",
      desc: "Connect to any OpenAI-compatible API",
      accentClass: "card-riso card-riso-orange",
      accentColor: "var(--accent-orange)",
    },
    {
      id: "local",
      label: "Local GGUF",
      desc: "Run a local model file on your machine",
      accentClass: "card-riso",
      accentColor: "var(--accent-teal)",
    },
  ];

  const featureList: { label: string; desc: string; color: string }[] = [
    { label: "Chat", desc: "Conversational AI assistant", color: "var(--accent-orange)" },
    { label: "Documents", desc: "AI-enhanced rich text editor", color: "var(--accent-teal)" },
    { label: "Sheets", desc: "Intelligent spreadsheets with formula AI", color: "var(--accent-violet)" },
    { label: "Canvas", desc: "Node-based visual AI workspace", color: "var(--accent-gold)" },
    { label: "Benchmark", desc: "Compare AI engines side-by-side", color: "var(--accent-orange)" },
  ];

  return (
    <div
      className="flex h-screen w-full items-center justify-center px-4 riso-noise riso-noise-live"
      style={{ background: "var(--background)" }}
    >
      {/* Riso background blobs */}
      <div
        className="pointer-events-none select-none"
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
      >
        <div
          className="animate-blob-drift"
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "var(--accent-teal)",
            opacity: 0.10,
            mixBlendMode: "multiply",
            top: -160,
            right: -160,
          }}
        />
        <div
          className="animate-blob-drift-b"
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "var(--accent-orange)",
            opacity: 0.09,
            mixBlendMode: "multiply",
            bottom: -140,
            left: -140,
          }}
        />
        <div
          className="animate-blob-drift-c"
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "var(--accent-violet)",
            opacity: 0.07,
            mixBlendMode: "multiply",
            bottom: 60,
            right: -60,
          }}
        />

        {/* Registration crosshair — top-right */}
        <svg
          style={{ position: "absolute", top: 10, right: 10, width: 48, height: 48 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="4" y1="20" x2="28" y2="20" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <line x1="16" y1="8" x2="16" y2="32" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <circle cx="16" cy="20" r="5" stroke="rgba(11,114,104,0.30)" strokeWidth="1" fill="none" />
        </svg>
        {/* Registration crosshair — bottom-left */}
        <svg
          style={{ position: "absolute", bottom: 10, left: 10, width: 48, height: 48 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="4" y1="28" x2="28" y2="28" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <line x1="16" y1="16" x2="16" y2="40" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <circle cx="16" cy="28" r="5" stroke="rgba(224,78,14,0.30)" strokeWidth="1" fill="none" />
        </svg>
        {/* Halftone cluster — top-right area */}
        <svg
          style={{ position: "absolute", right: 44, top: 76, width: 80, height: 80 }}
          viewBox="0 0 80 80"
          xmlns="http://www.w3.org/2000/svg"
        >
          {(
            [
              [14, 14, 2.5],
              [28, 10, 1.5],
              [8, 28, 2],
              [22, 26, 1.5],
              [36, 16, 1.5],
              [40, 30, 1],
              [12, 40, 1.5],
              [30, 38, 1],
            ] as [number, number, number][]
          ).map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(224,78,14,0.28)" />
          ))}
        </svg>
        {/* Halftone cluster — bottom-right */}
        <svg
          style={{ position: "absolute", right: 16, bottom: 40, width: 60, height: 60 }}
          viewBox="0 0 60 60"
          xmlns="http://www.w3.org/2000/svg"
        >
          {(
            [
              [8, 8, 1.8],
              [20, 6, 1.2],
              [6, 20, 1.5],
              [18, 18, 1],
              [28, 10, 1.2],
              [8, 30, 1.2],
            ] as [number, number, number][]
          ).map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(11,114,104,0.22)" />
          ))}
        </svg>
      </div>

      {/* Main card */}
      <div
        className="card-riso riso-frame animate-ink-in w-full rounded-xl border"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 460,
          background: "var(--card)",
          borderColor: "var(--border-strong)",
          boxShadow: "5px 5px 0 rgba(11,114,104,0.18), -2px -2px 0 rgba(224,78,14,0.10)",
          padding: "36px 32px 32px",
        }}
      >
        {/* Riso color strip at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            borderRadius: "12px 12px 0 0",
            background: "var(--riso-strip)",
            opacity: 0.85,
          }}
        />

        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              style={{
                width: s === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background:
                  s === step
                    ? "var(--accent-orange)"
                    : s < step
                    ? "var(--accent-teal)"
                    : "var(--background-3)",
                display: "block",
                transition: "width 0.25s ease, background 0.25s ease",
                border: "1px solid rgba(20,16,10,0.10)",
              }}
            />
          ))}
        </div>

        {/* ── Step 1 — Welcome ──────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                textAlign: "center",
              }}
            >
              <div className="riso-stamp-press" style={{ flexShrink: 0 }}>
                <img
                  src={crowforgeIco}
                  alt="CrowForge"
                  style={{ width: 88, height: 88, objectFit: "contain", display: "block" }}
                />
              </div>
              <div>
                <p
                  className="font-mono-ui uppercase"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    color: "var(--accent-teal)",
                    opacity: 0.8,
                    marginBottom: 4,
                  }}
                >
                  v0.1.0
                </p>
                <h1
                  className="font-display font-black tracking-tight leading-none riso-title"
                  style={{ fontSize: "clamp(2rem, 5vw, 2.8rem)" }}
                >
                  CrowForge
                </h1>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  A local-first AI workspace
                </p>
              </div>
              {/* Riso color chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 24,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--accent-orange)",
                    opacity: 0.75,
                    display: "block",
                  }}
                />
                <span
                  style={{
                    width: 24,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--accent-teal)",
                    opacity: 0.75,
                    display: "block",
                  }}
                />
                <span
                  style={{
                    width: 24,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--accent-violet)",
                    opacity: 0.75,
                    display: "block",
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="btn-tactile btn-tactile-orange w-full justify-center"
              style={{ fontSize: 13, padding: "10px 20px" }}
            >
              Get Started →
            </button>
          </div>
        )}

        {/* ── Step 2 — AI Setup ─────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div
                className="riso-section-label"
                style={{ marginBottom: 4 }}
              >
                Step 2 of 3
              </div>
              <h2
                className="font-display font-bold"
                style={{ fontSize: "1.25rem", lineHeight: 1.2, marginTop: 2 }}
              >
                Configure AI Engine
              </h2>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                You can change this later in Settings.
              </p>
            </div>

            {/* Engine selection cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {engineCards.map((card) => {
                const isActive = engine === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setEngine(card.id)}
                    className={cn(card.accentClass, "surface-noise")}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      borderRadius: 8,
                      border: isActive
                        ? `2px solid ${card.accentColor}`
                        : "1.5px solid var(--border-strong)",
                      padding: "12px 14px",
                      background: isActive
                        ? `color-mix(in srgb, ${card.accentColor} 9%, var(--card))`
                        : "var(--card)",
                      boxShadow: isActive
                        ? `3px 3px 0 color-mix(in srgb, ${card.accentColor} 30%, transparent)`
                        : "2px 2px 0 rgba(20,16,10,0.08)",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
                      position: "relative",
                    }}
                  >
                    {isActive && (
                      <span
                        className="font-mono-ui"
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 12,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.10em",
                          textTransform: "uppercase",
                          color: card.accentColor,
                          opacity: 0.85,
                        }}
                      >
                        ◆ SELECTED
                      </span>
                    )}
                    <p
                      className="font-display font-semibold"
                      style={{ fontSize: 13, color: isActive ? card.accentColor : "var(--foreground)" }}
                    >
                      {card.label}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {card.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* HTTP fields */}
            {engine === "http" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label
                    className="font-mono-ui"
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      marginBottom: 5,
                    }}
                  >
                    Base URL
                  </label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="surface-noise"
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1.5px solid var(--border-strong)",
                      background: "var(--input)",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontFamily: "IBM Plex Mono, monospace",
                      color: "var(--foreground)",
                      outline: "none",
                      boxSizing: "border-box",
                      boxShadow: "2px 2px 0 rgba(20,16,10,0.08)",
                      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-teal)";
                      e.currentTarget.style.boxShadow = "3px 3px 0 rgba(11,114,104,0.22)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-strong)";
                      e.currentTarget.style.boxShadow = "2px 2px 0 rgba(20,16,10,0.08)";
                    }}
                  />
                </div>
                <div>
                  <label
                    className="font-mono-ui"
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      marginBottom: 5,
                    }}
                  >
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="surface-noise"
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1.5px solid var(--border-strong)",
                      background: "var(--input)",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontFamily: "IBM Plex Mono, monospace",
                      color: "var(--foreground)",
                      outline: "none",
                      boxSizing: "border-box",
                      boxShadow: "2px 2px 0 rgba(20,16,10,0.08)",
                      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-teal)";
                      e.currentTarget.style.boxShadow = "3px 3px 0 rgba(11,114,104,0.22)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-strong)";
                      e.currentTarget.style.boxShadow = "2px 2px 0 rgba(20,16,10,0.08)";
                    }}
                  />
                </div>
                <div>
                  <label
                    className="font-mono-ui"
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      marginBottom: 5,
                    }}
                  >
                    Model
                  </label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="surface-noise"
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1.5px solid var(--border-strong)",
                      background: "var(--input)",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontFamily: "IBM Plex Mono, monospace",
                      color: "var(--foreground)",
                      outline: "none",
                      boxSizing: "border-box",
                      boxShadow: "2px 2px 0 rgba(20,16,10,0.08)",
                      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-teal)";
                      e.currentTarget.style.boxShadow = "3px 3px 0 rgba(11,114,104,0.22)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-strong)";
                      e.currentTarget.style.boxShadow = "2px 2px 0 rgba(20,16,10,0.08)";
                    }}
                  />
                </div>
              </div>
            )}

            {/* Local GGUF field */}
            {engine === "local" && (
              <div>
                <label
                  className="font-mono-ui"
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                    marginBottom: 5,
                  }}
                >
                  Models Directory
                </label>
                <input
                  value={modelsDir}
                  onChange={(e) => setModelsDir(e.target.value)}
                  className="surface-noise"
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    border: "1.5px solid var(--border-strong)",
                    background: "var(--input)",
                    padding: "8px 12px",
                    fontSize: 12,
                    fontFamily: "IBM Plex Mono, monospace",
                    color: "var(--foreground)",
                    outline: "none",
                    boxSizing: "border-box",
                    boxShadow: "2px 2px 0 rgba(20,16,10,0.08)",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-teal)";
                    e.currentTarget.style.boxShadow = "3px 3px 0 rgba(11,114,104,0.22)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.boxShadow = "2px 2px 0 rgba(20,16,10,0.08)";
                  }}
                />
              </div>
            )}

            {/* Error state */}
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1.5px solid rgba(220,38,38,0.30)",
                  background: "color-mix(in srgb, var(--destructive) 8%, var(--card))",
                  boxShadow: "2px 2px 0 rgba(220,38,38,0.15)",
                  fontSize: 12,
                  color: "var(--destructive)",
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={handleApply}
                disabled={saving}
                className="btn-tactile btn-tactile-teal w-full justify-center"
                style={{ fontSize: 13, padding: "10px 20px" }}
              >
                {saving ? "Saving…" : "Apply & Continue →"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSkipped(true);
                  axios.post(`${API_BASE}/state`, { onboarding_completed: true }).catch(() => {});
                  setStep(3);
                }}
                className="btn-tactile btn-tactile-outline w-full justify-center"
                style={{ fontSize: 11, padding: "7px 16px" }}
              >
                Skip — configure in Settings later
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 — Done ─────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Success header */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                textAlign: "center",
              }}
            >
              {/* Riso success mark — teal stamp */}
              <div
                className="surface-noise"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "color-mix(in srgb, var(--accent-teal) 14%, var(--card))",
                  border: "2px solid var(--accent-teal)",
                  boxShadow: "4px 4px 0 rgba(11,114,104,0.22), -2px -2px 0 rgba(224,78,14,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "var(--accent-teal)", fontWeight: 800, lineHeight: 1 }}>✓</span>
              </div>

              <div>
                <div
                  className="riso-section-label"
                  style={{ justifyContent: "center", marginBottom: 6 }}
                >
                  Setup complete
                </div>
                <h2
                  className="font-display font-black tracking-tight riso-title"
                  style={{ fontSize: "1.6rem", lineHeight: 1.1 }}
                >
                  You're all set!
                </h2>
                {skipped && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    Configure your AI engine anytime in{" "}
                    <strong style={{ color: "var(--foreground)" }}>Settings → AI Configuration</strong>.
                  </p>
                )}
              </div>
            </div>

            {/* Feature list */}
            <div
              className="surface-noise"
              style={{
                borderRadius: 8,
                border: "1.5px solid var(--border-strong)",
                overflow: "hidden",
                boxShadow: "3px 3px 0 rgba(20,16,10,0.07)",
              }}
            >
              <div
                className="riso-section-label"
                style={{
                  padding: "8px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--background-2)",
                }}
              >
                What's inside
              </div>
              {featureList.map((feat, i) => (
                <div
                  key={feat.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                    background: "var(--card)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: feat.color,
                      flexShrink: 0,
                      border: "1.5px solid rgba(20,16,10,0.10)",
                    }}
                  />
                  <div>
                    <span
                      className="font-display font-semibold"
                      style={{ fontSize: 12, color: "var(--foreground)" }}
                    >
                      {feat.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginLeft: 8,
                      }}
                    >
                      {feat.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onComplete}
              className="btn-tactile btn-tactile-orange w-full justify-center"
              style={{ fontSize: 13, padding: "10px 20px" }}
            >
              Open CrowForge →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
