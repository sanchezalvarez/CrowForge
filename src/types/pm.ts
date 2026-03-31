export type PMItemType = "epic" | "feature" | "story" | "task" | "bug" | "spike";
export type PMTaskStatus = "new" | "active" | "ready_to_go" | "needs_testing" | "resolved" | "rejected" | "closed";
export type PMPriority = "critical" | "high" | "medium" | "low";
export type PMSeverity = "Blocker" | "Major" | "Minor" | "UI/UX";
export type PMView = "backlog" | "kanban" | "sprint" | "roadmap";
export type PMRefType = "link" | "image" | "document" | "sheet" | "canvas";

export interface PMRef {
  type: PMRefType;
  url?: string;     // for link / image
  ref_id?: string;  // for document / sheet / canvas
  label: string;
}

export interface PMProject {
  id: number;
  name: string;
  code: string;
  description: string;
  color: string;
  icon: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  total_count?: number;
  closed_count?: number;
  open_bug_count?: number;
  active_sprint?: PMSprint | null;
}

export interface PMMember {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  initials: string;
  created_at: string;
}

export interface PMTask {
  id: number;
  project_id: number;
  project_task_id: number | null;
  parent_id: number | null;
  sprint_id: number | null;
  item_type: PMItemType;
  title: string;
  description: string;
  acceptance_criteria: string;
  status: PMTaskStatus;
  priority: PMPriority;
  severity: PMSeverity;
  assignee_id: number | null;
  assignee_name?: string | null;
  assignee_color?: string | null;
  assignee_initials?: string | null;
  story_points: number | null;
  due_date: string | null;
  resolved_date: string | null;
  position: number;
  refs: PMRef[];
  labels: string[];
  child_count: number;
  created_at: string;
  updated_at: string;
}

export interface PMSprint {
  id: number;
  project_id: number;
  name: string;
  goal: string;
  start_date: string | null;
  end_date: string | null;
  status: "planned" | "active" | "completed";
  created_at: string;
  task_count?: number;
  done_count?: number;
  done_sp?: number;
}

export interface PMActivity {
  id: number;
  project_id: number;
  task_id: number | null;
  member_id: number | null;
  member_name?: string | null;
  task_title?: string | null;
  action: string;
  detail: string;
  created_at: string;
}

export interface PMSuggestedTask {
  title: string;
  item_type: PMItemType;
}

export interface PMTaskStats {
  [key: string]: number;
}

export interface PMIssue extends PMTask {
  project_code: string;
  project_name: string;
}
