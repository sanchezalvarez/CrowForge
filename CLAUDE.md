# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## UI Changes

When fixing UI issues, ONLY change the specific element requested. Do not modify surrounding elements (toolbar height, widths, layouts) unless explicitly asked.

## Code Quality

After implementing any fix, do a self-review pass checking for: stale state closures, camelCase/snake_case mismatches, off-by-one errors in loops, and missing visual edge cases before presenting the result.

## Build & Release

Use semver format (e.g., `0.4.1` not `0.4`) for all version strings. Current version: **0.4.1** (set in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, displayed in `App.tsx` sidebar and `SettingsPage.tsx` About). Always validate version format before committing.

## Problem Solving

When a CSS/visual approach fails twice, stop and propose an alternative architecture instead of iterating on the same broken approach. Especially for complex layout problems like page pagination and text flow.

## Project Overview

**CrowForge** is a local-first AI Workspace with Chat, Documents, Canvas, Sheets, Agent, and Tools. Three-layer architecture: Tauri v2 (Rust shell) → React/TypeScript frontend → Python FastAPI backend. All communication between frontend and backend is via HTTP/SSE (no Tauri IPC for app logic).

## Development Commands

### Running in Development (start separately for better logs)
1. `python -m backend.app` — FastAPI backend on http://127.0.0.1:8000
2. `npm run tauri dev` — Tauri window + Vite dev server on port 1420

### Production Build
1. `python -m PyInstaller --onefile --name crowforge-backend --add-data "backend/schema.sql;backend" backend/app.py`
2. Copy `dist/crowforge-backend.exe` → `src-tauri/bin/crowforge-backend-x86_64-pc-windows-msvc.exe`
3. `npm run tauri build`

### Other
- `npm run build` — TypeScript check + Vite production build (no Tauri)
- No test suite or linter is configured

## Architecture

```
Tauri (Rust) — spawns Python backend as sidecar on startup
  ├── Frontend (React 19 / Vite 7 / Tailwind v4) — port 1420
  │     └── axios for REST, EventSource/useFetchSSE for SSE streaming
  └── Backend (FastAPI / uvicorn) — port 8000
        ├── SQLite via raw sqlite3 (crowforge.db)
        └── AI engines: MockAIEngine, HTTPAIEngine, GeminiAIEngine, LocalLLAMAEngine
```

### Frontend

**Pages** (`src/pages/`):
- `DashboardPage.tsx` — overview dashboard with recent activity
- `ChatPage.tsx` — multi-session chat interface with AI
- `AgentPage.tsx` — ReAct agent with tool use and RAG knowledge base
- `CanvasPage.tsx` — node-based visual canvas (wraps `src/components/Canvas/`)
- `DocumentsPage.tsx` — rich text document editor (TipTap)
- `SheetsPage.tsx` — spreadsheet with formula support and AI fill
- `ToolsPage.tsx` — utility widgets (world clock, RSS news, etc.)
- `BenchmarkPage.tsx` — model comparison/benchmarking tool
- `ProjectsPage.tsx` — project list with create/edit dialogs
- `ProjectDetailPage.tsx` — single project view with tabs: Kanban, Backlog, Sprint, Roadmap
- `IssueTrackerPage.tsx` — cross-project bug tracker with Report Bug dialog
- `SettingsPage.tsx` — all app configuration (AI engines, appearance, team, workflows, etc.)
- `HelpPage.tsx` — in-app help documentation (includes Scrum guide)
- `OnboardingPage.tsx` — first-run onboarding flow

**App shell**: `src/App.tsx` contains routing, layout sidebar, and shared state.

**Styling**: Tailwind CSS v4 with shadcn/ui design tokens (CSS variables in `index.css`), Radix UI primitives, Lucide icons. Risograph visual design system throughout (see below).

**SSE hook**: `src/hooks/useFetchSSE.ts` wraps `fetch` with streaming for AI token streaming (use this, not `useSSE.ts`).

**Backend URL hardcoded**: `http://127.0.0.1:8000` as `API_BASE` constant in each file.

### Canvas System (`src/components/Canvas/`)

Node-based visual programming canvas using `@xyflow/react` v12.

