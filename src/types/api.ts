// ── Page Navigation ─────────────────────────────────────────────────────────
export type PageName =
  | "home" | "chat" | "agent" | "documents" | "sheets" | "tools"
  | "benchmark" | "settings" | "canvas" | "help" | "projects"
  | "project_detail" | "issues";

export type NavigateCallback = (page: PageName, id?: string) => void;

// ── Chat ────────────────────────────────────────────────────────────────────
export interface ChatSession {
  id: number;
  title: string;
  mode: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  metadata?: string | null;
  created_at: string;
}

export interface AttachedFile {
  name: string;
  text: string;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export interface RecentDoc {
  id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
}

export interface RecentSheet {
  id: string;
  title: string;
  updated_at?: string;
  columns: number;
  rows: number;
}

export interface RecentChat {
  id: number;
  title: string;
  mode: string;
  created_at?: string;
}

export interface DashboardData {
  recent_documents: RecentDoc[];
  recent_sheets: RecentSheet[];
  recent_chats: RecentChat[];
  counts: { documents: number; sheets: number; chats: number };
  ai_engine: string;
}

// ── AI / Settings ───────────────────────────────────────────────────────────
export type EngineType = "mock" | "http" | "local" | "gemini";

export interface AIConfig {
  enable_llm: boolean;
  engine: EngineType;
  base_url: string;
  api_key: string;
  model: string;
  model_path: string;
  models_dir: string;
  ctx_size: number;
  gemini_api_key: string;
  gemini_model: string;
}

export interface EngineInfo {
  name: string;
  type: string;
  active: boolean;
}

export interface LocalModel {
  filename: string;
  path: string;
  size_mb: number;
  default_ctx: number;
}

export interface GalleryModel {
  name: string;
  size: string;
  license: string;
  description: string;
  filename: string;
  url: string;
  infoUrl?: string;
  tags?: string[];
  vram?: string;
  ram?: string;
  recommended?: boolean;
}

export interface SystemSpecs {
  cpu: string;
  cpu_cores: number;
  ram_total_gb: number;
  ram_available_gb: number;
  disk_total_gb: number;
  disk_free_gb: number;
  os: string;
  gpu: string | null;
  gpu_vram_gb: number | null;
}

export interface DownloadState {
  progress: number;
  total: number;
  done: boolean;
  error: string | null;
  running: boolean;
  speed_mbps?: number;
}

// ── Benchmark ───────────────────────────────────────────────────────────────
export interface BenchmarkRun {
  id: number;
  input_text: string;
  engine_name: string;
  model_name: string | null;
  temperature: number;
  max_tokens: number;
  latency_ms: number;
  output_text: string;
  error: string | null;
  created_at: string;
}

export interface ModelInfo {
  filename: string;
  size_mb: number;
  default_ctx: number;
}

// ── RSS ─────────────────────────────────────────────────────────────────────
export interface RssFeed {
  id: number;
  url: string;
  title: string;
  description: string;
  is_active: boolean;
  last_fetched_at: string | null;
  created_at: string;
  article_count?: number;
}

export interface RssArticle {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  summary?: string;
  url: string;
  feed_title: string;
  image_url?: string | null;
  published_at?: string | null;
  fetched_at: string;
}

// ── Canvas ──────────────────────────────────────────────────────────────────
export interface CanvasItem {
  id: string;
  name: string;
  updated_at: string;
}

// ── Agent ───────────────────────────────────────────────────────────────────
export interface ScopeItem {
  id: string;
  title: string;
  type: "sheet" | "document";
}

// ── TipTap (ProseMirror JSON) ───────────────────────────────────────────────
export interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
}

// ── ToolsPage ───────────────────────────────────────────────────────────────
export interface CalcBtnProps {
  label: string;
  onClick: () => void;
  variant?: "default" | "link" | "outline" | "destructive" | "secondary" | "ghost";
  className?: string;
  span?: number;
}
