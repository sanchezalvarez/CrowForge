import { FileJson, FileText } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { ConceptCard } from "./ConceptCard";
import type { UIConcept, RefineAction } from "../types";

type EditableField = "concept_name" | "rationale" | "target_audience" | "key_message";

interface ConceptResultsProps {
  concepts: UIConcept[];
  tone: string;
  style: string;
  regeneratingIndex: number | null;
  isBusy: boolean;
  refiningIndex: number | null;
  refiningField: EditableField | null;
  onRegenerate: (index: number) => void;
  onExport: (format: "json" | "markdown") => void;
  onFieldEdit: (index: number, field: EditableField, value: string) => void;
  onRefine: (index: number, field: EditableField, action: RefineAction) => void;
}

export function ConceptResults({
  concepts,
  tone,
  style,
  regeneratingIndex,
  isBusy,
  refiningIndex,
  refiningField,
  onRegenerate,
  onExport,
  onFieldEdit,
  onRefine,
}: ConceptResultsProps) {
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">
          Generated Concepts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {concepts.map((concept, idx) => (
          <ConceptCard
            key={idx}
            concept={concept}
            index={idx}
            tone={tone}
            style={style}
            isRegenerating={regeneratingIndex === idx}
            isBusy={isBusy}
            refiningField={refiningIndex === idx ? refiningField : null}
            onRegenerate={() => onRegenerate(idx)}
            onFieldEdit={(field, value) => onFieldEdit(idx, field, value)}
            onRefine={(field, action) => onRefine(idx, field, action)}
          />
        ))}
      </CardContent>
      <CardFooter className="gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onExport("json")}
          disabled={isBusy}
        >
          <FileJson className="h-4 w-4 mr-1.5" />
          Export JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onExport("markdown")}
          disabled={isBusy}
        >
          <FileText className="h-4 w-4 mr-1.5" />
          Export Markdown
        </Button>
      </CardFooter>
    </Card>
  );
}
