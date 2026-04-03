import { useCallback, useEffect, useRef, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import axios from "axios";
import { hasCycle } from "../utils/autoLayout";
import { getErrorDetail } from "../../../lib/errorUtils";
import { getAPIBase } from "../../../lib/api";
const DEFAULT_CANVAS_ID  = "default";
const SAVE_DEBOUNCE_MS   = 800;
const HISTORY_THROTTLE_MS = 500;
const MAX_HISTORY         = 20;
const CHAIN_DELAY_MS      = 300;

type Snapshot = { nodes: Node[]; edges: Edge[] };

async function loadOrCreate(canvasId: string): Promise<{ nodes: Node[]; edges: Edge[] }> {
  try {
    const res = await axios.get(`${getAPIBase()}/canvas/${canvasId}`);
    return res.data as { nodes: Node[]; edges: Edge[] };
  } catch (err: unknown) {
    if ((err as { response?: { status?: number } })?.response?.status === 404) {
      await axios.post(`${getAPIBase()}/canvas/${canvasId}`, { nodes: [], edges: [] });
      return { nodes: [], edges: [] };
    }
    throw err;
  }
}

export function useCanvasStore(canvasId?: string) {
  const activeCanvasId = canvasId ?? DEFAULT_CANVAS_ID;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loaded, setLoaded]              = useState(false);

  // ── Execution state ──────────────────────────────────────────────────────
  const [runningNodes, setRunningNodes] = useState<Set<string>>(new Set());
  const runningNodesRef                 = useRef<Set<string>>(new Set());

  const nodeOutputsRef = useRef<Record<string, string>>({});

  const [toast, setToast] = useState<string | null>(null);

  // ── Save / history ───────────────────────────────────────────────────────
  const saveTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef            = useRef(nodes);
  const edgesRef            = useRef(edges);
  const historyRef          = useRef<Snapshot[]>([]);
  const lastHistoryPushRef  = useRef<number>(0);
  const isUndoingRef        = useRef(false);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  const { getNode, updateNodeData } = useReactFlow();

  // ── Load on mount (re-load when canvasId changes) ─────────────────────────
  useEffect(() => {
    setLoaded(false);
    setNodes([]);
    setEdges([]);
    loadOrCreate(activeCanvasId)
      .then(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [activeCanvasId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── History push (throttled) ─────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    if (isUndoingRef.current) return;
    const now = Date.now();
    if (now - lastHistoryPushRef.current < HISTORY_THROTTLE_MS) return;
    lastHistoryPushRef.current = now;
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY - 1)),
      { nodes: nodesRef.current, edges: edgesRef.current },
    ];
  }, []);

  // ── Debounced save ───────────────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (!loaded) return;
    pushHistory();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      axios
        .post(`${getAPIBase()}/canvas/${activeCanvasId}`, {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        })
        .catch(console.error);
    }, SAVE_DEBOUNCE_MS);
  }, [loaded, activeCanvasId, pushHistory]);

  // ── Undo ─────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const history = historyRef.current;
    if (!history.length) return;
    const snapshot = history[history.length - 1];
    historyRef.current = history.slice(0, -1);
    isUndoingRef.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setTimeout(() => {
      isUndoingRef.current = false;
      axios
        .post(`${getAPIBase()}/canvas/${activeCanvasId}`, {
          nodes: snapshot.nodes,
          edges: snapshot.edges,
        })
        .catch(console.error);
    }, 50);
  }, [setNodes, setEdges, activeCanvasId]);

  // ── Running nodes helpers ────────────────────────────────────────────────
  const markRunning = useCallback((id: string) => {
    runningNodesRef.current = new Set(runningNodesRef.current).add(id);
    setRunningNodes(new Set(runningNodesRef.current));
  }, []);

  const markDone = useCallback((id: string) => {
    const s = new Set(runningNodesRef.current);
    s.delete(id);
    runningNodesRef.current = s;
    setRunningNodes(new Set(s));
  }, []);

  // ── Edge animation: incoming edges animate while target node runs ─────────
  useEffect(() => {
    if (!loaded) return;
    const running = runningNodesRef.current;
    setEdges((eds) =>
      eds.map((e) => {
        const userStyle = (e.data as { style?: string } | undefined)?.style;
        if (running.has(e.target)) {
          return e.animated ? e : { ...e, animated: true };
        }
        const shouldAnimate = userStyle === "animated";
        return e.animated === shouldAnimate ? e : { ...e, animated: shouldAnimate };
      }),
    );
  }, [runningNodes, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Self-referential triggerNode via ref ──────────────────────────────────
  const triggerNodeRef = useRef<(nodeId: string) => Promise<void>>(async () => {});

  const triggerNode = useCallback(
    async (nodeId: string): Promise<void> => {
      if (runningNodesRef.current.has(nodeId)) return;
      markRunning(nodeId); // claim slot immediately to prevent race on concurrent calls

      if (hasCycle(edgesRef.current)) {
        setToast("Cycle detected in flow — cannot run.");
        markDone(nodeId);
        return;
      }

      const node = getNode(nodeId);
      if (!node || node.type !== "ai") { markDone(nodeId); return; }

      const prompt   = (node.data.prompt   as string | undefined)?.trim() ?? "";
      const behavior = (node.data.behavior as string | undefined) ?? "none";
      if (!prompt) { markDone(nodeId); return; }

      const upstreamCtx = edgesRef.current
        .filter((e) => e.target === nodeId)
        .map((e) => getNode(e.source))
        .filter((n): n is Node => n?.type === "ai")
        .map((n) => ({
          node_id: n.id,
          label:   (n.data.label as string | undefined) || "Previous step",
          output:  nodeOutputsRef.current[n.id] ?? (n.data.output as string | undefined) ?? "",
        }))
        .filter((c) => c.output.length > 0);

      updateNodeData(nodeId, { output: "", error: null });

      let fullOutput = "";
      let hadError   = false;

      try {
        const res = await fetch(`${getAPIBase()}/canvas/run`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            prompt,
            behavior,
            node_id:       nodeId,
            context_nodes: upstreamCtx,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error("No response body");

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let doneSignal = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const chunk = line.slice(6);
            if (chunk === "[DONE]") { doneSignal = true; break; }
            if (chunk.startsWith("[ERROR]")) {
              throw new Error(chunk.slice(8).trim() || chunk.slice(7).trim());
            }
            fullOutput += chunk;
            updateNodeData(nodeId, { output: fullOutput });
          }
          if (doneSignal) break;
        }
      } catch (err: unknown) {
        hadError = true;
        updateNodeData(nodeId, { error: getErrorDetail(err) });
      } finally {
        nodeOutputsRef.current[nodeId] = fullOutput;
        markDone(nodeId);
        updateNodeData(nodeId, { output: fullOutput });
        scheduleSave();
      }

      if (hadError) return;

      const downstream = edgesRef.current.filter((e) => e.source === nodeId);
      for (const edge of downstream) {
        const dn = getNode(edge.target);
        if (dn?.type === "ai") {
          await new Promise<void>((r) => setTimeout(r, CHAIN_DELAY_MS));
          await triggerNodeRef.current(edge.target);
        }
      }
    },
    [getNode, updateNodeData, markRunning, markDone, scheduleSave],
  );

  triggerNodeRef.current = triggerNode;

  // ── Run all root AI nodes ─────────────────────────────────────────────────
  const runFlow = useCallback(async (): Promise<void> => {
    if (hasCycle(edgesRef.current)) {
      setToast("Cycle detected in flow — cannot run.");
      return;
    }

    const aiNodes  = nodesRef.current.filter((n) => n.type === "ai");
    const aiIds    = new Set(aiNodes.map((n) => n.id));
    const rootAI   = aiNodes.filter(
      (n) =>
        !edgesRef.current.some((e) => e.target === n.id && aiIds.has(e.source)),
    );

    await Promise.all(rootAI.map((n) => triggerNodeRef.current(n.id)));
  }, []);

  // ── Change handlers ───────────────────────────────────────────────────────
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      scheduleSave();
    },
    [onNodesChange, scheduleSave],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      scheduleSave();
    },
    [onEdgesChange, scheduleSave],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, type: "custom", data: { style: "solid" } }, eds),
      );
      scheduleSave();
    },
    [setEdges, scheduleSave],
  );

  // ── Toast auto-clear ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,
    loaded,
    scheduleSave,
    undo,
    runningNodes,
    triggerNode,
    runFlow,
    toast,
    clearToast: () => setToast(null),
  };
}
