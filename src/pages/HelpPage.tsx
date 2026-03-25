import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
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
  Bug
} from "lucide-react";

export function HelpPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b shrink-0">
        <h1 className="text-xl font-bold tracking-tight">Help!</h1>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto space-y-10 pb-20">
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Zap size={24} />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight">Master CrowForge</h2>
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
                <TabsTrigger value="overview" className="flex-1 gap-2"><Zap size={14} />Overview</TabsTrigger>
                <TabsTrigger value="chat" className="flex-1 gap-2"><MessageSquare size={14} />Chat</TabsTrigger>
                <TabsTrigger value="docs" className="flex-1 gap-2"><FileText size={14} />Docs</TabsTrigger>
                <TabsTrigger value="sheets" className="flex-1 gap-2"><Table2 size={14} />Sheets</TabsTrigger>
                <TabsTrigger value="agent" className="flex-1 gap-2"><Bot size={14} />Agent</TabsTrigger>
                <TabsTrigger value="controls" className="flex-1 gap-2"><Sliders size={14} />AI Controls</TabsTrigger>
                <TabsTrigger value="news" className="flex-1 gap-2"><Newspaper size={14} />News</TabsTrigger>
                <TabsTrigger value="advanced" className="flex-1 gap-2"><Workflow size={14} />Advanced</TabsTrigger>
              </TabsList>
            </ScrollArea>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <ShieldCheck className="h-8 w-8 text-emerald-500 mb-2" />
                    <CardTitle className="text-lg">Local-First</CardTitle>
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
                <Card className="bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <Cpu className="h-8 w-8 text-blue-500 mb-2" />
                    <CardTitle className="text-lg">Local LLM</CardTitle>
                    <CardDescription>No API keys required.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Run open-source models (GGUF) directly on your CPU/GPU. 
                      Switch models instantly to match your hardware capabilities.
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <Zap className="h-8 w-8 text-amber-500 mb-2" />
                    <CardTitle className="text-lg">Universal Tools</CardTitle>
                    <CardDescription>Cross-module synergy.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your chat assistant can read your spreadsheets, 
                      rewrite your documents, and even visualize data on a canvas.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-8 space-y-4">
                <h3 className="text-xl font-bold">Quick Start</h3>
                <div className="grid gap-6 md:grid-cols-2 text-sm">
                  <div className="space-y-2">
                    <p className="font-semibold">1. Configure your Engine</p>
                    <p className="text-muted-foreground">Go to Settings or the AI Panel to choose between Local GGUF, OpenAI, or Gemini engines.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">2. Start a Session</p>
                    <p className="text-muted-foreground">Open a Chat to brainstorm, or a Document to begin writing with AI suggestions.</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* CHAT TAB */}
            <TabsContent value="chat" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Intelligent Conversations</h3>
                <p className="text-muted-foreground">Chat is the heart of CrowForge, designed for multi-session persistence and context awareness.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Context Personas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="font-medium">General</span>
                      <span className="text-muted-foreground">Concise & helpful</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="font-medium">Writing</span>
                      <span className="text-muted-foreground">Creative & stylistic</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="font-medium">Coding</span>
                      <span className="text-muted-foreground">Technical & logical</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="font-medium">Analysis</span>
                      <span className="text-muted-foreground">Rigorous & data-driven</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Advanced Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-2">
                      <li><strong>Document Awareness:</strong> Attach an open document to chat. The AI will read the outline and content to provide specific answers.</li>
                      <li><strong>Streaming:</strong> Real-time token generation for instant feedback.</li>
                      <li><strong>PDF Support:</strong> Upload PDFs directly to the chat to extract text and analyze local research.</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* DOCUMENTS TAB */}
            <TabsContent value="docs" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Rich Text & AI Writing</h3>
                <p className="text-muted-foreground">A Tiptap-powered editor with native AI operations baked into the interface.</p>
              </div>
              <div className="grid gap-4">
                <div className="p-4 rounded-xl border bg-card">
                  <h4 className="font-bold mb-3">AI Context Toolbar</h4>
                  <p className="text-sm text-muted-foreground mb-4">Select text to reveal the AI action menu:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">Rewrite</span>
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs font-semibold">Summarize</span>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-semibold">Expand</span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-semibold">Fix Grammar</span>
                  </div>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Exports & Formatting</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Documents support full Markdown formatting, tables, and nested lists. 
                      When finished, export to <strong className="text-foreground">PDF</strong>, 
                      <strong className="text-foreground">DOCX</strong>, or 
                      <strong className="text-foreground">Markdown</strong> with a single click.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* SHEETS TAB */}
            <TabsContent value="sheets" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Data Management</h3>
                <p className="text-muted-foreground">Local spreadsheets with infinite rows and integrated AI data generation.</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI Sheet Operations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <h5 className="text-sm font-bold">AI Data Fill</h5>
                      <p className="text-xs text-muted-foreground">
                        Select a column, provide an instruction, and click "AI Fill". 
                        The engine will process each row's existing data to generate values.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-sm font-bold">AI Schema Gen</h5>
                      <p className="text-xs text-muted-foreground">
                        Describe a table type (e.g., "SaaS CRM with MRR") and the AI will 
                        suggest and create the columns and initial structure.
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h5 className="text-sm font-bold">Standard Features</h5>
                    <p className="text-xs text-muted-foreground">
                      Formulas (=SUM, =AVG), Multi-column sorting, Conditional formatting, and Freeze columns/rows.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AGENT TAB */}
            <TabsContent value="agent" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">The ReAct Agent</h3>
                <p className="text-muted-foreground">An autonomous assistant that can reason and use tools to manage your workspace.</p>
              </div>
              <Card className="border-violet-500/20 bg-violet-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot size={18} className="text-violet-500" />
                    Agent Capabilities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Unlike standard chat, the Agent can "think" through multiple steps. 
                    It observes your workspace, selects a tool, executes it, and reflects on the result.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="bg-background/60 p-3 rounded-lg border">
                      <p className="text-xs font-bold mb-1">Sheet Tools</p>
                      <p className="text-[10px] text-muted-foreground italic">read_sheet, write_to_sheet, create_sheet, list_sheets</p>
                    </div>
                    <div className="bg-background/60 p-3 rounded-lg border">
                      <p className="text-xs font-bold mb-1">Doc Tools</p>
                      <p className="text-[10px] text-muted-foreground italic">read_document, update_document, create_document, list_documents</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI CONTROLS TAB */}
            <TabsContent value="controls" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">AI Control Panel</h3>
                <p className="text-muted-foreground">The sidebar (right panel) gives you granular control over the AI's "brain" and engine state.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Engine & Model Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p><strong>Hot-Swapping:</strong> Change engines instantly between Local (GGUF), OpenAI, and Gemini.</p>
                    <p><strong>Local Memory:</strong> Configure "Auto-unload" to free up system RAM after the AI has been idle for a set period.</p>
                    <p><strong>Status Banner:</strong> Real-time monitoring of the backend process with Start/Stop/Restart controls.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hyperparameter Tuning</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p><strong>Temperature:</strong> Control creativity (0.0 = deterministic, 1.0+ = creative/random).</p>
                    <p><strong>Top-P:</strong> Diversity filter for token selection.</p>
                    <p><strong>Max Tokens:</strong> Limit response length to save resources or prevent rambling.</p>
                    <p><strong>Seed:</strong> Set a specific seed for reproducible generations.</p>
                  </CardContent>
                </Card>
              </div>
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bug size={18} className="text-red-500" />
                    AI Debug Mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enable "Show AI Debug" to inspect the exact prompt sent to the LLM and 
                    the raw JSON response metadata (latency, token estimates, etc.) for the last generation.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* NEWS TAB */}
            <TabsContent value="news" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">AI News Digest</h3>
                <p className="text-muted-foreground">Stay informed with an automated, AI-curated summary of your favorite RSS feeds.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Feed Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Subscribe to any standard RSS or Atom feed.</p>
                    <p>The system periodically fetches latest headlines and caches them locally.</p>
                    <p>View individual articles or trigger a global refresh.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Smart Digest</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>The AI analyzes multiple feeds to identify trends and key news items.</p>
                    <p>Generates a beautifully formatted Markdown summary with categorized news.</p>
                    <p>Clickable links to original sources via the built-in system browser.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ADVANCED TAB */}
            <TabsContent value="advanced" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <Workflow className="h-6 w-6 text-primary mb-2" />
                    <CardTitle className="text-lg">Infinite Canvas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Visual workspace for connecting nodes and visualizing data flows.</p>
                    <p>Supports persistent canvas states saved directly to the database.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <Gauge className="h-6 w-6 text-primary mb-2" />
                    <CardTitle className="text-lg">AI Benchmarking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Compare multiple models side-by-side using the same prompt.</p>
                    <p>Measure <strong className="text-foreground">latency</strong>, 
                       <strong className="text-foreground">output quality</strong>, and 
                       <strong className="text-foreground">token efficiency</strong>.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>

          <Separator />

          <div className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              CrowForge v0.3 — Crafted for privacy and power. 
              <br />
              <span className="text-xs opacity-50">Local-first. AI-driven. User-owned.</span>
            </p>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
