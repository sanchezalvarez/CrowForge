import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { PMTask, PMTaskStatus } from "../types/pm";
import { toast } from "./useToast";
import { getAPIBase } from "../lib/api";

export function useTasks(projectId: number | null) {
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${getAPIBase()}/pm/tasks`, { params: { project_id: projectId } });
      setTasks(res.data);
    } catch {
      toast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const create = async (data: Partial<PMTask> & { project_id: number; title: string }) => {
    try {
      const res = await axios.post(`${getAPIBase()}/pm/tasks`, data);
      setTasks((prev) => [...prev, res.data]);
      return res.data as PMTask;
    } catch {
      toast("Failed to create task", "error");
      return null;
    }
  };

  const update = async (id: number, data: Partial<PMTask>) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    try {
      const res = await axios.patch(`${getAPIBase()}/pm/tasks/${id}`, data);
      setTasks((prev) => prev.map((t) => (t.id === id ? res.data : t)));
      return res.data as PMTask;
    } catch {
      toast("Failed to update task", "error");
      await load();
      return null;
    }
  };

  const remove = async (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await axios.delete(`${getAPIBase()}/pm/tasks/${id}`);
    } catch {
      toast("Failed to delete task", "error");
      await load();
    }
  };

  const reorder = async (items: { id: number; position: number; status?: PMTaskStatus }[]) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => {
        const upd = items.find((i) => i.id === t.id);
        if (!upd) return t;
        return { ...t, position: upd.position, ...(upd.status ? { status: upd.status } : {}) };
      })
    );
    try {
      await axios.patch(`${getAPIBase()}/pm/tasks/reorder`, { items });
    } catch {
      toast("Failed to reorder tasks", "error");
      await load();
    }
  };

  const loadSubtasks = async (parentId: number): Promise<PMTask[]> => {
    try {
      const res = await axios.get(`${getAPIBase()}/pm/tasks`, {
        params: { parent_id: parentId },
      });
      return res.data;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return { tasks, loading, load, create, update, remove, reorder, loadSubtasks };
}
