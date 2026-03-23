import { createContext, useContext } from "react";

export interface CanvasExecutionContextValue {
  triggerNode:  (nodeId: string) => Promise<void>;
  runningNodes: Set<string>;
  runFlow:      () => Promise<void>;
  scheduleSave: () => void;
}

export const CanvasExecutionContext = createContext<CanvasExecutionContextValue>({
  triggerNode:  async () => {},
  runningNodes: new Set(),
  runFlow:      async () => {},
  scheduleSave: () => {},
});

export function useCanvasExecution(): CanvasExecutionContextValue {
  return useContext(CanvasExecutionContext);
}
