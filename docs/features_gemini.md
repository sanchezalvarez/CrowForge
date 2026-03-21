# Gemini's Feature Suggestions for CrowForge

Based on the current architecture (Local-first, Python/FastAPI, React/Tauri), here are suggested "Killer Features" to elevate the project.

---

## 1. 🧠 "Second Brain" / Global Context (Local RAG)
**The Concept:** Transform the app from a simple editor into a true Knowledge Base Assistant.
*   **Current State:** Context is limited to single open documents.
*   **Killer Feature:** **Full Folder Indexing.**
    *   User selects a folder (e.g., "My Projects").
    *   CrowForge creates a local vector index in the background using a lightweight embedding model.
    *   **Usage:** User asks chat: *"What was the marketing budget decision in Q1?"* -> App searches across PDFs, DOCX, and TXT files in that folder to construct the answer.
*   **Tech Stack:** `sentence-transformers` (embeddings), `FAISS` or `sqlite-vec` (vector store).

## 2. 🌐 Agent with Web Access
**The Concept:** Break the "offline" barrier without breaking privacy.
*   **Current State:** The Agent can only see internal files.
*   **Killer Feature:** **Web Search Tool.**
    *   Give the Agent a `web_search` and `visit_page` tool.
    *   **Usage:** *"Create a table comparing iPhone 15 vs Samsung S24 specs and fill in current prices."* -> Agent searches web -> Scrapes data -> Writes to Sheet.
*   **Tech Stack:** `duckduckgo-search` (no API key needed) or `Tavily` (robust), plus `beautifulsoup4` for content extraction.

## 3. 🎙️ Full Voice Mode
**The Concept:** Jarvis-like interaction with zero latency.
*   **Current State:** Text-only interaction.
*   **Killer Feature:** **Local Speech-to-Text & Text-to-Speech.**
    *   **Usage:** Dictate documents or talk to the agent while walking around the room.
*   **Tech Stack:** `Whisper.cpp` or `faster-whisper` (Python) for STT. `Coqui TTS` or system TTS for output.

## 4. ♾️ Infinite Canvas
**The Concept:** Visual workflow builder.
*   **Current State:** Isolated tabs for Chat, Sheets, Docs.
*   **Killer Feature:** **Whiteboard Interface.**
    *   Drag a Chat window next to a Sheet. Draw a line between them.
    *   **Usage:** Visually map out data flows or brainstorm complex topics with mixed media on a zoomable canvas.

## 5. 🔌 Plugin System
**The Concept:** Community-driven expansion.
*   **Current State:** Hardcoded tools in `backend/ai/`.
*   **Killer Feature:** **Python Plugin API.**
    *   Allow users to drop `.py` files into a `plugins/` folder to add new Agent Tools (e.g., Home Assistant control, Calendar integration).

---

## Low Hanging Fruit (Quick Wins)

1.  **Dashboard / Home Screen:**
    *   A starting hub showing "Recent Files", "Quick Actions", and System Status instead of a blank editor.
2.  **Visual Data in Sheets:**
    *   Simple chart generation (Bar/Line/Pie) directly from Sheet data.
3.  **Local Model Optimization:**
    *   Support for `GGUF` quantization directly in the UI (e.g., "Fast" vs "High Quality").
