import { useCallback, useEffect, useRef, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import axios from "axios";

const API_BASE  = "http://127.0.0.1:8000";
const CANVAS_ID = "default";
const SAVE_DEBOUNCE_MS = 800;

// Ensure the "default" canvas exists, then load its data.
async function loadOrCreate(): Promise<{ nodes: Node[]; edges: Edge[] }> {
  try {
    const res = await axios.get(`${API_BASE}/canvas/${CANVAS_ID}`);
    return res.data as { nodes: Node[]; edges: Edge[] };
  } catch (err: any) {
    if (err?.response?.status === 404) {
      await axios.post(`${API_BASE}/canvas/${CANVAS_ID}`, {
        nodes: [],
        edges: [],
      });
      return { nodes: [], edges: [] };
    }
    throw err;
  }
}

export function useCanvasStore() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loaded, setLoaded] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to latest nodes/edges so the debounced save always reads fresh values
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Load on mount
  useEffect(() => {
    loadOrCreate()
      .then(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, []);

  // Debounced save whenever nodes/edges change (skip until loaded)
  const scheduleSave = useCallback(() => {
    if (!loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      axios
        .post(`${API_BASE}/canvas/${CANVAS_ID}`, {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        })
        .catch(console.error);
    }, SAVE_DEBOUNCE_MS);
  }, [loaded]);

  // Wrap change handlers to also schedule a save
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
      setEdges((eds) => addEdge({ ...connection, type: "custom" }, eds));
      scheduleSave();
    },
    [setEdges, scheduleSave],
  );

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
  };
}
