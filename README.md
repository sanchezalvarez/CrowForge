# CrowForge

Local-first AI workspace with **Chat**, **Documents**, and **Sheets**. Runs entirely on your machine — no cloud services required. Connect any local GGUF model or OpenAI-compatible API.

Built with **Tauri v2** (Rust) + **React 19** / TypeScript + **Python FastAPI** / SQLite.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.10+ |
| Rust | 1.70+ (for Tauri builds) |

## Setup

```bash
# Frontend
npm install

# Backend
pip install fastapi uvicorn httpx python-dotenv sse-starlette pydantic

# Optional — local GGUF model inference
pip install llama-cpp-python
```

### Environment

Create a `.env` in the project root:

```env
# Mock mode (no model needed)
ENABLE_LLM=false

# — OR — OpenAI-compatible API
ENABLE_LLM=true
LLM_ENGINE=http
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

# — OR — Local GGUF model
ENABLE_LLM=true
LLM_ENGINE=local
LLM_MODEL_PATH=C:/path/to/model.gguf
LLM_CTX_SIZE=2048
LLM_MAX_TOKENS=1024
LLM_TEMPERATURE=0.7
```

## Development

Start backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend (port 8000)
python -m backend.app

# Terminal 2 — Tauri + Vite (port 1420)
npm run tauri dev
```

Browser-only (no Tauri shell):

```bash
python -m backend.app   # Terminal 1
npm run dev              # Terminal 2 → http://localhost:1420
```

## Production Build

```bash
python -m PyInstaller --onefile --name crowforge-backend --add-data "backend/schema.sql;backend" backend/app.py
copy dist\crowforge-backend.exe src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`

## Project Structure

```
backend/
  app.py              Routes and AI orchestration
  ai_engine.py        AI engines (Mock, HTTP, Local GGUF)
  ai/engine_manager.py  Runtime engine switching
  storage.py          SQLite data layer (raw SQL)
  models.py           Pydantic models
  schema.sql          Database DDL
src/
  App.tsx             Shell, routing, sidebar
  pages/
    ChatPage.tsx      Conversational AI (multi-mode)
    DocumentsPage.tsx AI-assisted document editor (TipTap)
    SheetsPage.tsx    Spreadsheet with formulas, formatting, AI fill
    BenchmarkPage.tsx Model comparison tool
  components/         Shared UI (shadcn/ui, AIControlPanel)
  hooks/useSSE.ts     SSE streaming hook
src-tauri/
  src/lib.rs          Tauri setup, sidecar spawn
```

## License

MIT
