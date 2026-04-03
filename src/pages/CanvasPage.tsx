import { useState, useEffect } from "react";
import axios from "axios";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasView }    from "../components/Canvas/CanvasView";
import { CanvasSidebar } from "../components/Canvas/CanvasSidebar";
import type { NavigateCallback } from "../types/api";
import { getAPIBase } from "../lib/api";


async function ensureDefaultCanvas(): Promise<string> {
  try {
    // Check if default canvas exists
    await axios.get(`${getAPIBase()}/canvas/default`);
    return "default";
  } catch (err: unknown) {
    if ((err as { response?: { status?: number } })?.response?.status === 404) {
      // Create it
      try {
        await axios.post(`${getAPIBase()}/canvas/default`, { nodes: [], edges: [] });
      } catch {
        // Already exists race condition — OK
      }
    }
    return "default";
  }
}

export function CanvasPage(_props: { onNavigate?: NavigateCallback }) {
  const [activeCanvasId, setActiveCanvasId] = useState<string>("default");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureDefaultCanvas().then((id) => {
      setActiveCanvasId(id);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm riso-noise riso-noise-live">
        <span className="font-mono-ui text-xs tracking-widest uppercase opacity-60 animate-ink-in">Loading canvas…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <CanvasSidebar activeId={activeCanvasId} onSelect={setActiveCanvasId} />
      <div className="flex-1 flex flex-col min-w-0">
        <ReactFlowProvider>
          <CanvasView canvasId={activeCanvasId} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
