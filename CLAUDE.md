# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CrowForge** is a local-first Windows desktop app that generates marketing campaign concepts from a client brief using AI. Three-layer architecture: Tauri v2 (Rust shell) → React/TypeScript frontend → Python FastAPI backend. All communication between frontend and backend is via HTTP/SSE (no Tauri IPC for app logic).

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
  │     └── axios for REST, EventSource for SSE streaming
  └── Backend (FastAPI / uvicorn) — port 8000
        ├── SQLite via raw sqlite3 (campaigns.db)
        └── AI engines: MockAIEngine, HTTPAIEngine, LocalLLAMAEngine
```

### Frontend
- **Pages**: `src/pages/MarketingGeneratorPage.tsx` (main campaign UI), `src/pages/BenchmarkPage.tsx` (model comparison tool)
- **App shell**: `src/App.tsx` contains routing/layout and shared state
- **Styling**: Tailwind CSS v4 with shadcn/ui design tokens (CSS variables in `index.css`), Radix UI primitives, Lucide icons
- **SSE hook**: `src/hooks/useSSE.ts` wraps native EventSource for AI token streaming
- **Backend URL hardcoded**: `http://127.0.0.1:8000` as `API_BASE` constant

### Backend
- **`app.py`**: All FastAPI routes and AI orchestration (clients, campaigns, generate via SSE, benchmark, export)
- **`ai_engine.py`**: Abstract `AIEngine` base class with three implementations (Mock, HTTP/OpenAI-compatible, Local GGUF via llama-cpp-python)
- **`ai/engine_manager.py`**: `AIEngineManager` — runtime engine switching, registers/unregisters engines dynamically
- **`storage.py`**: Raw SQL data layer — `DatabaseManager`, `ClientRepository`, `CampaignRepository`, `AppRepository`, `PromptTemplateRepository`, `ConceptRevisionRepository`, `GenerationVersionRepository`, `BenchmarkRepository`
- **`models.py`**: Pydantic models (Client, Campaign, BrandProfile, CampaignStatus, PromptTemplate, BenchmarkRun, BenchmarkRequest, etc.)
- **`prompts.py`**: System prompt and user prompt template strings
- **`schema.sql`**: SQLite DDL (clients, brand_profiles, campaigns, campaign_ideas, channel_contents, settings, prompt_templates, concept_revisions, generation_versions, benchmark_runs)

### Tauri
- `src-tauri/src/lib.rs`: Spawns `crowforge-backend` sidecar via `tauri-plugin-shell` on setup
- Sidecar binary path: `src-tauri/bin/crowforge-backend-x86_64-pc-windows-msvc.exe`
- No custom Tauri commands are used (the `greet` command is unused template code)

## Key Conventions

- **Local-first**: No cloud services or external APIs (except optionally configured LLM endpoint)
- **Raw SQL only**: No ORMs — uses `sqlite3` directly in `storage.py`
- **SSE streaming protocol**: Server yields `{"data": chunk}` per token, `{"data": "[DONE]"}` on completion, `{"data": "[ERROR] ..."}` on failure
- **Prompt construction**: Uses `.replace()` not `.format()` to safely handle user content containing braces
- **JSON extraction**: Dual-pass on backend and frontend — finds first `[`/`{` and last `]`/`}` as bounds, strips markdown fences, handles wrapped arrays under keys like `concepts`, `ideas`, `items`
- **Session persistence**: Settings table stores last_client_id, last_campaign_id, onboarding_completed — always restore on startup
- **Benchmark**: POST `/benchmark/run` runs generation sequentially across engines; per-engine failures are recorded but don't abort the batch

## Feature Flags (.env)

- `ENABLE_LLM` (`false`): When false, uses `MockAIEngine` with hardcoded responses
- `LLM_ENGINE` (`http`): `http` for OpenAI-compatible API, `local` for GGUF via llama-cpp-python
- `LLM_API_KEY`, `LLM_BASE_URL` (`https://api.openai.com/v1`), `LLM_MODEL` (`gpt-4o-mini`): HTTP engine config
- `LLM_MODEL_PATH`, `LLM_CTX_SIZE` (`2048`), `LLM_MAX_TOKENS` (`1024`), `LLM_TEMPERATURE` (`0.7`): Local engine config
