import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { RisoBackground } from "../components/RisoBackground";
import {
  MessageSquare,
  FileText,
  Table2,
  Bot,
  Sliders,
  Newspaper,
  Workflow,
  Gauge,
  Cpu,
  ShieldCheck,
  Zap,
  Bug,
  HelpCircle,
  Download,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  FunctionSquare,
  MessageCircle,
  LayoutGrid,
  PlusSquare,
  KanbanSquare,
  Settings,
  Users,
  Target,
  Calendar,
  GitBranch,
  Layers,
  ClipboardList,
  Palette,
  Trash2,
  Plug,
  Rss,
  Info,
} from "lucide-react";

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border rounded-xl bg-card/50 overflow-hidden">
      <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none font-semibold text-sm select-none hover:bg-muted/40 transition-colors">
        <span>{q}</span>
        <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="px-5 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed border-t bg-muted/10">
        {children}
      </div>
    </details>
  );
}

export function HelpPage() {
  return (
    <div className="relative flex flex-col h-full overflow-hidden riso-noise">
      <RisoBackground />

      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b shrink-0" style={{ position: 'relative', zIndex: 1 }}>
        <h1 className="font-display font-black tracking-tight" style={{ fontSize: '1.35rem', textShadow: '1.5px 1.5px 0 rgba(224,78,14,0.18), -0.75px -0.75px 0 rgba(11,114,104,0.12)' }}>Help</h1>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1" style={{ position: 'relative', zIndex: 1 }}>
        <div className="p-6 max-w-7xl mx-auto space-y-10 pb-20">

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)' }}>
                <Zap size={24} style={{ color: 'var(--accent-orange)' }} />
              </div>
              <h2 className="font-display font-black tracking-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', textShadow: '2px 2px 0 rgba(224,78,14,0.20), -1px -1px 0 rgba(11,114,104,0.14)' }}>Master CrowForge</h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              CrowForge is your private, local-first AI command center.
              Everything you create—chats, documents, spreadsheets—is stored locally
              and processed on your own hardware. No cloud, no tracking, just performance.
            </p>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="flex w-max min-w-full h-10 mb-8 bg-muted/50 p-1">
                <TabsTrigger value="overview"  className="flex-1 gap-2"><Zap size={14} />Overview</TabsTrigger>
                <TabsTrigger value="chat"      className="flex-1 gap-2"><MessageSquare size={14} />Chat</TabsTrigger>
                <TabsTrigger value="docs"      className="flex-1 gap-2"><FileText size={14} />Docs</TabsTrigger>
                <TabsTrigger value="sheets"    className="flex-1 gap-2"><Table2 size={14} />Sheets</TabsTrigger>
                <TabsTrigger value="agent"     className="flex-1 gap-2"><Bot size={14} />Agent</TabsTrigger>
                <TabsTrigger value="controls"  className="flex-1 gap-2"><Sliders size={14} />AI Controls</TabsTrigger>
                <TabsTrigger value="news"      className="flex-1 gap-2"><Newspaper size={14} />News</TabsTrigger>
                <TabsTrigger value="management" className="flex-1 gap-2"><KanbanSquare size={14} />Management</TabsTrigger>
                <TabsTrigger value="issues"    className="flex-1 gap-2"><Bug size={14} />Issues</TabsTrigger>
                <TabsTrigger value="settings"  className="flex-1 gap-2"><Settings size={14} />Settings</TabsTrigger>
                <TabsTrigger value="advanced"  className="flex-1 gap-2"><Workflow size={14} />Advanced</TabsTrigger>
                <TabsTrigger value="faq"       className="flex-1 gap-2"><HelpCircle size={14} />FAQ</TabsTrigger>
              </TabsList>
            </ScrollArea>

            {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="card-riso bg-card/50 backdrop-blur-sm animate-ink-in" style={{ animationDelay: '50ms' }}>
                  <CardHeader>
                    <ShieldCheck className="h-8 w-8 mb-2" style={{ color: 'var(--accent-teal)' }} />
                    <CardTitle className="text-lg font-display">Local-First</CardTitle>
                    <CardDescription>Privacy by design.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      All data is saved in a local SQLite database.
                      CrowForge never phones home or sends telemetry.
                      You have 100% ownership of your work.
                    </p>
                  </CardContent>
                </Card>
                <Card className="card-riso card-riso-orange bg-card/50 backdrop-blur-sm animate-ink-in" style={{ animationDelay: '100ms' }}>
                  <CardHeader>
                    <Cpu className="h-8 w-8 mb-2" style={{ color: 'var(--accent-orange)' }} />
                    <CardTitle className="text-lg font-display">Local LLM</CardTitle>
                    <CardDescription>No API keys required.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Run open-source models (GGUF) directly on your CPU/GPU.
                      Switch models instantly to match your hardware capabilities.
                    </p>
                  </CardContent>
                </Card>
                <Card className="card-riso card-riso-violet bg-card/50 backdrop-blur-sm animate-ink-in" style={{ animationDelay: '150ms' }}>
                  <CardHeader>
                    <Zap className="h-8 w-8 mb-2" style={{ color: 'var(--accent-violet)' }} />
                    <CardTitle className="text-lg font-display">Universal Tools</CardTitle>
                    <CardDescription>Cross-module synergy.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your chat assistant can read your spreadsheets,
                      rewrite your documents, and visualize data on an infinite canvas.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-8 space-y-6">
                <h3 className="text-xl font-bold">Quick Start</h3>
                <div className="grid gap-6 md:grid-cols-2 text-sm">
                  <div className="space-y-2">
                    <p className="font-semibold">1. Configure your Engine</p>
                    <p className="text-muted-foreground">Go to <strong>Settings → AI Engine</strong> to choose Local GGUF, OpenAI-compatible API, or Gemini. For local use, point to your <code className="bg-muted px-1 rounded text-xs">.gguf</code> model file.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">2. Download a GGUF Model</p>
                    <p className="text-muted-foreground">Grab any GGUF file from <strong>Hugging Face</strong>. Use <code className="bg-muted px-1 rounded text-xs">Q4_K_M</code> quantization for the best quality/size ratio. See the <strong>FAQ</strong> tab for specific recommendations.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">3. Start a Session</p>
                    <p className="text-muted-foreground">Open Chat to brainstorm ideas, a Document to write with inline AI edits, or a Sheet to analyse data — all powered by the same engine.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">4. Set Up News Feeds</p>
                    <p className="text-muted-foreground">Add RSS feeds in <strong>Settings → News Feeds</strong>, then use the Dashboard to fetch headlines and generate a daily AI digest.</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── CHAT ─────────────────────────────────────────────────────── */}
            <TabsContent value="chat" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Intelligent Conversations</h3>
                <p className="text-muted-foreground">Chat is the heart of CrowForge, designed for multi-session persistence and context awareness.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display">Context Personas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      ["General",  "Concise & helpful"],
                      ["Writing",  "Creative & stylistic"],
                      ["Coding",   "Technical & logical"],
                      ["Analysis", "Rigorous & data-driven"],
                    ].map(([name, desc]) => (
                      <div key={name} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                        <span className="font-medium">{name}</span>
                        <span className="text-muted-foreground">{desc}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="card-riso card-riso-orange">
                  <CardHeader>
                    <CardTitle className="text-base font-display">Advanced Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-2">
                      <li><strong>Document Awareness:</strong> Attach an open document to chat — the AI reads its outline and content to give specific answers.</li>
                      <li><strong>Streaming:</strong> Real-time token generation for instant feedback.</li>
                      <li><strong>PDF Support:</strong> Upload PDFs directly into the chat to extract text and analyse local research.</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── DOCS ─────────────────────────────────────────────────────── */}
            <TabsContent value="docs" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Rich Text &amp; AI Writing</h3>
                <p className="text-muted-foreground">A Tiptap-powered editor with AI operations built directly into the toolbar and selection flow.</p>
              </div>

              {/* Inline AI actions */}
              <Card className="card-riso card-riso-orange">
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    Inline AI Actions
                  </CardTitle>
                  <CardDescription>Select any text, then click an action in the AI toolbar strip.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                      <p className="text-xs font-bold">Rewrite <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+J</kbd></p>
                      <p className="text-xs text-muted-foreground">Rephrases the selection with alternative wording while preserving meaning.</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                      <p className="text-xs font-bold">Summarize</p>
                      <p className="text-xs text-muted-foreground">Condenses the selected passage into a shorter, high-density summary.</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                      <p className="text-xs font-bold">Expand</p>
                      <p className="text-xs text-muted-foreground">Elaborates on the selection with additional detail, context, and examples.</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                      <p className="text-xs font-bold">Fix Grammar</p>
                      <p className="text-xs text-muted-foreground">Corrects spelling, punctuation, and grammatical errors in the selection.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions panel */}
              <Card className="card-riso">
                <CardHeader>
                  <CardTitle className="text-base">AI Suggestions Panel</CardTitle>
                  <CardDescription>Appears in the right sidebar after any AI action completes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>The AI returns up to <strong className="text-foreground">4 suggestion variants</strong>. Each shows a short description and an <strong className="text-foreground">Insert</strong> button to apply just that one.</p>
                  <p>Use <strong className="text-foreground">Insert All</strong> to accept every suggestion at once, or <strong className="text-foreground">Dismiss</strong> to discard them all and return to the document.</p>
                  <p>If the AI request fails, an error banner appears in the sidebar with a Dismiss button.</p>
                </CardContent>
              </Card>

              {/* Export */}
              <Card className="card-riso">
                <CardHeader>
                  <CardTitle className="text-base">Exports &amp; Formatting</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Documents support full Markdown formatting, tables, and nested lists.
                    Export to <strong className="text-foreground">PDF</strong>,{" "}
                    <strong className="text-foreground">DOCX</strong>, or{" "}
                    <strong className="text-foreground">Markdown</strong> with a single click.
                    The toolbar also shows a live word and character count.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SHEETS ───────────────────────────────────────────────────── */}
            <TabsContent value="sheets" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Data Management &amp; AI</h3>
                <p className="text-muted-foreground">Local spreadsheets with six integrated AI capabilities — from chat to formula generation.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">

                {/* Ask AI */}
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageCircle size={15} className="text-blue-500" />
                      Ask AI (Sheet Chat)
                    </CardTitle>
                    <CardDescription>Toolbar → "Ask AI" button</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Opens a right-side chat panel titled <em>"Ask about data"</em>. Type any question about your data in natural language.</p>
                    <p>The AI automatically receives your current selection (or full sheet up to 200 rows) as context.</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["Summarize this data", "Which row has the highest value?", "What trends do you see?"].map(s => (
                        <span key={s} className="px-2 py-0.5 bg-muted rounded text-[10px]">{s}</span>
                      ))}
                    </div>
                    <p className="text-[11px]">Supports multi-turn conversation with streaming responses. Use <strong className="text-foreground">Stop</strong> to cancel mid-stream.</p>
                  </CardContent>
                </Card>

                {/* Formula Wizard */}
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FunctionSquare size={15} className="text-emerald-500" />
                      AI Formula Assistant
                    </CardTitle>
                    <CardDescription>Toolbar → "Formula" button</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Describe what you want the formula to do in plain English — the AI generates the spreadsheet formula for you.</p>
                    <p>The dialog shows the target cell, available column names, and quick example prompts to get started:</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["sum of column B where A > 100", "average of Sales", "if A > B show 'Over budget'"].map(s => (
                        <span key={s} className="px-2 py-0.5 bg-muted rounded text-[10px]">{s}</span>
                      ))}
                    </div>
                    <p className="text-[11px]">Hit <kbd className="px-1 py-0.5 rounded bg-muted font-mono">Ctrl+Enter</kbd> to generate. Use <strong className="text-foreground">Regenerate</strong> if the first result isn't right, then <strong className="text-foreground">Insert</strong> to place it in the cell.</p>
                  </CardContent>
                </Card>

                {/* Explain Formula */}
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <HelpCircle size={15} className="text-amber-500" />
                      Explain Formula
                    </CardTitle>
                    <CardDescription>Right-click a formula cell → "Explain"</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Right-click any cell that contains a formula and choose <strong className="text-foreground">Explain</strong>. A popup appears next to the cell with a plain-English breakdown of exactly what the formula does.</p>
                    <p className="text-[11px]">Useful for auditing inherited spreadsheets or understanding complex nested functions.</p>
                  </CardContent>
                </Card>

                {/* AI Fill */}
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles size={15} className="text-violet-500" />
                      AI Fill Column
                    </CardTitle>
                    <CardDescription>Toolbar → "Fill" button</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Select a column, write an instruction, and the AI fills every row based on existing data in the same row.</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["Fill with realistic values", "Translate to English", "Categorize", "Extract from context"].map(s => (
                        <span key={s} className="px-2 py-0.5 bg-muted rounded text-[10px]">{s}</span>
                      ))}
                    </div>
                    <p className="text-[11px]">A live <strong className="text-foreground">N / total rows</strong> progress counter is shown. Use <strong className="text-foreground">Stop</strong> to cancel at any time.</p>
                  </CardContent>
                </Card>

                {/* Range Operation */}
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <LayoutGrid size={15} className="text-primary" />
                      Range Operation
                    </CardTitle>
                    <CardDescription>Toolbar → "Range" button</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Run an AI operation over a selected cell range. Supports three modes:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li><strong>Row-wise</strong> — process each row independently</li>
                      <li><strong>Aggregate</strong> — derive a single result from the entire range</li>
                      <li><strong>Matrix</strong> — transform the whole block at once</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Generate Rows */}
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PlusSquare size={15} className="text-emerald-500" />
                      Generate Rows
                    </CardTitle>
                    <CardDescription>Toolbar → "Generate rows" button</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Generate new synthetic data rows that follow the patterns and value distributions already present in the sheet. Great for creating realistic test datasets or expanding demo data.</p>
                  </CardContent>
                </Card>

              </div>

              {/* Standard features */}
              <Card className="card-riso">
                <CardHeader>
                  <CardTitle className="text-base">Standard Spreadsheet Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Formulas (<code className="bg-muted px-1 rounded">=SUM</code>, <code className="bg-muted px-1 rounded">=AVG</code>, <code className="bg-muted px-1 rounded">=IF</code>, …) · Multi-column sorting · Conditional formatting · Freeze columns/rows · CSV import/export
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── AGENT ─────────────────────────────────────────────────────── */}
            <TabsContent value="agent" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">The ReAct Agent</h3>
                <p className="text-muted-foreground">An autonomous assistant that can reason and use tools to manage your workspace.</p>
              </div>
              <Card className="card-riso card-riso-violet border-violet-500/20 bg-violet-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot size={18} className="text-violet-500" />
                    Agent Capabilities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Unlike standard chat, the Agent "thinks" through multiple steps — it observes your workspace, selects a tool, executes it, and reflects on the result before continuing.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="bg-background/60 p-3 rounded-lg border">
                      <p className="text-xs font-bold mb-1">Sheet Tools</p>
                      <p className="text-[10px] text-muted-foreground font-mono">read_sheet · write_to_sheet · create_sheet · list_sheets</p>
                    </div>
                    <div className="bg-background/60 p-3 rounded-lg border">
                      <p className="text-xs font-bold mb-1">Doc Tools</p>
                      <p className="text-[10px] text-muted-foreground font-mono">read_document · update_document · create_document · list_documents</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>Tip:</strong> The Agent works best with a 7B+ model. Smaller 3B models may struggle with multi-step tool-calling logic.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── AI CONTROLS ───────────────────────────────────────────────── */}
            <TabsContent value="controls" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">AI Control Panel</h3>
                <p className="text-muted-foreground">The right sidebar gives you granular control over the engine, model, and generation parameters.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base">Engine &amp; Model Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p><strong>Hot-Swapping:</strong> Switch instantly between Local (GGUF), OpenAI-compatible, and Gemini engines without restarting.</p>
                    <p><strong>Auto-unload:</strong> Free RAM automatically after the AI has been idle for a configurable period (0 = keep in memory always).</p>
                    <p><strong>Status Banner:</strong> Real-time backend health monitoring with Start / Stop / Restart controls.</p>
                  </CardContent>
                </Card>
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base">Hyperparameter Tuning</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p><strong>Temperature (0 – 1.5):</strong> Lower = more focused and deterministic. Higher = more creative and varied.</p>
                    <p><strong>Top-P (0.1 – 1.0):</strong> Nucleus sampling — controls vocabulary diversity per token.</p>
                    <p><strong>Max Tokens (64 – 8192):</strong> Caps response length. Set higher for long documents, lower for quick answers.</p>
                    <p><strong>Seed:</strong> Fix a number for fully reproducible outputs. Leave empty for random.</p>
                  </CardContent>
                </Card>
              </div>
              <Card className="card-riso border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bug size={18} className="text-red-500" />
                    AI Debug Mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enable <strong>Show AI Debug</strong> to inspect the exact prompt sent to the LLM and the raw JSON response metadata (latency, token estimates, etc.) for the last generation. Set <code className="bg-muted px-1 rounded text-xs">DEBUG_AI=true</code> in your <code className="bg-muted px-1 rounded text-xs">.env</code> for full backend logging.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── NEWS ──────────────────────────────────────────────────────── */}
            <TabsContent value="news" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">AI News Digest</h3>
                <p className="text-muted-foreground">Stay informed with an automated, AI-curated summary of your favourite RSS feeds.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base">Feed Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Subscribe to any standard RSS or Atom feed via <strong className="text-foreground">Settings → News Feeds</strong>.</p>
                    <p>A curated library (BBC, Reuters, Hacker News, Wired, NASA, etc.) is pre-loaded for quick setup.</p>
                    <p>Toggle individual feeds on/off to control which sources appear in the digest.</p>
                  </CardContent>
                </Card>
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base">Smart Digest</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Click <strong className="text-foreground">Fetch</strong> on the Dashboard to pull the latest headlines from all active feeds.</p>
                    <p>Click <strong className="text-foreground">Summarize</strong> to generate a Markdown digest grouped by feed, streamed live.</p>
                    <p>The digest is cached — reload it instantly without re-generating.</p>
                  </CardContent>
                </Card>
              </div>
              <Card className="card-riso card-riso-violet border-blue-500/20 bg-blue-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu size={16} className="text-blue-500" />
                    Article Storage &amp; Local Model Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>CrowForge automatically keeps the <strong className="text-foreground">10 most recent articles per feed</strong> and deletes older ones after each fetch — preventing database bloat.</p>
                  <p>The AI digest uses the <strong className="text-foreground">3 newest articles per feed</strong> with short summaries, optimised to fit within the context window of 7B local models.</p>
                  <p>When using a cloud API (OpenAI / Gemini), you will get richer and more detailed digests.</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── PROJECT MANAGEMENT ────────────────────────────────────────── */}
            <TabsContent value="management" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Project Management</h3>
                <p className="text-muted-foreground">Full-featured project tracking with Kanban boards, sprints, roadmaps, and AI-powered standups.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Layers size={16} style={{ color: 'var(--accent-teal)' }} />
                      Projects
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Create projects with a <strong className="text-foreground">name</strong>, <strong className="text-foreground">short code</strong> (e.g. CRW), <strong className="text-foreground">color</strong>, <strong className="text-foreground">deadline</strong>, and assigned <strong className="text-foreground">team members</strong>.</p>
                    <p>Each project has its own Kanban board, sprint backlog, and roadmap. Project cards show progress bars and sprint status at a glance.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso card-riso-orange">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <KanbanSquare size={16} style={{ color: 'var(--accent-orange)' }} />
                      Kanban Board
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Drag-and-drop tasks across <strong className="text-foreground">status columns</strong> (New, Active, Ready to Go, Needs Testing, Resolved, Rejected).</p>
                    <p>Filter by <strong className="text-foreground">work item type</strong> (epic, feature, story, task, bug) or <strong className="text-foreground">assignee</strong>. Columns show task counts and are color-coded by status.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Target size={16} style={{ color: 'var(--accent-teal)' }} />
                      Sprint View
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Create <strong className="text-foreground">time-boxed sprints</strong> with a name, goal, start date, and end date.</p>
                    <p>Assign tasks from the backlog, track completion with <strong className="text-foreground">progress bars</strong>, and <strong className="text-foreground">complete sprints</strong> to move unfinished items back to backlog.</p>
                    <p className="text-[11px]">Backlog tasks show an "Add to sprint" dropdown directly inside the card.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso card-riso-orange">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Calendar size={16} style={{ color: 'var(--accent-orange)' }} />
                      Roadmap
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>View <strong className="text-foreground">Epics</strong> and <strong className="text-foreground">Features</strong> organized by target month. Cards show type, status, due date, and assignee.</p>
                    <p>Overdue items are highlighted with a <strong className="text-foreground">red indicator</strong>. Items without a due date appear in a "No Date" section.</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="card-riso card-riso-violet">
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <GitBranch size={16} style={{ color: 'var(--accent-violet)' }} />
                    Work Item Types &amp; Hierarchy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    {[
                      ["Epic", "Large initiative spanning multiple features and sprints"],
                      ["Feature", "Distinct functionality that delivers user value"],
                      ["User Story", "A requirement described from the user's perspective"],
                      ["Task", "A concrete unit of work to be completed"],
                      ["Bug", "A defect or issue that needs fixing"],
                      ["Spike", "A time-boxed research or investigation task"],
                    ].map(([type, desc]) => (
                      <div key={type} className="p-3 rounded-lg border bg-muted/20 space-y-1">
                        <p className="text-xs font-bold">{type}</p>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-riso">
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    AI Standup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Generate an <strong className="text-foreground">AI-powered daily standup</strong> summary based on recent task activity in the project.</p>
                  <p>The AI analyses what was completed, what's in progress, and what's blocked — giving you a quick overview without manual status updates.</p>
                </CardContent>
              </Card>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-2xl font-bold">How Scrum Works</h3>
                <p className="text-muted-foreground">CrowForge follows the Scrum framework. Here's how the key ceremonies and artifacts map to the app.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso card-riso-violet">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <ClipboardList size={16} style={{ color: 'var(--accent-violet)' }} />
                      Product Backlog
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>The <strong className="text-foreground">Backlog view</strong> is your Product Backlog — an ordered list of everything that might be needed in the product.</p>
                    <p>Organize work items into a <strong className="text-foreground">hierarchy</strong>: Epics &rarr; Features &rarr; Stories &rarr; Tasks. The Product Owner prioritizes items from top to bottom.</p>
                    <p className="text-[11px]">Use filters and type toggles to focus on specific work item types or assignees.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso card-riso-orange">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Target size={16} style={{ color: 'var(--accent-orange)' }} />
                      Sprint Planning
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Create a <strong className="text-foreground">new sprint</strong> with a name, goal, start and end date (typically 1–4 weeks).</p>
                    <p>Pull items from the backlog into the sprint using the <strong className="text-foreground">"Add to sprint"</strong> dropdown on each task card. This is your Sprint Backlog.</p>
                    <p className="text-[11px]">The sprint goal should describe what the team commits to delivering by the end of the sprint.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <KanbanSquare size={16} style={{ color: 'var(--accent-teal)' }} />
                      Daily Scrum
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Use the <strong className="text-foreground">Kanban board</strong> during daily standups to visualize progress. Move tasks across columns as work progresses.</p>
                    <p>The <strong className="text-foreground">AI Standup</strong> feature can generate a summary of what changed — what was done, what's in progress, and what's blocked.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso card-riso-violet">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <CheckCircle2 size={16} style={{ color: 'var(--accent-violet)' }} />
                      Sprint Review &amp; Retrospective
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>When a sprint ends, click <strong className="text-foreground">"Complete Sprint"</strong>. Resolved tasks are marked done; unfinished items automatically move back to the backlog.</p>
                    <p>The sprint <strong className="text-foreground">progress bar</strong> shows completion percentage — use this to review what was accomplished and discuss improvements for the next sprint.</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="card-riso">
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Info size={16} style={{ color: 'var(--accent-teal)' }} />
                    Scrum Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    {[
                      ["Product Owner", "Owns the backlog, prioritizes work items, defines acceptance criteria for stories"],
                      ["Scrum Master", "Facilitates ceremonies, removes blockers, ensures the team follows Scrum practices"],
                      ["Development Team", "Self-organizing team that delivers the sprint increment — assign members to projects via Settings"],
                    ].map(([role, desc]) => (
                      <div key={role} className="p-3 rounded-lg border bg-muted/20 space-y-1">
                        <p className="text-xs font-bold">{role}</p>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── ISSUE TRACKER ────────────────────────────────────────────── */}
            <TabsContent value="issues" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Issue Tracker</h3>
                <p className="text-muted-foreground">Track bugs and issues across all projects with severity levels, bulk actions, and filterable views.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso card-riso-orange">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Bug size={16} style={{ color: 'var(--accent-orange)' }} />
                      Bug Reporting
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Report bugs with a <strong className="text-foreground">title</strong>, <strong className="text-foreground">description</strong>, <strong className="text-foreground">severity level</strong>, and <strong className="text-foreground">when it happened</strong>.</p>
                    <p>Attach <strong className="text-foreground">screenshots</strong> by pasting from clipboard or dragging files. Bugs are automatically assigned to the selected project.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <ClipboardList size={16} style={{ color: 'var(--accent-teal)' }} />
                      Issue List &amp; Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>View all issues in a <strong className="text-foreground">sortable table</strong> with columns for ID, title, severity, status, assignee, and project.</p>
                    <p>Filter by <strong className="text-foreground">severity</strong>, <strong className="text-foreground">status</strong>, <strong className="text-foreground">assignee</strong>, or <strong className="text-foreground">project</strong>. Toggle <strong className="text-foreground">Group by Project</strong> to organize issues under project headers.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <CheckCircle2 size={16} style={{ color: 'var(--accent-teal)' }} />
                      Bulk Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Select multiple issues using <strong className="text-foreground">checkboxes</strong>, then use the bulk action bar to:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li>Change <strong>status</strong> of all selected issues at once</li>
                      <li>Reassign to a different <strong>team member</strong></li>
                      <li>Batch <strong>close</strong> resolved issues</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="card-riso card-riso-orange">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <AlertTriangle size={16} style={{ color: 'var(--accent-orange)' }} />
                      Severity Levels
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Issues are categorized by severity to help prioritize fixes:</p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {[
                        ["Blocker", "System unusable, no workaround"],
                        ["Major", "Significant impact on usage"],
                        ["Minor", "Small inconvenience"],
                        ["UI/UX", "Cosmetic or visual issue"],
                      ].map(([level, desc]) => (
                        <div key={level} className="text-[11px]">
                          <strong className="text-foreground">{level}</strong> — {desc}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px]">Severity levels are <strong className="text-foreground">customizable</strong> in Settings → Team &amp; Workflow.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── SETTINGS ─────────────────────────────────────────────────── */}
            <TabsContent value="settings" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Settings Reference</h3>
                <p className="text-muted-foreground">All configurable options in CrowForge, organized by section.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Cpu size={16} style={{ color: 'var(--accent-teal)' }} />
                      AI &amp; Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-xs">Engine Selection</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li><strong>Mock</strong> — test without any AI</li>
                        <li><strong>HTTP / OpenAI-compatible</strong> — connect to OpenAI, LM Studio, Ollama, etc.</li>
                        <li><strong>Google Gemini</strong> — Google AI with dedicated API</li>
                        <li><strong>Local GGUF</strong> — run open-source models on your machine</li>
                      </ul>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-xs">Engine-Specific Config</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>HTTP: Base URL, API Key, Model name</li>
                        <li>Gemini: API Key, Model selection</li>
                        <li>Local: Models directory, Context size (tokens)</li>
                      </ul>
                    </div>
                    <p className="text-[11px]"><strong>System Specs</strong> — read-only display of OS, CPU, RAM, GPU, VRAM, and disk space.</p>
                    <p className="text-[11px]"><strong>GGUF Gallery</strong> — browse and download free models with tag filtering and size info.</p>
                  </CardContent>
                </Card>

                <Card className="card-riso card-riso-orange">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Palette size={16} style={{ color: 'var(--accent-orange)' }} />
                      Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-xs">Appearance</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li><strong>Theme</strong> — Light or Dark mode</li>
                        <li><strong>Avatar</strong> — pick an emoji to represent yourself</li>
                      </ul>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-xs flex items-center gap-1"><Plug size={12} /> Plugins</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Set a plugin folder path</li>
                        <li>Load / reload agent plugins</li>
                        <li>View plugin status, errors, and available tools</li>
                      </ul>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-xs flex items-center gap-1"><Trash2 size={12} /> Data Management</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Delete all <strong>chats</strong>, <strong>documents</strong>, <strong>sheets</strong>, or <strong>everything</strong></li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-riso card-riso-violet">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Users size={16} style={{ color: 'var(--accent-violet)' }} />
                      Team &amp; Workflow
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-xs">Team Members</p>
                      <p className="text-xs">Add members with <strong>name</strong> and <strong>avatar color</strong>. Members can be assigned to tasks and issues.</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-xs">Custom Workflows</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li><strong>Task Statuses</strong> — add, edit, remove, mark as "done" (terminal)</li>
                        <li><strong>Issue Statuses</strong> — separate workflow for bug tracking</li>
                        <li><strong>Severity Levels</strong> — customize severity names and priority order</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-riso">
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Rss size={16} style={{ color: 'var(--accent-teal)' }} />
                      News Feeds
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Subscribe to RSS/Atom feeds for the AI news digest.</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li><strong>Curated library</strong> — pre-loaded feeds (BBC, Reuters, Hacker News, NASA, etc.) sorted by category</li>
                      <li><strong>Custom feeds</strong> — add any RSS URL with a custom title</li>
                      <li><strong>Toggle feeds</strong> — enable/disable individual sources</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

            </TabsContent>

            {/* ── ADVANCED ──────────────────────────────────────────────────── */}
            <TabsContent value="advanced" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-riso">
                  <CardHeader>
                    <Workflow className="h-6 w-6 text-primary mb-2" />
                    <CardTitle className="text-lg">Infinite Canvas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>A node-based visual workspace for connecting ideas and data flows. Add AI Nodes with 9 behaviour modes (Summarize, Translate, Expand, Classify, …) and wire them together.</p>
                    <p>Canvas states are saved to the local database and restored on reload.</p>
                  </CardContent>
                </Card>
                <Card className="card-riso">
                  <CardHeader>
                    <Gauge className="h-6 w-6 text-primary mb-2" />
                    <CardTitle className="text-lg">AI Benchmarking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Compare multiple models side-by-side using the same prompt.</p>
                    <p>Measures <strong className="text-foreground">latency</strong>, <strong className="text-foreground">output quality</strong>, and <strong className="text-foreground">token efficiency</strong> per engine. Per-engine failures are recorded without aborting the batch.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── FAQ ───────────────────────────────────────────────────────── */}
            <TabsContent value="faq" className="space-y-8 animate-in fade-in slide-in-from-bottom-2">

              {/* Model choice */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500"><Cpu size={20} /></div>
                  <h3 className="text-xl font-bold">AI Models — which one to pick?</h3>
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <div className="grid grid-cols-4 bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Size</span><span>RAM</span><span>Speed</span><span>Best for</span>
                  </div>
                  {[
                    { size: "3B",  color: "emerald", ram: "2 – 4 GB",   speed: "Very fast", speedColor: "text-emerald-600", use: "Simple Q&A, summarisation, short texts" },
                    { size: "7B",  color: "blue",    ram: "4 – 8 GB",   speed: "Fast",      speedColor: "text-blue-600",    use: "Daily tasks, writing, coding, news digest" },
                    { size: "13B", color: "amber",   ram: "8 – 12 GB",  speed: "Medium",    speedColor: "text-amber-600",   use: "Complex analysis, Agent, long documents" },
                    { size: "30B+",color: "red",     ram: "16 – 24+ GB",speed: "Slow",      speedColor: "text-red-500",     use: "Research, deep reasoning, creative writing" },
                  ].map(r => (
                    <div key={r.size} className="grid grid-cols-4 px-4 py-3 text-sm border-t items-center">
                      <Badge variant="outline" className={`w-fit text-${r.color}-600 border-${r.color}-600`}>{r.size}</Badge>
                      <span className="text-muted-foreground">{r.ram}</span>
                      <span className={`${r.speedColor} font-medium`}>{r.speed}</span>
                      <span className="text-muted-foreground text-xs">{r.use}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border bg-card/50 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Download size={16} className="text-primary" />
                    <h4 className="font-bold text-sm">Recommended models to download (Hugging Face)</h4>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">3B — Fast &amp; light</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /><span><strong>Phi-3.5-mini-instruct</strong> Q4_K_M (~2.2 GB) — Microsoft model, great at coding</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /><span><strong>Llama-3.2-3B-Instruct</strong> Q4_K_M (~2 GB) — Solid all-rounder</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /><span><strong>Qwen2.5-3B-Instruct</strong> Q4_K_M (~2 GB) — Strong at analysis &amp; math</span></li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">7B — Recommended for most users</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" /><span><strong>Mistral-7B-Instruct-v0.3</strong> Q4_K_M (~4.1 GB) — Fast and reliable</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" /><span><strong>Llama-3.1-8B-Instruct</strong> Q4_K_M (~5 GB) — Excellent for writing &amp; chat</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" /><span><strong>Qwen2.5-7B-Instruct</strong> Q4_K_M (~4.7 GB) — Best-in-class coding at 7B</span></li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">12–14B — Higher quality</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" /><span><strong>Mistral-Nemo-12B-Instruct</strong> Q4_K_M (~7 GB) — 128k context window</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" /><span><strong>Phi-4-14B-Instruct</strong> Q4_K_M (~8 GB) — Microsoft's best small model</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" /><span><strong>Qwen2.5-14B-Instruct</strong> Q4_K_M (~8.5 GB) — Excellent reasoning</span></li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Quantization — what to choose?</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2"><span className="font-bold text-foreground w-14 shrink-0">Q4_K_M</span><span>Recommended. Best quality/size ratio.</span></li>
                        <li className="flex items-start gap-2"><span className="font-bold text-foreground w-14 shrink-0">Q5_K_M</span><span>Better quality, ~20% larger file.</span></li>
                        <li className="flex items-start gap-2"><span className="font-bold text-foreground w-14 shrink-0">Q8_0</span><span>Near-lossless quality, but large file.</span></li>
                        <li className="flex items-start gap-2"><span className="font-bold text-foreground w-14 shrink-0">Q2_K</span><span>Smallest file, noticeably worse quality.</span></li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground border-t">
                    <ExternalLink size={12} />
                    <span>Download at: <strong className="text-foreground">huggingface.co</strong> — search model name + "GGUF" (e.g. "Mistral 7B GGUF")</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Setup FAQ */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary"><Sliders size={20} /></div>
                  <h3 className="text-xl font-bold">Setup &amp; Configuration</h3>
                </div>
                <div className="space-y-2">

                  <FaqItem q="How do I set up a local GGUF model?">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Download a <code className="bg-muted px-1 rounded">.gguf</code> file from Hugging Face</li>
                      <li>Open <strong>Settings → AI Engine</strong> in CrowForge</li>
                      <li>Select the <strong>Local (GGUF)</strong> engine</li>
                      <li>Paste the full path to the file into <strong>Model Path</strong> (e.g. <code className="bg-muted px-1 rounded">C:\Models\mistral-7b.gguf</code>)</li>
                      <li>Set <strong>Context Size</strong> — recommended: 4096 for 7B, 2048 for 3B</li>
                      <li>Click <strong>Save &amp; Reload</strong> — the model loads into RAM</li>
                    </ol>
                  </FaqItem>

                  <FaqItem q="How do I connect to OpenAI or another cloud API?">
                    <p>Go to <strong>Settings → AI Engine</strong>, choose <strong>OpenAI-compatible</strong>, and fill in:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li><strong>Base URL:</strong> <code className="bg-muted px-1 rounded">https://api.openai.com/v1</code></li>
                      <li><strong>API Key:</strong> your key (e.g. <code className="bg-muted px-1 rounded">sk-...</code>)</li>
                      <li><strong>Model:</strong> e.g. <code className="bg-muted px-1 rounded">gpt-4o-mini</code> or <code className="bg-muted px-1 rounded">gpt-4o</code></li>
                    </ul>
                    <p className="mt-2">Works with local servers too: <strong>LM Studio</strong> (<code className="bg-muted px-1 rounded">http://localhost:1234/v1</code>) and <strong>Ollama</strong> (<code className="bg-muted px-1 rounded">http://localhost:11434/v1</code>, API Key: <code className="bg-muted px-1 rounded">ollama</code>).</p>
                  </FaqItem>

                  <FaqItem q="What is Context Size and how should I set it?">
                    <p>Context Size (CTX) is the maximum number of tokens the model processes at once — including chat history and your message. Larger context = better understanding of long documents, but uses more RAM.</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li><strong>3B models:</strong> 2048 – 4096</li>
                      <li><strong>7B models:</strong> 4096 – 8192</li>
                      <li><strong>13B+ models:</strong> 8192 – 32768+</li>
                    </ul>
                    <p className="mt-2 text-amber-600 dark:text-amber-400">⚠ If the model crashes or is extremely slow, reduce Context Size first.</p>
                  </FaqItem>

                  <FaqItem q="What is Max Tokens and when should I change it?">
                    <p>Max Tokens caps the <em>length of the response</em> (not the input). If set too low, the AI will cut off mid-sentence.</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Short chat / Q&amp;A: <strong>256 – 512</strong></li>
                      <li>General use (recommended for 7B): <strong>1024</strong></li>
                      <li>Long documents / code (13B+ only): <strong>2048 – 4096</strong></li>
                    </ul>
                  </FaqItem>

                </div>
              </div>

              <Separator />

              {/* Troubleshooting FAQ */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-500/10 text-red-500"><AlertTriangle size={20} /></div>
                  <h3 className="text-xl font-bold">Troubleshooting</h3>
                </div>
                <div className="space-y-2">

                  <FaqItem q="AI responses are short or cut off mid-sentence">
                    <p>Most likely cause: <strong>Max Tokens is too low</strong>. Raise it in the AI Controls panel (1024+ recommended).</p>
                    <p className="mt-1">Second cause: the chat history is too long and hit the <strong>Context Size</strong> limit. Start a new chat or increase CTX.</p>
                  </FaqItem>

                  <FaqItem q="Backend won't start / AI isn't responding">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Check that <code className="bg-muted px-1 rounded">crowforge-backend.exe</code> exists in the app folder</li>
                      <li>Use the <strong>Restart Backend</strong> button in the AI Controls panel</li>
                      <li>Check that port <strong>8000</strong> isn't occupied by another process</li>
                      <li>Verify the model path is an absolute path and the file exists</li>
                    </ul>
                  </FaqItem>

                  <FaqItem q="The model takes a long time to load">
                    <p>Loading a GGUF file into RAM can take <strong>30 seconds to 2 minutes</strong> depending on model size and disk speed. This is normal for the first load or after a restart.</p>
                    <p className="mt-1">With <strong>Auto-unload</strong> enabled, the model is evicted from RAM after the configured idle period and will reload on the next request.</p>
                  </FaqItem>

                  <FaqItem q="AI produces gibberish or repeats itself">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Lower <strong>Temperature</strong> to 0.3 – 0.5 for factual tasks</li>
                      <li>Set <strong>Top-P</strong> to 0.9</li>
                      <li>For 3B models — use shorter prompts; they are sensitive to prompt format</li>
                      <li>Try a different model — not every GGUF performs equally on every task</li>
                    </ul>
                  </FaqItem>

                  <FaqItem q="The news digest is too short or missing some feeds">
                    <p>The digest is optimised for 7B local models — it uses <strong>3 articles per feed</strong> with short summaries to stay within the context window. This is intentional for local inference.</p>
                    <p className="mt-1">With a <strong>cloud API</strong> (OpenAI / Gemini) you'll get richer output. Also make sure feeds are set to <strong>active</strong> in Settings and that you clicked <strong>Fetch</strong> before summarising.</p>
                  </FaqItem>

                  <FaqItem q="Can I use LM Studio or Ollama with CrowForge?">
                    <p>Yes. Both expose an OpenAI-compatible API. Set the engine to <strong>OpenAI-compatible</strong> and use:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li><strong>LM Studio:</strong> Base URL = <code className="bg-muted px-1 rounded">http://localhost:1234/v1</code>, API Key = any text</li>
                      <li><strong>Ollama:</strong> Base URL = <code className="bg-muted px-1 rounded">http://localhost:11434/v1</code>, API Key = <code className="bg-muted px-1 rounded">ollama</code></li>
                    </ul>
                    <p className="mt-1">The model name must match what is currently loaded in LM Studio / Ollama.</p>
                  </FaqItem>

                  <FaqItem q="How do I speed up generation on CPU?">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Use a <strong>smaller model</strong> — 3B is ~3× faster than 7B</li>
                      <li>Choose <strong>Q4_K_M</strong> quantization instead of Q8</li>
                      <li>Lower <strong>Context Size</strong> — smaller CTX means fewer computations</li>
                      <li>Lower <strong>Max Tokens</strong> — shorter responses are faster</li>
                      <li>With a GPU: use llama-cpp-python compiled with <strong>CUDA</strong> support</li>
                    </ul>
                  </FaqItem>

                  <FaqItem q="Where is my data stored?">
                    <p>All data (chats, documents, sheets, settings) is stored locally in a SQLite database file called <code className="bg-muted px-1 rounded">crowforge.db</code> inside the app directory.</p>
                    <p className="mt-1">Nothing is sent to the cloud — except your own API calls if you are using OpenAI or Gemini.</p>
                  </FaqItem>

                </div>
              </div>

            </TabsContent>

          </Tabs>


        </div>
      </ScrollArea>
    </div>
  );
}
