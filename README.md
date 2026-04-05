<div align="center">
  <img src="src/assets/crowforge_ico.png" alt="CrowForge" width="120">
</div>

# CrowForge

> **Alpha** — actively developed and tested. Expect rough edges and breaking changes.

**Local-first AI workspace** (Gemma 4, Qwen3.5, OpenAI, Gemini) — Chat, Documents, Sheets, Canvas, Project Management, Agent, and more in a single desktop app.

**Stop Managing. Start Creating.**

Developed by indie game developers from **rembrosoft.com**. We got tired of juggling spreadsheets, documents, Azure services, and Miro boards — so we built CrowForge: everything in one place, running on your machine with local AI support.

## ✨ What Makes CrowForge Different?

-   **All-in-One Workspace:** Chat, Documents, Spreadsheets, Canvas, Scrum PM, Issue Tracker, AI Agent, Benchmarking — one app.
-   **Documents & Tasks in Symbiosis:** Your GDD is a living organism. Turn an idea into an actionable task with a single click.
-   **Scrum Project Management:** Kanban boards, sprint planning, backlog, roadmaps, AI-powered standups.
-   **AI Agent with Tools:** ReAct agent with Knowledge Base (RAG), filesystem access, and live model switching.
-   **Blazing Fast:** No loading spinners. As fast as your code.
-   **Docker Multi-User Server:** Run CrowForge backend as a Docker container for team use — tested on Synology NAS.
-   **Risograph Design System:** Unique visual identity — offset shadows, grain textures, registration marks, tactile buttons. Not your typical generic UI.
-   **Guided Onboarding:** First-run setup wizard walks you through AI engine config, so you're productive in minutes.
-   **Indie-First:** Built for solo devs and small teams. No corporate overhead.

## 💰 Transparent & Free

-   **For Individuals:** Forever free. All features unlocked.
-   **For the Community:** No tracking, no data selling, no BS.

## 🗺️ Roadmap

-   **CrowSync:** SVN-inspired collaboration — file locking, binary-friendly versioning, team sync without Git complexity.
-   **Plugin Ecosystem:** Community-built agent tools and integrations.

---

## 🧩 Modules

| Module | Description |
|--------|-------------|
| **Chat** | Multi-session AI conversations with personas, PDF uploads, document awareness |
| **Documents** | Rich text editor (TipTap) with inline AI — rewrite, summarize, expand, fix grammar |
| **Sheets** | Spreadsheets with formulas, AI Fill, Formula Assistant, Range Operations, Generate Rows |
| **Canvas** | Infinite node-based canvas with AI nodes, auto-layout, execution chains |
| **Projects** | Scrum PM — Kanban, Backlog (tree hierarchy), Sprint view, Roadmap |
| **Issue Tracker** | Cross-project bug tracking with severity, bulk actions, screenshots, filters |
| **Agent** | ReAct agent with tool use, Knowledge Base (RAG), Working Directory, AI Controls panel |
| **Benchmark** | Side-by-side model comparison with latency and quality metrics |
| **Tools** | Utility widgets — world clock, RSS news reader, and more |
| **Dashboard** | Activity overview, quick actions, AI news digest from RSS |
| **Settings** | AI engine config, GGUF model gallery (Qwen3.5, Gemma 4, Llama 4, Mistral Small 3.1, DeepSeek-R1, etc.), team, workflows, feeds |

---

## 🛠️ Tech Stack

-   **Desktop:** [Tauri v2](https://tauri.app/) (Rust) | **Frontend:** React 19, TypeScript, Vite 7, Tailwind v4
-   **Backend:** Python 3.10+, FastAPI, SQLite | **Deploy:** Desktop (sidecar) or Docker (multi-user)
-   **AI:** llama-cpp-python (local GGUF), OpenAI-compatible APIs, Google Gemini

---

## 💻 Getting Started

### Prerequisites
-   [Node.js](https://nodejs.org/) (v18+), [Python](https://www.python.org/) (3.10+), [Rust](https://www.rust-lang.org/) (for Tauri builds)

### Dev Setup
```bash
git clone https://github.com/sanchezalvarez/CrowForge.git
cd crowforge
npm install
pip install -r requirements.txt

# Run (two terminals):
python -m backend.app       # Backend on :8000
npm run tauri dev            # Tauri + Vite on :1420
```

### Production Build
1.  Freeze backend with PyInstaller → place binary in `src-tauri/bin/`
2.  `npm run tauri build`

### Docker (Multi-User Server)
```bash
docker compose up -d        # Backend accessible on :8000
```

---

## 🛡️ Privacy

-   **No Cloud:** We don't have servers to store your data.
-   **No Telemetry:** We don't track how you use the app.
-   **Bring Your Own Model:** Local GGUF files for 100% offline air-gapped AI.

---

## 📜 License

**Business Source License 1.1 (BSL 1.1)** — see [LICENSE](LICENSE) for details.

-   **Use:** Free for any purpose, including selling games you make with it.
-   **Prohibited:** Selling, sublicensing, or redistributing CrowForge itself.
-   **Converts to Apache 2.0** on January 1st, 2029.

**Made by Lubomir Timko** ([sanchez.sk](https://www.sanchez.sk))
