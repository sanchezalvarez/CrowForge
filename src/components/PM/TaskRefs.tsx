import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import axios from "axios";
import {
  Link2,
  Image,
  FileText,
  Table2,
  Workflow,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { PMRef, PMRefType } from "../../types/pm";
import { Button } from "../ui/button";
import { getAPIBase } from "../../lib/api";

const REF_ICONS: Record<PMRefType, typeof Link2> = {
  link:     Link2,
  image:    Image,
  document: FileText,
  sheet:    Table2,
  canvas:   Workflow,
};

const REF_COLORS: Record<PMRefType, string> = {
  link:     "text-blue-400 bg-blue-500/10 border-blue-500/30",
  image:    "text-green-400 bg-green-500/10 border-green-500/30",
  document: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  sheet:    "text-amber-400 bg-amber-500/10 border-amber-500/30",
  canvas:   "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
};

interface InternalItem { id: string; title: string }

interface TaskRefsProps {
  refs: PMRef[];
  onChange: (refs: PMRef[]) => void;
  onNavigate?: (page: string, id?: string) => void;
}

export function TaskRefs({ refs, onChange, onNavigate }: TaskRefsProps) {
  const [expanded, setExpanded] = useState(true);
  const [addMode, setAddMode] = useState<PMRefType | null>(null);

  // Form state for add
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<InternalItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const removeRef = (idx: number) => {
    const next = refs.filter((_, i) => i !== idx);
    onChange(next);
  };

  const addExternalRef = (type: "link" | "image") => {
    if (!url.trim()) return;
    const next: PMRef = { type, url: url.trim(), label: label.trim() || url.trim() };
    onChange([...refs, next]);
    setUrl("");
    setLabel("");
    setAddMode(null);
    setImagePreview(null);
  };

  const openInternalPicker = async (type: "document" | "sheet" | "canvas") => {
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerSearch("");
    try {
      const endpoint = type === "document" ? "/documents" : type === "sheet" ? "/sheets" : "/canvas";
      const res = await axios.get(`${getAPIBase()}${endpoint}`);
      const items: InternalItem[] = res.data.map((r: { id: string; title?: string; name?: string }) => ({
        id: r.id,
        title: r.title ?? r.name ?? r.id,
      }));
      setPickerItems(items);
    } catch {
      setPickerItems([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const addInternalRef = (type: "document" | "sheet" | "canvas", item: InternalItem) => {
    const next: PMRef = { type, ref_id: item.id, label: item.title };
    onChange([...refs, next]);
    setPickerOpen(false);
    setPickerItems([]);
    setAddMode(null);
  };

  const handleRefClick = (ref: PMRef) => {
    if (ref.type === "link" && ref.url) {
      openUrl(ref.url);
    } else if (ref.type === "image" && ref.url) {
      openUrl(ref.url);
    } else if (ref.type === "document" && ref.ref_id && onNavigate) {
      onNavigate("documents", ref.ref_id);
    } else if (ref.type === "sheet" && ref.ref_id && onNavigate) {
      onNavigate("sheets", ref.ref_id);
    } else if (ref.type === "canvas" && ref.ref_id && onNavigate) {
      onNavigate("canvas", ref.ref_id);
    }
  };

  const filteredPickerItems = pickerSearch
    ? pickerItems.filter((i) => i.title.toLowerCase().includes(pickerSearch.toLowerCase()))
    : pickerItems;

  return (
    <div className="px-4 py-3 border-b border-border">
      {/* Section header */}
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground font-mono mb-2 hover:text-foreground transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        References ({refs.length})
      </button>

      {expanded && (
        <div className="flex flex-col gap-2">
          {/* Existing refs */}
          {refs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {refs.map((ref, idx) => {
                const Icon = REF_ICONS[ref.type] ?? Link2;
                const colors = REF_COLORS[ref.type] ?? REF_COLORS.link;
                const isClickable = ref.type === "link" || ref.type === "image" || (!!onNavigate && !!ref.ref_id);
                return (
                  <div
                    key={idx}
                    className={`inline-flex items-center gap-1 rounded border text-[10px] font-medium px-1.5 py-0.5 ${colors} group`}
                  >
                    <button
                      className={`flex items-center gap-1 ${isClickable ? "hover:underline cursor-pointer" : "cursor-default"}`}
                      onClick={() => isClickable && handleRefClick(ref)}
                      title={ref.type === "link" || ref.type === "image" ? ref.url : ref.label}
                    >
                      <Icon size={9} />
                      <span className="max-w-[120px] truncate">{ref.label}</span>
                      {(ref.type === "link" || ref.type === "image") && <ExternalLink size={8} className="opacity-60" />}
                    </button>
                    <button
                      onClick={() => removeRef(idx)}
                      className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      title="Remove"
                    >
                      <X size={9} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Image preview */}
          {addMode === "image" && imagePreview && (
            <div className="rounded border border-border overflow-hidden max-w-[200px] max-h-[120px]">
              <img
                src={imagePreview}
                alt="preview"
                className="w-full h-full object-contain"
                onError={() => setImagePreview(null)}
              />
            </div>
          )}

          {/* Add form — link or image */}
          {(addMode === "link" || addMode === "image") && (
            <div className="flex flex-col gap-1.5 p-2 rounded bg-muted/40 border border-border">
              <input
                autoFocus
                className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={addMode === "image" ? "Image URL…" : "https://…"}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (addMode === "image") setImagePreview(e.target.value);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") addExternalRef(addMode); if (e.key === "Escape") setAddMode(null); }}
              />
              <input
                className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addExternalRef(addMode); if (e.key === "Escape") setAddMode(null); }}
              />
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => { setAddMode(null); setUrl(""); setLabel(""); setImagePreview(null); }}>Cancel</Button>
                <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => addExternalRef(addMode)} disabled={!url.trim()}>Add</Button>
              </div>
            </div>
          )}

          {/* Internal picker */}
          {pickerOpen && addMode && (addMode === "document" || addMode === "sheet" || addMode === "canvas") && (
            <div className="flex flex-col gap-1 p-2 rounded bg-muted/40 border border-border">
              <input
                autoFocus
                className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={`Search ${addMode}s…`}
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setPickerOpen(false); setAddMode(null); } }}
              />
              <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 mt-0.5">
                {pickerLoading ? (
                  <p className="text-[10px] text-muted-foreground px-1 py-1">Loading…</p>
                ) : filteredPickerItems.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground px-1 py-1">No {addMode}s found.</p>
                ) : (
                  filteredPickerItems.map((item) => (
                    <button
                      key={item.id}
                      className="text-left text-xs px-2 py-1 rounded hover:bg-muted transition-colors truncate"
                      onClick={() => addInternalRef(addMode as "document" | "sheet" | "canvas", item)}
                    >
                      {item.title}
                    </button>
                  ))
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 self-start" onClick={() => { setPickerOpen(false); setAddMode(null); }}>Cancel</Button>
            </div>
          )}

          {/* Add buttons */}
          {!addMode && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {([
                { type: "document" as PMRefType, label: "Document", Icon: FileText },
                { type: "sheet"    as PMRefType, label: "Sheet",    Icon: Table2   },
                { type: "canvas"   as PMRefType, label: "Canvas",   Icon: Workflow },
              ]).map(({ type, label: lbl, Icon }) => (
                <button
                  key={type}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 hover:bg-muted transition-colors"
                  onClick={() => {
                    setAddMode(type);
                    if (type === "document" || type === "sheet" || type === "canvas") {
                      openInternalPicker(type);
                    }
                  }}
                >
                  <Plus size={8} /> <Icon size={9} /> {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
