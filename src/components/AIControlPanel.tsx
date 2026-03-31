import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Cpu, Sliders, Bug, Loader2, RotateCcw, Terminal, Square, Play, RefreshCw } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "../hooks/useToast";

const API_BASE = "http://127.0.0.1:8000";

/** Check if running inside Tauri (vs plain browser / Vite dev server) */
function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}

export interface TuningParams {
  temperature: number;
  topP: number;
  maxTokens: number;
  seed: number | null;
}

interface AIControlPanelProps {
  showDebug: boolean;
  onShowDebugChange: (show: boolean) => void;
  tuningParams: TuningParams;
  onTuningChange: (params: TuningParams) => void;
  modelStatus?: "loaded" | "not_loaded" | "unloaded" | "no_local";
}

interface EngineInfo {
  name: string;
  type: string;
  active: boolean;
}

interface LocalModel {
  filename: string;
  path: string;
  size_mb: number;
  default_ctx: number;
}

/**
 * Right-side AI control panel with 3 tabs: Engine & Model, Tuning, Debug.
 */
export function AIControlPanel({ showDebug, onShowDebugChange, tuningParams, onTuningChange, modelStatus }: AIControlPanelProps) {
  // ── Backend status ────────────────────────────────────────────
  type BackendStatus = "online" | "offline" | "restarting";
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("online");
  const [restartAttempt, setRestartAttempt] = useState(0);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const restartingRef = useRef(false);

  const checkBackend = useCallback(async () => {
    const t0 = performance.now();
    try {
      await axios.get(`${API_BASE}/state`, { timeout: 2000 });
      setResponseTime(Math.round(performance.now() - t0));
      setBackendStatus("online");
      return true;
    } catch {
      setResponseTime(null);
      if (!restartingRef.current) setBackendStatus("offline");
      return false;
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 5_000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  const pollUntilOnline = useCallback((onSuccess: () => void) => {
    let attempts = 0;
    const poll = () => {
      setTimeout(async () => {
        attempts++;
        setRestartAttempt(attempts);
        const alive = await checkBackend();
        if (alive) {
          restartingRef.current = false;
          setBackendStatus("online");
          setRestartAttempt(0);
          onSuccess();
          fetchEngines();
          fetchModels();
        } else if (attempts < 30) {
          poll();
        } else {
          restartingRef.current = false;
          setBackendStatus("offline");
          setRestartAttempt(0);
          toast("Backend did not come back — check manually", "error");
        }
      }, 1000);
    };
    poll();
  }, [checkBackend]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestartBackend = useCallback(async () => {
    setBackendStatus("restarting");
    restartingRef.current = true;
    setRestartAttempt(0);

    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("restart_backend");
      } catch (err: any) {
        restartingRef.current = false;
        setBackendStatus("offline");
        toast(`Restart failed: ${err}`, "error");
        return;
      }
    } else {
      try {
        await axios.post(`${API_BASE}/shutdown`, {}, { timeout: 2000 }).catch(() => {});
      } catch { /* expected */ }
    }

    pollUntilOnline(() => toast("Backend restarted", "success"));
  }, [checkBackend, pollUntilOnline]);

  const handleKillBackend = useCallback(async () => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("kill_backend");
        setBackendStatus("offline");
        toast("Backend stopped", "success");
      } catch (err: any) {
        toast(`Kill failed: ${err}`, "error");
      }
    } else {
      try {
        await axios.post(`${API_BASE}/shutdown`, {}, { timeout: 2000 }).catch(() => {});
        setBackendStatus("offline");
      } catch { /* expected */ }
    }
  }, []);

  const handleStartBackend = useCallback(async () => {
    if (!isTauri()) {
      toast("Start is only available in the app (Tauri)", "error");
      return;
    }
    setBackendStatus("restarting");
    restartingRef.current = true;
    setRestartAttempt(0);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("start_backend").catch(() => {
        // Might fail if already running — try restart instead
        return invoke("restart_backend");
      });
    } catch (err: any) {
      restartingRef.current = false;
      setBackendStatus("offline");
      toast(`Start failed: ${err}`, "error");
      return;
    }
    pollUntilOnline(() => toast("Backend started", "success"));
  }, [pollUntilOnline]);

  // ── Engine state ───────────────────────────────────────────────
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [activeEngine, setActiveEngine] = useState<string | null>(null);
  const [engineSwitching, setEngineSwitching] = useState(false);

  // ── Model state ────────────────────────────────────────────────
  const [models, setModels] = useState<LocalModel[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [modelSwitching, setModelSwitching] = useState(false);

  // ── Model idle timeout ─────────────────────────────────────────
  const [idleTimeoutMin, setIdleTimeoutMin] = useState<number>(10);
  useEffect(() => {
    axios.get(`${API_BASE}/ai/idle-timeout`).then(r => setIdleTimeoutMin(r.data.timeout_minutes ?? 10)).catch(() => {});
  }, []);
  const handleIdleTimeoutChange = async (val: number) => {
    setIdleTimeoutMin(val);
    try { await axios.post(`${API_BASE}/ai/idle-timeout`, { timeout_minutes: val }); } catch { /* ignore */ }
  };

  // ── Debug state ────────────────────────────────────────────────
  const [debugPayload, setDebugPayload] = useState<Record<string, unknown> | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  // ── Fetch engines ──────────────────────────────────────────────
  const fetchEngines = useCallback(async () => {
    try {
      const res = await axios.get<EngineInfo[]>(`${API_BASE}/ai/engines`);
      setEngines(res.data);
      const active = res.data.find((e) => e.active);
      if (active) setActiveEngine(active.name);
    } catch {
      // Silently ignore on startup
    }
  }, []);

  // ── Fetch models ───────────────────────────────────────────────
  const fetchModels = useCallback(async () => {
    try {
      const res = await axios.get<{ models: LocalModel[]; active_model: string | null }>(
        `${API_BASE}/ai/models`
      );
      setModels(res.data.models);
      setActiveModel(res.data.active_model);
    } catch {
      // Silently ignore
    }
  }, []);

  useEffect(() => {
    fetchEngines();
    fetchModels();
  }, [fetchEngines, fetchModels]);

  // ── Switch engine ──────────────────────────────────────────────
  const handleEngineChange = async (name: string) => {
    if (name === activeEngine) return;
    setEngineSwitching(true);
    try {
      await axios.post(`${API_BASE}/ai/engine`, { engine: name });
      setActiveEngine(name);
      toast(`Switched to ${name} engine`, "success");
      await fetchEngines();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to switch engine";
      toast(msg, "error");
    } finally {
      setEngineSwitching(false);
    }
  };

  // ── Switch model ───────────────────────────────────────────────
  const handleModelChange = async (filename: string) => {
    if (filename === activeModel) return;
    const model = models.find((m) => m.filename === filename);
    if (!model) return;
    setModelSwitching(true);
    try {
      await axios.post(`${API_BASE}/ai/model`, {
        filename: model.filename,
        ctx: model.default_ctx,
      });
      setActiveModel(model.filename);
      toast(`Loaded ${model.filename}`, "success");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to load model";
      toast(msg, "error");
    } finally {
      setModelSwitching(false);
    }
  };

  // ── Fetch debug payload ────────────────────────────────────────
  const fetchDebug = useCallback(async () => {
    setDebugLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/ai/debug/last`);
      setDebugPayload(res.data.payload);
    } catch {
      // ignore
    } finally {
      setDebugLoading(false);
    }
  }, []);

  const isBusy = engineSwitching || modelSwitching;

  // Check if local engine is active (to show model selector)
  const activeEngineInfo = engines.find((e) => e.name === activeEngine);
  const showModelSelector = activeEngineInfo?.type === "local";

  // ── Status banner rendering ────────────────────────────────────
  const renderStatusBanner = () => {
    if (backendStatus === "online") {
      return (
        <div
          className="surface-noise rounded border-l-4 px-3 py-2.5"
          style={{
            borderLeftColor: "var(--accent-teal)",
            border: "1.5px solid var(--border-strong)",
            borderLeftWidth: "4px",
            background: "color-mix(in srgb, var(--accent-teal) 6%, var(--background-2))",
            boxShadow: "2px 2px 0 var(--riso-teal)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent-teal)", boxShadow: "0 0 6px color-mix(in srgb, var(--accent-teal) 50%, transparent)" }} />
              <span className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--accent-teal)" }}>
                Backend Online
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleRestartBackend}
                className="btn-tactile"
                title="Restart backend"
              >
                <RotateCcw size={10} />
                Restart
              </button>
              <button
                onClick={handleKillBackend}
                className="btn-tactile"
                style={{ color: "var(--destructive)" }}
                title="Stop backend"
              >
                <Square size={10} />
                Stop
              </button>
            </div>
          </div>
          {responseTime !== null && (
            <p className="font-mono-ui text-[10px] mt-1 ml-[18px]" style={{ color: "color-mix(in srgb, var(--accent-teal) 70%, var(--muted-foreground))" }}>
              Response: {responseTime}ms
            </p>
          )}
        </div>
      );
    }

    if (backendStatus === "restarting") {
      return (
        <div
          className="surface-noise rounded border-l-4 px-3 py-2.5"
          style={{
            borderLeftColor: "var(--accent-orange)",
            border: "1.5px solid var(--border-strong)",
            borderLeftWidth: "4px",
            background: "color-mix(in srgb, var(--accent-orange) 6%, var(--background-2))",
            boxShadow: "2px 2px 0 var(--riso-orange)",
          }}
        >
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-orange)" }} />
            <span className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--accent-orange)" }}>
              Restarting backend...
            </span>
          </div>
          <p className="font-mono-ui text-[10px] mt-1 ml-[22px]" style={{ color: "color-mix(in srgb, var(--accent-orange) 70%, var(--muted-foreground))" }}>
            Attempt {restartAttempt}/30 — waiting for backend to respond
          </p>
        </div>
      );
    }

    // Offline
    return (
      <div
        className="surface-noise rounded border-l-4 px-3 py-2.5"
        style={{
          borderLeftColor: "var(--destructive)",
          border: "1.5px solid var(--border-strong)",
          borderLeftWidth: "4px",
          background: "color-mix(in srgb, var(--destructive) 6%, var(--background-2))",
          boxShadow: "2px 2px 0 rgba(220,38,38,0.18)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--destructive)", boxShadow: "0 0 6px rgba(239,68,68,0.4)" }} />
          <span className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--destructive)" }}>
            Backend Offline
          </span>
        </div>
        <div className="mt-2 ml-[18px]">
          {isTauri() ? (
            <div className="flex gap-2">
              <button
                onClick={handleStartBackend}
                className="btn-tactile btn-tactile-teal"
              >
                <Play size={11} />
                Start
              </button>
              <button
                onClick={handleRestartBackend}
                className="btn-tactile btn-tactile-orange"
              >
                <RotateCcw size={11} />
                Restart
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-mono-ui text-[10px]" style={{ color: "var(--destructive)" }}>
                Start the backend manually:
              </p>
              <code
                className="flex items-center gap-1.5 font-mono-ui text-[10px] rounded px-2 py-1"
                style={{
                  background: "var(--background-3)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--foreground)",
                }}
              >
                <Terminal size={10} className="shrink-0" style={{ color: "var(--accent-teal)" }} />
                python -m backend.app
              </code>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="surface-noise w-full lg:w-[280px] shrink-0 border-t lg:border-t-0 lg:border-l border-border-strong bg-background flex flex-col overflow-hidden max-h-[40vh] lg:max-h-none">
      {/* Header */}
      <div className="h-12 lg:h-14 flex items-center gap-2 px-4 border-b border-border-strong">
        <Sliders size={15} style={{ color: "var(--accent-orange)" }} />
        <span className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
          AI Controls
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isBusy && <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent-orange)" }} />}
          {modelStatus && modelStatus !== "loaded" && modelStatus !== "no_local" && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-ui whitespace-nowrap" style={{ background: "color-mix(in srgb, var(--accent-gold) 12%, transparent)", color: "var(--accent-gold)", border: "1px solid color-mix(in srgb, var(--accent-gold) 28%, transparent)" }}>
              <Cpu size={10} />
              {modelStatus === "unloaded" ? "Model unloaded" : "No model"}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Backend Status Banner */}
        {renderStatusBanner()}

        <Tabs defaultValue="engine-model" className="w-full">
          <TabsList
            className="w-full grid grid-cols-3 h-8 surface-noise"
            style={{
              background: "var(--background-3)",
              border: "1.5px solid var(--border-strong)",
              borderRadius: "6px",
              padding: "2px",
            }}
          >
            <TabsTrigger
              value="engine-model"
              className="font-mono-ui text-[10px] tracking-wider uppercase px-1.5 gap-1"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              <Cpu size={12} />
              Engine
            </TabsTrigger>
            <TabsTrigger
              value="tuning"
              className="font-mono-ui text-[10px] tracking-wider uppercase px-1.5 gap-1"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              <Sliders size={12} />
              Tuning
            </TabsTrigger>
            <TabsTrigger
              value="debug"
              className="font-mono-ui text-[10px] tracking-wider uppercase px-1.5 gap-1"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              onClick={() => { if (showDebug) fetchDebug(); }}
            >
              <Bug size={12} />
              Debug
            </TabsTrigger>
          </TabsList>

          {/* ── Engine & Model ─────────────────────── */}
          <TabsContent value="engine-model">
            <Card
              className="card-riso surface-noise"
              style={{
                border: "1.5px solid var(--border-strong)",
                background: "var(--background-2)",
              }}
            >
              <CardContent className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="riso-section-label">
                    AI Engine
                  </Label>
                  <Select
                    value={activeEngine ?? ""}
                    onValueChange={handleEngineChange}
                    disabled={isBusy}
                  >
                    <SelectTrigger
                      className="h-8 font-mono-ui text-xs"
                      style={{
                        background: "var(--background-2)",
                        border: "1.5px solid var(--border-strong)",
                        fontFamily: "'IBM Plex Mono', monospace",
                        boxShadow: "1px 1px 0 var(--riso-teal)",
                      }}
                    >
                      <SelectValue placeholder="No engines available" />
                    </SelectTrigger>
                    <SelectContent>
                      {engines.map((e) => (
                        <SelectItem key={e.name} value={e.name}>
                          <span className="font-mono-ui">{e.type === "mock" ? "No AI" : e.name}</span>
                          <span className="ml-2 text-[10px]" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
                            {e.type === "mock" ? "no ai" : e.type}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="font-mono-ui text-[10px]" style={{ color: "var(--muted-foreground)", opacity: 0.75 }}>
                    {engineSwitching
                      ? "Switching engine..."
                      : activeEngine
                        ? `Using ${activeEngine} for all generation`
                        : "Select an engine to begin"}
                  </p>
                </div>

                {/* Model selector — only when local engine is active */}
                {showModelSelector && (
                  <>
                    <Separator style={{ borderColor: "var(--border-strong)" }} />
                    <div className="space-y-1.5">
                      <Label className="riso-section-label">
                        Local Model
                      </Label>
                      <Select
                        value={activeModel ?? ""}
                        onValueChange={handleModelChange}
                        disabled={isBusy || models.length === 0}
                      >
                        <SelectTrigger
                          className="h-8 font-mono-ui text-xs"
                          style={{
                            background: "var(--background-2)",
                            border: "1.5px solid var(--border-strong)",
                            fontFamily: "'IBM Plex Mono', monospace",
                            boxShadow: "1px 1px 0 var(--riso-teal)",
                          }}
                        >
                          <SelectValue placeholder="Choose a model…" />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((m) => (
                            <SelectItem key={m.filename} value={m.filename}>
                              <span>{m.filename}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {modelSwitching && (
                        <p className="font-mono-ui text-[10px]" style={{ color: "var(--muted-foreground)", opacity: 0.75 }}>
                          Loading model — this may take a moment...
                        </p>
                      )}

                      {/* Model idle timeout */}
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                            Auto-unload after
                          </Label>
                          <span className="font-mono-ui text-xs" style={{ color: "var(--accent-violet)" }}>
                            {idleTimeoutMin === 0 ? "Never" : `${idleTimeoutMin}m`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="60"
                          step="5"
                          value={idleTimeoutMin}
                          onChange={(e) => handleIdleTimeoutChange(Number(e.target.value))}
                          className="w-full h-2 cursor-pointer"
                          style={{ accentColor: "var(--accent-violet)" }}
                        />
                        <p className="font-mono-ui text-[10px]" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
                          0 = keep in memory
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Separator style={{ borderColor: "var(--border-strong)" }} />

                <div className="space-y-1.5">
                  <Label className="riso-section-label">
                    Registered
                  </Label>
                  {engines.length === 0 ? (
                    <p className="font-mono-ui text-[10px] italic" style={{ color: "var(--muted-foreground)", opacity: 0.75 }}>
                      No engines found — is the backend running?
                    </p>
                  ) : (
                    engines.map((e) => (
                      <div
                        key={e.name}
                        className="surface-noise flex items-center justify-between rounded px-3 py-1.5"
                        style={{
                          border: "1.5px solid var(--border-strong)",
                          background: e.name === activeEngine
                            ? "color-mix(in srgb, var(--accent-teal) 8%, var(--background-2))"
                            : "var(--background-2)",
                          boxShadow: e.name === activeEngine ? "2px 2px 0 var(--riso-teal)" : "1px 1px 0 var(--border-strong)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              background: e.name === activeEngine ? "var(--accent-teal)" : "var(--muted-foreground)",
                              opacity: e.name === activeEngine ? 1 : 0.35,
                            }}
                          />
                          <span className="font-mono-ui text-[11px]" style={{ color: "var(--foreground)" }}>{e.name}</span>
                        </div>
                        <span className="font-mono-ui text-[10px]" style={{ color: "var(--muted-foreground)", opacity: 0.65 }}>
                          {e.type}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tuning ─────────────────────────────── */}
          <TabsContent value="tuning">
            <Card
              className="card-riso card-riso-orange surface-noise"
              style={{
                border: "1.5px solid var(--border-strong)",
                background: "var(--background-2)",
              }}
            >
              <CardContent className="p-3 space-y-3">
                {/* Temperature */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                      Temperature
                    </Label>
                    <span className="font-mono-ui text-xs font-semibold" style={{ color: "var(--accent-orange)" }}>
                      {tuningParams.temperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={tuningParams.temperature}
                    onChange={(e) => onTuningChange({ ...tuningParams, temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 cursor-pointer"
                    style={{ accentColor: "var(--accent-orange)" }}
                  />
                  <p className="font-mono-ui text-[10px] text-right" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>0 – 1.5</p>
                </div>

                <Separator style={{ borderColor: "var(--border-strong)" }} />

                {/* Top-p */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                      Top-p
                    </Label>
                    <span className="font-mono-ui text-xs font-semibold" style={{ color: "var(--accent-teal)" }}>
                      {tuningParams.topP.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={tuningParams.topP}
                    onChange={(e) => onTuningChange({ ...tuningParams, topP: parseFloat(e.target.value) })}
                    className="w-full h-2 cursor-pointer"
                    style={{ accentColor: "var(--accent-teal)" }}
                  />
                  <p className="font-mono-ui text-[10px] text-right" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>0.1 – 1.0</p>
                </div>

                <Separator style={{ borderColor: "var(--border-strong)" }} />

                {/* Max Tokens */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                      Max Tokens
                    </Label>
                    <span className="font-mono-ui text-xs font-semibold" style={{ color: "var(--accent-violet)" }}>
                      {tuningParams.maxTokens}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="64"
                    max="8192"
                    step="64"
                    value={tuningParams.maxTokens}
                    onChange={(e) => onTuningChange({ ...tuningParams, maxTokens: parseInt(e.target.value, 10) || 1024 })}
                    className="w-full h-2 cursor-pointer"
                    style={{ accentColor: "var(--accent-violet)" }}
                  />
                  <p className="font-mono-ui text-[10px] text-right" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>64 – 8192</p>
                </div>

                <Separator style={{ borderColor: "var(--border-strong)" }} />

                {/* Seed */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                      Seed
                    </Label>
                    <span className="font-mono-ui text-xs" style={{ color: "var(--foreground)", opacity: 0.8 }}>
                      {tuningParams.seed !== null ? tuningParams.seed : "Random"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Random"
                      value={tuningParams.seed !== null ? tuningParams.seed : ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const parsed = parseInt(val, 10);
                        onTuningChange({ ...tuningParams, seed: val && !isNaN(parsed) ? parsed : null });
                      }}
                      className="flex-1 h-7 rounded px-2 font-mono-ui text-xs"
                      style={{
                        background: "var(--background-2)",
                        border: "1.5px solid var(--border-strong)",
                        color: "var(--foreground)",
                        boxShadow: "1px 1px 0 var(--border-strong)",
                        outline: "none",
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    />
                    {tuningParams.seed !== null && (
                      <button
                        onClick={() => onTuningChange({ ...tuningParams, seed: null })}
                        className="btn-tactile text-[10px]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="font-mono-ui text-[10px] text-right" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>optional</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Debug ──────────────────────────────── */}
          <TabsContent value="debug">
            <Card
              className="card-riso surface-noise"
              style={{
                border: "1.5px solid var(--border-strong)",
                background: "var(--background-2)",
              }}
            >
              <CardContent className="p-3 space-y-3">
                {/* Debug toggle */}
                <button
                  type="button"
                  onClick={() => onShowDebugChange(!showDebug)}
                  className="flex items-center gap-2.5 w-full px-1 py-1.5 transition-colors"
                  style={{ color: showDebug ? "var(--accent-teal)" : "var(--muted-foreground)" }}
                >
                  <div
                    className="h-4 w-8 rounded-full relative transition-colors"
                    style={{
                      background: showDebug
                        ? "var(--accent-teal)"
                        : "color-mix(in srgb, var(--muted-foreground) 30%, transparent)",
                      border: "1.5px solid var(--border-strong)",
                      boxShadow: showDebug ? "1px 1px 0 var(--riso-teal)" : "none",
                    }}
                  >
                    <div
                      className="absolute top-0.5 h-3 w-3 rounded-full transition-transform"
                      style={{
                        background: showDebug ? "#fff" : "var(--background-3)",
                        transform: showDebug ? "translateX(16px)" : "translateX(2px)",
                      }}
                    />
                  </div>
                  <span className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase">Show AI Debug</span>
                </button>

                {showDebug && (
                  <>
                    <Separator style={{ borderColor: "var(--border-strong)" }} />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="riso-section-label">
                          Last Generation
                        </Label>
                        <button
                          onClick={fetchDebug}
                          disabled={debugLoading}
                          className="btn-tactile"
                          style={{ padding: "2px 4px" }}
                        >
                          <RefreshCw size={12} className={debugLoading ? "animate-spin" : ""} />
                        </button>
                      </div>
                      {debugPayload ? (
                        <pre
                          className="font-mono-ui text-[10px] rounded p-2 overflow-auto max-h-[300px] whitespace-pre-wrap break-all"
                          style={{
                            background: "var(--background-3)",
                            border: "1.5px solid var(--border-strong)",
                            color: "var(--foreground)",
                            boxShadow: "2px 2px 0 var(--riso-teal)",
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {JSON.stringify(debugPayload, null, 2)}
                        </pre>
                      ) : (
                        <p className="font-mono-ui text-[10px] italic" style={{ color: "var(--muted-foreground)", opacity: 0.75 }}>
                          {debugLoading ? "Loading..." : "No debug data yet. Set DEBUG_AI=true in .env and make a generation request."}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
