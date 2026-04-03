import { useState } from "react";
import axios from "axios";
import { Monitor, Globe, Server, Loader2, CheckCircle2, AlertCircle, Copy, RefreshCw } from "lucide-react";
import { APP_VERSION } from "../lib/constants";
import { LOCAL_API_BASE, syncAxiosDefaults } from "../lib/api";
import crowforgeIco from "../assets/crowforge_ico.png";
import { cn } from "../lib/utils";

type DeploymentMode = "local" | "connect" | "host";

interface Props {
  onComplete: () => void;
}

function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "sk-cf-";
  for (let i = 0; i < 16; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

const risoInputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 6,
  border: "1.5px solid var(--border-strong)",
  background: "var(--input)",
  padding: "8px 12px",
  fontSize: 12,
  fontFamily: "IBM Plex Mono, monospace",
  color: "var(--foreground)",
  outline: "none",
  boxSizing: "border-box" as const,
  boxShadow: "2px 2px 0 rgba(20,16,10,0.08)",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

function risoInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--accent-teal)";
  e.currentTarget.style.boxShadow = "3px 3px 0 rgba(11,114,104,0.22)";
}
function risoInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--border-strong)";
  e.currentTarget.style.boxShadow = "2px 2px 0 rgba(20,16,10,0.08)";
}

