import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { ProjectType, PromptTemplate } from "../types";

const TONE_OPTIONS = ["Neutral", "Professional", "Bold", "Playful", "Premium"];
const STYLE_OPTIONS = ["B2B", "B2C", "Minimal", "Storytelling", "Performance"];
const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "campaign", label: "Campaign" },
  { value: "website", label: "Website" },
];

function creativityLabel(value: number): string {
  if (value <= 33) return "Conservative";
  if (value <= 66) return "Balanced";
  return "Experimental";
}

interface GeneratorFormProps {
  brief: string;
  tone: string;
  style: string;
  creativity: number;
  projectType: ProjectType;
  isGenerating: boolean;
  isBusy: boolean;
  onToneChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onCreativityChange: (value: number) => void;
  onProjectTypeChange: (value: ProjectType) => void;
  onGenerate: () => void;
  // Prompt template
  templates: PromptTemplate[];
  selectedTemplateId: number | null;
  onTemplateChange: (id: number) => void;
  // Advanced AI controls
  advTemperature: number | null;
  advTopP: number;
  advMaxTokens: number;
  advSeed: number | null;
  onAdvTemperatureChange: (value: number | null) => void;
  onAdvTopPChange: (value: number) => void;
  onAdvMaxTokensChange: (value: number) => void;
  onAdvSeedChange: (value: number | null) => void;
  // Local model
  localModels: LocalModelInfo[];
  activeModel: string | null;
  modelLoading: boolean;
  onModelChange: (filename: string, ctx: number) => void;
}

export interface LocalModelInfo {
  filename: string;
  path: string;
  size_mb: number;
  default_ctx: number;
}

export function GeneratorForm({
  brief,
  tone,
  style,
  creativity,
  projectType,
  isGenerating,
  isBusy,
  onToneChange,
  onStyleChange,
  onCreativityChange,
  onProjectTypeChange,
  onGenerate,
  templates,
  selectedTemplateId,
  onTemplateChange,
  advTemperature,
  advTopP,
  advMaxTokens,
  advSeed,
  onAdvTemperatureChange,
  onAdvTopPChange,
  onAdvMaxTokensChange,
  onAdvSeedChange,
  localModels,
  activeModel,
  modelLoading,
  onModelChange,
}: GeneratorFormProps) {
  const [advOpen, setAdvOpen] = useState(false);

  // Group templates by category for the dropdown
  const categories = Array.from(new Set(templates.map((t) => t.category)));
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Card className="shadow-md">
      <CardContent className="p-6 space-y-5">
        {/* Project Goal (read-only from campaign brief) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Project Goal
          </Label>
          <Textarea
            value={brief}
            readOnly
            className="resize-none bg-muted/50 text-sm leading-relaxed cursor-default focus-visible:ring-0"
            rows={3}
          />
        </div>

        {/* Prompt Template */}
        {templates.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Prompt Template
            </Label>
            <Select
              value={selectedTemplateId !== null ? String(selectedTemplateId) : undefined}
              onValueChange={(v) => onTemplateChange(parseInt(v))}
              disabled={isBusy}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <div key={cat}>
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {cat}
                    </div>
                    {templates
                      .filter((t) => t.category === cat)
                      .map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-[11px] text-muted-foreground/70 leading-snug">
                {selectedTemplate.description}
              </p>
            )}
          </div>
        )}

        {/* Row: Project Type + Tone + Style */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Type
            </Label>
            <Select
              value={projectType}
              onValueChange={(v) => onProjectTypeChange(v as ProjectType)}
              disabled={isBusy}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Tone
            </Label>
            <Select
              value={tone}
              onValueChange={onToneChange}
              disabled={isBusy}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t.toLowerCase()}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Style
            </Label>
            <Select
              value={style}
              onValueChange={onStyleChange}
              disabled={isBusy}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s.toLowerCase()}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Creativity Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">
              Creativity
            </Label>
            <span className="text-xs font-medium text-muted-foreground">
              {creativityLabel(creativity)}
            </span>
          </div>
          <Slider
            value={[creativity]}
            onValueChange={([v]) => onCreativityChange(v)}
            min={0}
            max={100}
            step={1}
            disabled={isBusy}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground/60">
            <span>Conservative</span>
            <span>Balanced</span>
            <span>Experimental</span>
          </div>
        </div>

        {/* Advanced AI Controls (collapsible) */}
        <div className="border rounded-md">
          <button
            type="button"
            onClick={() => setAdvOpen(!advOpen)}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 size={13} />
            <span>Advanced AI Controls</span>
            {advOpen ? <ChevronDown size={13} className="ml-auto" /> : <ChevronRight size={13} className="ml-auto" />}
          </button>

          {advOpen && (
            <div className="px-3 pb-3 space-y-4 border-t pt-3">
              {/* Local Model selector */}
              {localModels.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Local Model
                  </Label>
                  <Select
                    value={activeModel ?? undefined}
                    onValueChange={(fname) => {
                      const m = localModels.find((x) => x.filename === fname);
                      if (m) onModelChange(m.filename, m.default_ctx);
                    }}
                    disabled={isBusy || modelLoading}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue placeholder="No model loaded" />
                    </SelectTrigger>
                    <SelectContent>
                      {localModels.map((m) => (
                        <SelectItem key={m.filename} value={m.filename}>
                          <span>{m.filename}</span>
                          <span className="ml-2 text-muted-foreground/60">
                            ({m.size_mb >= 1024 ? `${(m.size_mb / 1024).toFixed(1)}GB` : `${m.size_mb}MB`} · ctx {m.default_ctx})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {modelLoading && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
                      <Loader2 size={11} className="animate-spin" />
                      Loading model — this may take a moment...
                    </div>
                  )}
                </div>
              )}

              {/* Temperature override */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Temperature override
                  </Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {advTemperature !== null ? advTemperature.toFixed(2) : "auto"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[advTemperature ?? 0.7]}
                    onValueChange={([v]) => onAdvTemperatureChange(parseFloat(v.toFixed(2)))}
                    min={0}
                    max={1.5}
                    step={0.05}
                    disabled={isBusy}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => onAdvTemperatureChange(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 border rounded"
                    disabled={isBusy}
                  >
                    Auto
                  </button>
                </div>
              </div>

              {/* Top-p */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Top-p (nucleus sampling)
                  </Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {advTopP.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[advTopP]}
                  onValueChange={([v]) => onAdvTopPChange(parseFloat(v.toFixed(2)))}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  disabled={isBusy}
                />
              </div>

              {/* Max tokens + Seed row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Max tokens
                  </Label>
                  <input
                    type="number"
                    value={advMaxTokens}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v > 0) onAdvMaxTokensChange(v);
                    }}
                    min={64}
                    max={8192}
                    disabled={isBusy}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Seed (optional)
                  </Label>
                  <input
                    type="number"
                    value={advSeed ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        onAdvSeedChange(null);
                      } else {
                        const v = parseInt(raw);
                        if (!isNaN(v)) onAdvSeedChange(v);
                      }
                    }}
                    placeholder="Random"
                    disabled={isBusy}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={isBusy}
          className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Concepts
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
