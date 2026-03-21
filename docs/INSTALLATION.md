# Installation and Setup Guide

This guide covers the prerequisites and steps needed to set up CrowForge for development or build a production installer.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.10+ |
| Rust + Cargo | 1.70+ (Tauri desktop build only) |

---

## Setup

```bash
# 1. Frontend dependencies
npm install

# 2. Backend dependencies
pip install -r requirements.txt

# 3. (Optional) Local GGUF inference
pip install llama-cpp-python
```

### Environment

Create a `.env` file in the project root. The app defaults to mock mode — no model required:

```env
# ── Mock mode (default, no model required) ─────────────────────────
ENABLE_LLM=false

# ── OpenAI-compatible API ───────────────────────────────────────────
ENABLE_LLM=true
LLM_ENGINE=http
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

# ── Local GGUF model ────────────────────────────────────────────────
ENABLE_LLM=true
LLM_ENGINE=local
LLM_MODEL_PATH=C:/models/my-model.gguf
LLM_CTX_SIZE=2048
LLM_MAX_TOKENS=1024
LLM_TEMPERATURE=0.7

# ── Optional tuning ─────────────────────────────────────────────────
MODEL_IDLE_TIMEOUT=600       # seconds before local model auto-unloads (default 600)
LLM_GENERATION_TIMEOUT=120   # max seconds per generation (default 120)
```

> All of the above can also be configured through the **Settings** page inside the app — no file editing required.

---

## Running in Development

```bash
# Terminal 1 — FastAPI backend (port 8000)
python -m backend.app

# Terminal 2 — Tauri + Vite (port 1420)
npm run tauri dev
```

**Browser-only mode** (no Tauri shell):

```bash
python -m backend.app   # Terminal 1
npm run dev             # Terminal 2 → http://localhost:1420
```

---

## Production Build

### Automated (recommended)

```powershell
.\build.ps1
```

This script runs all three steps in order and stops on any error.

### Manual steps

#### 1. Bundle the Python backend

```bash
python -m PyInstaller crowforge-backend.spec --noconfirm
```

#### 2. Copy the sidecar binary

```bash
copy dist\crowforge-backend.exe src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe
```

#### 3. Build the Tauri installer

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/` — MSI and NSIS installers.

> The PyInstaller spec (`crowforge-backend.spec`) bundles all required DLLs automatically — llama-cpp, numpy, Pillow, pdfplumber, psutil and all other backend dependencies are collected and embedded in the executable. No separate DLL installation is needed on the target machine.
