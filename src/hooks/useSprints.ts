import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { PMSprint } from "../types/pm";
import { toast } from "./useToast";
import { getAPIBase } from "../lib/api";

export function useSprints(projectId: number | null) {
  const [sprints, setSprints] = useState<PMSprint[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${getAPIBase()}/pm/sprints`, { params: { project_id: projectId } });
      setSprints(res.data);
    } catch {
      toast("Failed to load sprints", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const create = async (data: {
    project_id: number;
    name: string;
    goal?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    try {
      const res = await axios.post(`${getAPIBase()}/pm/sprints`, data);
      setSprints((prev) => [...prev, res.data]);
      return res.data as PMSprint;
    } catch {
      toast("Failed to create sprint", "error");
      return null;
    }
  };

  const update = async (id: number, data: Partial<PMSprint>) => {
    try {
      const res = await axios.patch(`${getAPIBase()}/pm/sprints/${id}`, data);
      setSprints((prev) => prev.map((s) => (s.id === id ? res.data : s)));
      return res.data as PMSprint;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast(msg || "Failed to update sprint", "error");
      return null;
    }
  };

  const completeSprint = async (id: number): Promise<{ completed: number; moved_to_backlog: number } | null> => {
    try {
      const res = await axios.post(`${getAPIBase()}/pm/sprints/${id}/complete`);
      await load();
      return res.data;
    } catch {
      toast("Failed to complete sprint", "error");
      return null;
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return { sprints, loading, load, create, update, completeSprint };
}