export function SetupPage({ onComplete }: Props) {
  const [mode, setMode] = useState<DeploymentMode>("local");
  const [saving, setSaving] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  // Connect mode fields
  const [serverUrl, setServerUrl] = useState("");
  const [serverApiKey, setServerApiKey] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ version?: string; error?: string }>({});

  // Host mode fields
  const [hostPort, setHostPort] = useState("8000");
  const [hostApiKey, setHostApiKey] = useState("");
  const [localIp, setLocalIp] = useState("");
  const [copied, setCopied] = useState(false);

  // Firewall notice
  const [firewallDismissed, setFirewallDismissed] = useState(() => localStorage.getItem("crowforge_firewall_notice_dismissed") === "true");

  // Fetch local IP when host mode selected
  const selectMode = async (m: DeploymentMode) => {
    setMode(m);
    if (m === "host" && !localIp) {
      try {
        const res = await axios.get(`${LOCAL_API_BASE}/settings/deployment`);
        setLocalIp(res.data.local_ip || "127.0.0.1");
      } catch {
        setLocalIp("127.0.0.1");
      }
    }
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestResult({});
    try {
      const res = await axios.post(`${LOCAL_API_BASE}/settings/deployment/test-connection`, {
        url: serverUrl,
        api_key: serverApiKey,
      });
      if (res.data.success) {
        setTestStatus("success");
        setTestResult({ version: res.data.version });
      } else {
        setTestStatus("error");
        setTestResult({ error: res.data.error });
      }
    } catch {
      setTestStatus("error");
      setTestResult({ error: "Failed to reach local backend" });
    }
  };

  const copyConnectionDetails = () => {
    const details = `Server: http://${localIp}:${hostPort}\nAPI Key: ${hostApiKey}`;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGetStarted = async () => {
    setSaving(true);
    try {
      await axios.patch(`${LOCAL_API_BASE}/settings/deployment`, {
        mode,
        server_url: serverUrl,
        server_api_key: serverApiKey,
        host_port: hostPort,
        host_api_key: hostApiKey,
        setup_completed: true,
      });

      localStorage.setItem("crowforge_deployment_mode", mode);
      if (mode === "connect") {
        localStorage.setItem("crowforge_server_url", serverUrl);
        localStorage.setItem("crowforge_server_api_key", serverApiKey);
      } else if (mode === "host") {
        localStorage.setItem("crowforge_host_port", hostPort);
        localStorage.setItem("crowforge_host_api_key", hostApiKey);
      }
      syncAxiosDefaults();

      // Check if app restart is needed (host mode changes bind address)
      if (mode === "host") {
        setRestartNeeded(true);
        setSaving(false);
        return;
      }

      onComplete();
    } catch (e) {
      console.error("Setup save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const modeCards: { id: DeploymentMode; icon: typeof Monitor; label: string; desc: string; accentColor: string }[] = [
    { id: "local", icon: Monitor, label: "Local", desc: "Just for me. Everything runs on this PC. Offline & safe.", accentColor: "var(--accent-teal)" },
    { id: "connect", icon: Globe, label: "Connect", desc: "Join a team server. Connect to a shared CrowForge workspace.", accentColor: "var(--accent-orange)" },
    { id: "host", icon: Server, label: "Host", desc: "Run as server for your team. Others connect to you.", accentColor: "var(--accent-violet)" },
  ];

  return (
    <div
      className="flex h-screen w-full items-center justify-center px-4 riso-noise riso-noise-live"
      style={{ background: "var(--background)" }}
    >
      {/* Riso background blobs */}
      <div className="pointer-events-none select-none" style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <div className="animate-blob-drift" style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "var(--accent-teal)", opacity: 0.10, mixBlendMode: "multiply", top: -160, right: -160 }} />
        <div className="animate-blob-drift-b" style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: "var(--accent-orange)", opacity: 0.09, mixBlendMode: "multiply", bottom: -140, left: -140 }} />
        <div className="animate-blob-drift-c" style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "var(--accent-violet)", opacity: 0.07, mixBlendMode: "multiply", bottom: 60, right: -60 }} />

        {/* Registration crosshair — top-right */}
        <svg style={{ position: "absolute", top: 10, right: 10, width: 48, height: 48 }} xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="20" x2="28" y2="20" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <line x1="16" y1="8" x2="16" y2="32" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <circle cx="16" cy="20" r="5" stroke="rgba(11,114,104,0.30)" strokeWidth="1" fill="none" />
        </svg>
        {/* Registration crosshair — bottom-left */}
        <svg style={{ position: "absolute", bottom: 10, left: 10, width: 48, height: 48 }} xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="28" x2="28" y2="28" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <line x1="16" y1="16" x2="16" y2="40" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <circle cx="16" cy="28" r="5" stroke="rgba(224,78,14,0.30)" strokeWidth="1" fill="none" />
        </svg>
        {/* Halftone cluster — top-right */}
        <svg style={{ position: "absolute", right: 44, top: 76, width: 80, height: 80 }} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
          {([[14,14,2.5],[28,10,1.5],[8,28,2],[22,26,1.5],[36,16,1.5],[40,30,1],[12,40,1.5],[30,38,1]] as [number,number,number][]).map(([x,y,r],i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(224,78,14,0.28)" />
          ))}
        </svg>
        {/* Halftone cluster — bottom-right */}
        <svg style={{ position: "absolute", right: 16, bottom: 40, width: 60, height: 60 }} viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          {([[8,8,1.8],[20,6,1.2],[6,20,1.5],[18,18,1],[28,10,1.2],[8,30,1.2]] as [number,number,number][]).map(([x,y,r],i) => (
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
          maxWidth: 560,
          background: "var(--card)",
          borderColor: "var(--border-strong)",
          boxShadow: "5px 5px 0 rgba(11,114,104,0.18), -2px -2px 0 rgba(224,78,14,0.10)",
          padding: "36px 32px 32px",
        }}
      >
        {/* Riso color strip at top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "12px 12px 0 0", background: "var(--riso-strip)", opacity: 0.85 }} />

        {/* Logo + header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", marginBottom: 24 }}>
          <div className="riso-stamp-press" style={{ flexShrink: 0 }}>
            <img src={crowforgeIco} alt="CrowForge" style={{ width: 72, height: 72, objectFit: "contain", display: "block" }} />
          </div>
          <div>
            <p className="font-mono-ui uppercase" style={{ fontSize: 10, letterSpacing: "0.22em", color: "var(--accent-teal)", opacity: 0.8, marginBottom: 4 }}>
              v{APP_VERSION}
            </p>
            <h1 className="font-display font-black tracking-tight leading-none riso-title" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>
              CrowForge
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.5 }}>
              How do you want to use CrowForge?
            </p>
          </div>
          {/* Riso color chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 24, height: 4, borderRadius: 2, background: "var(--accent-orange)", opacity: 0.75, display: "block" }} />
            <span style={{ width: 24, height: 4, borderRadius: 2, background: "var(--accent-teal)", opacity: 0.75, display: "block" }} />
            <span style={{ width: 24, height: 4, borderRadius: 2, background: "var(--accent-violet)", opacity: 0.75, display: "block" }} />
          </div>
        </div>

        {/* Mode cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {modeCards.map(({ id, icon: Icon, label, desc, accentColor }) => {
            const isActive = mode === id;
            return (
              <button
                key={id}
                onClick={() => selectMode(id)}
                className={cn("card-riso surface-noise")}
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 8,
                  border: isActive ? `2px solid ${accentColor}` : "1.5px solid var(--border-strong)",
                  padding: "12px 14px",
                  background: isActive ? `color-mix(in srgb, ${accentColor} 9%, var(--card))` : "var(--card)",
                  boxShadow: isActive ? `3px 3px 0 color-mix(in srgb, ${accentColor} 30%, transparent)` : "2px 2px 0 rgba(20,16,10,0.08)",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <Icon size={20} style={{ color: isActive ? accentColor : "var(--muted-foreground)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p className="font-display font-semibold" style={{ fontSize: 13, color: isActive ? accentColor : "var(--foreground)" }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {desc}
                  </p>
                </div>
                {isActive && (
                  <span className="font-mono-ui" style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: accentColor, opacity: 0.85 }}>
                    ◆ SELECTED
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Expanded config for selected mode */}
        {mode === "local" && (
          <div className="surface-noise" style={{ borderRadius: 8, border: "1.5px solid var(--border-strong)", padding: "14px 16px", background: "var(--background-2)", boxShadow: "2px 2px 0 rgba(20,16,10,0.06)", marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>
              No configuration needed. Everything runs locally on this PC.
            </p>
          </div>
        )}

        {mode === "connect" && (
          <div className="surface-noise" style={{ borderRadius: 8, border: "1.5px solid var(--border-strong)", padding: "16px", background: "var(--card)", boxShadow: "2px 2px 0 rgba(20,16,10,0.06)", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="riso-section-label" style={{ marginBottom: 0 }}>Server Connection</div>
            <div>
              <label className="font-mono-ui" style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 5 }}>
                Server URL
              </label>
              <input
                type="url"
                placeholder="https://crowforge.mycompany.com"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                className="surface-noise"
                style={risoInputStyle}
                onFocus={risoInputFocus}
                onBlur={risoInputBlur}
              />
            </div>
            <div>
              <label className="font-mono-ui" style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 5 }}>
                API Key
              </label>
              <input
                type="text"
                placeholder="Server API key"
                value={serverApiKey}
                onChange={e => setServerApiKey(e.target.value)}
                className="surface-noise"
                style={risoInputStyle}
                onFocus={risoInputFocus}
                onBlur={risoInputBlur}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={testConnection}
                disabled={!serverUrl || testStatus === "testing"}
                className="btn-tactile btn-tactile-teal"
                style={{ fontSize: 11, padding: "7px 14px" }}
              >
                {testStatus === "testing" ? <Loader2 size={12} className="animate-spin" /> : "Test connection"}
              </button>
              {testStatus === "success" && (
                <span className="font-mono-ui" style={{ fontSize: 11, color: "var(--accent-teal)", display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={14} /> Connected · v{testResult.version}
                </span>
              )}
              {testStatus === "error" && (
                <span className="font-mono-ui" style={{ fontSize: 11, color: "var(--destructive)", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={14} /> {testResult.error}
                </span>
              )}
            </div>
          </div>
        )}

        {mode === "host" && (
          <div className="surface-noise" style={{ borderRadius: 8, border: "1.5px solid var(--border-strong)", padding: "16px", background: "var(--card)", boxShadow: "2px 2px 0 rgba(20,16,10,0.06)", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="riso-section-label" style={{ marginBottom: 0 }}>Server Configuration</div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 90 }}>
                <label className="font-mono-ui" style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 5 }}>
                  Port
                </label>
                <input
                  type="text"
                  value={hostPort}
                  onChange={e => setHostPort(e.target.value.replace(/\D/g, ""))}
                  className="surface-noise"
                  style={risoInputStyle}
                  onFocus={risoInputFocus}
                  onBlur={risoInputBlur}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="font-mono-ui" style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 5 }}>
                  API Key
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={hostApiKey}
                    onChange={e => setHostApiKey(e.target.value)}
                    placeholder="Click generate"
                    className="surface-noise"
                    style={{ ...risoInputStyle, flex: 1 }}
                    onFocus={risoInputFocus}
                    onBlur={risoInputBlur}
                  />
                  <button
                    onClick={() => setHostApiKey(generateApiKey())}
                    className="btn-tactile btn-tactile-teal"
                    style={{ fontSize: 10, padding: "7px 10px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <RefreshCw size={12} /> Generate
                  </button>
                </div>
              </div>
            </div>

            {hostApiKey && (
              <div className="surface-noise" style={{ borderRadius: 6, border: "1.5px solid var(--border-strong)", padding: "12px 14px", background: "var(--background-2)", boxShadow: "2px 2px 0 rgba(20,16,10,0.05)" }}>
                <div className="riso-section-label" style={{ marginBottom: 6 }}>Your team connects to</div>
                <p className="font-mono-ui" style={{ fontSize: 12, color: "var(--foreground)" }}>
                  http://{localIp || "..."}:{hostPort}
                </p>
                <p className="font-mono-ui" style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                  Key: {hostApiKey}
                </p>
                <button
                  onClick={copyConnectionDetails}
                  className="btn-tactile btn-tactile-outline"
                  style={{ fontSize: 10, padding: "5px 10px", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Copy size={12} /> {copied ? "Copied!" : "Copy connection details"}
                </button>
              </div>
            )}

            {/* Firewall notice */}
            {!firewallDismissed && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 6, border: "1.5px solid rgba(224,78,14,0.30)", background: "color-mix(in srgb, var(--accent-orange) 8%, var(--card))", boxShadow: "2px 2px 0 rgba(224,78,14,0.12)", fontSize: 12 }}>
                <AlertCircle size={14} style={{ color: "var(--accent-orange)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="font-mono-ui" style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-orange)" }}>Windows Firewall</p>
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.4 }}>
                    CrowForge needs port {hostPort} to be accessible on your network.
                    Windows may prompt you to allow this — click "Allow access".
                  </p>
                  <button
                    onClick={() => { setFirewallDismissed(true); localStorage.setItem("crowforge_firewall_notice_dismissed", "true"); }}
                    className="font-mono-ui"
                    style={{ fontSize: 10, color: "var(--muted-foreground)", textDecoration: "underline", marginTop: 4, cursor: "pointer", background: "none", border: "none", padding: 0 }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Restart notice for host mode */}
        {restartNeeded && (
          <div className="surface-noise" style={{ borderRadius: 8, border: "1.5px solid var(--accent-orange)", padding: "14px 16px", background: "color-mix(in srgb, var(--accent-orange) 8%, var(--card))", boxShadow: "2px 2px 0 rgba(224,78,14,0.15)", marginBottom: 8, textAlign: "center" }}>
            <p className="font-display font-semibold" style={{ fontSize: 13, color: "var(--accent-orange)", marginBottom: 4 }}>
              Settings saved! Restart CrowForge to enable network hosting.
            </p>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Close and reopen the app. Windows may ask for firewall permission — click "Allow access".
            </p>
          </div>
        )}

        {/* Get started button */}
        {!restartNeeded ? (
          <button
            onClick={handleGetStarted}
            disabled={saving || (mode === "connect" && testStatus !== "success") || (mode === "host" && !hostApiKey)}
            className="btn-tactile btn-tactile-orange w-full justify-center"
            style={{ fontSize: 13, padding: "10px 20px" }}
          >
            {saving ? "Saving…" : "Get Started →"}
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="btn-tactile btn-tactile-teal w-full justify-center"
            style={{ fontSize: 13, padding: "10px 20px" }}
          >
            Continue anyway →
          </button>
        )}
      </div>
    </div>
  );
}
