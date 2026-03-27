import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Download, CheckCircle2, Loader2, X, AlertCircle, Trash2, ExternalLink, Cpu, HardDrive, Monitor, MemoryStick, Rss, Plus, ToggleLeft, ToggleRight, Check, Newspaper } from "lucide-react";
import { toast } from "../hooks/useToast";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRssFeeds, RssFeed } from "../hooks/useRssFeeds";

const API_BASE = "http://127.0.0.1:8000";

const USER_AVATARS = [
  { emoji: "🐱", label: "Cat" },
  { emoji: "🐶", label: "Dog" },
  { emoji: "🐰", label: "Rabbit" },
  { emoji: "🦜", label: "Parrot" },
  { emoji: "🐟", label: "Fish" },
  { emoji: "🦊", label: "Fox" },
  { emoji: "🐢", label: "Turtle" },
  { emoji: "🐸", label: "Frog" },
  { emoji: "🐼", label: "Panda" },
  { emoji: "🦋", label: "Butterfly" },
  { emoji: "🐧", label: "Penguin" },
  { emoji: "🦔", label: "Hedgehog" },
];

type EngineType = "mock" | "http" | "local" | "gemini";

interface AIConfig {
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

interface GalleryModel {
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

interface SystemSpecs {
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

const GALLERY_MODELS: GalleryModel[] = [
  // ── Agent-capable models (tool calling / function calling) ──
  {
    name: "Qwen2.5 7B Instruct Q4_K_M",
    size: "~4.7 GB",
    license: "Apache 2.0",
    description: "Best local agent model — native tool/function calling, strong coding and math.",
    filename: "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
    tags: ["agent", "coding", "math", "multilingual"],
    vram: "5 GB",
    ram: "8 GB",
    recommended: true,
  },
  {
    name: "Qwen2.5 14B Instruct Q4_K_M",
    size: "~8.9 GB",
    license: "Apache 2.0",
    description: "Larger Qwen2.5 with stronger reasoning and coding — ideal for RTX 5070 with 16 GB VRAM.",
    filename: "Qwen2.5-14B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-GGUF/resolve/main/Qwen2.5-14B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/Qwen/Qwen2.5-14B-Instruct",
    tags: ["agent", "coding", "math", "multilingual", "reasoning"],
    vram: "10 GB",
    ram: "16 GB",
  },
  {
    name: "Qwen2.5 32B Instruct Q4_K_M",
    size: "~19.8 GB",
    license: "Apache 2.0",
    description: "High-end Qwen2.5 32B — exceptional quality for all tasks. Runs on 16 GB VRAM with offloading.",
    filename: "Qwen2.5-32B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-32B-Instruct-GGUF/resolve/main/Qwen2.5-32B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/Qwen/Qwen2.5-32B-Instruct",
    tags: ["agent", "coding", "math", "multilingual", "reasoning"],
    vram: "16 GB+",
    ram: "32 GB",
  },
  {
    name: "Qwen2.5 3B Instruct Q4_K_M",
    size: "~1.9 GB",
    license: "Apache 2.0",
    description: "Lightweight agent model — supports tool calling, good for lower-end hardware.",
    filename: "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct",
    tags: ["agent", "translate", "multilingual", "fast"],
    vram: "2 GB",
    ram: "4 GB",
  },
  {
    name: "Mistral Small 3.1 24B Q4_K_M",
    size: "~14.3 GB",
    license: "Apache 2.0",
    description: "Mistral Small 3.1 — state-of-the-art 24B with native tool calling and 128k context. Perfect for RTX 5070.",
    filename: "Mistral-Small-3.1-24B-Instruct-2503-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Mistral-Small-3.1-24B-Instruct-2503-GGUF/resolve/main/Mistral-Small-3.1-24B-Instruct-2503-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct-2503",
    tags: ["agent", "chat", "reasoning", "coding"],
    vram: "14 GB",
    ram: "24 GB",
  },
  {
    name: "Mistral Nemo 12B Instruct Q4_K_M",
    size: "~7.1 GB",
    license: "Apache 2.0",
    description: "Mistral + NVIDIA 12B — native function calling, strong reasoning.",
    filename: "Mistral-Nemo-Instruct-2407-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/resolve/main/Mistral-Nemo-Instruct-2407-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/mistralai/Mistral-Nemo-Instruct-2407",
    tags: ["agent", "chat", "reasoning"],
    vram: "8 GB",
    ram: "12 GB",
  },
  {
    name: "Hermes 3 Llama 3.1 8B Q4_K_M",
    size: "~4.9 GB",
    license: "Meta Llama 3.1",
    description: "NousResearch fine-tune with excellent structured output and function calling.",
    filename: "Hermes-3-Llama-3.1-8B-Q4_K_M.gguf",
    url: "https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B",
    tags: ["agent", "chat", "reasoning"],
    vram: "6 GB",
    ram: "8 GB",
  },
  // ── General-purpose / large models ──
  {
    name: "Llama 3.3 70B Instruct Q2_K",
    size: "~26.5 GB",
    license: "Meta Llama 3.3",
    description: "Meta's flagship 70B in aggressive Q2_K quantization — fits in 16 GB VRAM with CPU offloading.",
    filename: "Llama-3.3-70B-Instruct-Q2_K.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF/resolve/main/Llama-3.3-70B-Instruct-Q2_K.gguf",
    infoUrl: "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
    tags: ["chat", "reasoning", "coding"],
    vram: "16 GB+",
    ram: "48 GB",
  },
  {
    name: "Llama 3.1 8B Instruct Q4_K_M",
    size: "~4.9 GB",
    license: "Meta Llama 3.1",
    description: "Larger Llama model with stronger reasoning and instruction following.",
    filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct",
    tags: ["chat", "reasoning"],
    vram: "6 GB",
    ram: "8 GB",
  },
  {
    name: "Llama 3.2 3B Instruct Q4_K_M",
    size: "~2.0 GB",
    license: "Meta Llama 3.2",
    description: "Compact and capable general-purpose model from Meta. Great for chat and writing.",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
    tags: ["chat", "general", "fast"],
    vram: "2 GB",
    ram: "4 GB",
  },
  {
    name: "Phi-4 14B Q4_K_M",
    size: "~8.9 GB",
    license: "MIT",
    description: "Microsoft Phi-4 — punches well above its weight in reasoning and coding. Great for RTX 5070.",
    filename: "phi-4-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/phi-4-GGUF/resolve/main/phi-4-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/microsoft/phi-4",
    tags: ["coding", "reasoning", "math"],
    vram: "10 GB",
    ram: "16 GB",
  },
  {
    name: "Gemma 3 12B Instruct Q4_K_M",
    size: "~7.8 GB",
    license: "Google Gemma",
    description: "Google Gemma 3 12B — multimodal-trained, strong reasoning and multilingual.",
    filename: "gemma-3-12b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/gemma-3-12b-it-GGUF/resolve/main/gemma-3-12b-it-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/google/gemma-3-12b-it",
    tags: ["chat", "multilingual", "reasoning"],
    vram: "9 GB",
    ram: "14 GB",
  },
  {
    name: "Gemma 3 4B Instruct Q4_K_M",
    size: "~2.6 GB",
    license: "Google Gemma",
    description: "Compact Gemma 3 — fast, multilingual, excellent for translation and general chat.",
    filename: "gemma-3-4b-it-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/google/gemma-3-4b-it",
    tags: ["translate", "multilingual", "fast"],
    vram: "3 GB",
    ram: "6 GB",
  },
  {
    name: "DeepSeek-R1 Distill Qwen 14B Q4_K_M",
    size: "~9.0 GB",
    license: "MIT",
    description: "DeepSeek-R1 reasoning distilled into Qwen 14B — strong math and chain-of-thought.",
    filename: "DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",
    tags: ["reasoning", "math", "coding"],
    vram: "10 GB",
    ram: "16 GB",
  },
  {
    name: "DeepSeek-R1 Distill Qwen 7B Q4_K_M",
    size: "~4.7 GB",
    license: "MIT",
    description: "DeepSeek-R1 reasoning distilled into Qwen 7B — great reasoning at low resource cost.",
    filename: "DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    tags: ["reasoning", "math", "coding"],
    vram: "6 GB",
    ram: "8 GB",
  },
  {
    name: "Aya Expanse 8B Q4_K_M",
    size: "~4.9 GB",
    license: "CC-BY-NC 4.0",
    description: "Cohere's multilingual model trained on 23 languages — best-in-class for translation.",
    filename: "aya-expanse-8b-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/aya-expanse-8b-GGUF/resolve/main/aya-expanse-8b-Q4_K_M.gguf",
    infoUrl: "https://huggingface.co/CohereForAI/aya-expanse-8b",
    tags: ["translate", "multilingual"],
    vram: "6 GB",
    ram: "8 GB",
  },
];

const ALL_TAGS = ["all", "agent", "chat", "translate", "multilingual", "coding", "reasoning", "math", "fast", "general"];

type Section = "ai" | "preferences" | "news" | "about";

interface CuratedFeed {
  url: string;
  title: string;
  category: string;
}

const CURATED_FEEDS: CuratedFeed[] = [
  // World News
  { url: "http://feeds.bbci.co.uk/news/world/rss.xml", title: "BBC World News", category: "World" },
  { url: "https://feeds.reuters.com/reuters/topNews", title: "Reuters Top News", category: "World" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", title: "Al Jazeera", category: "World" },
  // Technology
  { url: "https://hnrss.org/frontpage", title: "Hacker News", category: "Technology" },
  { url: "https://www.theverge.com/rss/index.xml", title: "The Verge", category: "Technology" },
  { url: "https://www.wired.com/feed/rss", title: "Wired", category: "Technology" },
  { url: "https://techcrunch.com/feed/", title: "TechCrunch", category: "Technology" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", title: "Ars Technica", category: "Technology" },
  // Economics
  { url: "https://feeds.bloomberg.com/markets/news.rss", title: "Bloomberg Markets", category: "Economics" },
  { url: "https://www.economist.com/latest/rss.xml", title: "The Economist", category: "Economics" },
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", title: "WSJ Markets", category: "Economics" },
  // Sports
  { url: "http://feeds.bbci.co.uk/sport/rss.xml", title: "BBC Sport", category: "Sports" },
  { url: "https://www.espn.com/espn/rss/news", title: "ESPN", category: "Sports" },
  // Science
  { url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", title: "NASA Breaking News", category: "Science" },
  { url: "https://feeds.newscientist.com/home", title: "New Scientist", category: "Science" },
];

const CATEGORY_COLORS: Record<string, string> = {
  World: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Technology: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Economics: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Sports: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  Science: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

const FEED_DOT_COLORS: string[] = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-rose-500",
];

function feedDotColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
  return FEED_DOT_COLORS[Math.abs(hash) % FEED_DOT_COLORS.length];
}

function fmtFeedDate(str: string | null): string {
  if (!str) return "Never";
  const diff = Date.now() - new Date(str).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NewsFeedsSection() {
  const { feeds, loading, loadFeeds, addFeed, deleteFeed, toggleFeed } = useRssFeeds();
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingUrls, setPendingUrls] = useState<Set<string>>(new Set());

  useEffect(() => { loadFeeds(); }, []);

  async function handleAdd() {
    if (!urlInput.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      await addFeed(urlInput.trim(), titleInput.trim());
      setUrlInput("");
      setTitleInput("");
    } catch (e: any) {
      setAddError(e?.response?.data?.detail ?? "Failed to add feed.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteFeed(id);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddCurated(feed: CuratedFeed) {
    if (pendingUrls.has(feed.url)) return;
    setPendingUrls((s) => new Set(s).add(feed.url));
    try {
      await addFeed(feed.url, feed.title);
    } catch {
      // 409 duplicate — ignore, loadFeeds already called
    } finally {
      setPendingUrls((s) => { const n = new Set(s); n.delete(feed.url); return n; });
    }
  }

  const addedUrls = new Set(feeds.map((f: RssFeed) => f.url));
  const categories = [...new Set(CURATED_FEEDS.map((f) => f.category))];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">News Feeds</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage RSS feeds for your AI news digest. Active feeds are fetched when you generate a digest.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left: Feed Library + Add Custom */}
        <div className="space-y-4">
          {/* Curated feed library */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-primary" />
              Feed Library
              <span className="text-xs text-muted-foreground font-normal">— click + to add</span>
            </p>
            {categories.map((cat) => (
              <div key={cat}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat}</p>
                <div className="flex flex-wrap gap-2">
                  {CURATED_FEEDS.filter((f) => f.category === cat).map((feed) => {
                    const isAdded = addedUrls.has(feed.url);
                    const isPending = pendingUrls.has(feed.url);
                    return (
                      <button
                        key={feed.url}
                        onClick={() => !isAdded && !isPending && handleAddCurated(feed)}
                        disabled={isAdded || isPending}
                        title={isAdded ? "Already added" : `Add ${feed.title}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          isAdded
                            ? "bg-primary/10 text-primary border-primary/30 opacity-60 cursor-default"
                            : isPending
                              ? "opacity-60 cursor-wait border-transparent"
                              : `${CATEGORY_COLORS[cat] ?? ""} border-transparent hover:border-current hover:shadow-sm cursor-pointer`
                        }`}
                      >
                        {isAdded
                          ? <Check className="h-3 w-3" />
                          : isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Plus className="h-3 w-3" />
                        }
                        {feed.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Add custom feed form */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Rss className="h-4 w-4 text-primary" />
              Add Custom Feed
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="url"
                placeholder="https://example.com/feed.xml"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Display name (optional)"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={handleAdd}
                  disabled={adding || !urlInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add Feed
                </button>
              </div>
            </div>
            {addError && (
              <p className="text-xs text-destructive">{addError}</p>
            )}
          </div>
        </div>

        {/* Right: My Feeds list */}
        <div className="space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Rss className="h-4 w-4 text-primary" />
            My Feeds
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading feeds…
            </div>
          ) : feeds.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 flex flex-col items-center gap-3 text-center">
              <Rss className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">No feeds yet</p>
                <p className="text-xs text-muted-foreground mt-1">Pick feeds from the library or add a custom URL</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{feeds.length} feed{feeds.length !== 1 ? "s" : ""}</p>
                <span className="text-xs text-muted-foreground">{feeds.filter((f: RssFeed) => f.is_active === 1).length} active</span>
              </div>
              <div className="space-y-2">
                {feeds.map((feed: RssFeed) => {
                  const dot = feedDotColor(feed.title || feed.url);
                  const isActive = feed.is_active === 1;
                  return (
                    <div
                      key={feed.id}
                      className={`rounded-lg border p-3 flex items-start gap-3 transition-colors ${isActive ? "bg-background" : "bg-muted/20 opacity-60"}`}
                    >
                      <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{feed.title || feed.url}</p>
                        <p className="text-xs text-muted-foreground truncate">{feed.url}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span>Last fetched: {fmtFeedDate(feed.last_fetched_at)}</span>
                          {feed.article_count > 0 && (
                            <span>{feed.article_count} article{feed.article_count !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => toggleFeed(feed.id, !isActive)}
                          title={isActive ? "Disable feed" : "Enable feed"}
                          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          {isActive
                            ? <ToggleRight className="h-4 w-4 text-primary" />
                            : <ToggleLeft className="h-4 w-4" />
                          }
                        </button>
                        <button
                          onClick={() => handleDelete(feed.id)}
                          disabled={deletingId === feed.id}
                          title="Delete feed"
                          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                        >
                          {deletingId === feed.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface DownloadState {
  progress: number;
  total: number;
  done: boolean;
  error: string | null;
  running: boolean;
}

function fmt_bytes(b: number) {
  if (b === 0) return "0 B";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface SettingsPageProps {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;

}

export function SettingsPage({ theme, setTheme }: SettingsPageProps) {
  const [section, setSection] = useState<Section>("ai");

  const [avatarIndex, setAvatarIndex] = useState(() =>
    parseInt(localStorage.getItem("user_avatar_index") ?? "0", 10)
  );
  const [confirmDelete, setConfirmDelete] = useState<"chat" | "documents" | "sheets" | "all" | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Plugin state
  interface PluginRecord { name: string; file: string; tools: string[]; status: "ok" | "error"; error: string | null }
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsReloading, setPluginsReloading] = useState(false);
  const [pluginsDir, setPluginsDir] = useState("");
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());

  function selectAvatar(index: number) {
    setAvatarIndex(index);
    localStorage.setItem("user_avatar_index", String(index));
    window.dispatchEvent(new Event("avatarchange"));
  }

  async function deleteData(target: "chat" | "documents" | "sheets" | "all") {
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE}/data/${target}`);
      const labels: Record<string, string> = { chat: "Chat", documents: "Documents", sheets: "Sheets", all: "All data" };
      toast(`${labels[target]} deleted.`);
      // Notify all pages to reload their data
      window.dispatchEvent(new CustomEvent("crowforge:data-deleted", { detail: { target } }));
    } catch {
      toast("Failed to delete data.", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }
  const [config, setConfig] = useState<AIConfig>({
    enable_llm: false,
    engine: "mock",
    base_url: "https://api.openai.com/v1",
    api_key: "",
    model: "gpt-4o-mini",
    model_path: "",
    models_dir: "C:/models",
    ctx_size: 8192,
    gemini_api_key: "",
    gemini_model: "gemini-2.0-flash",
  });
  const [installedFiles, setInstalledFiles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [reinitStatus, setReinitStatus] = useState<"idle" | "reinitializing" | "done" | "error">("idle");
  const [reinitError, setReinitError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [tagFilter, setTagFilter] = useState("all");
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reinitPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refreshModels() {
    axios.get(`${API_BASE}/ai/models`).then((r) => {
      setInstalledFiles(r.data.models.map((m: { filename: string }) => m.filename));
    }).catch(() => {});
  }

  async function handleDeleteModel(filename: string) {
    try {
      await axios.delete(`${API_BASE}/ai/models/${encodeURIComponent(filename)}`);
      toast(`"${filename}" deleted.`);
      refreshModels();
    } catch {
      toast(`Failed to delete "${filename}".`, "error");
    }
  }

  function refreshDownloads() {
    axios.get(`${API_BASE}/ai/models/download/status`).then((r) => {
      setDownloads(r.data.downloads ?? {});
      // If any download just finished, rescan installed models
      const states: DownloadState[] = Object.values(r.data.downloads ?? {});
      if (states.some((s) => s.done)) refreshModels();
    }).catch(() => {});
  }

  useEffect(() => {
    axios.get(`${API_BASE}/settings/ai`).then((r) => setConfig(r.data)).catch(() => {});
    refreshModels();
    return () => {
      if (reinitPollRef.current) { clearInterval(reinitPollRef.current); reinitPollRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (section === "ai") {
      refreshModels();
      refreshDownloads();
      axios.get(`${API_BASE}/system/specs`).then((r) => setSpecs(r.data)).catch(() => {});
    }
    if (section === "preferences") {
      setPluginsLoading(true);
      Promise.all([
        axios.get(`${API_BASE}/plugins`),
        axios.get(`${API_BASE}/plugins/dir`),
      ]).then(([p, d]) => {
        setPlugins(p.data);
        setPluginsDir(d.data.path ?? "");
      }).catch(() => {}).finally(() => setPluginsLoading(false));
    }
  }, [section]);

  // Poll downloads while any are running
  useEffect(() => {
    const anyRunning = Object.values(downloads).some((d) => d.running);
    if (anyRunning && !pollRef.current) {
      pollRef.current = setInterval(refreshDownloads, 800);
    } else if (!anyRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [downloads]);

  async function handleSave() {
    setSaving(true);
    setReinitError(null);
    try {
      await axios.post(`${API_BASE}/settings/ai`, config);
      setReinitStatus("reinitializing");
      // Poll until backend finishes re-initializing engines
      reinitPollRef.current = setInterval(async () => {
        try {
          const r = await axios.get(`${API_BASE}/settings/ai/status`);
          if (r.data.status === "ready") {
            clearInterval(reinitPollRef.current!);
            reinitPollRef.current = null;
            setReinitStatus("done");
            setSaving(false);
            toast(`Settings applied — engine: ${r.data.active_engine}`, "success");
            setTimeout(() => setReinitStatus("idle"), 2500);
          } else if (r.data.status === "error") {
            clearInterval(reinitPollRef.current!);
            reinitPollRef.current = null;
            setReinitStatus("error");
            setSaving(false);
            setReinitError(r.data.error ?? "Unknown error");
          }
        } catch { /* backend might be briefly busy */ }
      }, 600);
    } catch {
      toast("Failed to save settings", "error");
      setReinitStatus("idle");
      setSaving(false);
    }
  }

  async function reloadPlugins() {
    setPluginsReloading(true);
    try {
      const res = await axios.post(`${API_BASE}/plugins/reload`);
      setPlugins(res.data);
      toast(`Plugins reloaded — ${res.data.length} found`, "success");
    } catch {
      toast("Failed to reload plugins", "error");
    } finally {
      setPluginsReloading(false);
    }
  }

  async function handleDownload(model: GalleryModel) {
    try {
      await axios.post(`${API_BASE}/ai/models/download`, {
        url: model.url,
        filename: model.filename,
      });
      setDownloads((prev) => ({
        ...prev,
        [model.filename]: { progress: 0, total: 0, done: false, error: null, running: true },
      }));
      // Start polling
      refreshDownloads();
    } catch (e: any) {
      toast(`Failed to start download: ${e?.response?.data?.detail ?? e.message}`, "error");
    }
  }

  async function handleCancelDownload(filename: string) {
    await axios.delete(`${API_BASE}/ai/models/download/${encodeURIComponent(filename)}`).catch(() => {});
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
  }

  const navItems: { id: Section; label: string }[] = [
    { id: "ai", label: "AI & Models" },
    { id: "preferences", label: "Preferences" },
    { id: "news", label: "News Feeds" },
    { id: "about", label: "About" },
  ];

  const filteredModels = tagFilter === "all"
    ? GALLERY_MODELS
    : GALLERY_MODELS.filter((m) => m.tags?.includes(tagFilter));

  return (
    <div className="flex h-full relative overflow-hidden riso-noise">
      <div className="pointer-events-none select-none" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'var(--accent-teal)', opacity: 0.10, mixBlendMode: 'multiply', top: -200, right: -180 }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'var(--accent-orange)', opacity: 0.09, mixBlendMode: 'multiply', bottom: -160, left: -160 }} />
        <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'var(--accent-violet)', opacity: 0.07, mixBlendMode: 'multiply', bottom: 80, right: -100 }} />
        <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'var(--accent-teal)', opacity: 0.06, mixBlendMode: 'multiply', top: '35%', left: -100 }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
          <line x1="calc(100% - 32)" y1="28" x2="calc(100% - 8)" y2="28" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <line x1="calc(100% - 20)" y1="16" x2="calc(100% - 20)" y2="40" stroke="rgba(11,114,104,0.45)" strokeWidth="1.5" />
          <circle cx="calc(100% - 20)" cy="28" r="5" stroke="rgba(11,114,104,0.3)" strokeWidth="1" fill="none" />
          <line x1="8" y1="calc(100% - 28)" x2="32" y2="calc(100% - 28)" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <line x1="20" y1="calc(100% - 40)" x2="20" y2="calc(100% - 16)" stroke="rgba(224,78,14,0.45)" strokeWidth="1.5" />
          <circle cx="20" cy="calc(100% - 28)" r="5" stroke="rgba(224,78,14,0.3)" strokeWidth="1" fill="none" />
          <line x1="8" y1="28" x2="32" y2="28" stroke="rgba(92,58,156,0.35)" strokeWidth="1.5" />
          <line x1="20" y1="16" x2="20" y2="40" stroke="rgba(92,58,156,0.35)" strokeWidth="1.5" />
        </svg>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
          <circle cx="18%" cy="12%" r="3" fill="rgba(224,78,14,0.20)" />
          <circle cx="72%" cy="55%" r="2.5" fill="rgba(11,114,104,0.18)" />
          <circle cx="88%" cy="30%" r="2" fill="rgba(92,58,156,0.18)" />
          <circle cx="10%" cy="70%" r="2" fill="rgba(11,114,104,0.16)" />
        </svg>
      </div>
      {/* Re-init overlay */}
      {(reinitStatus === "reinitializing" || reinitStatus === "done" || reinitStatus === "error") && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-background shadow-xl px-10 py-8 max-w-xs text-center">
            {reinitStatus === "reinitializing" && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div>
                  <p className="font-semibold text-sm">Applying settings…</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The AI engine is restarting. This may take a few seconds if a local model is loading.
                  </p>
                </div>
              </>
            )}
            {reinitStatus === "done" && (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="font-semibold text-sm">Settings applied!</p>
              </>
            )}
            {reinitStatus === "error" && (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-sm">Engine failed to start</p>
                  <p className="text-xs text-muted-foreground mt-1">{reinitError}</p>
                </div>
                <button
                  onClick={() => setReinitStatus("idle")}
                  className="text-xs px-4 py-1.5 rounded-md border hover:bg-muted transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Side tabs */}
      <nav className="w-44 shrink-0 border-r p-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
              section === item.id
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-6 ${["ai", "news", "preferences"].includes(section) ? "" : "max-w-2xl"} space-y-6`}>
        {section === "ai" && (
          <>
            <div className="grid gap-8 items-start" style={{ gridTemplateColumns: "360px 1fr" }}>
            {/* Left: AI Configuration */}
            <div className="space-y-6">
            <h2 className="text-lg font-semibold">AI Configuration</h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enable_llm}
                onChange={(e) => setConfig({ ...config, enable_llm: e.target.checked })}
                className="h-4 w-4 rounded border accent-primary"
              />
              <span className="text-sm font-medium">Enable LLM</span>
            </label>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Engine</label>
              <select
                value={config.engine}
                onChange={(e) => setConfig({ ...config, engine: e.target.value as EngineType })}
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="mock">No AI (mock)</option>
                <option value="http">HTTP / OpenAI-compatible</option>
                <option value="gemini">Google Gemini</option>
                <option value="local">Local GGUF</option>
              </select>
            </div>

            {config.engine === "http" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Base URL</label>
                  <input
                    value={config.base_url}
                    onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">API Key</label>
                  <input
                    type="password"
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <input
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </>
            )}

            {config.engine === "gemini" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Gemini API Key</label>
                  <input
                    type="password"
                    value={config.gemini_api_key}
                    onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
                    placeholder="AIza..."
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Get your key at aistudio.google.com</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <select
                    value={config.gemini_model}
                    onChange={(e) => setConfig({ ...config, gemini_model: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="gemini-2.0-flash">gemini-2.0-flash (fast, recommended)</option>
                    <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (lite)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (powerful)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  </select>
                </div>
              </>
            )}

            {config.engine === "local" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Models Directory</label>
                <input
                  value={config.models_dir}
                  onChange={(e) => setConfig({ ...config, models_dir: e.target.value })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="C:/models"
                />
                <p className="text-[11px] text-muted-foreground mt-1">GGUF model files will be downloaded here.</p>
              </div>
            )}

            {config.engine === "local" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Context Size (tokens)</label>
                <input
                  type="number"
                  value={config.ctx_size}
                  onChange={(e) => setConfig({ ...config, ctx_size: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Minimum 4096 for agent tool calling. 8192 recommended. Higher values use more RAM.
                </p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {/* PC Specs */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <h3 className="text-sm font-semibold">Your PC Specs</h3>
              {!specs ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" />Detecting hardware…</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-start gap-2"><Monitor size={14} className="shrink-0 mt-0.5 text-muted-foreground" /><div><p className="font-medium">OS</p><p className="text-muted-foreground">{specs.os}</p></div></div>
                  <div className="flex items-start gap-2"><Cpu size={14} className="shrink-0 mt-0.5 text-muted-foreground" /><div><p className="font-medium">CPU</p><p className="text-muted-foreground">{specs.cpu}</p><p className="text-muted-foreground">{specs.cpu_cores} cores</p></div></div>
                  <div className="flex items-start gap-2"><MemoryStick size={14} className="shrink-0 mt-0.5 text-muted-foreground" /><div><p className="font-medium">RAM</p><p className="text-muted-foreground">{specs.ram_total_gb} GB total · {specs.ram_available_gb} GB free</p></div></div>
                  {specs.gpu && <div className="flex items-start gap-2"><Monitor size={14} className="shrink-0 mt-0.5 text-muted-foreground" /><div><p className="font-medium">GPU</p><p className="text-muted-foreground">{specs.gpu}{specs.gpu_vram_gb != null ? ` · ${specs.gpu_vram_gb} GB VRAM` : ""}</p></div></div>}
                  <div className="flex items-start gap-2"><HardDrive size={14} className="shrink-0 mt-0.5 text-muted-foreground" /><div><p className="font-medium">Disk</p><p className="text-muted-foreground">{specs.disk_free_gb} GB free / {specs.disk_total_gb} GB</p></div></div>
                </div>
              )}
            </div>
            </div>{/* end left AI config */}

            {/* Right: Model Gallery */}
            <div className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Free GGUF Models</h2>
                    <p className="text-xs text-muted-foreground">
                      {config.engine === "local"
                        ? <>Downloads go to <span className="font-mono text-foreground">{config.models_dir || "Models Directory"}</span>.</>
                        : "Switch engine to Local GGUF to download and run models locally."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_TAGS.map((tag) => (
                      <button key={tag} onClick={() => setTagFilter(tag)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${tagFilter === tag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {filteredModels.map((m) => {
                      const installed = installedFiles.includes(m.filename);
                      const dl = downloads[m.filename];
                      const pct = dl && dl.total > 0 ? Math.round((dl.progress / dl.total) * 100) : 0;
                      return (
                        <div key={m.filename} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-medium">{m.name}</p>
                                {m.recommended && (
                                  <span className="px-1.5 py-0 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/25">Recommended</span>
                                )}
                                {m.infoUrl && (
                                  <button onClick={() => openUrl(m.infoUrl!)} className="text-muted-foreground hover:text-foreground transition-colors" title="More info on HuggingFace">
                                    <ExternalLink size={12} />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{m.description}</p>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                                <span>{m.size}</span><span>·</span><span>{m.license}</span>
                                {m.vram && <span>· GPU: {m.vram}</span>}
                                {m.ram && <span>· RAM: {m.ram}</span>}
                                {m.tags && m.tags.map((t) => (
                                  <span key={t} className="px-1.5 py-0 rounded-full bg-muted text-muted-foreground/70">{t}</span>
                                ))}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {installed && !dl?.running ? (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 size={14} />Installed</span>
                                  <button onClick={() => handleDeleteModel(m.filename)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors" title="Delete model"><Trash2 size={13} /></button>
                                </div>
                              ) : dl?.running ? (
                                <button onClick={() => handleCancelDownload(m.filename)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"><X size={13} />Cancel</button>
                              ) : dl?.error ? (
                                <button onClick={() => handleDownload(m)} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-destructive border-destructive/30"><AlertCircle size={13} />Retry</button>
                              ) : (
                                <button onClick={() => handleDownload(m)} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"><Download size={13} />Download</button>
                              )}
                            </div>
                          </div>
                          {dl?.running && (
                            <div className="space-y-1">
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: dl.total > 0 ? `${pct}%` : "0%" }} />
                              </div>
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" />Downloading…</span>
                                <span>{dl.total > 0 ? `${fmt_bytes(dl.progress)} / ${fmt_bytes(dl.total)} (${pct}%)` : fmt_bytes(dl.progress)}</span>
                              </div>
                            </div>
                          )}
                          {dl?.error && <p className="text-[11px] text-destructive">{dl.error}</p>}
                          {dl?.done && !installed && <p className="text-[11px] text-green-600">Download complete — rescanning…</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>{/* end right model gallery */}
            </div>{/* end grid */}
          </>
        )}

        {section === "preferences" && (
          <div className="grid grid-cols-2 gap-8 items-start">
            {/* ── Left: Appearance ── */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Appearance</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Theme</label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    {/* Light mode preview */}
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === "light" ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/30 hover:bg-muted/50"}`}
                    >
                      <div className="w-full aspect-video rounded-md overflow-hidden shadow-sm border" style={{ borderColor: "rgba(20,16,10,0.12)" }}>
                        <div className="w-full h-full flex" style={{ background: "#F0E8DC" }}>
                          {/* Sidebar */}
                          <div className="h-full flex flex-col gap-1 p-1" style={{ width: "28%", background: "#2E2518" }}>
                            <div className="w-full h-1.5 rounded-sm" style={{ background: "#E04E0E", opacity: 0.9 }} />
                            <div className="w-3/4 h-1 rounded-sm" style={{ background: "rgba(240,232,220,0.25)" }} />
                            <div className="w-1/2 h-1 rounded-sm mt-0.5" style={{ background: "rgba(240,232,220,0.15)" }} />
                            <div className="w-2/3 h-1 rounded-sm" style={{ background: "rgba(240,232,220,0.15)" }} />
                          </div>
                          {/* Content */}
                          <div className="flex-1 flex flex-col gap-1 p-1.5">
                            <div className="w-1/2 h-1.5 rounded-sm" style={{ background: "#14100A", opacity: 0.55 }} />
                            <div className="w-full h-1 rounded-sm" style={{ background: "#E6DDD0" }} />
                            <div className="w-5/6 h-1 rounded-sm" style={{ background: "#E6DDD0" }} />
                            <div className="w-3/4 h-1 rounded-sm" style={{ background: "#E6DDD0" }} />
                            <div className="mt-1 w-1/3 h-2 rounded-sm" style={{ background: "#E04E0E", opacity: 0.85 }} />
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-medium">Light</span>
                    </button>
                    {/* Dark mode preview */}
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === "dark" ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/30 hover:bg-muted/50"}`}
                    >
                      <div className="w-full aspect-video rounded-md overflow-hidden shadow-sm border" style={{ borderColor: "rgba(240,232,220,0.10)" }}>
                        <div className="w-full h-full flex" style={{ background: "#2C2418" }}>
                          {/* Sidebar */}
                          <div className="h-full flex flex-col gap-1 p-1" style={{ width: "28%", background: "#080705" }}>
                            <div className="w-full h-1.5 rounded-sm" style={{ background: "#FF5A1A", opacity: 0.9 }} />
                            <div className="w-3/4 h-1 rounded-sm" style={{ background: "rgba(240,232,220,0.20)" }} />
                            <div className="w-1/2 h-1 rounded-sm mt-0.5" style={{ background: "rgba(240,232,220,0.12)" }} />
                            <div className="w-2/3 h-1 rounded-sm" style={{ background: "rgba(240,232,220,0.12)" }} />
                          </div>
                          {/* Content */}
                          <div className="flex-1 flex flex-col gap-1 p-1.5">
                            <div className="w-1/2 h-1.5 rounded-sm" style={{ background: "#F0E8DC", opacity: 0.55 }} />
                            <div className="w-full h-1 rounded-sm" style={{ background: "#362D1F" }} />
                            <div className="w-5/6 h-1 rounded-sm" style={{ background: "#362D1F" }} />
                            <div className="w-3/4 h-1 rounded-sm" style={{ background: "#362D1F" }} />
                            <div className="mt-1 w-1/3 h-2 rounded-sm" style={{ background: "#FF5A1A", opacity: 0.85 }} />
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-medium">Dark</span>
                    </button>
                  </div>
                </div>
                <div className="pt-4">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avatar</label>
                  <div className="mt-3 grid grid-cols-6 gap-2">
                    {USER_AVATARS.map((av, i) => (
                      <button
                        key={i}
                        onClick={() => selectAvatar(i)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-2xl bg-muted hover:bg-muted/80 ${avatarIndex === i ? "ring-2 ring-offset-2 ring-primary" : "opacity-70 hover:opacity-100"}`}
                        title={av.label}
                      >
                        {av.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right column: Plugins + Data Management ── */}
            <div className="space-y-10">

            {/* ── Plugins ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Plugins</h2>
                <button
                  onClick={reloadPlugins}
                  disabled={pluginsReloading}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {pluginsReloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Reload
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Drop <code className="font-mono bg-muted px-1 rounded text-xs">.py</code> files into the plugins folder — they're auto-loaded at startup. Click Reload to apply changes without restarting.
              </p>
              {pluginsDir && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-xs font-mono text-muted-foreground">
                  <span className="shrink-0 text-foreground font-medium">Folder:</span>
                  <span className="truncate flex-1">{pluginsDir}</span>
                  <button onClick={() => navigator.clipboard.writeText(pluginsDir).then(() => toast("Path copied", "success"))} className="shrink-0 hover:text-foreground transition-colors" title="Copy path">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => openUrl(`file://${pluginsDir}`).catch(() => {})} className="shrink-0 hover:text-foreground transition-colors" title="Open folder">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {pluginsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading plugins…
                </div>
              ) : plugins.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                  <p className="text-sm font-medium">No plugins loaded yet</p>
                  <p className="text-xs text-muted-foreground">Create a <code className="font-mono bg-muted px-1 rounded">.py</code> file in the plugins folder with this structure:</p>
                  <pre className="text-left text-xs bg-muted rounded-md p-3 overflow-x-auto">{`async def my_tool(param: str):
    return {"result": "..."}

def initialize_plugin(registry):
    registry.register_tool(
        "my_tool", my_tool,
        {"type": "function", "function": {
            "name": "my_tool",
            "description": "What it does",
            "parameters": {"type": "object",
                "properties": {"param": {"type": "string"}},
                "required": ["param"]}}}
    )`}</pre>
                </div>
              ) : (
                <div className="space-y-2">
                  {plugins.map((p) => (
                    <div key={p.name} className="rounded-lg border bg-card">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                        onClick={() => setExpandedPlugins(prev => {
                          const next = new Set(prev);
                          next.has(p.name) ? next.delete(p.name) : next.add(p.name);
                          return next;
                        })}
                      >
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === "ok" ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
                          {p.status === "ok" ? "Loaded" : "Error"}
                        </span>
                        <span className="font-medium text-sm flex-1">{p.name}</span>
                        {p.tools.length > 0 && (
                          <span className="text-[11px] text-muted-foreground shrink-0">{p.tools.length} tool{p.tools.length !== 1 ? "s" : ""}</span>
                        )}
                        {expandedPlugins.has(p.name) ? <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0 rotate-180" />}
                      </button>
                      {expandedPlugins.has(p.name) && (
                        <div className="px-4 pb-3 border-t pt-2 space-y-1.5 text-xs">
                          <p className="text-muted-foreground font-mono truncate">{p.file}</p>
                          {p.error && (
                            <div className="flex items-start gap-1.5 text-red-600 dark:text-red-400 bg-red-500/10 rounded px-2 py-1.5">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>{p.error}</span>
                            </div>
                          )}
                          {p.tools.length > 0 && (
                            <div>
                              <p className="text-muted-foreground mb-1">Tools:</p>
                              <div className="flex flex-wrap gap-1">
                                {p.tools.map(t => (
                                  <code key={t} className="bg-muted px-2 py-0.5 rounded font-mono">{t}</code>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Data Management ── */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Data Management</h2>
              <p className="text-xs text-muted-foreground">Permanently delete stored data. This cannot be undone.</p>
              <div className="space-y-3">
                {([
                  { key: "chat" as const, label: "Chat history", description: "All chat sessions and messages" },
                  { key: "documents" as const, label: "Documents", description: "All documents and their content" },
                  { key: "sheets" as const, label: "Sheets", description: "All spreadsheets and their data" },
                ]).map(({ key, label, description }) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(key)}
                      className="text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3 w-3 inline mr-1" />
                      Delete
                    </button>
                  </div>
                ))}
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Delete everything</p>
                    <p className="text-xs text-muted-foreground">Wipe all chat, documents and sheets</p>
                  </div>
                  <button
                    onClick={() => setConfirmDelete("all")}
                    className="text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3 w-3 inline mr-1" />
                    Delete all
                  </button>
                </div>
              </div>
            </div>

            </div>{/* end right column */}

            {/* Confirm dialog */}
            {confirmDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !deleting && setConfirmDelete(null)}>
                <div className="bg-background border border-border rounded-lg shadow-xl w-[360px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {confirmDelete === "all" ? "Delete all data?" : `Delete ${confirmDelete} data?`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will permanently remove {confirmDelete === "all" ? "all chats, documents and sheets" : `all ${confirmDelete}`}. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
                    <button onClick={() => deleteData(confirmDelete)} disabled={deleting} className="text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {section === "news" && (
          <NewsFeedsSection />
        )}

        {section === "about" && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="text-lg font-semibold">About CrowForge</h2>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p><span className="text-foreground font-medium">Version</span>&nbsp; 0.1.0</p>
                <p><span className="text-foreground font-medium">Data storage</span>&nbsp; Local SQLite (crowforge.db)</p>
                <p><span className="text-foreground font-medium">Architecture</span>&nbsp; Tauri + React + FastAPI</p>
              </div>
            </div>

            {/* Developer card */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
                  LT
                </div>
                <div>
                  <p className="font-semibold text-sm">Created by Ľubomír Timko — Sanchez</p>
                  <p className="text-xs text-muted-foreground">VFX Partner · 20+ years in 3D, game dev &amp; visual effects · 50+ projects</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => openUrl("https://www.sanchez.sk")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H11.82c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/></svg>
                  sanchez.sk
                </button>
                <button
                  onClick={() => openUrl("https://www.linkedin.com/in/%C4%BEubom%C3%ADr-timko-sanchez/")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/></svg>
                  LinkedIn
                </button>
                <button
                  onClick={() => openUrl("mailto:timko.sanchez@gmail.com")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/></svg>
                  timko.sanchez@gmail.com
                </button>
              </div>
            </div>

            {/* Built with Claude */}
            <div className="rounded-lg border bg-muted/30 p-4 flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-[#D97757]" fill="currentColor" aria-label="Claude">
                <path d="M17.304 3.541 12.836 16.37H10.31L5.842 3.54h2.725l3.017 9.645L14.6 3.54h2.704zM5 20.459h2.548v-2.394H5v2.394zm11.452 0H19v-2.394h-2.548v2.394z"/>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">AI-assisted development by Claude</p>
                <p className="text-xs text-muted-foreground">Built with Anthropic's Claude Code — AI pair programming</p>
              </div>
              <button
                onClick={() => openUrl("https://claude.ai/code")}
                className="text-xs px-2.5 py-1 rounded-md border hover:bg-muted transition-colors shrink-0"
              >
                claude.ai/code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
