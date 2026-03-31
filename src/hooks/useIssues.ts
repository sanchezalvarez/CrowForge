import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { PMIssue, PMTask } from "../types/pm";
import { toast } from "./useToast";

const API_BASE = "http://127.0.0.1:8000";

export interface IssueFilters {
  projectId?: number;
  assigneeId?: number;
  severity?: string;
  status?: string;
}

export function useIssues(filters: IssueFilters = {}) {
  const [issues, setIssues] = useState<PMIssue[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filters.projectId) params.project_id = filters.projectId;
      if (filters.assigneeId) params.assignee_id = filters.assigneeId;
      if (filters.severity) params.severity = filters.severity;
      if (filters.status) params.status = filters.status;
      const res = await axios.get(`${API_BASE}/pm/issues`, { params });
      setIssues(res.data);
    } catch {
      toast("Failed to load issues", "error");
    } finally {
      setLoading(false);
    }
  }, [filters.projectId, filters.assigneeId, filters.severity, filters.status]);

  const update = async (id: number, data: Partial<PMTask>) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
    try {
      const res = await axios.patch(`${API_BASE}/pm/tasks/${id}`, data);
      setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...res.data } : i)));
      return res.data as PMIssue;
    } catch {
      toast("Failed to update issue", "error");
      await load();
      return null;
    }
  };

  const bulkUpdate = async (ids: number[], data: Partial<PMTask>) => {
    try {
      await Promise.all(ids.map((id) => axios.patch(`${API_BASE}/pm/tasks/${id}`, data)));
      await load();
    } catch {
      toast("Bulk update failed", "error");
      await load();
    }
  };

  const bulkDelete = async (ids: number[]) => {
    try {
      await Promise.all(ids.map((id) => axios.delete(`${API_BASE}/pm/tasks/${id}`)));
      setIssues((prev) => prev.filter((i) => !ids.includes(i.id)));
    } catch {
      toast("Bulk delete failed", "error");
      await load();
    }
  };

  const create = async (data: Partial<PMTask> & { project_id: number; title: string }) => {
    try {
      const res = await axios.post(`${API_BASE}/pm/tasks`, { ...data, item_type: "bug" });
      setIssues((prev) => [res.data, ...prev]);
      return res.data as PMIssue;
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast(detail || "Failed to create issue", "error");
      return null;
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return { issues, loading, load, update, bulkUpdate, bulkDelete, create };
}
