# CrowForge: Local-First AI Workspace

CrowForge is a comprehensive, local-first AI workspace featuring Chat, Documents, Sheets, and Benchmarking capabilities. It is designed to run entirely on the user's machine, providing privacy and offline functionality.

## Project Overview

- **Purpose:** A privacy-focused, "bring-your-own-model" AI productivity suite.
- **Architecture:** 3-layer stack: Tauri v2 (Rust shell) → React/TypeScript frontend → Python FastAPI backend.
- **Backend Integration:** The Python backend runs as a Tauri sidecar. Frontend communication occurs via HTTP and SSE (for streaming tokens).
- **Data Privacy:** Uses a local SQLite database (`crowforge.db`) stored in the user's application data directory. No cloud telemetry or external API calls unless explicitly configured by the user (e.g., via OpenAI-compatible endpoints).

## Tech Stack

### Frontend
- **Framework:** React 19, Vite 7, TypeScript.
- **Styling:** Tailwind CSS v4, shadcn/ui (Radix UI primitives).
- **Icons:** Lucide React.
- **Editor:** Tiptap (Rich text) with Markdown support.
- **Graphs/Charts:** Recharts, @xyflow/react (for Canvas).
- **Networking:** Axios for REST, native `EventSource` for SSE streaming.

### Backend
- **Framework:** Python 3.10+, FastAPI, Uvicorn.
- **Database:** SQLite (accessed via raw `sqlite3` in `storage.py`).
- **AI Engines:**
    - `MockAIEngine`: For testing without LLM calls.
    - `HTTPAIEngine`: For OpenAI-compatible APIs.
    - `LocalLLAMAEngine`: For running GGUF models locally via `llama-cpp-python`.
    - `GeminiAIEngine`: For Google Gemini API integration.
- **Key Modules:**
    - `ai/agent_loop.py`: ReAct-style agentic logic for workspace interactions.
    - `ai/rag_engine.py`: Local document indexing and vector-like search.
    - `ai/plugin_loader.py`: Dynamic loading of Python-based tools and extensions.

### Desktop Shell
- **Framework:** Tauri v2.
- **Sidecar:** Spawns the `crowforge-backend` binary on startup.
- **Plugin:** `tauri-plugin-shell` for process management.

## Building and Running

### Development Mode
To run the project in development with live logs:
1.  **Backend:** `python -m backend.app` (Starts FastAPI on `http://127.0.0.1:8000`).
2.  **Frontend:** `npm run tauri dev` (Starts Tauri window + Vite dev server on port 1420).

### Production Build
1.  **Freeze Backend:** 
    ```bash
    python -m PyInstaller --onefile --name crowforge-backend --add-data "backend/schema.sql;backend" backend/app.py
    ```
2.  **Deploy Sidecar:** Copy `dist/crowforge-backend.exe` to `src-tauri/bin/crowforge-backend-x86_64-pc-windows-msvc.exe`.
3.  **Build App:** `npm run tauri build`.

## Project Structure

- `src/`: React frontend (Pages, Components, Hooks).
- `backend/`: Python FastAPI source, data models, and AI engine implementations.
- `src-tauri/`: Tauri configuration, Rust source, and sidecar binaries.
- `docs/`: Technical documentation (Architecture, Installation).
- `plugins/`: User-defined Python plugins for extending AI capabilities.
- `public/`: Static assets and base JSON data.

## Development Conventions

- **Local-First:** Always prioritize local storage (SQLite) and local LLM execution.
- **SSE for AI:** All AI generation must be streamed via Server-Sent Events (SSE) for a responsive UI.
- **No ORM:** Use raw SQL queries in `backend/storage.py` for maximum control and transparency.
- **Sidecar Protocol:** Frontend and Backend communicate solely via HTTP/SSE. Do not use Tauri IPC for application logic to keep the backend portable.
- **Prompting:** Use `.replace()` for prompt template injection to avoid conflicts with brace-heavy content (like code).
- **Agent Safety:** The AI Agent must use `list_sheets` and `list_documents` tools before performing writes to ensure ID accuracy.

## Key Files
- `CLAUDE.md`: Detailed dev guide and architecture overview for AI assistants.
- `backend/app.py`: Main API entry point and route definitions.
- `backend/schema.sql`: Database structure and initial data.
- `src/App.tsx`: Frontend routing and main application layout.
- `src-tauri/tauri.conf.json`: Tauri and sidecar configuration.