- **`CanvasView.tsx`** — main React Flow canvas with context menu, add-node helpers, keyboard shortcuts
- **`CanvasSidebar.tsx`** — canvas list with create/rename/duplicate/delete and right-click menu
- **`CanvasToolbar.tsx`** — add-node buttons, auto-layout, snap-to-grid, export/import, zoom controls
- **`CanvasContextMenu.tsx`** — right-click menu for pane/node/edge actions
- **`CanvasExecutionContext.tsx`** — React context providing `triggerNode`, `runFlow`, `scheduleSave`
- **`edges/CustomEdge.tsx`** — custom edge with inline label editing, dash styles, color/width
- **`nodes/`** — `TextNode`, `AINode`, `ImageNode`, `StickyNoteNode`, `AnnotationNode`, `HyperlinkNode`, `GroupNode`
- **`nodes/NodeToolbar.tsx`** — per-node toolbar: delete, duplicate, shape, icon, color (presets + hex)
- **`hooks/useCanvasStore.ts`** — state management: nodes, edges, undo (20-item), auto-save (800ms debounce), AI execution chain
- **`hooks/useKeyboardShortcuts.ts`** — keyboard shortcuts: Delete, Ctrl+D, Ctrl+Z, Ctrl+A, Escape, Ctrl+Shift+F
- **`utils/autoLayout.ts`** — hierarchical/grid auto-layout with cycle detection

**AI Node behaviors**: free prompt, answer, summarize, translate, expand, extract, simplify, classify, rewrite.
**Execution chain**: when an AI node completes, it automatically triggers connected downstream AI nodes. Outputs from connected upstream nodes are injected as context.

### Project Management System (`src/components/PM/`)

Full Scrum-style project management with Kanban boards, sprints, backlog, roadmap, and issue tracking.

- **`KanbanBoard.tsx`** — drag-and-drop Kanban board using `@hello-pangea/dnd`, status columns with task cards
- **`BacklogView.tsx`** — hierarchical tree table (Epic → Feature → Story → Task/Bug/Spike), column reorder, inline child creation, context menu
- **`SprintView.tsx`** — time-boxed sprints with progress bars, complete sprint action
- **`RoadmapView.tsx`** — epics/features grouped by target month with overdue indicators
- **`IssueTrackerView.tsx`** — virtual-scrolled issue table with bulk actions, severity/status filters, group by project
- **`TaskDetailPanel.tsx`** — slide-in right panel for editing task details, parent assignment, references
- **`TaskForm.tsx`** — create/edit work item dialog (risograph styled)
- **`TaskCard.tsx`** — compact task card used in Kanban and Sprint views

**PM Hooks** (`src/hooks/`):
- `useIssues.ts` — issue CRUD and filtering
- `useWorkflowConfig.ts` — custom task/issue statuses and severity levels

**PM Types**: `src/types/pm.ts` — `PMProject`, `PMTask`, `PMSprint`, `PMMember`, `PMIssue`, `PMSeverity`, `PMItemType`

### Risograph Design System (`src/index.css`)

Visual identity based on risograph printing aesthetics — offset shadows, grain textures, registration marks, mono typography.

**CSS classes** (defined in `index.css`):
- `surface-noise` — subtle grain texture overlay via `::after` pseudo-element
- `card-riso`, `card-riso-orange`, `card-riso-teal`, `card-riso-violet` — card variants with offset box-shadows
- `btn-tactile`, `btn-tactile-orange`, `btn-tactile-teal`, `btn-tactile-outline` — buttons with press-in active state (translate + shadow)
- `riso-section-label` — IBM Plex Mono 10px uppercase labels with `◆` marker
- `riso-frame` — registration-mark corner decorations via `::before`/`::after`
- `input-riso-date`, `input-riso-date-sm` — styled date inputs with noise, borders, shadows, focus glow
- `row-tactile` — interactive table row with orange tint on active

**Animation classes** (all use `cubic-bezier(0.22, 1, 0.36, 1)` easing, respect `prefers-reduced-motion`):
- `animate-ink-in` — blur fade + bounce (0.6s), for headers/sections
- `animate-column-in` — fade + slide up 12px (0.25s), for columns/sections with stagger
- `animate-card-in` — fade + slide left 6px (0.2s), for cards with stagger
- `animate-row-in` — fade + slide up 6px (0.18s), for table/list rows with stagger
- `animate-msg-in` — riso misregistration text-shadow fade (0.35s), for chat messages

**CSS variables** (key tokens): `--accent-orange`, `--accent-teal`, `--accent-violet`, `--riso-orange`, `--riso-teal`, `--riso-violet`, `--border-strong`, `--background-2`, `--background-3`, `--noise-subtle`

**Fonts**: Syne Variable (`font-display`), IBM Plex Mono (`font-mono-ui`)

### Dialog Component

`src/components/ui/dialog.tsx` — Radix Dialog with flexbox-centered overlay (`flex items-center justify-center`) instead of `fixed + translate`. Content uses `max-h-[85vh]` with internal scroll for tall dialogs.

### Backend

