import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Bug, Loader2, Plus, ImagePlus, X } from "lucide-react";
import { RisoBackground } from "../components/RisoBackground";
import { PMProject, PMMember, PMTask, PMIssue, PMSeverity } from "../types/pm";
import { TaskDetailPanel } from "../components/PM/TaskDetailPanel";
import { useIssues } from "../hooks/useIssues";
import { IssueTrackerView } from "../components/PM/IssueTrackerView";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { getAPIBase } from "../lib/api";


export function IssueTrackerPage() {
  const { issues, loading, update, bulkUpdate, bulkDelete, create, load } = useIssues();
  const [members, setMembers] = useState<PMMember[]>([]);
  const [projects, setProjects] = useState<PMProject[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PMTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Bug report form state
  const [formProjectId, setFormProjectId] = useState<string>("none");
  const [formParentId, setFormParentId] = useState<string>("none");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStepsToReproduce, setFormStepsToReproduce] = useState("");
  const [formOccurredAt, setFormOccurredAt] = useState("");
  const [formSeverity, setFormSeverity] = useState<PMSeverity>("Minor");
  const [formAssigneeId, setFormAssigneeId] = useState<string>("none");
  const [formScreenshots, setFormScreenshots] = useState<string[]>([]);
  const [parentOptions, setParentOptions] = useState<{ id: number; title: string; item_type: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    axios.get(`${getAPIBase()}/pm/members`).then((r) => setMembers(r.data)).catch(() => {});
    axios.get(`${getAPIBase()}/pm/projects`).then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  // Load stories when project changes
  useEffect(() => {
    const pid = formProjectId !== "none" ? Number(formProjectId) : null;
    if (!pid) { setParentOptions([]); setFormParentId("none"); return; }
    axios.get(`${getAPIBase()}/pm/tasks`, { params: { project_id: pid } })
      .then((r) => {
        const parents = (r.data as PMTask[]).filter((t) => t.item_type === "story");
        setParentOptions(parents.map((p) => ({ id: p.id, title: p.title, item_type: p.item_type })));
      })
      .catch(() => setParentOptions([]));
  }, [formProjectId]);

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormStepsToReproduce("");
    setFormOccurredAt("");
    setFormSeverity("Minor");
    setFormAssigneeId("none");
    setFormParentId("none");
    setFormScreenshots([]);
  };

  const handleIssueClick = useCallback(async (issue: PMIssue) => {
    try {
      const res = await axios.get(`${getAPIBase()}/pm/tasks/${issue.id}`);
      setSelectedTask(res.data);
      setDetailOpen(true);
    } catch {
      // fallback to issue data from list
      setSelectedTask(issue as PMTask);
      setDetailOpen(true);
    }
  }, []);

  const handleDetailUpdate = useCallback(async (id: number, data: Partial<PMTask>) => {
    const result = await update(id, data);
    if (result) {
      setSelectedTask((prev) => prev ? { ...prev, ...data } : prev);
    }
    return result;
  }, [update]);

  const handleDetailDelete = useCallback(async (id: number) => {
    await axios.delete(`${getAPIBase()}/pm/tasks/${id}`);
    setDetailOpen(false);
    setSelectedTask(null);
    await load();
  }, [load]);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedTask(null);
    load();
  }, [load]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await axios.post(`${getAPIBase()}/pm/files/upload`, fd);
        setFormScreenshots((prev) => [...prev, res.data.url]);
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, []);

  const removeScreenshot = (idx: number) => {
    setFormScreenshots((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = useCallback(async () => {
    const pid = formProjectId !== "none" ? Number(formProjectId) : null;
    if (!pid || !formTitle.trim()) return;
    setCreating(true);
    try {
      // Build description with structured sections
      let fullDescription = formDescription;
      if (formStepsToReproduce.trim()) {
        fullDescription += `\n\n**Steps to Reproduce:**\n${formStepsToReproduce.trim()}`;
      }
      if (formOccurredAt.trim()) {
        fullDescription += `\n\n**When it happened:** ${formOccurredAt.trim()}`;
      }
      if (formScreenshots.length > 0) {
        fullDescription += `\n\n**Screenshots:**\n${formScreenshots.map((url) => `![screenshot](${url})`).join("\n")}`;
      }

      await create({
        project_id: pid,
        title: formTitle.trim(),
        description: fullDescription.trim(),
        severity: formSeverity,
        assignee_id: formAssigneeId !== "none" ? Number(formAssigneeId) : null,
        parent_id: formParentId !== "none" ? Number(formParentId) : null,
        status: "new" as const,
      } as PMTask & { project_id: number; title: string });
      resetForm();
      setDialogOpen(false);
      await load();
    } finally {
      setCreating(false);
    }
  }, [formProjectId, formTitle, formDescription, formStepsToReproduce, formOccurredAt, formSeverity, formAssigneeId, formParentId, formScreenshots, create, load]);

  return (
    <div className="flex flex-col h-full overflow-hidden riso-noise" style={{ position: "relative" }}>
      <RisoBackground />

      {/* Header — matches ProjectsPage layout */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0" style={{ position: "relative", zIndex: 1 }}>
        <div className="flex items-center gap-3">
          <h1
            className="font-display font-black tracking-tight text-3xl text-foreground"
            style={{ textShadow: '3px 3px 0 rgba(224,78,14,0.20), -1.5px -1.5px 0 rgba(11,114,104,0.16)' }}
          >
            Issue Tracker
          </h1>
          {!loading && issues.length > 0 && (
            <span
              className="riso-stamp riso-stamp-press font-mono-ui text-[11px] px-2 py-0.5 rounded-full select-none"
              style={{ background: 'rgba(224,78,14,0.12)', color: 'var(--accent-orange)', border: '1.5px solid rgba(224,78,14,0.28)' }}
            >
              {issues.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-tactile btn-tactile-orange gap-1" onClick={() => setDialogOpen(true)}>
            <Plus size={13} /> Report Bug
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && issues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ position: "relative", zIndex: 1 }}>
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
          <IssueTrackerView
            issues={issues}
            members={members}
            loading={loading}
            currentMemberId={1}
            onUpdate={update}
            onBulkUpdate={bulkUpdate}
            onBulkDelete={bulkDelete}
            onIssueClick={handleIssueClick}
          />
        </div>
      )}

      {/* ── Issue Detail Sidebar ── */}
      <TaskDetailPanel
        task={selectedTask}
        open={detailOpen}
        onClose={handleDetailClose}
        onUpdate={handleDetailUpdate}
        onDelete={handleDetailDelete}
        members={members}
        sprints={[]}
      />

      {/* ── Bug Report Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { resetForm(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-lg riso-frame flex flex-col overflow-hidden">
          <DialogHeader className="pb-1 shrink-0">
            <DialogTitle
              className="flex items-center gap-2 font-display font-black text-base tracking-tight"
              style={{ textShadow: "1.5px 1.5px 0 rgba(224,78,14,0.18)" }}
            >
              <Bug size={15} style={{ color: "var(--accent-orange)" }} /> Report Bug
            </DialogTitle>
            <DialogDescription
              className="font-mono-ui text-xs tracking-wide"
              style={{ color: "var(--muted-foreground)" }}
            >
              Describe the issue so it can be reproduced and fixed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1 min-h-0">
            {/* Row 1: Project + Severity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "var(--muted-foreground)" }}
                >Project *</Label>
                <Select value={formProjectId} onValueChange={setFormProjectId}>
                  <SelectTrigger
                    className="h-8 text-xs font-mono-ui"
                    style={{
                      border: "1.5px solid var(--border-strong)",
                      background: "var(--background-2)",
                      boxShadow: "2px 2px 0 var(--riso-teal)",
                      borderRadius: "4px",
                    }}
                  >
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.icon} {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "var(--muted-foreground)" }}
                >Severity</Label>
                <Select value={formSeverity} onValueChange={(v) => setFormSeverity(v as PMSeverity)}>
                  <SelectTrigger
                    className="h-8 text-xs font-mono-ui"
                    style={{
                      border: "1.5px solid var(--border-strong)",
                      background: "var(--background-2)",
                      boxShadow: "2px 2px 0 var(--riso-orange)",
                      borderRadius: "4px",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blocker">Blocker</SelectItem>
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Minor">Minor</SelectItem>
                    <SelectItem value="UI/UX">UI/UX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label
                className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >Title *</Label>
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
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Short summary of the bug"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label
                className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >Description *</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What went wrong? What did you expect to happen?"
                className="resize-none h-20 text-sm font-mono-ui"
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

            {/* Steps to Reproduce */}
            <div className="flex flex-col gap-1.5">
              <Label
                className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >Steps to Reproduce</Label>
              <Textarea
                value={formStepsToReproduce}
                onChange={(e) => setFormStepsToReproduce(e.target.value)}
                placeholder={"1. Open the page...\n2. Click on...\n3. Observe that..."}
                className="resize-none h-20 text-sm font-mono-ui"
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

            {/* Row: When + Assignee */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "var(--muted-foreground)" }}
                >When did it happen?</Label>
                <input
                  type="datetime-local"
                  className="input-riso-date"
                  value={formOccurredAt}
                  onChange={(e) => setFormOccurredAt(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "var(--muted-foreground)" }}
                >Assignee</Label>
                <Select value={formAssigneeId} onValueChange={setFormAssigneeId}>
                  <SelectTrigger
                    className="h-8 text-xs font-mono-ui"
                    style={{
                      border: "1.5px solid var(--border-strong)",
                      background: "var(--background-2)",
                      boxShadow: "2px 2px 0 var(--riso-violet)",
                      borderRadius: "4px",
                    }}
                  >
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

            {/* Linked Story (optional) */}
            {parentOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label
                  className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "var(--muted-foreground)" }}
                >Linked Story (optional)</Label>
                <Select value={formParentId} onValueChange={setFormParentId}>
                  <SelectTrigger
                    className="h-8 text-xs font-mono-ui"
                    style={{
                      border: "1.5px solid var(--border-strong)",
                      background: "var(--background-2)",
                      boxShadow: "2px 2px 0 var(--riso-teal)",
                      borderRadius: "4px",
                    }}
                  >
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Screenshots */}
            <div className="flex flex-col gap-2">
              <Label
                className="font-mono-ui text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >Screenshots</Label>
              <div className="flex flex-wrap gap-2">
                {formScreenshots.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt={`screenshot ${i + 1}`}
                      className="h-20 object-cover"
                      style={{
                        borderRadius: "4px",
                        border: "1.5px solid var(--border-strong)",
                        boxShadow: "2px 2px 0 var(--riso-teal)",
                      }}
                    />
                    <button
                      onClick={() => removeScreenshot(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <label
                  className="h-20 w-20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                  style={{
                    borderRadius: "4px",
                    border: "1.5px dashed var(--border-strong)",
                    background: "var(--background-2)",
                    backgroundImage: "var(--noise-subtle)",
                    backgroundRepeat: "repeat",
                    boxShadow: "2px 2px 0 var(--riso-teal)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-teal)";
                    e.currentTarget.style.background = "color-mix(in srgb, var(--accent-teal) 8%, var(--background-2))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.background = "var(--background-2)";
                  }}
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent-teal)" }} />
                  ) : (
                    <>
                      <ImagePlus size={16} style={{ color: "var(--accent-teal)" }} />
                      <span
                        className="font-mono-ui font-semibold tracking-widest uppercase"
                        style={{ fontSize: "8px", color: "var(--muted-foreground)" }}
                      >Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter
            className="pt-2 shrink-0"
            style={{ borderTop: "1.5px solid rgba(20,16,10,0.10)", marginTop: "4px" }}
          >
            <button
              type="button"
              className="btn-tactile btn-tactile-outline"
              onClick={() => { resetForm(); setDialogOpen(false); }}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              className="btn-tactile btn-tactile-orange"
              onClick={handleSubmit}
              disabled={creating || formProjectId === "none" || !formTitle.trim()}
            >
              {creating ? <><Loader2 size={12} className="animate-spin" /> Creating...</> : <><Bug size={12} /> Report Bug</>}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
