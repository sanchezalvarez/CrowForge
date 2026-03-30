import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { useFetchSSE } from "../../hooks/useFetchSSE";
import { Button } from "../ui/button";

const API_BASE = "http://127.0.0.1:8000";

interface AIStandupProps {
  projectId?: number;
}

export function AIStandup({ projectId }: AIStandupProps) {
  const [content, setContent] = useState("");
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const { start, cancel } = useFetchSSE();

  useEffect(() => {
    checkModel();
    loadCache();
  }, [projectId]);

  const checkModel = async () => {
    try {
      const res = await axios.get(`${API_BASE}/ai/model/status`);
      setModelReady(res.data?.status === "ready" || res.data?.engine !== "local");
    } catch {
      setModelReady(true); // assume ready if endpoint fails
    }
  };

  const loadCache = async () => {
    try {
      const res = await axios.get(`${API_BASE}/pm/ai/standup/cache`, {
        params: projectId ? { project_id: projectId } : {},
      });
      if (res.data.cache) {
        setContent(res.data.cache);
        setLastGenerated(res.data.last_generated);
      }
    } catch {}
  };

  const generate = () => {
    setIsGenerating(true);
    setContent("");
    start(
      `${API_BASE}/pm/ai/standup`,
      projectId ? { project_id: projectId } : {},
      {
        onToken: (token) => setContent((prev) => prev + token),
        onDone: () => {
          setIsGenerating(false);
          setLastGenerated(new Date().toISOString());
        },
        onError: (err) => {
          setIsGenerating(false);
          setContent(`Error: ${err}`);
        },
      }
    );
  };

  const handleStop = () => {
    cancel();
    setIsGenerating(false);
  };

  const today = new Date().toISOString().slice(0, 10);
  const isToday = lastGenerated ? lastGenerated.slice(0, 10) === today : false;

  return (
    <div className="flex flex-col gap-3">
      {/* Controls row */}
      <div className="flex items-center gap-2">
        {lastGenerated && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {isToday ? "Generated today" : `Last: ${lastGenerated.slice(0, 10)}`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isGenerating ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleStop}>
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={generate}
              disabled={modelReady === false}
            >
              <RefreshCw size={11} />
              {content ? "Regenerate" : "Generate"}
            </Button>
          )}
        </div>
      </div>

      {/* Model not ready warning */}
      {modelReady === false && (
        <div className="flex items-center gap-2 text-xs text-amber-600">
          <AlertCircle size={12} />
          No AI model configured. Set up a model in Settings to use this feature.
        </div>
      )}

      {/* Empty state */}
      {!content && !isGenerating && modelReady !== false && (
        <p className="text-xs text-muted-foreground">
          Click "Generate" to create a daily standup summary from your project data.
        </p>
      )}

      {/* Content */}
      {content && (
        <div className="rounded-md border border-border bg-muted/20 px-4 py-3 max-h-[60vh] overflow-y-auto">
          <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {isGenerating && (
            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse rounded ml-0.5" />
          )}
        </div>
      )}
    </div>
  );
}
