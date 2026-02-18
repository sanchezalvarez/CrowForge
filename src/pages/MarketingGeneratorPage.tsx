/**
 * LEGACY — Marketing campaign generator UI.
 * Retained while the new workspace modules (Chat, Documents, Sheets) are built.
 */
import { useState, useEffect } from "react";
import axios from "axios";
import { Sparkles, AlertCircle } from "lucide-react";
import { GeneratorForm, type LocalModelInfo } from "../components/GeneratorForm";
import { ConceptResults } from "../components/ConceptResults";
import { StreamingDisplay } from "../components/StreamingDisplay";
import { VersionHistory } from "../components/VersionHistory";
import { useSSE, type AIDebugInfo } from "../hooks/useSSE";
import { normalizeConcepts } from "../lib/normalize";
import { toast } from "../hooks/useToast";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import type { Campaign, UIConcept, ProjectType, RefineAction, GenerationVersion, PromptTemplate } from "../types";

const API_BASE = "http://127.0.0.1:8000";

type EditableField = "concept_name" | "rationale" | "target_audience" | "key_message";

function AIDebugPanel({ debug }: { debug: AIDebugInfo }) {
  const [expandPrompt, setExpandPrompt] = useState(false);
  return (
    <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/30 p-3 space-y-2 font-mono text-[11px] text-muted-foreground">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>Engine:</span><span className="font-semibold">{debug.engine_name}</span>
        <span>Latency:</span><span>{debug.latency_ms}ms</span>
        <span>Token est.:</span><span>~{debug.token_estimate}</span>
        <span>Response:</span><span>{debug.response_chars} chars</span>
        <span>Temperature:</span><span>{debug.generation_params.temperature}</span>
        <span>Top-p:</span><span>{debug.generation_params.top_p}</span>
        <span>Max tokens:</span><span>{debug.generation_params.max_tokens}</span>
        <span>Seed:</span><span>{debug.generation_params.seed ?? "none"}</span>
      </div>
      <button
        type="button"
        onClick={() => setExpandPrompt(!expandPrompt)}
        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground"
      >
        {expandPrompt ? "[-] Hide prompts" : "[+] Show final prompts"}
      </button>
      {expandPrompt && (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] font-semibold mb-0.5">System prompt:</div>
            <pre className="whitespace-pre-wrap break-words bg-background/50 rounded p-2 max-h-48 overflow-y-auto text-[10px] leading-relaxed">{debug.final_system_prompt}</pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold mb-0.5">User prompt:</div>
            <pre className="whitespace-pre-wrap break-words bg-background/50 rounded p-2 max-h-24 overflow-y-auto text-[10px] leading-relaxed">{debug.final_user_prompt}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

interface MarketingGeneratorPageProps {
  campaign: Campaign;
  onCampaignUpdate: (campaign: Campaign) => void;
  templates: PromptTemplate[];
  selectedTemplateId: number | null;
  onTemplateChange: (id: number) => void;
  showDebug: boolean;
}

export function MarketingGeneratorPage({
  campaign,
  onCampaignUpdate,
  templates,
  selectedTemplateId,
  onTemplateChange,
  showDebug,
}: MarketingGeneratorPageProps) {
  const {
    streamedText,
    isGenerating,
    generationFinished,
    error,
    debugInfo,
    startStream,
    reset: resetMainStream,
  } = useSSE();
  const {
    streamedText: regenText,
    isGenerating: isRegenerating,
    generationFinished: regenFinished,
    error: regenError,
    debugInfo: regenDebugInfo,
    startStream: startRegenStream,
  } = useSSE();

  // Debug mode — toggle is controlled from AIControlPanel via App.tsx
  const [latestDebug, setLatestDebug] = useState<AIDebugInfo | null>(null);

  // Capture debug info from either stream
  useEffect(() => {
    if (debugInfo) setLatestDebug(debugInfo);
  }, [debugInfo]);
  useEffect(() => {
    if (regenDebugInfo) setLatestDebug(regenDebugInfo);
  }, [regenDebugInfo]);

  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null
  );
  const [regenResultError, setRegenResultError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Refine state
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  const [refiningField, setRefiningField] = useState<EditableField | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  // Local editable concepts — initialized from campaign data or generation results
  const [localConcepts, setLocalConcepts] = useState<UIConcept[] | null>(null);

  // Version history
  const [versions, setVersions] = useState<GenerationVersion[]>([]);
  const [viewingVersionId, setViewingVersionId] = useState<number | null>(null);

  // AI generation controls
  const [tone, setTone] = useState("neutral");
  const [style, setStyle] = useState("b2b");
  const [creativity, setCreativity] = useState(50);
  const [projectType, setProjectType] = useState<ProjectType>(
    campaign.project_type ?? "campaign"
  );

  // Prompt template — state is lifted to App.tsx and shared with AIControlPanel

  // Advanced AI controls (persisted in localStorage)
  const [advTemperature, setAdvTemperature] = useState<number | null>(() => {
    const v = localStorage.getItem("ai_adv_temperature");
    return v !== null ? parseFloat(v) : null;
  });
  const [advTopP, setAdvTopP] = useState(() => {
    const v = localStorage.getItem("ai_adv_top_p");
    return v !== null ? parseFloat(v) : 0.95;
  });
  const [advMaxTokens, setAdvMaxTokens] = useState(() => {
    const v = localStorage.getItem("ai_adv_max_tokens");
    return v !== null ? parseInt(v) : 1024;
  });
  const [advSeed, setAdvSeed] = useState<number | null>(() => {
    const v = localStorage.getItem("ai_adv_seed");
    return v !== null && v !== "" ? parseInt(v) : null;
  });

  // Persist advanced controls
  useEffect(() => {
    if (advTemperature !== null) localStorage.setItem("ai_adv_temperature", String(advTemperature));
    else localStorage.removeItem("ai_adv_temperature");
    localStorage.setItem("ai_adv_top_p", String(advTopP));
    localStorage.setItem("ai_adv_max_tokens", String(advMaxTokens));
    if (advSeed !== null) localStorage.setItem("ai_adv_seed", String(advSeed));
    else localStorage.removeItem("ai_adv_seed");
  }, [advTemperature, advTopP, advMaxTokens, advSeed]);

  // Local model management
  const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);

  const fetchModels = () => {
    axios.get(`${API_BASE}/ai/models`).then((res) => {
      setLocalModels(res.data.models || []);
      setActiveModel(res.data.active_model || null);
    }).catch(() => {});
  };

  useEffect(() => { fetchModels(); }, []);

  const handleModelChange = async (filename: string, ctx: number) => {
    setModelLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/ai/model`, { filename, ctx });
      setActiveModel(res.data.model?.model_name || filename);
      toast(`Model loaded: ${filename}`);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail || "Model load failed" : "Model load failed";
      toast(msg, "error");
    } finally {
      setModelLoading(false);
    }
  };

  // Confirm overwrite dialog
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const isRefining = refiningIndex !== null;
  const isBusy = isGenerating || isRegenerating || isRefining;

  const fetchVersions = async () => {
    if (!campaign.id) return;
    try {
      const res = await axios.get(`${API_BASE}/campaigns/${campaign.id}/versions`);
      setVersions(res.data);
    } catch {
      // silently fail — versions are non-critical
    }
  };

  // Fetch versions on mount if campaign has ideas
  useEffect(() => {
    if (campaign.id && campaign.ideas && campaign.ideas.length > 0) {
      fetchVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const handleViewVersion = (versionId: number) => {
    const version = versions.find((v) => v.id === versionId);
    if (!version) return;
    setLocalConcepts(normalizeConcepts(version.content));
    setViewingVersionId(versionId);
  };

  const handleRestoreVersion = async (versionId: number) => {
    try {
      const res = await axios.post(`${API_BASE}/versions/${versionId}/restore`);
      onCampaignUpdate(res.data);
      setViewingVersionId(null);
      await fetchVersions();
      toast("Version restored successfully.");
    } catch {
      toast("Failed to restore version.", "error");
    }
  };

  const handleBackToCurrent = () => {
    setViewingVersionId(null);
    if (campaign.ideas && campaign.ideas.length > 0) {
      setLocalConcepts(normalizeConcepts(campaign.ideas));
    }
  };

  const buildGenUrl = (base: string) => {
    const params = new URLSearchParams({
      tone,
      style,
      creativity: String(creativity),
      project_type: projectType,
      top_p: String(advTopP),
      max_tokens: String(advMaxTokens),
    });
    if (advTemperature !== null) params.set("temperature", String(advTemperature));
    if (advSeed !== null) params.set("seed", String(advSeed));
    if (selectedTemplateId !== null) params.set("template_id", String(selectedTemplateId));
    return `${base}?${params}`;
  };

  const parseIdeas = (text: string) => {
    try {
      const startArr = text.indexOf("[");
      const endArr = text.lastIndexOf("]");
      const startObj = text.indexOf("{");
      const endObj = text.lastIndexOf("}");

      let jsonStr = "";
      if (startArr !== -1 && endArr > startArr) {
        jsonStr = text.substring(startArr, endArr + 1);
      } else if (startObj !== -1 && endObj > startObj) {
        jsonStr = text.substring(startObj, endObj + 1);
      }

      if (!jsonStr) return [];
      const data = JSON.parse(jsonStr);

      if (Array.isArray(data)) return data;
      if (typeof data === "object") {
        for (const key of ["concepts", "ideas", "items", "campaigns"]) {
          if (Array.isArray(data[key])) return data[key];
        }
      }
      return [];
    } catch {
      return [];
    }
  };

  const currentIdeas: UIConcept[] = isGenerating
    ? []
    : localConcepts ??
      normalizeConcepts(
        generationFinished
          ? parseIdeas(streamedText)
          : campaign.ideas || []
      );

  const generationEmpty =
    generationFinished && !error && currentIdeas.length === 0;

  // Sync localConcepts when generation finishes
  useEffect(() => {
    if (generationFinished && !error) {
      const parsed = parseIdeas(streamedText);
      const normalized = normalizeConcepts(parsed);
      if (normalized.length > 0) {
        setLocalConcepts(normalized);
        toast("Concepts ready — review them below or export.");
      }
      setViewingVersionId(null);
      fetchVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationFinished]);

  // Sync localConcepts when campaign changes externally (e.g. after regen refresh)
  useEffect(() => {
    if (!generationFinished && campaign.ideas && campaign.ideas.length > 0) {
      setLocalConcepts(normalizeConcepts(campaign.ideas));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.ideas]);

  const startGeneration = () => {
    setLocalConcepts(null);
    setRegenResultError(null);
    setExportError(null);
    setRefineError(null);
    startStream(
      buildGenUrl(`${API_BASE}/generate/ideas/${campaign.id}`)
    );
  };

  const handleGenerate = () => {
    // If concepts exist, confirm before overwriting
    if (currentIdeas.length > 0) {
      setConfirmOverwrite(true);
      return;
    }
    startGeneration();
  };

  const handleConfirmRegenerate = () => {
    setConfirmOverwrite(false);
    startGeneration();
  };

  const handleRegenerate = (idx: number) => {
    resetMainStream();
    setLocalConcepts(null);
    setRegeneratingIndex(idx);
    setRegenResultError(null);
    setExportError(null);
    setRefineError(null);
    startRegenStream(
      buildGenUrl(`${API_BASE}/generate/idea/${campaign.id}/${idx}`)
    );
  };

  const handleFieldEdit = (index: number, field: EditableField, value: string) => {
    setLocalConcepts((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRefine = async (index: number, field: EditableField, action: RefineAction) => {
    const concept = currentIdeas[index];
    if (!concept) return;

    setRefiningIndex(index);
    setRefiningField(field);
    setRefineError(null);

    try {
      const res = await axios.post(`${API_BASE}/refine`, {
        campaign_id: campaign.id,
        concept_index: index,
        field_name: field,
        current_text: concept[field],
        project_goal: campaign.brief,
        action,
      });

      const refinedText: string = res.data.refined_text;
      setLocalConcepts((prev) => {
        if (!prev) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: refinedText };
        return updated;
      });
    } catch {
      setRefineError("Refinement failed. Please try again.");
    } finally {
      setRefiningIndex(null);
      setRefiningField(null);
    }
  };

  const handleExport = async (format: "json" | "markdown") => {
    setExportError(null);
    try {
      const res = await axios.get(
        `${API_BASE}/campaigns/${campaign.id}/export/${format}`
      );
      const content =
        format === "json"
          ? JSON.stringify(res.data, null, 2)
          : res.data.markdown;
      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${campaign.name}.${format === "json" ? "json" : "md"}`;
      a.click();
    } catch {
      setExportError(
        "We couldn't export your file. Please try again in a moment."
      );
    }
  };

  // Clear regen overlay on SSE-level error
  useEffect(() => {
    if (regenError) {
      setRegeneratingIndex(null);
    }
  }, [regenError]);

  // Handle regen completion
  useEffect(() => {
    if (regenFinished && campaign) {
      const parsed = parseIdeas(regenText);
      const valid = normalizeConcepts(parsed);
      if (valid.length === 0) {
        setRegenResultError(
          "AI returned an invalid response. The concept was not updated. Try again."
        );
        setRegeneratingIndex(null);
        return;
      }
      setRegenResultError(null);
      const refresh = async () => {
        const res = await axios.get(
          `${API_BASE}/campaigns/${campaign.id}`
        );
        onCampaignUpdate(res.data);
        setRegeneratingIndex(null);
        setViewingVersionId(null);
        fetchVersions();
      };
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenFinished]);

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 px-4 sm:px-6 py-6 sm:py-8">
      {/* Generator Form */}
      <GeneratorForm
        brief={campaign.brief}
        tone={tone}
        style={style}
        creativity={creativity}
        projectType={projectType}
        isGenerating={isGenerating}
        isBusy={isBusy}
        onToneChange={setTone}
        onStyleChange={setStyle}
        onCreativityChange={setCreativity}
        onProjectTypeChange={setProjectType}
        onGenerate={handleGenerate}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={onTemplateChange}
        advTemperature={advTemperature}
        advTopP={advTopP}
        advMaxTokens={advMaxTokens}
        advSeed={advSeed}
        onAdvTemperatureChange={setAdvTemperature}
        onAdvTopPChange={setAdvTopP}
        onAdvMaxTokensChange={setAdvMaxTokens}
        onAdvSeedChange={setAdvSeed}
        localModels={localModels}
        activeModel={activeModel}
        modelLoading={modelLoading}
        onModelChange={handleModelChange}
      />

      {/* Status messages */}
      {generationEmpty && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          AI generation completed but returned an invalid response. Please
          try again.
        </div>
      )}

      {(error || regenError || regenResultError || exportError || refineError) && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error || regenError || regenResultError || exportError || refineError}
        </div>
      )}

      {/* Streaming Display */}
      {isGenerating && <StreamingDisplay streamedText={streamedText} />}

      {/* Results */}
      {!isGenerating && currentIdeas.length > 0 && (
        <>
          <ConceptResults
            concepts={currentIdeas}
            tone={tone}
            style={style}
            regeneratingIndex={regeneratingIndex}
            isBusy={isBusy}
            refiningIndex={refiningIndex}
            refiningField={refiningField}
            onRegenerate={handleRegenerate}
            onExport={handleExport}
            onFieldEdit={handleFieldEdit}
            onRefine={handleRefine}
          />

          {/* AI Debug Panel — toggle controlled from AI Controls panel */}
          {showDebug && latestDebug && (
            <AIDebugPanel debug={latestDebug} />
          )}

          {versions.length > 0 && (
            <VersionHistory
              versions={versions}
              viewingVersionId={viewingVersionId}
              isBusy={isBusy}
              onView={handleViewVersion}
              onRestore={handleRestoreVersion}
              onBackToCurrent={handleBackToCurrent}
            />
          )}
        </>
      )}

      {/* Empty state */}
      {!isGenerating && currentIdeas.length === 0 && !generationEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Sparkles className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">No concepts yet</p>
          <p className="text-xs mb-4">
            Generate AI-powered marketing concepts for this project.
          </p>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isBusy}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate Concepts
          </Button>
        </div>
      )}

      {/* Confirm overwrite dialog */}
      <Dialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate all concepts?</DialogTitle>
            <DialogDescription>
              This will replace your current concepts with a fresh generation.
              Your current version will be saved in version history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOverwrite(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRegenerate}
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
