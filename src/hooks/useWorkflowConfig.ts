import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "../lib/constants";

export interface StatusConfig {
  key: string;
  label: string;
  color: string;
  isDone: boolean;
}

export interface SeverityConfig {
  key: string;
  label: string;
  color: string;
  order: number;
}

export interface WorkflowConfig {
  task_statuses: StatusConfig[];
  issue_statuses: StatusConfig[];
  severities: SeverityConfig[];
}

const DEFAULT_CONFIG: WorkflowConfig = {
  task_statuses: [
    { key: "new",           label: "New",           color: "bg-muted-foreground/30", isDone: false },
    { key: "active",        label: "Active",        color: "bg-primary",             isDone: false },
    { key: "ready_to_go",   label: "Ready to Go",   color: "bg-blue-500",            isDone: false },
    { key: "needs_testing", label: "Needs Testing", color: "bg-amber-500",           isDone: false },
    { key: "resolved",      label: "Resolved",      color: "bg-teal-600",            isDone: true },
    { key: "rejected",      label: "Rejected",      color: "bg-destructive",         isDone: true },
  ],
  issue_statuses: [
    { key: "new",           label: "Open",          color: "bg-blue-500",            isDone: false },
    { key: "active",        label: "In Progress",   color: "bg-amber-500",           isDone: false },
    { key: "needs_testing", label: "Testing",       color: "bg-purple-500",          isDone: false },
    { key: "resolved",      label: "Resolved",      color: "bg-green-500",           isDone: true },
  ],
  severities: [
    { key: "Blocker", label: "Blocker", color: "bg-destructive/15 text-destructive border-destructive/30", order: 0 },
    { key: "Major",   label: "Major",   color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30", order: 1 },
    { key: "Minor",   label: "Minor",   color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", order: 2 },
    { key: "UI/UX",   label: "UI/UX",   color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", order: 3 },
  ],
};

let _cached: WorkflowConfig | null = null;
let _loading: Promise<WorkflowConfig> | null = null;

async function fetchConfig(): Promise<WorkflowConfig> {
  if (_cached) return _cached;
  if (_loading) return _loading;
  _loading = axios.get(`${API_BASE}/pm/workflow`)
    .then((r) => { _cached = r.data; return _cached!; })
    .catch(() => { _cached = DEFAULT_CONFIG; return _cached!; })
    .finally(() => { _loading = null; });
  return _loading;
}

export function invalidateWorkflowCache() {
  _cached = null;
}

export function useWorkflowConfig() {
  const [config, setConfig] = useState<WorkflowConfig>(_cached ?? DEFAULT_CONFIG);

  useEffect(() => {
    fetchConfig().then(setConfig);
  }, []);

  const save = useCallback(async (newConfig: WorkflowConfig) => {
    try {
      await axios.put(`${API_BASE}/pm/workflow`, newConfig);
      _cached = newConfig;
      setConfig(newConfig);
    } catch {
      throw new Error("Failed to save workflow config");
    }
  }, []);

  // Helper lookups
  const getTaskStatusLabel = useCallback((key: string) => {
    return config.task_statuses.find((s) => s.key === key)?.label ?? key;
  }, [config]);

  const getIssueStatusLabel = useCallback((key: string) => {
    return config.issue_statuses.find((s) => s.key === key)?.label ?? key;
  }, [config]);

  const getIssueStatusColor = useCallback((key: string) => {
    return config.issue_statuses.find((s) => s.key === key)?.color ?? "bg-muted";
  }, [config]);

  const getSeverityColor = useCallback((key: string) => {
    return config.severities.find((s) => s.key === key)?.color ?? "bg-muted text-muted-foreground border-border";
  }, [config]);

  const doneStatuses = config.task_statuses.filter((s) => s.isDone).map((s) => s.key);

  return {
    config,
    save,
    getTaskStatusLabel,
    getIssueStatusLabel,
    getIssueStatusColor,
    getSeverityColor,
    doneStatuses,
    taskStatuses: config.task_statuses,
    issueStatuses: config.issue_statuses,
    severities: config.severities,
  };
}
