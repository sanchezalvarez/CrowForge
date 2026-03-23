import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import type { Node } from "@xyflow/react";

interface UseKeyboardShortcutsOptions {
  undo: () => void;
  scheduleSave: () => void;
}

let _kbDupCounter = 0;
function kbDupId() {
  return `dup-kb-${Date.now()}-${++_kbDupCounter}`;
}

export function useKeyboardShortcuts({
  undo,
  scheduleSave,
}: UseKeyboardShortcutsOptions) {
  const {
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    deleteElements,
    fitView,
  } = useReactFlow();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire while typing in inputs / textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Delete / Backspace — delete selected nodes + edges
      if (e.key === "Delete" || e.key === "Backspace") {
        const nodes = getNodes().filter((n) => n.selected);
        const edges = getEdges().filter((ed) => ed.selected);
        if (nodes.length || edges.length) {
          deleteElements({ nodes, edges });
          scheduleSave();
        }
        return;
      }

      // Ctrl+D — duplicate selected node(s)
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const selected = getNodes().filter((n) => n.selected);
        if (!selected.length) return;
        const copies: Node[] = selected.map((n) => ({
          ...n,
          id: kbDupId(),
          position: { x: n.position.x + 30, y: n.position.y + 30 },
          selected: false,
        }));
        setNodes((nds) => [...nds, ...copies]);
        scheduleSave();
        return;
      }

      // Ctrl+Z — undo
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+A — select all
      if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
        setEdges((eds) => eds.map((ed) => ({ ...ed, selected: true })));
        return;
      }

      // Escape — deselect all
      if (e.key === "Escape") {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
        return;
      }

      // Ctrl+Shift+F — fit view
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        fitView({ padding: 0.2, duration: 400 });
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [getNodes, getEdges, setNodes, setEdges, deleteElements, fitView, undo, scheduleSave]);
}
