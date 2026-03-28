import { useState } from "react";
import { PMView, PMSprint } from "../types/pm";

export function usePMStore() {
  const [activeView, setActiveView] = useState<PMView>("backlog");
  const [activeSprint, setActiveSprint] = useState<PMSprint | null>(null);

  return { activeView, setActiveView, activeSprint, setActiveSprint };
}
