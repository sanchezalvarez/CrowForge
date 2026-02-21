# CrowForge Project `GEMINI.md`

This file provides instructional context for working on the CrowForge project.

## Project Overview

CrowForge is a local-first AI workspace with **Chat**, **Documents**, and **Sheets**. It runs entirely on your machine, with no cloud services required. You can connect any local GGUF model or OpenAI-compatible API.

The project is built with:

*   **Frontend**: React 19, TypeScript, Vite, and Tailwind CSS.
*   **Backend**: Python, FastAPI, and SQLite.
*   **Desktop App**: Tauri v2 (Rust).

## Development Setup

### Prerequisites

*   Node.js 18+
*   Python 3.10+
*   Rust 1.70+ (for Tauri builds)

### Installation

1.  **Frontend**:
    ```bash
    npm install
    ```

2.  **Backend**:
    ```bash
    pip install fastapi uvicorn httpx python-dotenv sse-starlette pydantic
    ```

3.  **Local GGUF Model Inference (Optional)**:
    ```bash
    pip install llama-cpp-python
    ```

### Environment Variables

Create a `.env` file in the project root. You can use one of the following configurations:

*   **Mock Mode (no model needed)**:
    ```env
    ENABLE_LLM=false
    ```

*   **OpenAI-compatible API**:
    ```env
    ENABLE_LLM=true
    LLM_ENGINE=http
    LLM_BASE_URL=https://api.openai.com/v1
    LLM_API_KEY=sk-...
    LLM_MODEL=gpt-4o-mini
    ```

*   **Local GGUF Model**:
    ```env
    ENABLE_LLM=true
    LLM_ENGINE=local
    LLM_MODEL_PATH=C:/path/to/model.gguf
    LLM_CTX_SIZE=2048
    LLM_MAX_TOKENS=1024
    LLM_TEMPERATURE=0.7
    ```

## Running the Application

### Development Mode

Start the backend and frontend in separate terminals:

1.  **Terminal 1 (Backend)**:
    ```bash
    python -m backend.app
    ```
    The backend will run on `http://127.0.0.1:8000`.

2.  **Terminal 2 (Frontend)**:
    ```bash
    npm run tauri dev
    ```
    This will start the Tauri development server and open the application window.

### Browser-Only Mode

If you want to run the application in a browser without the Tauri shell:

1.  **Terminal 1 (Backend)**:
    ```bash
    python -m backend.app
    ```

2.  **Terminal 2 (Frontend)**:
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:1420`.

## Building for Production

To create a production build of the application:

1.  **Build the Backend**:
    ```bash
    python -m PyInstaller --onefile --name crowforge-backend --add-data "backend/schema.sql;backend" backend/app.py
    ```

2.  **Copy the Backend Executable**:
    ```bash
    copy dist\crowforge-backend.exe src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe
    ```

3.  **Build the Frontend and Tauri App**:
    ```bash
    npm run tauri build
    ```
    The final bundled application will be located in the `src-tauri/target/release/bundle/` directory.

## Project Structure

*   `backend/`: The Python FastAPI backend.
    *   `app.py`: The main application file with all the routes.
    *   `ai_engine.py`: Contains the different AI engines (Mock, HTTP, Local GGUF).
    *   `storage.py`: The data layer for interacting with the SQLite database.
*   `src/`: The React frontend.
    *   `pages/`: The main pages of the application (Chat, Documents, Sheets).
    *   `components/`: Shared UI components.
    *   `hooks/`: Custom React hooks.
*   `src-tauri/`: The Tauri application configuration and Rust code.
    *   `tauri.conf.json`: The main configuration file for the Tauri application.
    *   `src/main.rs`: The main entry point for the Rust application.
