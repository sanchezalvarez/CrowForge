import { useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import { ProjectCard } from "../components/PM/ProjectCard";
import { AIStandup } from "../components/PM/AIStandup";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";

interface ProjectsPageProps {
  onNavigateToProject: (projectId: number) => void;
}

const COLOR_PRESETS = [
  "#E04E0E", "#0B7268", "#5C3A9C", "#C8902A", "#DC2626", "#2563EB",
];

const ICON_OPTIONS = ["📋", "🚀", "🎮", "🎨", "🔧", "📊", "🌐", "⚡"];

export function ProjectsPage({ onNavigateToProject }: ProjectsPageProps) {
  const { projects, loading, create } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const proj = await create({ name: name.trim(), description, color, icon });
      if (proj) {
        setCreateOpen(false);
        setName(""); setDescription(""); setColor(COLOR_PRESETS[0]); setIcon(ICON_OPTIONS[0]);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus size={14} /> New Project
        </Button>
      </div>

      {/* AI Standup */}
      {projects.length > 0 && (
        <AIStandup />
      )}

      {/* Projects grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
          <FolderOpen size={40} className="text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
          <p className="text-xs text-muted-foreground">Create your first project to get started.</p>
          <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-2">
            <Plus size={14} className="mr-1" /> New Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onNavigateToProject(project.id)}
            />
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
              <Label>Name *</Label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Description</Label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${
                      icon === ic ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-colors ${
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating…" : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
