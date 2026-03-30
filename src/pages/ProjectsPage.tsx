import { useState } from "react";
import { Plus, FolderOpen, Radio } from "lucide-react";
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
  const [standupOpen, setStandupOpen] = useState(false);
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
    <div className="h-full overflow-y-auto overflow-x-hidden relative riso-noise riso-noise-live projects-scroll">
      {/* ── Riso background blob glows ── */}
      <div className="absolute pointer-events-none animate-blob-drift-b" style={{ top: -120, right: -60, width: 520, height: 400, background: 'rgba(11,114,104,0.18)', borderRadius: '50%', mixBlendMode: 'multiply', filter: 'blur(80px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none animate-blob-drift-c" style={{ bottom: -80, left: -80, width: 480, height: 380, background: 'rgba(224,78,14,0.18)', borderRadius: '50%', mixBlendMode: 'multiply', filter: 'blur(70px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none animate-blob-drift" style={{ top: '40%', left: '40%', width: 400, height: 340, background: 'rgba(92,58,156,0.13)', borderRadius: '50%', mixBlendMode: 'multiply', filter: 'blur(60px)', zIndex: 0 }} />

      {/* Registration crosshairs */}
      <svg className="absolute pointer-events-none" style={{ top: 14, right: 14, opacity: 0.25, zIndex: 2 }} width="20" height="20" viewBox="0 0 20 20">
        <line x1="10" y1="0" x2="10" y2="20" stroke="#E04E0E" strokeWidth="1" />
        <line x1="0" y1="10" x2="20" y2="10" stroke="#E04E0E" strokeWidth="1" />
        <circle cx="10" cy="10" r="4" fill="none" stroke="#E04E0E" strokeWidth="1" />
      </svg>
      <svg className="absolute pointer-events-none" style={{ bottom: 14, left: 14, opacity: 0.22, zIndex: 2 }} width="20" height="20" viewBox="0 0 20 20">
        <line x1="10" y1="0" x2="10" y2="20" stroke="#0B7268" strokeWidth="1" />
        <line x1="0" y1="10" x2="20" y2="10" stroke="#0B7268" strokeWidth="1" />
        <circle cx="10" cy="10" r="4" fill="none" stroke="#0B7268" strokeWidth="1" />
      </svg>

      {/* Halftone dot cluster — bottom right */}
      <div className="absolute pointer-events-none" style={{ bottom: 0, right: 0, width: 220, height: 260, opacity: 0.06, backgroundImage: 'radial-gradient(circle, rgba(92,58,156,0.9) 1.8px, transparent 1.8px)', backgroundSize: '12px 12px', zIndex: 0 }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="font-display font-black tracking-tight text-3xl text-foreground"
              style={{ textShadow: '3px 3px 0 rgba(224,78,14,0.20), -1.5px -1.5px 0 rgba(11,114,104,0.16)' }}
            >
              Tasks
            </h1>
            {!loading && (
              <span
                className="riso-stamp riso-stamp-press font-mono-ui text-[11px] px-2 py-0.5 rounded-full select-none"
                style={{ background: 'rgba(224,78,14,0.12)', color: 'var(--accent-orange)', border: '1.5px solid rgba(224,78,14,0.28)' }}
              >
                {projects.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setStandupOpen(true)} className="gap-1.5">
              <Radio size={14} /> Standup
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus size={14} /> New Project
            </Button>
          </div>
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20">
            <div className="riso-frame p-8 flex flex-col items-center gap-3" style={{ borderColor: 'rgba(224,78,14,0.20)' }}>
              <FolderOpen size={40} className="text-muted-foreground/40" />
              <p className="font-display font-black text-lg text-muted-foreground/70">No projects yet</p>
              <p className="text-xs text-muted-foreground font-mono-ui">Create your first project to get started.</p>
              <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-2">
                <Plus size={14} className="mr-1" /> New Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project, i) => (
              <div
                key={project.id}
                className="animate-ink-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <ProjectCard
                  project={project}
                  onClick={() => onNavigateToProject(project.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standup Dialog */}
      <Dialog open={standupOpen} onOpenChange={setStandupOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio size={14} className="text-primary" /> Daily Standup
            </DialogTitle>
          </DialogHeader>
          <AIStandup />
        </DialogContent>
      </Dialog>

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
