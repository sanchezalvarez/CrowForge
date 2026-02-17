import { useState, useRef } from "react";
import { RefreshCw, Sparkles, Maximize2, Minimize2, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { UIConcept, RefineAction } from "../types";

const ACCENT_COLORS = [
  "border-l-blue-500",
  "border-l-violet-500",
  "border-l-teal-500",
];

type EditableField = "concept_name" | "rationale" | "target_audience" | "key_message";

interface ConceptCardProps {
  concept: UIConcept;
  index: number;
  tone: string;
  style: string;
  isRegenerating: boolean;
  isBusy: boolean;
  refiningField: EditableField | null;
  onRegenerate: () => void;
  onFieldEdit: (field: EditableField, value: string) => void;
  onRefine: (field: EditableField, action: RefineAction) => void;
}

export function ConceptCard({
  concept,
  index,
  tone,
  style,
  isRegenerating,
  isBusy,
  refiningField,
  onRegenerate,
  onFieldEdit,
  onRefine,
}: ConceptCardProps) {
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const [activeField, setActiveField] = useState<EditableField | null>(null);
  const [editValues, setEditValues] = useState<Partial<Record<EditableField, string>>>({});
  const cardRef = useRef<HTMLDivElement>(null);

  const isRefining = refiningField !== null;

  const handleFieldClick = (field: EditableField) => {
    if (isRefining) return;
    if (activeField !== field) {
      // Commit previous field if switching
      if (activeField && editValues[activeField] !== undefined) {
        onFieldEdit(activeField, editValues[activeField]!);
      }
      setActiveField(field);
      setEditValues((prev) => ({ ...prev, [field]: concept[field] }));
    }
  };

  const handleBlur = (field: EditableField, e: React.FocusEvent) => {
    // Don't blur if clicking within the card (e.g. refine buttons)
    const related = e.relatedTarget as HTMLElement | null;
    if (related && cardRef.current?.contains(related)) return;

    if (editValues[field] !== undefined && editValues[field] !== concept[field]) {
      onFieldEdit(field, editValues[field]!);
    }
    setActiveField(null);
  };

  const handleChange = (field: EditableField, value: string) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const renderField = (
    field: EditableField,
    isTitle: boolean = false,
  ) => {
    const isActive = activeField === field;
    const isFieldRefining = refiningField === field;
    const displayValue = editValues[field] ?? concept[field];

    if (isFieldRefining) {
      return (
        <div className="flex items-center gap-2 text-primary py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs font-medium">Refining...</span>
        </div>
      );
    }

    if (isActive) {
      const commonProps = {
        value: displayValue,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          handleChange(field, e.target.value),
        onBlur: (e: React.FocusEvent) => handleBlur(field, e),
        autoFocus: true,
        className:
          "w-full rounded border border-primary/30 bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50",
      };

      return isTitle ? (
        <input {...commonProps} />
      ) : (
        <textarea {...commonProps} rows={3} />
      );
    }

    return (
      <p
        role="button"
        tabIndex={isRefining ? -1 : 0}
        className="text-foreground/80 leading-relaxed mt-0.5 cursor-text rounded px-1 -mx-1 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={() => handleFieldClick(field)}
        onKeyDown={(e) => e.key === "Enter" && handleFieldClick(field)}
      >
        {concept[field]}
      </p>
    );
  };

  return (
    <div
      ref={cardRef}
      className={`relative rounded-lg border border-border bg-card p-5 shadow-sm border-l-4 ${accentColor} transition-all hover:shadow-md`}
    >
      {isRegenerating && (
        <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-primary">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Regenerating...</span>
          </div>
        </div>
      )}

      {/* Header: Title + Badges + Redo */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <div
            className="flex-1 min-w-0"
            role={activeField !== "concept_name" ? "button" : undefined}
            tabIndex={activeField !== "concept_name" && !isRefining ? 0 : undefined}
            onClick={() => handleFieldClick("concept_name")}
            onKeyDown={(e) => e.key === "Enter" && handleFieldClick("concept_name")}
          >
            {activeField === "concept_name" ? (
              renderField("concept_name", true)
            ) : (
              <h3 className="font-semibold text-sm text-foreground truncate cursor-text rounded px-1 -mx-1 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {concept.concept_name}
              </h3>
            )}
          </div>
          <Badge
            variant="secondary"
            className="text-[11px] px-2 py-0 h-5 capitalize"
          >
            {tone}
          </Badge>
          <Badge
            variant="outline"
            className="text-[11px] px-2 py-0 h-5 uppercase"
          >
            {style}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={isBusy || isRefining}
          className="shrink-0 h-7 px-2 text-muted-foreground hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          <span className="text-xs">Redo</span>
        </Button>
      </div>

      {/* Fields */}
      <div className="space-y-2.5 text-sm">
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Rationale
          </span>
          {renderField("rationale")}
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Target Audience
          </span>
          {renderField("target_audience")}
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Key Message
          </span>
          {renderField("key_message")}
        </div>
      </div>

      {/* Refine action buttons */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
        <span className="text-xs text-muted-foreground mr-1">
          {activeField ? `Refine "${activeField.replace("_", " ")}"` : "Click a field to refine"}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!activeField || isBusy || isRefining}
          onClick={() => activeField && onRefine(activeField, "refine")}
          className="h-7 px-2.5 text-xs"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Refine
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!activeField || isBusy || isRefining}
          onClick={() => activeField && onRefine(activeField, "expand")}
          className="h-7 px-2.5 text-xs"
        >
          <Maximize2 className="h-3 w-3 mr-1" />
          Expand
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!activeField || isBusy || isRefining}
          onClick={() => activeField && onRefine(activeField, "shorten")}
          className="h-7 px-2.5 text-xs"
        >
          <Minimize2 className="h-3 w-3 mr-1" />
          Shorten
        </Button>
      </div>
    </div>
  );
}