- **`app.py`**: All FastAPI routes — chat, agent, documents, sheets, canvas, benchmark, AI engine management, model download
- **`ai_engine.py`**: Abstract `AIEngine` base class with four implementations:
  - `MockAIEngine` — prompt-aware mock responses
  - `HTTPAIEngine` — OpenAI-compatible HTTP API
  - `GeminiAIEngine` — Google Gemini API
  - `LocalLLAMAEngine` — local GGUF models via llama-cpp-python; runs inference in a thread, streams via asyncio queue; supports hot-swap/reload and idle-timeout unload
- **`ai/engine_manager.py`**: `AIEngineManager` — runtime engine switching, thread-safe registry with RLock
- **`ai/agent_loop.py`**: ReAct agent loop — LLM generates with tools, executes tool calls, feeds results back (max 6 iterations, 30s tool timeout)
- **`ai/tool_registry.py`**: Dynamic tool registry for agent function calling
- **`ai/plugin_loader.py`**: Loads agent tools as plugins
- **`storage.py`**: Raw SQL data layer — `DatabaseManager`, `AppRepository`, `PromptTemplateRepository`, `BenchmarkRepository`, `ChatSessionRepository`, `ChatMessageRepository`, `DocumentRepository`, `SheetRepository`, `CanvasRepository`
- **`models.py`**: Pydantic request/response models
- **`prompts.py`**: System prompt and user prompt template strings
- **`schema.sql`**: SQLite DDL — `settings`, `prompt_templates`, `benchmark_runs`, `chat_sessions`, `chat_messages`, `documents`, `sheets`, `sheet_columns`, `sheet_rows`, `rf_canvases`, `pm_projects`, `pm_members`, `pm_project_members`, `pm_sprints`, `pm_tasks`, `pm_workflow_config`

### Tauri

- `src-tauri/src/lib.rs`: Spawns `crowforge-backend` sidecar via `tauri-plugin-shell` on setup
- Sidecar binary path: `src-tauri/bin/crowforge-backend-x86_64-pc-windows-msvc.exe`
- No custom Tauri commands are used (the `greet` command is unused template code)

## Key Conventions

- **Local-first**: No cloud services or external APIs required (except optionally configured LLM endpoint)
- **Raw SQL only**: No ORMs — uses `sqlite3` directly in `storage.py`
- **SSE streaming protocol**: Server yields `data: <chunk>\n\n` per token, `data: [DONE]\n\n` on completion, `data: [ERROR] ...\n\n` on failure
- **Agent SSE events** (JSON strings): `{"type":"token","content":"..."}`, `{"type":"thinking","content":"..."}`, `{"type":"started_tool",...}`, `{"type":"finished_tool",...}`, `{"type":"tool_error",...}`, `{"type":"error","message":"..."}`
- **Prompt construction**: Uses `.replace()` not `.format()` to safely handle user content containing braces
- **JSON extraction**: Dual-pass on backend and frontend — finds first `[`/`{` and last `]`/`}` as bounds, strips markdown fences, handles wrapped arrays under keys like `concepts`, `ideas`, `items`
- **Session persistence**: `settings` table stores `last_client_id`, `last_campaign_id`, `onboarding_completed` — always restore on startup
- **Canvas save**: debounced 800ms after any change; data stored as JSON blob in `rf_canvases.data`
- **Generation timeout**: `GENERATION_TIMEOUT` env var (default 120s) — endpoints wrap generation in `asyncio.timeout()`
- **Idle unload**: local model automatically unloaded after `MODEL_IDLE_TIMEOUT` seconds of inactivity (default 600s); watcher checks `_generating` flag before unloading
- **LocalLLAMAEngine thread safety**: `_generating` flag set under `_lock` before any inference; `unload()` checks `_generating` under `_lock` before freeing model

## Feature Flags (.env)

- `ENABLE_LLM` (`false`): When false, uses `MockAIEngine` with hardcoded responses
- `LLM_ENGINE` (`http`): `http` for OpenAI-compatible API, `local` for GGUF via llama-cpp-python, `gemini` for Google Gemini
- `LLM_API_KEY`, `LLM_BASE_URL` (`https://api.openai.com/v1`), `LLM_MODEL` (`gpt-4o-mini`): HTTP engine config
- `GEMINI_API_KEY`, `GEMINI_MODEL` (`gemini-2.0-flash`): Gemini engine config
- `LLM_MODEL_PATH`, `LLM_CTX_SIZE` (`2048`), `LLM_MAX_TOKENS` (`1024`), `LLM_TEMPERATURE` (`0.7`): Local engine config
- `LLM_GENERATION_TIMEOUT` (`120`): Seconds before a generation request times out
- `MODEL_IDLE_TIMEOUT` (`600`): Seconds of inactivity before local model is unloaded from memory
