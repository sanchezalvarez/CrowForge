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
import { Button } from "../ui/button";
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Edit Work Item" : "New Work Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Type</Label>
              <Select value={itemType} onValueChange={(v) => setItemType(v as PMItemType)}>
                <SelectTrigger className="h-8 text-sm">
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
              <Label>Title *</Label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                autoFocus
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="resize-none h-16 text-sm"
            />
          </div>
          {(itemType === "story" || acceptanceCriteria) && (
            <div className="flex flex-col gap-1">
              <Label>Acceptance Criteria</Label>
              <Textarea
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                placeholder="Given / When / Then…"
                className="resize-none h-16 text-sm"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PMTaskStatus)}>
                <SelectTrigger className="h-8 text-sm">
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
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-8 text-sm">
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
              <Label>Sprint</Label>
              <Select value={sprintId} onValueChange={setSprintId}>
                <SelectTrigger className="h-8 text-sm">
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
              <Label>Due Date</Label>
              <input
                type="date"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Saving…" : initialData?.id ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
