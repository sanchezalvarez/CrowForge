import { Loader2 } from "lucide-react";
import { Card, CardContent } from "./ui/card";

interface StreamingDisplayProps {
  streamedText: string;
}

export function StreamingDisplay({ streamedText }: StreamingDisplayProps) {
  const charCount = streamedText.length;
  // Rough progress hint: more chars = more skeleton lines filled
  const filledLines = Math.min(6, Math.floor(charCount / 80) + 1);

  return (
    <Card className="shadow-md overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <span className="text-sm font-medium text-foreground">
            Generating...
          </span>
        </div>

        {/* Animated skeleton lines — fills in as tokens arrive */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-3 rounded ${
                i < filledLines
                  ? "bg-primary/15 animate-pulse"
                  : "bg-muted animate-pulse"
              }`}
              style={{ width: ["75%", "100%", "85%", "66%", "100%", "80%"][i] }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
