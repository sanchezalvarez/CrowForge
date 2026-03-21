# Architecture and Project Structure

This document provides an overview of the technical architecture and the file structure of the CrowForge project.

---

## Project Structure

```
backend/
  app.py              FastAPI routes and AI orchestration
  ai_engine.py        AI engine implementations (Mock, HTTP, Local GGUF)
  ai/
    engine_manager.py Runtime engine registry and hot-swap
    agent_loop.py     ReAct agent loop (reasoning + tool calling)
    agent_tools.py    Tool handlers bound to sheet/document repos
    tool_registry.py  Tool registration and dispatch
  storage.py          SQLite data layer (raw SQL, no ORM)
  models.py           Pydantic request/response models
  formula.py          Spreadsheet formula evaluator
  schema.sql          Database schema

src/
  App.tsx             App shell, sidebar navigation, shared state
  pages/
    ChatPage.tsx      Conversational AI with session history
    DocumentsPage.tsx Rich text editor with AI writing tools
    SheetsPage.tsx    Spreadsheet with AI fill and export
    BenchmarkPage.tsx Multi-model comparison tool
    SettingsPage.tsx  AI config and model gallery
    OnboardingPage.tsx First-run setup wizard
  components/
    AIControlPanel.tsx Right-side engine/model/tuning panel
    SplashScreen.tsx  Loading screen during backend startup
    ui/               shadcn/ui primitives
  hooks/
    useSSE.ts         EventSource wrapper for SSE token streaming
    useToast.ts       Toast notification hook
  lib/
    fileService.ts    Client-side export (PDF, DOCX, XLSX, CSV)

src-tauri/
  src/lib.rs          Tauri setup and sidecar spawn
```

---

## Architecture

```
Tauri (Rust shell)
  └── spawns Python sidecar on startup
        ├── Frontend  React 19 / Vite — port 1420
        │     └── axios (REST) + EventSource (SSE streaming)
        └── Backend   FastAPI / uvicorn — port 8000
              ├── SQLite  crowforge.db  (raw sqlite3, no ORM)
              └── AI engines: Mock · HTTP/OpenAI-compatible · Local GGUF
```

All frontend ↔ backend communication is HTTP/SSE — no Tauri IPC is used for app logic.
