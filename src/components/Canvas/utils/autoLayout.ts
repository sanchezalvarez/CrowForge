import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

// ── Cycle detection (DFS) ─────────────────────────────────────────────────────
export function hasCycle(edges: Edge[]): boolean {
  const adj: Record<string, string[]> = {};
  for (const e of edges) {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  }
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const nb of adj[node] ?? []) {
      if (dfs(nb)) return true;
    }
    inStack.delete(node);
    return false;
  }

  const allNodes = new Set([
    ...edges.map((e) => e.source),
    ...edges.map((e) => e.target),
  ]);
  for (const n of allNodes) {
    if (!visited.has(n) && dfs(n)) return true;
  }
  return false;
}

const NODE_WIDTH  = 240;
const NODE_HEIGHT = 100;

export function applyAutoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 60 });

  nodes.forEach((n) => {
    g.setNode(n.id, {
      width:  (n.measured?.width  ?? n.style?.width  ?? NODE_WIDTH)  as number,
      height: (n.measured?.height ?? n.style?.height ?? NODE_HEIGHT) as number,
    });
  });

  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const w = (n.measured?.width  ?? n.style?.width  ?? NODE_WIDTH)  as number;
    const h = (n.measured?.height ?? n.style?.height ?? NODE_HEIGHT) as number;
    return {
      ...n,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });
}
