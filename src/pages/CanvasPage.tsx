import { ReactFlowProvider } from "@xyflow/react";
import { CanvasView } from "../components/Canvas/CanvasView";

export function CanvasPage(_props: { onNavigate?: (page: any, id?: string) => void }) {
  return (
    <ReactFlowProvider>
      <div className="flex flex-col" style={{ height: "100vh" }}>
        <CanvasView />
      </div>
    </ReactFlowProvider>
  );
}
