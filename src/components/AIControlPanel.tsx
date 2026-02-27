import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Cpu, Sliders, Bug, Loader2, RefreshCw, RotateCcw, Terminal } from "lucide-react";
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
export function AIControlPanel({ showDebug, onShowDebugChange, tuningParams, onTuningChange }: AIControlPanelProps) {
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

  const handleRestartBackend = useCallback(async () => {
    setBackendStatus("restarting");
    restartingRef.current = true;
    setRestartAttempt(0);

    if (isTauri()) {
      // Use Tauri IPC to restart the sidecar
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
      // Dev mode: just try to hit /shutdown — backend won't come back
      try {
        await axios.post(`${API_BASE}/shutdown`, {}, { timeout: 2000 }).catch(() => {});
      } catch { /* expected */ }
    }

    // Poll until backend comes back (up to 30s)
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
          toast("Backend restarted", "success");
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
  }, [checkBackend]);

  // ── Engine state ───────────────────────────────────────────────
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [activeEngine, setActiveEngine] = useState<string | null>(null);
  const [engineSwitching, setEngineSwitching] = useState(false);

  // ── Model state ────────────────────────────────────────────────
  const [models, setModels] = useState<LocalModel[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [modelSwitching, setModelSwitching] = useState(false);

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
        <div className="rounded-lg border-l-4 border-l-emerald-500 border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Backend Online
              </span>
            </div>
            <button
              onClick={handleRestartBackend}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Restart backend"
            >
              <RotateCcw size={11} />
              Restart
            </button>
          </div>
          {responseTime !== null && (
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/60 mt-1 ml-[18px]">
              Response: {responseTime}ms
            </p>
          )}
        </div>
      );
    }

    if (backendStatus === "restarting") {
      return (
        <div className="rounded-lg border-l-4 border-l-amber-500 border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-amber-500" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Restarting backend...
            </span>
          </div>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-500/60 mt-1 ml-[22px]">
            Attempt {restartAttempt}/30 — waiting for backend to respond
          </p>
        </div>
      );
    }

    // Offline
    return (
      <div className="rounded-lg border-l-4 border-l-red-500 border border-red-500/20 bg-red-500/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">
            Backend Offline
          </span>
        </div>
        <div className="mt-2 ml-[18px]">
          {isTauri() ? (
            <button
              onClick={handleRestartBackend}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <RotateCcw size={12} />
              Restart Backend
            </button>
          ) : (
            <div className="space-y-1">
              <p className="text-[11px] text-red-600/80 dark:text-red-400/80">
                Start the backend manually:
              </p>
              <code className="flex items-center gap-1.5 text-[10px] font-mono bg-muted/60 rounded px-2 py-1 text-foreground/80">
                <Terminal size={10} className="shrink-0 text-muted-foreground" />
                python -m backend.app
              </code>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-full lg:w-[280px] shrink-0 border-t lg:border-t-0 lg:border-l bg-background flex flex-col overflow-hidden max-h-[40vh] lg:max-h-none">
      {/* Header */}
      <div className="h-12 lg:h-14 flex items-center gap-2 px-4 border-b">
        <Sliders size={15} className="text-muted-foreground" />
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          AI Controls
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isBusy && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Backend Status Banner */}
        {renderStatusBanner()}

        <Tabs defaultValue="engine-model" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="engine-model" className="text-xs px-1.5 gap-1">
              <Cpu size={12} />
              Engine
            </TabsTrigger>
            <TabsTrigger value="tuning" className="text-xs px-1.5 gap-1">
              <Sliders size={12} />
              Tuning
            </TabsTrigger>
            <TabsTrigger value="debug" className="text-xs px-1.5 gap-1" onClick={() => { if (showDebug) fetchDebug(); }}>
              <Bug size={12} />
              Debug
            </TabsTrigger>
          </TabsList>

          {/* ── Engine & Model ─────────────────────── */}
          <TabsContent value="engine-model">
            <Card className="shadow-none border-muted">
              <CardContent className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    AI Engine
                  </Label>
                  <Select
                    value={activeEngine ?? undefined}
                    onValueChange={handleEngineChange}
                    disabled={isBusy}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue placeholder="No engines available" />
                    </SelectTrigger>
                    <SelectContent>
                      {engines.map((e) => (
                        <SelectItem key={e.name} value={e.name}>
                          <span className="font-mono">{e.name}</span>
                          <span className="ml-2 text-muted-foreground/60 text-[10px]">
                            {e.type}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground/70">
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
                    <Separator />
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                        Local Model
                      </Label>
                      <Select
                        value={activeModel ?? undefined}
                        onValueChange={handleModelChange}
                        disabled={isBusy || models.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs font-mono">
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
                        <p className="text-[10px] text-muted-foreground/70">
                          Loading model — this may take a moment...
                        </p>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Registered
                  </Label>
                  {engines.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/70 italic">
                      No engines found — is the backend running?
                    </p>
                  ) : (
                    engines.map((e) => (
                      <div
                        key={e.name}
                        className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs text-muted-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              e.name === activeEngine ? "bg-emerald-500" : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="font-mono">{e.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">
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
            <Card className="shadow-none border-muted">
              <CardContent className="p-3 space-y-3">
                {/* Temperature */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      Temperature
                    </Label>
                    <span className="text-xs font-mono text-foreground">
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
                    className="w-full h-2 accent-primary cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground/60 text-right">0 – 1.5</p>
                </div>

                <Separator />

                {/* Top-p */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      Top-p
                    </Label>
                    <span className="text-xs font-mono text-foreground">
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
                    className="w-full h-2 accent-primary cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground/60 text-right">0.1 – 1.0</p>
                </div>

                <Separator />

                {/* Max Tokens */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      Max Tokens
                    </Label>
                    <span className="text-xs font-mono text-foreground">
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
                    className="w-full h-2 accent-primary cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground/60 text-right">64 – 8192</p>
                </div>

                <Separator />

                {/* Seed */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      Seed
                    </Label>
                    <span className="text-xs font-mono text-foreground">
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
                      className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    {tuningParams.seed !== null && (
                      <button
                        onClick={() => onTuningChange({ ...tuningParams, seed: null })}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 text-right">optional</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Debug ──────────────────────────────── */}
          <TabsContent value="debug">
            <Card className="shadow-none border-muted">
              <CardContent className="p-3 space-y-3">
                {/* Debug toggle */}
                <button
                  type="button"
                  onClick={() => onShowDebugChange(!showDebug)}
                  className="flex items-center gap-2.5 w-full px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <div
                    className={`h-4 w-8 rounded-full relative transition-colors ${
                      showDebug ? "bg-emerald-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                        showDebug ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <span className="font-mono">Show AI Debug</span>
                </button>

                {showDebug && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          Last Generation
                        </Label>
                        <button
                          onClick={fetchDebug}
                          disabled={debugLoading}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw size={12} className={debugLoading ? "animate-spin" : ""} />
                        </button>
                      </div>
                      {debugPayload ? (
                        <pre className="text-[10px] font-mono text-foreground/80 bg-muted rounded p-2 overflow-auto max-h-[300px] whitespace-pre-wrap break-all">
                          {JSON.stringify(debugPayload, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/70 italic">
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
