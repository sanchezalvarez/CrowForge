/**
 * LEGACY — Model benchmark/comparison tool for the marketing generator.
 * Retained while the new workspace modules (Chat, Documents, Sheets) are built.
 */
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Play, Loader2, AlertCircle, Check, Zap, FileText, ChevronDown, ChevronRight, History, RotateCcw, CheckCircle2, XCircle, Trash2, Info } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { toast } from "../hooks/useToast";

const API_BASE = "http://127.0.0.1:8000";

// Rough token estimate: ~4 chars per token for English text
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

interface BenchmarkRun {
  id: number;
  input_text: string;
  engine_name: string;
  model_name: string | null;
  temperature: number;
  max_tokens: number;
  latency_ms: number;
  output_text: string;
  error: string | null;
  created_at: string;
}

interface EngineInfo {
  name: string;
  type: string;
  active: boolean;
}

interface ModelInfo {
  filename: string;
  size_mb: number;
  default_ctx: number;
}

export function BenchmarkPage() {
  const [inputText, setInputText] = useState(
    "Generate 3 creative marketing concepts for a new eco-friendly water bottle brand."
  );
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<Set<string>>(
    new Set()
  );
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    new Set()
  );
  const [running, setRunning] = useState(false);
  const [runningLabel, setRunningLabel] = useState<string | null>(null);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);
  // Tracks IDs of runs from the current in-progress batch (for live highlighting)
  const [currentBatchIds, setCurrentBatchIds] = useState<Set<number>>(new Set());
  const abortRef = useRef(false);

  // Fetch engines, models, and history on mount
  useEffect(() => {
    axios
      .get<EngineInfo[]>(`${API_BASE}/ai/engines`)
      .then((res) => {
        setEngines(res.data);
        setSelectedEngines(new Set(res.data.map((e) => e.name)));
      })
      .catch(() => {});

    axios
      .get<{ models: ModelInfo[]; active_model: string | null }>(
        `${API_BASE}/ai/models`
      )
      .then((res) => {
        setModels(res.data.models);
        if (res.data.active_model) {
          setSelectedModels(new Set([res.data.active_model]));
        }
      })
      .catch(() => {});

    fetchRuns();
  }, []);

  const fetchRuns = () => {
    axios
      .get<{ runs: BenchmarkRun[] }>(`${API_BASE}/benchmark/runs?limit=50`)
      .then((res) => {
        setRuns(
          (res.data.runs || []).map((r) => ({
            ...r,
            output_text: r.output_text ?? "",
            error: r.error ?? null,
          }))
        );
      })
      .catch(() => {});
  };

  const toggleEngine = (name: string) => {
    setSelectedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleModel = (filename: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  // Group runs into sessions by input_text
  interface Session {
    key: string;
    inputSummary: string;
    runCount: number;
    latestTime: string;
    models: string[];
  }
  const sessions: Session[] = (() => {
    const map = new Map<string, BenchmarkRun[]>();
    for (const r of runs) {
      const existing = map.get(r.input_text);
      if (existing) existing.push(r);
      else map.set(r.input_text, [r]);
    }
    return Array.from(map.entries()).map(([key, group]) => {
      const sorted = group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const modelSet = new Set(group.map((r) => r.model_name || r.engine_name));
      return {
        key,
        inputSummary: key.length > 80 ? key.slice(0, 80) + "\u2026" : key,
        runCount: group.length,
        latestTime: sorted[0].created_at,
        models: Array.from(modelSet),
      };
    }).sort((a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime());
  })();

  const displayedRuns = selectedSessionKey
    ? runs.filter((r) => r.input_text === selectedSessionKey)
    : runs;

  const hasLocalEngine = engines.some((e) => e.name === "local");
  const localSelected = selectedEngines.has("local");
  const needsModels = localSelected && hasLocalEngine && models.length > 0;
  const canRun =
    selectedEngines.size > 0 &&
    inputText.trim().length > 0 &&
    (!needsModels || selectedModels.size > 0);

  const normalizeRun = (r: BenchmarkRun): BenchmarkRun => ({
    ...r,
    output_text: r.output_text ?? "",
    error: r.error ?? null,
  });

  const handleRun = async () => {
    if (!inputText.trim()) {
      toast("Input text is required", "error");
      return;
    }
    if (selectedEngines.size === 0) {
      toast("Select at least one engine", "error");
      return;
    }
    if (needsModels && selectedModels.size === 0) {
      toast("Select at least one model for the local engine", "error");
      return;
    }

    setRunning(true);
    setRunningLabel(null);
    abortRef.current = false;

    const engineList = Array.from(selectedEngines);
    const modelList = Array.from(selectedModels);

    // Build individual jobs: each is a separate POST so results appear live
    const jobs: { engines: string[]; models: string[]; label: string }[] = [];
    for (const eng of engineList) {
      if (eng === "local" && modelList.length > 0) {
        for (const m of modelList) {
          jobs.push({ engines: [eng], models: [m], label: `${eng}/${m}` });
        }
      } else {
        jobs.push({ engines: [eng], models: [], label: eng });
      }
    }

    const batchIds = new Set<number>();
    setCurrentBatchIds(batchIds);
    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      if (abortRef.current) break;
      setRunningLabel(`${job.label} (${completed + 1}/${jobs.length})`);

      try {
        const res = await axios.post<{ runs: BenchmarkRun[] }>(
          `${API_BASE}/benchmark/run`,
          {
            input_text: inputText.trim(),
            engines: job.engines,
            models: job.models,
            temperature,
            max_tokens: maxTokens,
          }
        );
        const newRuns = (res.data.runs || []).map(normalizeRun);
        for (const r of newRuns) {
          batchIds.add(r.id);
          if (r.error) failed++;
        }
        setCurrentBatchIds(new Set(batchIds));
        // Prepend new runs so they appear at top
        setRuns((prev) => [...newRuns, ...prev]);
        completed++;
      } catch (err: any) {
        failed++;
        toast(`${job.label}: ${err?.response?.data?.detail || "Request failed"}`, "error");
        completed++;
      }
    }

    if (failed > 0) {
      toast(`Benchmark done: ${failed} of ${jobs.length} had errors`, "error");
    } else {
      toast(`Benchmark complete: ${jobs.length} run(s)`, "success");
    }

    setRunning(false);
    setRunningLabel(null);
    // Keep batch IDs so the reset button stays visible (highlight fades via CSS)
  };

  // Compute summary stats for displayed runs
  const okRuns = displayedRuns.filter((r) => !r.error);
  const fastestRun = okRuns.length > 0 ? okRuns.reduce((a, b) => a.latency_ms < b.latency_ms ? a : b) : null;
  const mostVerboseRun = okRuns.length > 0 ? okRuns.reduce((a, b) => a.output_text.length > b.output_text.length ? a : b) : null;
  const fastestMs = fastestRun?.latency_ms ?? -1;
  const longestLen = mostVerboseRun?.output_text.length ?? -1;

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Benchmark</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare AI engines and models side-by-side. Send the same prompt
          to multiple models, compare latency and output quality.
          Failed models are logged without stopping the run.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* ── Left: Controls ──────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Input Prompt
                </Label>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={5}
                  disabled={running}
                  className="text-sm leading-relaxed resize-none"
                  placeholder="Enter a prompt to benchmark..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Temperature
                  </Label>
                  <input
                    type="number"
                    value={temperature}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= 0 && v <= 1.5)
                        setTemperature(v);
                    }}
                    step={0.05}
                    min={0}
                    max={1.5}
                    disabled={running}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Max Tokens
                  </Label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v > 0) setMaxTokens(v);
                    }}
                    min={64}
                    max={8192}
                    disabled={running}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Engines
                </Label>
                {engines.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70 italic">
                    No engines available
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {engines.map((e) => (
                      <button
                        key={e.name}
                        type="button"
                        onClick={() => toggleEngine(e.name)}
                        disabled={running}
                        className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                          selectedEngines.has(e.name)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                        } disabled:opacity-50`}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model checklist — shown when local engine exists */}
              {hasLocalEngine && models.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Models{" "}
                    <span className="text-muted-foreground/60 font-normal">
                      (local engine)
                    </span>
                  </Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {models.map((m) => (
                      <label
                        key={m.filename}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          selectedModels.has(m.filename)
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/50"
                        } ${running ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            selectedModels.has(m.filename)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-input"
                          }`}
                        >
                          {selectedModels.has(m.filename) && (
                            <Check size={10} />
                          )}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedModels.has(m.filename)}
                          onChange={() => toggleModel(m.filename)}
                          disabled={running}
                        />
                        <span className="font-mono truncate flex-1">
                          {m.filename}
                        </span>
                        <span className="text-muted-foreground/60 tabular-nums">
                          {m.size_mb}MB
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedEngines.size === 0 && engines.length > 0 && (
                <p className="text-xs text-amber-600">
                  Select at least one engine to run the benchmark.
                </p>
              )}

              {needsModels && selectedModels.size === 0 && (
                <p className="text-xs text-amber-600">
                  Select at least one model to benchmark.
                </p>
              )}

              <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70">
                <Info size={12} className="mt-0.5 shrink-0" />
                <span>The same prompt is sent to every selected model for a fair comparison.</span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleRun}
                  disabled={running || !canRun}
                  className="flex-1"
                >
                  {running ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {runningLabel
                        ? `Running ${runningLabel}`
                        : "Running..."}
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Benchmark
                    </>
                  )}
                </Button>
                {currentBatchIds.size > 0 && !running && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRuns((prev) => prev.filter((r) => !currentBatchIds.has(r.id)));
                      setCurrentBatchIds(new Set());
                      setExpandedId(null);
                      toast("Last run cleared from view", "success");
                    }}
                    title="Clear last run from view"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Past Sessions ──────────────────────── */}
          {sessions.length > 0 && (
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <History size={13} />
                    Past Sessions
                  </div>
                  {selectedSessionKey && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setInputText(selectedSessionKey);
                          toast("Prompt loaded", "success");
                        }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Reuse prompt
                      </button>
                      <button
                        onClick={() => { setSelectedSessionKey(null); setExpandedId(null); }}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <RotateCcw size={10} />
                        Show all
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 max-h-52 overflow-y-auto">
                  {sessions.map((s) => {
                    const isActive = selectedSessionKey === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => {
                          setSelectedSessionKey(isActive ? null : s.key);
                          setExpandedId(null);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                          isActive
                            ? "bg-primary/10 ring-1 ring-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs truncate flex-1 ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                            {s.inputSummary}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
                            {s.runCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground/60">
                            {new Date(s.latestTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                            {new Date(s.latestTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 truncate">
                            {s.models.join(", ")}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Results ─────────────────────── */}
        <div className="space-y-4">
          {/* Summary bar */}
          {okRuns.length > 1 && (
            <div className="flex flex-wrap gap-3">
              {fastestRun && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <Zap size={12} className="text-emerald-500" />
                  <span className="text-muted-foreground">Fastest:</span>
                  <span className="font-mono font-medium text-emerald-600">
                    {fastestRun.model_name || fastestRun.engine_name}
                  </span>
                  <span className="text-muted-foreground/60 font-mono">
                    {fastestRun.latency_ms.toLocaleString()}ms
                  </span>
                </div>
              )}
              {mostVerboseRun && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs">
                  <FileText size={12} className="text-blue-500" />
                  <span className="text-muted-foreground">Most verbose:</span>
                  <span className="font-mono font-medium text-blue-600">
                    {mostVerboseRun.model_name || mostVerboseRun.engine_name}
                  </span>
                  <span className="text-muted-foreground/60 font-mono">
                    ~{estimateTokens(mostVerboseRun.output_text).toLocaleString()} tokens
                  </span>
                </div>
              )}
            </div>
          )}

          <Card>
            {selectedSessionKey && (
              <div className="px-4 pt-3 pb-0 flex items-center justify-between">
                <div className="text-xs text-muted-foreground min-w-0">
                  <span className="font-medium text-foreground">Session:</span>{" "}
                  <span className="font-mono truncate inline-block max-w-[300px] align-bottom">
                    {selectedSessionKey.length > 60 ? selectedSessionKey.slice(0, 60) + "\u2026" : selectedSessionKey}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 ml-2">
                  {displayedRuns.length} run{displayedRuns.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <CardContent className="p-0">
              {displayedRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <p className="text-sm">
                    {selectedSessionKey ? "No runs in this session" : "No benchmark runs yet"}
                  </p>
                  <p className="text-xs mt-1">
                    {selectedSessionKey ? "Select a different session or run a new benchmark" : "Run a benchmark to see results here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-8" />
                        <TableHead className="text-xs">Model</TableHead>
                        <TableHead className="text-xs text-center w-16">Status</TableHead>
                        <TableHead className="text-xs text-right whitespace-nowrap">
                          Latency
                        </TableHead>
                        <TableHead className="text-xs text-right whitespace-nowrap">
                          ~Tokens
                        </TableHead>
                        <TableHead className="text-xs">Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRuns.map((run) => {
                        const isExpanded = expandedId === run.id;
                        const isFastest = !run.error && run.latency_ms === fastestMs && okRuns.length > 1;
                        const isLongest = !run.error && run.output_text.length === longestLen && okRuns.length > 1;
                        const isNew = currentBatchIds.has(run.id);

                        return (
                          <TableRow
                            key={run.id}
                            className={`cursor-pointer group align-top transition-colors ${
                              run.error
                                ? "bg-destructive/[0.04]"
                                : isNew
                                  ? "bg-primary/[0.03]"
                                  : ""
                            }`}
                            onClick={() =>
                              setExpandedId(isExpanded ? null : run.id)
                            }
                          >
                            {/* Expand chevron */}
                            <TableCell className="text-muted-foreground/50 pr-0 w-8">
                              {isExpanded
                                ? <ChevronDown size={14} />
                                : <ChevronRight size={14} />}
                            </TableCell>

                            {/* Model */}
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate max-w-[180px]">
                                  {run.model_name || run.engine_name}
                                </span>
                                {isFastest && <Zap size={11} className="text-emerald-500" />}
                                {isLongest && <FileText size={11} className="text-blue-500" />}
                              </div>
                              {run.model_name && run.model_name !== run.engine_name && (
                                <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                  {run.engine_name}
                                </div>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell className="text-center">
                              {run.error ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive">
                                  <XCircle size={12} />
                                  ERROR
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                                  <CheckCircle2 size={12} />
                                  OK
                                </span>
                              )}
                            </TableCell>

                            {/* Latency */}
                            <TableCell className="text-xs font-mono text-right tabular-nums whitespace-nowrap">
                              {run.error ? (
                                <span className="text-muted-foreground/40">{"\u2014"}</span>
                              ) : (
                                <span className={isFastest ? "text-emerald-600 font-semibold" : ""}>
                                  {run.latency_ms.toLocaleString()}ms
                                </span>
                              )}
                            </TableCell>

                            {/* Estimated tokens */}
                            <TableCell className="text-xs font-mono text-right tabular-nums whitespace-nowrap">
                              {run.error ? (
                                <span className="text-muted-foreground/40">{"\u2014"}</span>
                              ) : (
                                <span className={isLongest ? "text-blue-600 font-semibold" : ""}>
                                  {estimateTokens(run.output_text).toLocaleString()}
                                </span>
                              )}
                            </TableCell>

                            {/* Preview */}
                            <TableCell className="text-xs max-w-[280px]">
                              {run.error ? (
                                <span className="font-mono text-destructive/80 line-clamp-2 block">
                                  {run.error}
                                </span>
                              ) : (
                                <span className="font-mono text-muted-foreground line-clamp-2 break-all leading-relaxed">
                                  {run.output_text.slice(0, 200) || "(empty)"}
                                  {run.output_text.length > 200 && "\u2026"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Expanded full output */}
                  {expandedId &&
                    (() => {
                      const run = displayedRuns.find((r) => r.id === expandedId);
                      if (!run) return null;
                      return (
                        <div className="border-t px-4 py-4 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">
                              {run.model_name || run.engine_name}
                              {run.model_name && run.model_name !== run.engine_name
                                ? ` \u00b7 ${run.engine_name}`
                                : ""}
                            </span>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                              <span>temp={run.temperature}</span>
                              <span>max_tokens={run.max_tokens}</span>
                              <span>{run.latency_ms.toLocaleString()}ms</span>
                              <span>{new Date(run.created_at).toLocaleString()}</span>
                            </div>
                          </div>

                          {run.error && (
                            <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2 font-mono">
                              {run.error}
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              Input
                            </span>
                            <pre className="text-xs font-mono bg-background rounded border px-3 py-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                              {run.input_text}
                            </pre>
                          </div>

                          {!run.error && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                  Output
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {run.output_text.length.toLocaleString()} chars {"\u00b7"} ~{estimateTokens(run.output_text).toLocaleString()} tokens
                                </span>
                              </div>
                              {(() => {
                                // Try to parse as JSON and render structured output
                                try {
                                  const trimmed = run.output_text.trim();
                                  const startIdx = trimmed.indexOf("{");
                                  const endIdx = trimmed.lastIndexOf("}");
                                  if (startIdx === -1 || endIdx === -1) throw new Error("no json");
                                  const parsed = JSON.parse(trimmed.slice(startIdx, endIdx + 1));
                                  // Find array of concepts — could be under various keys or top-level
                                  const items: any[] =
                                    parsed.concepts || parsed.ideas || parsed.items ||
                                    (Array.isArray(parsed) ? parsed : null);
                                  if (!items || items.length === 0) throw new Error("no items");
                                  return (
                                    <div className="space-y-2">
                                      {items.map((item: any, i: number) => (
                                        <div key={i} className="bg-background rounded border px-3 py-2.5 space-y-1.5">
                                          <div className="flex items-baseline gap-2">
                                            <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                                              #{i + 1}
                                            </span>
                                            <span className="text-sm font-semibold text-foreground">
                                              {item.concept_name || item.name || item.title || `Concept ${i + 1}`}
                                            </span>
                                          </div>
                                          {(item.rationale || item.description) && (
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                              {item.rationale || item.description}
                                            </p>
                                          )}
                                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                                            {item.target_audience && (
                                              <span>
                                                <span className="text-muted-foreground/60">Audience:</span>{" "}
                                                <span className="text-foreground">{item.target_audience}</span>
                                              </span>
                                            )}
                                            {item.key_message && (
                                              <span>
                                                <span className="text-muted-foreground/60">Message:</span>{" "}
                                                <span className="text-foreground italic">"{item.key_message}"</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                } catch {
                                  // Fallback: raw text
                                  return (
                                    <pre className="text-xs font-mono bg-background rounded border px-3 py-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                                      {run.output_text || "(empty)"}
                                    </pre>
                                  );
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
