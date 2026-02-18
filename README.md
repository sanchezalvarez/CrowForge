# CrowForge

**Local-first AI Workspace with Chat, Documents, and Sheets.**

A desktop app (Windows) that runs entirely on your machine — no cloud services required. Connect any local LLM or OpenAI-compatible API and work with AI through multiple interfaces.

## Roadmap / TODO

- [ ] **Chat** (core) — Conversational AI interface
- [ ] **Documents** — AI-assisted editor for long-form content
- [ ] **Sheets** — AI-assisted tables and structured data
- [ ] **Images** — AI image generation (later)

## Legacy: Marketing Campaign Generator

The current UI is a marketing campaign generator (brief → concepts). This will be retained as a legacy feature while the workspace modules above are built out. See `src/pages/MarketingGeneratorPage.tsx` and `src/pages/BenchmarkPage.tsx`.

## How It Works (Current / Legacy)

Enter a client brief (brand name, industry, goals) and CrowForge generates creative campaign concepts using a local LLM or any OpenAI-compatible API. Concepts stream in via SSE so you see results as they're generated. A built-in benchmark tool lets you compare models side-by-side.

## Architecture

```
Tauri v2 (Rust) — desktop shell, spawns backend as sidecar
  ├── Frontend — React 19 / TypeScript / Vite 7 / Tailwind v4
  └── Backend  — Python FastAPI / SQLite / llama-cpp-python
```

All frontend-backend communication is HTTP/SSE on `localhost:8000`.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 18+ | Frontend build tooling |
| **npm** | 9+ | Comes with Node.js |
| **Python** | 3.10+ | Backend runtime |
| **Rust** | 1.70+ | Tauri build (only needed for production builds) |

### Optional (for local LLM inference)

- A GGUF model file (e.g. `ministral-3b-instruct-q4_k_m.gguf`)
- C++ build tools if building `llama-cpp-python` from source (Visual Studio Build Tools on Windows)

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/your-username/crowforge.git
cd crowforge
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install Python dependencies

```bash
pip install fastapi uvicorn httpx python-dotenv sse-starlette pydantic
```

For local GGUF model support, also install:

```bash
pip install llama-cpp-python
```

### 4. Configure environment

Create a `.env` file in the project root:

**Mock mode (no LLM needed — good for testing):**
```env
ENABLE_LLM=false
```

**Local GGUF model:**
```env
ENABLE_LLM=true
LLM_ENGINE=local
LLM_MODEL_PATH=C:/path/to/your-model.gguf
LLM_CTX_SIZE=2048
LLM_MAX_TOKENS=1024
LLM_TEMPERATURE=0.3
```

**OpenAI-compatible API:**
```env
ENABLE_LLM=true
LLM_ENGINE=http
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4o-mini
```

## Running in Development

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend (port 8000)
python -m backend.app

# Terminal 2 — Frontend + Tauri desktop window
npm run tauri dev
```

Or run without the Tauri shell (browser only at http://localhost:1420):

```bash
# Terminal 1
python -m backend.app

# Terminal 2
npm run dev
```

## Production Build

```bash
# 1. Bundle the Python backend into a single executable
python -m PyInstaller --onefile --name crowforge-backend --add-data "backend/schema.sql;backend" backend/app.py

# 2. Place the sidecar binary where Tauri expects it
copy dist\crowforge-backend.exe src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe

# 3. Build the Tauri installer
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`.

## All Dependencies

### Python (Backend)

| Package | Purpose |
|---------|---------|
| `fastapi` | REST API framework |
| `uvicorn` | ASGI server |
| `httpx` | HTTP client for OpenAI-compatible APIs |
| `python-dotenv` | Load `.env` configuration |
| `sse-starlette` | Server-Sent Events streaming |
| `pydantic` | Data models and validation |
| `llama-cpp-python` | *(optional)* Local GGUF model inference |
| `sqlite3` | Database *(Python stdlib, no install needed)* |
| `PyInstaller` | *(build only)* Bundle backend into exe |

### Node.js (Frontend)

| Package | Purpose |
|---------|---------|
| `react` 19 / `react-dom` 19 | UI framework |
| `axios` | HTTP client |
| `tailwindcss` 4 | Utility-first CSS |
| `@radix-ui/react-dialog` | Modal dialogs |
| `@radix-ui/react-label` | Accessible form labels |
| `@radix-ui/react-scroll-area` | Custom scrollbars |
| `@radix-ui/react-select` | Dropdown select |
| `@radix-ui/react-separator` | Visual separator |
| `@radix-ui/react-slider` | Range slider |
| `@radix-ui/react-slot` | Component composition |
| `@radix-ui/react-tabs` | Tab navigation |
| `lucide-react` | Icons |
| `clsx` / `tailwind-merge` | Class name utilities |
| `tailwindcss-animate` | Animation utilities |
| `@tauri-apps/api` | Tauri runtime bindings |
| `@tauri-apps/plugin-opener` | Open URLs/files with OS defaults |
| `vite` 7 | Build tool / dev server |
| `typescript` 5.8 | Type checking |
| `@vitejs/plugin-react` | React Fast Refresh for Vite |
| `@tauri-apps/cli` | Tauri CLI for build/dev |

### Rust (Tauri Shell)

| Crate | Purpose |
|-------|---------|
| `tauri` 2 | Desktop application framework |
| `tauri-plugin-shell` 2 | Spawn backend sidecar process |
| `tauri-plugin-opener` 2 | Open URLs/files with system defaults |
| `serde` / `serde_json` | Serialization |

## Project Structure

```
├── backend/
│   ├── app.py                 # FastAPI routes and AI orchestration
│   ├── ai_engine.py           # AI engine implementations (Mock, HTTP, Local)
│   ├── ai/engine_manager.py   # Runtime engine switching
│   ├── models.py              # Pydantic data models
│   ├── storage.py             # SQLite data layer (raw SQL)
│   ├── prompts.py             # LLM prompt templates
│   └── schema.sql             # Database DDL
├── src/
│   ├── App.tsx                # Main application UI
│   ├── pages/
│   │   └── BenchmarkPage.tsx  # Model comparison tool
│   ├── hooks/
│   │   └── useSSE.ts          # SSE streaming hook
│   └── components/ui/         # shadcn/ui components
├── src-tauri/
│   ├── src/lib.rs             # Tauri setup, sidecar spawn
│   └── Cargo.toml             # Rust dependencies
├── .env                       # LLM configuration
└── package.json               # Node.js dependencies
```

## License

MIT
