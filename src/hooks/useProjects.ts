import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { PMProject } from "../types/pm";
import { toast } from "./useToast";
import { getAPIBase } from "../lib/api";

export function useProjects() {
  const [projects, setProjects] = useState<PMProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${getAPIBase()}/pm/projects`);
      setProjects(res.data);
    } catch {
      toast("Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const create = async (data: { name: string; description?: string; color?: string; icon?: string }) => {
    try {
      const res = await axios.post(`${getAPIBase()}/pm/projects`, data);
      await load();
      return res.data as PMProject;
    } catch {
      toast("Failed to create project", "error");
      return null;
    }
  };

  const update = async (id: number, data: Partial<PMProject>) => {
    try {
      const res = await axios.patch(`${getAPIBase()}/pm/projects/${id}`, data);
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...res.data } : p)));
      return res.data as PMProject;
    } catch {
      toast("Failed to update project", "error");
      return null;
    }
  };

  const remove = async (id: number) => {
    try {
      await axios.delete(`${getAPIBase()}/pm/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast("Failed to delete project", "error");
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return { projects, loading, load, create, update, remove };
}
