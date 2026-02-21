# CrowForge

A local-first AI workspace with **Chat**, **Documents**, **Sheets**, and **Benchmarking**. Everything runs on your machine — no cloud services, no telemetry, no subscriptions.

Bring your own model: connect a local GGUF file, any OpenAI-compatible API, or just use the built-in mock engine to explore the UI.

Built with **Tauri v2** · **React 19 / TypeScript** · **Python FastAPI** · **SQLite**

---

## Features

- **Chat** — Multi-session conversational AI with context modes (General, Writing, Coding, Analysis, Brainstorm). Markdown rendering for AI responses.
- **Documents** — AI-assisted rich text editor (TipTap). AI can rewrite, summarise, or expand selected text. Export to PDF, DOCX, or Markdown.
- **Sheets** — Spreadsheet with formula support, column types, formatting, and AI-powered cell fill. Export to XLSX or CSV.
- **Benchmark** — Send the same prompt to multiple engines / models simultaneously and compare latency and output quality side-by-side.
- **Settings** — Configure your AI engine and models through the UI. Download free GGUF models directly from HuggingFace.
- **Local model management** — Hot-swap GGUF models at runtime. Models auto-unload after 10 minutes of inactivity to free memory.
- **First-run onboarding** — Guided wizard on first launch to pick your AI engine.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.10+ |
| Rust + Cargo | 1.70+ (Tauri builds only) |

---

## Setup

```bash
# 1. Frontend dependencies
npm install

# 2. Backend dependencies
pip install fastapi uvicorn httpx python-dotenv sse-starlette pydantic openpyxl python-docx

# 3. (Optional) Local GGUF inference
pip install llama-cpp-python
```

### Environment

Create a `.env` file in the project root. The app defaults to mock mode (no model needed):

```env
# ── Mock mode (default, no model required) ──────────────────────────
ENABLE_LLM=false

# ── OpenAI-compatible API ────────────────────────────────────────────
ENABLE_LLM=true
LLM_ENGINE=http
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

# ── Local GGUF model ─────────────────────────────────────────────────
ENABLE_LLM=true
LLM_ENGINE=local
LLM_MODEL_PATH=C:/models/my-model.gguf
LLM_CTX_SIZE=2048
LLM_MAX_TOKENS=1024
LLM_TEMPERATURE=0.7

# ── Optional tuning ──────────────────────────────────────────────────
MODEL_IDLE_TIMEOUT=600      # seconds before local model is auto-unloaded (default 600)
LLM_GENERATION_TIMEOUT=120  # max seconds per generation pass (default 120)
```

> You can also configure all of this through the **Settings** page inside the app — no file editing required.

---

## Development

Run backend and frontend in separate terminals:

```bash
# Terminal 1 — FastAPI backend (port 8000)
python -m backend.app

# Terminal 2 — Tauri + Vite dev server (port 1420)
npm run tauri dev
```

**Browser-only mode** (no Tauri shell, useful for rapid UI iteration):

```bash
python -m backend.app   # Terminal 1
npm run dev             # Terminal 2 → http://localhost:1420
```

---

## Production Build

### 1. Bundle the Python backend

```bash
python -m PyInstaller --onefile --name crowforge-backend \
  --add-data "backend/schema.sql;backend" \
  backend/app.py
```

### 2. Copy the sidecar binary

```bash
# Windows
copy dist\crowforge-backend.exe src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe
```

### 3. Build the Tauri app

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/` (installer + portable exe)

---

## Project Structure

```
backend/
  app.py                  FastAPI routes and AI orchestration
  ai_engine.py            AI engine implementations (Mock, HTTP, Local GGUF)
  ai/
    engine_manager.py     Runtime engine registry and switching
  storage.py              SQLite data layer (raw SQL, no ORM)
  models.py               Pydantic request/response models
  schema.sql              Database schema

src/
  App.tsx                 App shell, sidebar navigation, state machine
  pages/
    ChatPage.tsx          Conversational AI with session history
    DocumentsPage.tsx     Rich text editor with AI writing tools
    SheetsPage.tsx        Spreadsheet with AI fill and export
    BenchmarkPage.tsx     Multi-model comparison tool
    SettingsPage.tsx      AI config and model gallery
    OnboardingPage.tsx    First-run setup wizard
  components/
    AIControlPanel.tsx    Right-side engine/model/tuning panel
    SplashScreen.tsx      Loading screen shown during backend startup
    ui/                   shadcn/ui primitives
  hooks/
    useSSE.ts             Native EventSource wrapper for token streaming
    useToast.ts           Toast notification hook
  lib/
    fileService.ts        Client-side export (XLSX, CSV, PDF, DOCX)

src-tauri/
  src/lib.rs              Tauri setup, sidecar spawn
  capabilities/           Permission declarations
```

---

## Architecture

```
Tauri (Rust shell)
  └── spawns Python sidecar on startup
        ├── Frontend  React 19 / Vite — port 1420
        │     └── axios (REST) + EventSource (SSE streaming)
        └── Backend   FastAPI / uvicorn — port 8000
              ├── SQLite  campaigns.db  (raw sqlite3)
              └── AI engines: Mock · HTTP/OpenAI · Local GGUF
```

All frontend ↔ backend communication is HTTP/SSE — no Tauri IPC is used for app logic.

---

## Free GGUF Models

The Settings → Model Gallery page includes one-click download links for:

| Model | Size | License |
|-------|------|---------|
| Llama 3.2 3B Instruct Q4_K_M | ~2.0 GB | Meta Llama 3.2 |
| Phi-3.5 mini Instruct Q4_K_M | ~2.2 GB | MIT |
| Qwen2.5 3B Instruct Q4_K_M | ~1.9 GB | Apache 2.0 |
| Mistral 7B Instruct v0.3 Q4_K_M | ~4.1 GB | Apache 2.0 |

Place downloaded `.gguf` files in your configured Models Directory, then select them in the AI panel.

---

## License

MIT
