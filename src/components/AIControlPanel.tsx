import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Cpu, Layers, FileText, Sliders, Loader2 } from "lucide-react";
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
import type { PromptTemplate } from "../types";

const API_BASE = "http://127.0.0.1:8000";

interface AIControlPanelProps {
  templates: PromptTemplate[];
  selectedTemplateId: number | null;
  onTemplateChange: (id: number) => void;
  showDebug: boolean;
  onShowDebugChange: (show: boolean) => void;
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
 * Always-visible right-side panel for power-user AI controls.
 * Engine and Model tabs are live-wired to the backend.
 */
export function AIControlPanel({ templates, selectedTemplateId, onTemplateChange, showDebug, onShowDebugChange }: AIControlPanelProps) {
  // ── Engine state ───────────────────────────────────────────────
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [activeEngine, setActiveEngine] = useState<string | null>(null);
  const [engineSwitching, setEngineSwitching] = useState(false);

  // ── Model state ────────────────────────────────────────────────
  const [models, setModels] = useState<LocalModel[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [modelSwitching, setModelSwitching] = useState(false);

  // ── Fetch engines ──────────────────────────────────────────────
  const fetchEngines = useCallback(async () => {
    try {
      const res = await axios.get<EngineInfo[]>(`${API_BASE}/ai/engines`);
      setEngines(res.data);
      const active = res.data.find((e) => e.active);
      if (active) setActiveEngine(active.name);
    } catch {
      // Silently ignore on startup — backend may not be up yet
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
      // Silently ignore — local engine may not be registered
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
      // Re-fetch to sync status flags
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

  const isBusy = engineSwitching || modelSwitching;

  // Derived template helpers
  const templateCategories = Array.from(new Set(templates.map((t) => t.category)));
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  return (
    <aside className="w-full lg:w-[280px] shrink-0 border-t lg:border-t-0 lg:border-l bg-background flex flex-col overflow-hidden max-h-[40vh] lg:max-h-none">
      {/* Header */}
      <div className="h-12 lg:h-14 flex items-center gap-2 px-4 border-b">
        <Sliders size={15} className="text-muted-foreground" />
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          AI Controls
        </span>
        {isBusy && <Loader2 size={13} className="ml-auto animate-spin text-muted-foreground" />}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Tabs defaultValue="engine" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-8">
            <TabsTrigger value="engine" className="text-xs px-1.5 gap-1">
              <Cpu size={12} />
              Engine
            </TabsTrigger>
            <TabsTrigger value="model" className="text-xs px-1.5 gap-1">
              <Layers size={12} />
              Model
            </TabsTrigger>
            <TabsTrigger value="template" className="text-xs px-1.5 gap-1">
              <FileText size={12} />
              Prompt
            </TabsTrigger>
            <TabsTrigger value="creativity" className="text-xs px-1.5 gap-1">
              <Sliders size={12} />
              Tuning
            </TabsTrigger>
          </TabsList>

          {/* ── Engine ─────────────────────────────── */}
          <TabsContent value="engine">
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

          {/* ── Model ──────────────────────────────── */}
          <TabsContent value="model">
            <Card className="shadow-none border-muted">
              <CardContent className="p-3 space-y-3">
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
                      <SelectValue placeholder="No model loaded" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.filename} value={m.filename}>
                          <span>{m.filename}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground/70">
                    {modelSwitching
                      ? "Loading model — this may take a moment..."
                      : activeModel
                        ? `Loaded: ${activeModel}`
                        : "Select a GGUF model to load"}
                  </p>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Available GGUF Models
                  </Label>
                  {models.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/70 italic">
                      No .gguf files found in models directory
                    </p>
                  ) : (
                    models.map((m) => (
                      <div
                        key={m.filename}
                        className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              m.filename === activeModel ? "bg-emerald-500" : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="font-mono text-foreground truncate max-w-[140px]">
                            {m.filename}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                          {m.size_mb >= 1024
                            ? `${(m.size_mb / 1024).toFixed(1)}G`
                            : `${m.size_mb}M`}
                          {" "}ctx {m.default_ctx}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Prompt Template ────────────────────── */}
          <TabsContent value="template">
            <Card className="shadow-none border-muted">
              <CardContent className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Prompt Template
                  </Label>
                  <Select
                    value={selectedTemplateId !== null ? String(selectedTemplateId) : undefined}
                    onValueChange={(v) => onTemplateChange(parseInt(v))}
                    disabled={isBusy}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templateCategories.map((cat) => (
                        <div key={cat}>
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {cat}
                          </div>
                          {templates
                            .filter((t) => t.category === cat)
                            .map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                                {t.version ? ` v${t.version}` : ""}
                              </SelectItem>
                            ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <p className="text-[10px] text-muted-foreground/70 leading-snug">
                      {selectedTemplate.description || `Category: ${selectedTemplate.category}`}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    All Templates
                  </Label>
                  {templates.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/70 italic">
                      No templates loaded
                    </p>
                  ) : (
                    templates.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => onTemplateChange(t.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              t.id === selectedTemplateId ? "bg-emerald-500" : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="text-foreground">{t.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">
                          {t.category}{t.version ? ` v${t.version}` : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Creativity / Tuning (placeholder) ── */}
          <TabsContent value="creativity">
            <Card className="shadow-none border-muted">
              <CardContent className="p-3 space-y-3">
                {[
                  { label: "Temperature", value: "0.70", range: "0 – 1.5" },
                  { label: "Top-p", value: "0.95", range: "0.1 – 1.0" },
                  { label: "Max Tokens", value: "1024", range: "64 – 8192" },
                  { label: "Seed", value: "Random", range: "optional" },
                ].map((param, i) => (
                  <div key={param.label}>
                    {i > 0 && <Separator className="mb-3" />}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          {param.label}
                        </Label>
                        <span className="text-xs font-mono text-foreground">
                          {param.value}
                        </span>
                      </div>
                      {/* Placeholder track */}
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary/30 w-1/2" />
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 text-right">
                        {param.range}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Debug toggle */}
        <Separator className="my-1" />
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
      </div>
    </aside>
  );
}
