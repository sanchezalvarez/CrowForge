import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

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
