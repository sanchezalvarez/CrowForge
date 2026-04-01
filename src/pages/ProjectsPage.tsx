import { useState } from "react";
import { Plus, FolderOpen, Radio } from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import { ProjectCard } from "../components/PM/ProjectCard";
import { AIStandup } from "../components/PM/AIStandup";
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
  onNavigate?: (page: string) => void;
}

const COLOR_PRESETS = [
  "#E04E0E", "#0B7268", "#5C3A9C", "#C8902A", "#DC2626", "#2563EB",
];

const ICON_OPTIONS = ["📋", "🚀", "🎮", "🎨", "🔧", "📊", "🌐", "⚡"];

export function ProjectsPage({ onNavigateToProject, onNavigate }: ProjectsPageProps) {
  const { projects, loading, create, remove } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [standupOpen, setStandupOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
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
    <div className="h-full overflow-hidden relative riso-noise">
      <div className="pointer-events-none select-none" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div className="animate-blob-drift" style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'var(--accent-teal)', opacity: 0.10, mixBlendMode: 'multiply', top: -200, right: -180 }} />
        <div className="animate-blob-drift-b" style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'var(--accent-orange)', opacity: 0.09, mixBlendMode: 'multiply', bottom: -160, left: -160 }} />
        <div className="animate-blob-drift-c" style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'var(--accent-violet)', opacity: 0.07, mixBlendMode: 'multiply', bottom: 80, right: -100 }} />
        <div className="animate-blob-drift-d" style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'var(--accent-teal)', opacity: 0.06, mixBlendMode: 'multiply', top: '35%', left: -100 }} />
        <svg style={{ position: 'absolute', top: 12, right: 12, width: 44, height: 44 }} xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="18" x2="26" y2="18" stroke="rgba(11,114,104,0.40)" strokeWidth="1.5" />
          <line x1="15" y1="7" x2="15" y2="29" stroke="rgba(11,114,104,0.40)" strokeWidth="1.5" />
          <circle cx="15" cy="18" r="5" stroke="rgba(11,114,104,0.28)" strokeWidth="1" fill="none" />
        </svg>
        <svg style={{ position: 'absolute', bottom: 12, left: 12, width: 44, height: 44 }} xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="26" x2="26" y2="26" stroke="rgba(224,78,14,0.40)" strokeWidth="1.5" />
          <line x1="15" y1="15" x2="15" y2="37" stroke="rgba(224,78,14,0.40)" strokeWidth="1.5" />
          <circle cx="15" cy="26" r="5" stroke="rgba(224,78,14,0.28)" strokeWidth="1" fill="none" />
        </svg>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
          <circle cx="18%" cy="12%" r="3" fill="rgba(224,78,14,0.20)" />
          <circle cx="72%" cy="55%" r="2.5" fill="rgba(11,114,104,0.18)" />
          <circle cx="88%" cy="30%" r="2" fill="rgba(92,58,156,0.18)" />
          <circle cx="10%" cy="70%" r="2" fill="rgba(11,114,104,0.16)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="font-display font-black tracking-tight text-3xl text-foreground"
              style={{ textShadow: '3px 3px 0 rgba(224,78,14,0.20), -1.5px -1.5px 0 rgba(11,114,104,0.16)' }}
            >
              Projects
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
            <button className="btn-tactile btn-tactile-teal gap-1" onClick={() => setStandupOpen(true)}>
              <Radio size={13} /> Standup
            </button>
            <button className="btn-tactile btn-tactile-orange gap-1" onClick={() => setCreateOpen(true)}>
              <Plus size={13} /> New Project
            </button>
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
              <button className="btn-tactile btn-tactile-orange gap-1 mt-2" onClick={() => setCreateOpen(true)}>
                <Plus size={13} /> New Project
              </button>
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
                  onNavigateIssues={() => onNavigate?.("issues")}
                  onDelete={(id) => setDeleteConfirmId(id)}
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
            <DialogTitle className="font-display font-black flex items-center gap-2 tracking-tight">
              <Radio size={14} style={{ color: "var(--accent-teal)" }} /> Daily Standup
            </DialogTitle>
          </DialogHeader>
          <AIStandup />
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name *</Label>
              <input
                className="w-full rounded-md bg-background px-3 py-2 text-sm focus:outline-none"
                style={{ border: "1.5px solid var(--border-strong)", boxShadow: "2px 2px 0 var(--riso-orange)" }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <input
                className="w-full rounded-md bg-background px-3 py-2 text-sm focus:outline-none"
                style={{ border: "1.5px solid var(--border-strong)", boxShadow: "2px 2px 0 var(--riso-orange)" }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors`}
                    style={{
                      border: icon === ic ? "2px solid var(--accent-orange)" : "1.5px solid var(--border-strong)",
                      background: icon === ic ? "color-mix(in srgb, var(--accent-orange) 10%, transparent)" : "transparent",
                      boxShadow: icon === ic ? "2px 2px 0 var(--riso-orange)" : "none",
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      color === c ? "scale-110" : ""
                    }`}
                    style={{
                      backgroundColor: c,
                      border: color === c ? "2px solid var(--foreground)" : "1.5px solid rgba(20,16,10,0.18)",
                    }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter className="pt-1">
              <button type="button" className="btn-tactile btn-tactile-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="submit" className="btn-tactile btn-tactile-orange" disabled={creating || !name.trim()}>
                {creating ? "Creating…" : "Create Project"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will permanently delete the project and all its tasks. This action cannot be undone.
          </p>
          <DialogFooter>
            <button className="btn-tactile btn-tactile-outline" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button
              className="btn-tactile gap-1"
              style={{ background: "var(--destructive)", backgroundImage: "var(--noise-btn)", borderColor: "rgba(0,0,0,0.15)", color: "#fff" }}
              onClick={async () => {
                if (deleteConfirmId) await remove(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
