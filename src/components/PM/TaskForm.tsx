import { useState, useEffect } from "react";
import { PMTask, PMTaskStatus, PMItemType, PMMember, PMSprint } from "../../types/pm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<PMTask>) => Promise<void>;
  initialData?: Partial<PMTask>;
  members: PMMember[];
  sprints: PMSprint[];
  projectId: number;
  restrictTypes?: boolean;
}

export function TaskForm({ open, onClose, onSubmit, initialData, members, sprints, projectId, restrictTypes }: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(initialData?.acceptance_criteria ?? "");
  const [itemType, setItemType] = useState<PMItemType>(initialData?.item_type ?? (restrictTypes ? "epic" : "task"));
  const [status, setStatus] = useState<PMTaskStatus>(initialData?.status ?? "new");
  const [assigneeId, setAssigneeId] = useState<string>(initialData?.assignee_id?.toString() ?? "none");
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? "");
  const [sprintId, setSprintId] = useState<string>(initialData?.sprint_id?.toString() ?? "none");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setDescription(initialData?.description ?? "");
      setAcceptanceCriteria(initialData?.acceptance_criteria ?? "");
      setItemType(initialData?.item_type ?? (restrictTypes ? "epic" : "task"));
      setStatus(initialData?.status ?? "new");
      setAssigneeId(initialData?.assignee_id?.toString() ?? "none");
      setDueDate(initialData?.due_date ?? "");
      setSprintId(initialData?.sprint_id?.toString() ?? "none");
    }
  }, [open, initialData, restrictTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        project_id: projectId,
        title: title.trim(),
        description,
        acceptance_criteria: acceptanceCriteria,
        item_type: itemType,
        status,
        assignee_id: assigneeId !== "none" ? parseInt(assigneeId) : null,
        due_date: dueDate || null,
        sprint_id: sprintId !== "none" ? parseInt(sprintId) : null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg riso-frame flex flex-col overflow-hidden">
        <DialogHeader className="pb-1 shrink-0">
          <DialogTitle
            className="font-display font-black text-base tracking-tight"
            style={{ textShadow: "1.5px 1.5px 0 rgba(224,78,14,0.18)" }}
          >{initialData?.id ? "Edit Work Item" : "New Work Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Type</Label>
              <Select value={itemType} onValueChange={(v) => setItemType(v as PMItemType)}>
                <SelectTrigger className="h-8 text-xs font-mono-ui" style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-teal)", borderRadius: "4px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="epic">Epic</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  {!restrictTypes && (
                    <>
                      <SelectItem value="story">Story</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="spike">Spike</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Title *</Label>
              <input
                className="w-full font-mono-ui text-sm focus:outline-none transition-all"
                style={{
                  background: "var(--background-2)",
                  backgroundImage: "var(--noise-subtle)",
                  backgroundRepeat: "repeat",
                  border: "1.5px solid var(--border-strong)",
                  borderRadius: "4px",
                  padding: "6px 10px",
                  boxShadow: "2px 2px 0 var(--riso-teal)",
                  color: "var(--foreground)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-teal)";
                  e.currentTarget.style.boxShadow = "3px 3px 0 var(--riso-teal), 0 0 0 2px color-mix(in srgb, var(--accent-teal) 18%, transparent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.boxShadow = "2px 2px 0 var(--riso-teal)";
                }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                autoFocus
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="resize-none h-16 text-sm font-mono-ui focus-visible:ring-0"
              style={{
                background: "var(--background-2)",
                backgroundImage: "var(--noise-subtle)",
                backgroundRepeat: "repeat",
                border: "1.5px solid var(--border-strong)",
                borderRadius: "4px",
                boxShadow: "2px 2px 0 var(--riso-teal)",
              }}
            />
          </div>
          {(itemType === "story" || acceptanceCriteria) && (
            <div className="flex flex-col gap-1">
              <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Acceptance Criteria</Label>
              <Textarea
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                placeholder="Given / When / Then…"
                className="resize-none h-16 text-sm font-mono-ui focus-visible:ring-0"
                style={{
                  background: "var(--background-2)",
                  backgroundImage: "var(--noise-subtle)",
                  backgroundRepeat: "repeat",
                  border: "1.5px solid var(--border-strong)",
                  borderRadius: "4px",
                  boxShadow: "2px 2px 0 var(--riso-violet)",
                }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PMTaskStatus)}>
                <SelectTrigger className="h-8 text-xs font-mono-ui" style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-orange)", borderRadius: "4px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-8 text-xs font-mono-ui" style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-violet)", borderRadius: "4px" }}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Sprint</Label>
              <Select value={sprintId} onValueChange={setSprintId}>
                <SelectTrigger className="h-8 text-xs font-mono-ui" style={{ border: "1.5px solid var(--border-strong)", background: "var(--background-2)", boxShadow: "2px 2px 0 var(--riso-teal)", borderRadius: "4px" }}>
                  <SelectValue placeholder="Backlog" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Backlog</SelectItem>
                  {sprints.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Due Date</Label>
              <input
                type="date"
                className="input-riso-date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="pt-2 shrink-0" style={{ borderTop: "1.5px solid rgba(20,16,10,0.10)", marginTop: "4px" }}>
            <button type="button" className="btn-tactile btn-tactile-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-tactile btn-tactile-teal" disabled={submitting || !title.trim()}>
              {submitting ? "Saving…" : initialData?.id ? "Save" : "Create"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
