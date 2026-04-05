<div align="center">
  <img src="src/assets/crowforge_ico.png" alt="CrowForge" width="120">
</div>

# CrowForge

> **Alpha** — actively developed and tested. Expect rough edges and breaking changes.

**Stop Managing. Start Creating.**

Developed by indie game developers from **rembrosoft.com**, CrowForge is born from the need for a unified, local-first AI workspace. We understand the struggle of juggling disparate tools like spreadsheets, documents, Azure services, and Miro boards. That's why we're building CrowForge: a powerful, integrated platform designed to bring everything together, running entirely on your machine with robust local AI support.

We're focused on providing a clean, efficient, and inspiring environment for creators with no annoying notifications, no unsolicited emails, and absolutely no complicated, bloated features that users only utilize 20% of.

## 🚫 No More Bloatware

-   **Effortless Task Creation:** Create tasks in seconds, not minutes. No 50-field forms.
-   **Intuitive UI:** Everything you need is visible. No hidden menus. If it's not there, you probably don't need it.
-   **Inspiring Design:** Built to inspire your creativity, not depress you with endless tables.

## ✨ What Makes CrowForge Different?

-   **All-in-One Workspace:** Chat, Documents, Spreadsheets, Canvas, Project Management, Issue Tracker, AI Agent, and Benchmarking — all in a single app.
-   **Documents & Tasks in Symbiosis:** Your Game Design Document (GDD) is not a static file. It's a living organism. Turn an idea into an actionable task with a single click.
-   **Scrum Project Management:** Full Kanban boards, sprint planning, backlog management, roadmaps, and AI-powered standups — built for how teams actually work.
-   **Blazing Fast:** As fast as your code. Experience an application without frustrating loading spinners.
-   **Indie-First Philosophy:** Built for solo developers and small teams. CrowForge won't impose corporate processes or overhead you don't need.

## 💰 Transparent & Free

-   **For Individuals:** Forever free. All features unlocked.
-   **For the Community:** No tracking, no data selling, no BS.
-   **For the Love of Games:** Built for creators who love making games.

## 🗺️ Roadmap

-   **CrowSync:** SVN-inspired collaboration system built for game development — simple file locking, binary-friendly versioning, and team sync without Git complexity.
-   **Multi-User Collaboration:** Real-time collaboration with shared projects and live cursors.
-   **Plugin Ecosystem:** Extend CrowForge with community-built agent tools and integrations.

---

## 🧩 Modules

| Module | Description |
|--------|-------------|
| **Chat** | Multi-session AI conversations with context personas, PDF uploads, and document awareness |
| **Documents** | Rich text editor (TipTap) with inline AI actions — rewrite, summarize, expand, fix grammar |
| **Sheets** | Spreadsheets with formulas, AI Fill, Formula Assistant, Range Operations, and Generate Rows |
| **Canvas** | Infinite node-based canvas with AI nodes, auto-layout, and execution chains |
| **Projects** | Scrum project management — Kanban board, Backlog (tree hierarchy), Sprint view, Roadmap |
| **Issue Tracker** | Cross-project bug tracking with severity levels, bulk actions, screenshots, and filters |
| **Agent** | ReAct agent with tool use, Knowledge Base (RAG), Working Directory for filesystem access, and live AI Controls panel for engine/model switching |
| **Benchmark** | Side-by-side model comparison with latency and quality metrics |
| **Dashboard** | Activity overview, quick actions, AI news digest from RSS feeds |
| **Settings** | AI engine config, GGUF model gallery (Qwen3.5, Gemma 4, Llama 4, Mistral Small 3.1, DeepSeek-R1, and more), team members, custom workflows, news feeds |

---

## 🛠️ Technical Stack

-   **Desktop Shell:** [Tauri v2](https://tauri.app/) (Rust)
-   **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS v4
-   **Backend (Sidecar):** Python 3.10+, FastAPI, Uvicorn
-   **Database:** SQLite
-   **AI Engines:**
    -   **Local:** llama-cpp-python (GGUF support)
    -   **Cloud (Optional):** OpenAI-compatible APIs, Google Gemini

---

## 💻 Installation & Development

### Prerequisites
-   [Node.js](https://nodejs.org/) (v18+)
-   [Python](https://www.python.org/) (3.10+)
-   [Rust](https://www.rust-lang.org/) (for Tauri builds)

### Setup
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/crowforge.git
    cd crowforge
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

3.  **Install Backend Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run in Development:**
    -   Start the backend: `python -m backend.app`
    -   Start the frontend: `npm run tauri dev`

### Building for Production
CrowForge uses a sidecar architecture. You must freeze the Python backend before building the Tauri app:
1.  **Freeze Backend:** Use PyInstaller to create a standalone binary.
2.  **Move to Sidecar:** Place the binary in `src-tauri/bin/`.
3.  **Build:** `npm run tauri build`.

---

## 🛡️ Privacy & Security

CrowForge is built on the principle of **User Sovereignty**.
-   **No Cloud:** We don't have servers to store your data.
-   **No Telemetry:** We don't track how you use the app.
-   **Bring Your Own Model:** Use local GGUF files for 100% offline air-gapped AI.

---

## 📜 License

**Business Source License 1.1 (BSL 1.1)** — see [LICENSE](LICENSE) for details.

-   **Development & Commercial Use:** You are free to use CrowForge for any purpose, including creating and selling video games.
-   **Prohibited:** You may not sell, sublicense, or redistribute CrowForge itself as a standalone product, development tool, or SaaS.
-   **Open Source Conversion:** This software will automatically convert to the **Apache License 2.0** on **January 1st, 2029**.

**Made by Lubomir Timko** ([sanchez.sk](https://www.sanchez.sk))
