import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import os
import json
import httpx
from contextlib import asynccontextmanager
from typing import List, Optional
from time import time
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

def get_app_data_dir() -> str:
    """Return a user-writable data directory for CrowForge (created if absent)."""
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    app_dir = os.path.join(base, "CrowForge")
    os.makedirs(app_dir, exist_ok=True)
    return app_dir

# Load .env from app-data dir first, then fall back to CWD (dev)
load_dotenv(os.path.join(get_app_data_dir(), ".env"))
load_dotenv()

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.abspath(relative_path)

from backend.models import PromptTemplate, BenchmarkRun, BenchmarkRequest, ChatSession, ChatMessage, ChatMessageRequest, Document, DocumentCreate, DocumentUpdate, DocumentAIRequest, Sheet, SheetCreate, SheetColumn, SheetAddColumn, SheetUpdateCell, SheetDeleteRow, SheetDeleteColumn, SheetAICellRequest, SheetAIBatchRequest
from backend.storage import DatabaseManager, AppRepository, PromptTemplateRepository, BenchmarkRepository, ChatSessionRepository, ChatMessageRepository, DocumentRepository, SheetRepository
from backend.ai_engine import MockAIEngine, HTTPAIEngine, LocalLLAMAEngine, AILogger
from backend.ai.engine_manager import AIEngineManager

# Timeout for a full generation pass (seconds). If the active engine
# produces no output within this window, we abort and fall back to mock.
GENERATION_TIMEOUT = float(os.getenv("LLM_GENERATION_TIMEOUT", "120"))
MODEL_IDLE_TIMEOUT = float(os.getenv("MODEL_IDLE_TIMEOUT", "600"))  # 10 minutes default


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Apply DB-saved models_dir over the env-var default on startup
    global LLM_MODELS_DIR
    saved_dir = app_repo.get_setting("ai_models_dir")
    if saved_dir:
        LLM_MODELS_DIR = saved_dir
    # Start background tasks
    idle_task = asyncio.create_task(_idle_unload_watcher())
    parent_task = asyncio.create_task(_parent_watchdog())
    yield
    idle_task.cancel()
    parent_task.cancel()


async def _parent_watchdog():
    """Exit if the parent process (Tauri) dies — prevents orphan backend on crashes."""
    import psutil
    parent_pid = os.getppid()
    while True:
        await asyncio.sleep(5)
        try:
            if not psutil.pid_exists(parent_pid):
                print("[WATCHDOG] Parent process gone — shutting down backend.")
                os._exit(0)
        except Exception:
            pass


async def _idle_unload_watcher():
    """Every 60 s, unload the local model if it has been idle > MODEL_IDLE_TIMEOUT."""
    import time as _time
    while True:
        await asyncio.sleep(60)
        try:
            local = engine_manager._engines.get("local")
            if isinstance(local, LocalLLAMAEngine) and local.is_ready and local.last_used > 0:
                idle_secs = _time.time() - local.last_used
                if idle_secs >= MODEL_IDLE_TIMEOUT:
                    local.unload()
        except Exception as e:
            print(f"[IDLE_WATCHER] Error: {e}")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseManager(os.path.join(get_app_data_dir(), "crowforge.db"))
db.initialize_schema(get_resource_path("backend/schema.sql"))

app_repo = AppRepository(db)
template_repo = PromptTemplateRepository(db)
benchmark_repo = BenchmarkRepository(db)
chat_session_repo = ChatSessionRepository(db)
chat_message_repo = ChatMessageRepository(db)
document_repo = DocumentRepository(db)
sheet_repo = SheetRepository(db)

# ── AI Engine Manager (runtime-switchable) ───────────────────────────
engine_manager = AIEngineManager()
engine_manager.register("mock", MockAIEngine())

# Try registering optional engines
ENABLE_LLM = os.getenv("ENABLE_LLM", "false").lower() == "true"
LLM_ENGINE = os.getenv("LLM_ENGINE", "http")

if ENABLE_LLM:
    if LLM_ENGINE == "local":
        local_engine = LocalLLAMAEngine()
        if local_engine.is_ready:
            engine_manager.register("local", local_engine)
        else:
            # Register anyway so model can be loaded via API later
            engine_manager.register("local", local_engine)
            print("STATUS: Local engine registered (no model loaded yet).")
    else:
        engine_manager.register("openai", HTTPAIEngine())

# ── Local model registry ─────────────────────────────────────────────
# Scan LLM_MODELS_DIR for .gguf files, or fall back to known paths.
LLM_MODELS_DIR = os.getenv("LLM_MODELS_DIR", "C:/models")

def _scan_local_models() -> list[dict]:
    """Return list of available local GGUF models with metadata."""
    models = []
    if not os.path.isdir(LLM_MODELS_DIR):
        return models
    for fname in sorted(os.listdir(LLM_MODELS_DIR)):
        if not fname.endswith(".gguf"):
            continue
        fpath = os.path.join(LLM_MODELS_DIR, fname)
        size_mb = os.path.getsize(fpath) / (1024 * 1024)
        # Heuristic: pick default ctx from filename patterns
        ctx = 2048
        name_lower = fname.lower()
        if "7b" in name_lower or "8b" in name_lower:
            ctx = 4096
        elif "medium" in name_lower or "14b" in name_lower:
            ctx = 4096
        models.append({
            "filename": fname,
            "path": fpath,
            "size_mb": round(size_mb, 1),
            "default_ctx": ctx,
        })
    return models

# Set initial active engine from env
if ENABLE_LLM and LLM_ENGINE == "local" and "local" in [e["name"] for e in engine_manager.list_engines()]:
    engine_manager.set_active("local")
elif ENABLE_LLM and LLM_ENGINE != "local":
    engine_manager.set_active("openai")
else:
    engine_manager.set_active("mock")

print(f"AI ENGINE SELECTED: {engine_manager.active_name}")

DEBUG_AI = os.getenv("DEBUG_AI", "false").lower() == "true"


def _build_debug_payload(
    *, engine_name: str, system_prompt: str, user_prompt: str,
    temperature: float, top_p: float, max_tokens: int,
    seed: int | None, latency_ms: int, response_len: int,
) -> str | None:
    """Build a JSON debug payload string, or None if debug is off."""
    global _last_debug_payload
    if not DEBUG_AI:
        return None
    try:
        token_estimate = (len(system_prompt) + len(user_prompt)) // 4
        payload = {
            "engine_name": engine_name,
            "final_system_prompt": system_prompt,
            "final_user_prompt": user_prompt,
            "generation_params": {
                "temperature": temperature,
                "top_p": top_p,
                "max_tokens": max_tokens,
                "seed": seed,
            },
            "latency_ms": latency_ms,
            "token_estimate": token_estimate,
            "response_chars": response_len,
        }
        _last_debug_payload = payload
        return json.dumps(payload)
    except Exception:
        return None


@app.post("/shutdown")
async def shutdown():
    """Gracefully shut down the backend process."""
    async def _do_exit():
        await asyncio.sleep(0.2)
        os._exit(0)
    asyncio.create_task(_do_exit())
    return {"status": "shutting_down"}


@app.get("/ai/debug")
async def get_debug_status():
    return {"enabled": DEBUG_AI}

# In-memory store for last debug payload
_last_debug_payload: dict | None = None

@app.get("/ai/debug/last")
async def get_last_debug():
    return {"enabled": DEBUG_AI, "payload": _last_debug_payload}


# ── Tuning defaults ──────────────────────────────────────────────────

@app.get("/ai/tuning")
async def get_tuning():
    temp = app_repo.get_setting("tuning_temperature") or "0.7"
    top_p = app_repo.get_setting("tuning_top_p") or "0.95"
    max_tokens = app_repo.get_setting("tuning_max_tokens") or "1024"
    seed = app_repo.get_setting("tuning_seed")
    return {
        "temperature": float(temp),
        "topP": float(top_p),
        "maxTokens": int(max_tokens),
        "seed": int(seed) if seed else None,
    }

@app.post("/ai/tuning")
async def set_tuning(data: dict):
    if "temperature" in data:
        app_repo.set_setting("tuning_temperature", str(data["temperature"]))
    if "topP" in data:
        app_repo.set_setting("tuning_top_p", str(data["topP"]))
    if "maxTokens" in data:
        app_repo.set_setting("tuning_max_tokens", str(data["maxTokens"]))
    if "seed" in data:
        if data["seed"] is None:
            app_repo.set_setting("tuning_seed", "")
        else:
            app_repo.set_setting("tuning_seed", str(data["seed"]))
    return {"status": "saved"}


@app.get("/state")
async def get_state():
    return {
        "onboarding_completed": app_repo.get_setting("onboarding_completed") == "true"
    }

@app.post("/state")
async def save_state(data: dict):
    if "onboarding_completed" in data:
        app_repo.set_setting("onboarding_completed", "true" if data["onboarding_completed"] else "false")
    return {"status": "saved"}

# ── AI Settings (read/write .env-style config) ───────────────────────

@app.get("/settings/ai")
async def get_ai_settings():
    """Return current effective AI config (settings table → env fallback)."""
    def _get(key: str, env_fallback: str = "") -> str:
        """Settings DB first, then provided env_fallback (already resolved)."""
        val = app_repo.get_setting(key)
        return val if val else env_fallback

    return {
        "enable_llm": (_get("ai_enable_llm", os.getenv("ENABLE_LLM", "false"))).lower() == "true",
        "engine": _get("ai_engine", os.getenv("LLM_ENGINE", "mock")),
        "base_url": _get("ai_base_url", os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")),
        "api_key": _get("ai_api_key", os.getenv("LLM_API_KEY", "")),
        "model": _get("ai_model", os.getenv("LLM_MODEL", "gpt-4o-mini")),
        "model_path": _get("ai_model_path", os.getenv("LLM_MODEL_PATH", "")),
        "models_dir": _get("ai_models_dir", LLM_MODELS_DIR),
        "ctx_size": int(_get("ai_ctx_size", os.getenv("LLM_CTX_SIZE", "2048"))),
    }


@app.post("/settings/ai")
async def save_ai_settings(data: dict, background_tasks: BackgroundTasks):
    """Persist AI config to settings table, re-init engines, and write .env."""
    global LLM_MODELS_DIR

    mapping = {
        "enable_llm": ("ai_enable_llm", lambda v: "true" if v else "false"),
        "engine": ("ai_engine", str),
        "base_url": ("ai_base_url", str),
        "api_key": ("ai_api_key", str),
        "model": ("ai_model", str),
        "model_path": ("ai_model_path", str),
        "models_dir": ("ai_models_dir", str),
        "ctx_size": ("ai_ctx_size", str),
    }
    for field, (key, transform) in mapping.items():
        if field in data:
            app_repo.set_setting(key, transform(data[field]))

    # Update models dir global
    new_models_dir = app_repo.get_setting("ai_models_dir")
    if new_models_dir:
        LLM_MODELS_DIR = new_models_dir

    enable_llm = app_repo.get_setting("ai_enable_llm") == "true"
    engine_type = app_repo.get_setting("ai_engine") or "mock"
    base_url = app_repo.get_setting("ai_base_url") or os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    api_key = app_repo.get_setting("ai_api_key") or os.getenv("LLM_API_KEY", "")
    model = app_repo.get_setting("ai_model") or os.getenv("LLM_MODEL", "gpt-4o-mini")
    model_path = app_repo.get_setting("ai_model_path") or ""
    ctx_size = int(app_repo.get_setting("ai_ctx_size") or "2048")

    # Persist settings to .env file for restart durability
    _write_env({
        "ENABLE_LLM": "true" if enable_llm else "false",
        "LLM_ENGINE": engine_type,
        "LLM_BASE_URL": base_url,
        "LLM_API_KEY": api_key,
        "LLM_MODEL": model,
        "LLM_MODEL_PATH": model_path,
        "LLM_MODELS_DIR": LLM_MODELS_DIR,
        "LLM_CTX_SIZE": str(ctx_size),
    })

    # Re-init engines in background so the response returns immediately
    _reinit_state["status"] = "reinitializing"
    _reinit_state["error"] = None

    async def _do_reinit():
        try:
            engine_manager.clear()
            engine_manager.register("mock", MockAIEngine())
            if enable_llm:
                if engine_type == "local":
                    local_engine = LocalLLAMAEngine(
                        model_path=model_path if model_path else None,
                        n_ctx=ctx_size,
                    )
                    engine_manager.register("local", local_engine)
                    engine_manager.set_active("local")
                else:
                    os.environ["LLM_BASE_URL"] = base_url
                    os.environ["LLM_API_KEY"] = api_key
                    os.environ["LLM_MODEL"] = model
                    http_engine = HTTPAIEngine()
                    engine_manager.register("openai", http_engine)
                    engine_manager.set_active("openai")
            else:
                engine_manager.set_active("mock")
            _reinit_state["status"] = "ready"
            print(f"[SETTINGS] Engine re-initialized: {engine_manager.active_name}")
        except Exception as e:
            _reinit_state["status"] = "error"
            _reinit_state["error"] = str(e)
            print(f"[SETTINGS] Re-init failed: {e}")

    background_tasks.add_task(_do_reinit)
    return {"status": "reinitializing", "active_engine": engine_manager.active_name}


# Shared state for background re-init progress
_reinit_state: dict = {"status": "ready", "error": None}


@app.get("/settings/ai/status")
async def get_reinit_status():
    """Poll this after saving settings to know when engine re-init is done."""
    return {
        "status": _reinit_state["status"],   # "ready" | "reinitializing" | "error"
        "error": _reinit_state["error"],
        "active_engine": engine_manager.active_name,
    }


def _write_env(updates: dict[str, str]) -> None:
    """Merge updates into the .env file (create if missing)."""
    env_path = os.path.join(get_app_data_dir(), ".env")
    existing: dict[str, str] = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    existing[k.strip()] = v.strip()
    existing.update(updates)
    with open(env_path, "w", encoding="utf-8") as f:
        for k, v in existing.items():
            f.write(f"{k}={v}\n")


# ── Prompt Templates ─────────────────────────────────────────────────

@app.get("/prompt-templates", response_model=List[PromptTemplate])
async def list_templates():
    return template_repo.get_all()

# ── AI Engine switching ──────────────────────────────────────────────

@app.get("/ai/engines")
async def list_engines():
    return engine_manager.list_engines()

@app.post("/ai/engine")
async def set_engine(data: dict):
    name = data.get("engine")
    if not name:
        raise HTTPException(status_code=400, detail="Missing 'engine' field")
    try:
        engine_manager.set_active(name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    print(f"[ENGINE] Switched active engine to: {name}")
    return {"active": name}


# ── Local model management ───────────────────────────────────────────

@app.get("/ai/models")
async def list_local_models():
    """List available GGUF models and the currently loaded one."""
    models = _scan_local_models()
    # Get current model info from LocalLLAMAEngine if registered
    local = engine_manager._engines.get("local")
    current = None
    if isinstance(local, LocalLLAMAEngine):
        info = local.get_model_info()
        current = info.get("model_name")
    return {"models": models, "active_model": current}


@app.post("/ai/model")
async def set_local_model(data: dict):
    """Hot-swap the local GGUF model. Expects {filename, ctx?}."""
    filename = data.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="Missing 'filename' field")

    ctx = int(data.get("ctx", 2048))
    model_path = os.path.join(LLM_MODELS_DIR, filename)

    local = engine_manager._engines.get("local")
    if not isinstance(local, LocalLLAMAEngine):
        raise HTTPException(status_code=400, detail="Local engine is not registered")

    status, detail = local.reload(model_path, n_ctx=ctx)

    if status == "busy":
        raise HTTPException(status_code=409, detail="Cannot reload while generation is in progress")
    if status == "not_found":
        raise HTTPException(status_code=404, detail=f"Model file not found: {model_path}")
    if status == "failed":
        raise HTTPException(status_code=500, detail=f"Model failed to load: {detail}")

    return {"status": "ok", "model": local.get_model_info()}


@app.get("/ai/model/status")
async def get_model_status():
    """Return whether a local model is currently loaded."""
    local = engine_manager._engines.get("local")
    if not isinstance(local, LocalLLAMAEngine):
        return {"loaded": False, "model_name": None, "is_local_engine": False}
    info = local.get_model_info()
    return {
        "loaded": info["is_ready"],
        "model_name": info.get("model_name"),
        "is_local_engine": engine_manager._active_name == "local",
    }


# ── Model downloads ───────────────────────────────────────────────

# download_state: filename -> {progress, total, done, error}
_download_state: dict = {}

@app.post("/ai/models/download")
async def start_model_download(data: dict, background_tasks: BackgroundTasks):
    """Start a background download of a GGUF model into models_dir."""
    url = data.get("url", "").strip()
    filename = data.get("filename", "").strip()
    if not url or not filename:
        raise HTTPException(status_code=400, detail="Missing url or filename")

    dest_dir = LLM_MODELS_DIR
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, filename)

    if _download_state.get(filename, {}).get("running"):
        return {"status": "already_running"}

    _download_state[filename] = {"progress": 0, "total": 0, "done": False, "error": None, "running": True}

    async def _do_download():
        try:
            async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
                async with client.stream("GET", url) as resp:
                    resp.raise_for_status()
                    total = int(resp.headers.get("content-length", 0))
                    _download_state[filename]["total"] = total
                    downloaded = 0
                    with open(dest_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=1024 * 256):
                            f.write(chunk)
                            downloaded += len(chunk)
                            _download_state[filename]["progress"] = downloaded
            _download_state[filename]["done"] = True
            _download_state[filename]["running"] = False
            print(f"[DOWNLOAD] Completed: {filename}")
        except Exception as e:
            _download_state[filename]["error"] = str(e)
            _download_state[filename]["running"] = False
            # Remove partial file
            if os.path.exists(dest_path):
                try:
                    os.remove(dest_path)
                except Exception:
                    pass
            print(f"[DOWNLOAD] Failed {filename}: {e}")

    background_tasks.add_task(_do_download)
    return {"status": "started"}


@app.get("/ai/models/download/status")
async def get_download_status():
    """Return current state of all active/recent downloads."""
    return {"downloads": _download_state}


@app.delete("/ai/models/download/{filename}")
async def cancel_model_download(filename: str):
    """Mark a download as cancelled and delete the partial file from disk."""
    state = _download_state.get(filename)
    if state:
        state["running"] = False
        state["error"] = "Cancelled"
    dest_path = os.path.join(LLM_MODELS_DIR, filename)
    if os.path.exists(dest_path):
        try:
            os.remove(dest_path)
        except Exception:
            pass
    return {"status": "cancelled"}


# ── Benchmark ────────────────────────────────────────────────────

@app.post("/benchmark/run")
async def run_benchmark(req: BenchmarkRequest):
    """Run generation sequentially across requested engines and store results.
    Each engine failure is recorded but does not abort the benchmark.
    If `models` is provided, the local engine is hot-swapped for each model."""
    results: list[dict] = []

    async def _run_single(engine_name: str, engine, model_label: str | None):
        """Run one engine/model combo and append to results."""
        output = ""
        error: str | None = None
        start = time()
        try:
            async for chunk in engine.generate_stream(
                system_prompt="You are a helpful assistant.",
                user_prompt=req.input_text,
                temperature=req.temperature,
                top_p=req.top_p,
                max_tokens=req.max_tokens,
            ):
                output += chunk
        except Exception as e:
            error = str(e)
            print(f"[BENCHMARK] Engine {engine_name} failed: {e}")
        latency_ms = int((time() - start) * 1000)

        run = BenchmarkRun(
            input_text=req.input_text,
            engine_name=engine_name,
            model_name=model_label,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            latency_ms=latency_ms,
            output_text=output,
            error=error,
        )
        saved = benchmark_repo.create(run)
        results.append(saved.model_dump())
        print(f"[BENCHMARK] {engine_name}/{model_label}: {latency_ms}ms, {len(output)} chars{', ERROR: ' + error if error else ''}")

    for engine_name in req.engines:
        engine = engine_manager._engines.get(engine_name)
        if engine is None:
            run = BenchmarkRun(
                input_text=req.input_text,
                engine_name=engine_name,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                error=f"Engine '{engine_name}' is not registered",
            )
            saved = benchmark_repo.create(run)
            results.append(saved.model_dump())
            continue

        # If local engine + models requested, hot-swap and run each model
        if isinstance(engine, LocalLLAMAEngine) and req.models:
            for model_filename in req.models:
                model_path = os.path.join(LLM_MODELS_DIR, model_filename)
                reload_status, reload_detail = engine.reload(model_path, n_ctx=int(os.getenv("LLM_CTX_SIZE", "2048")))
                if reload_status != "ok":
                    run = BenchmarkRun(
                        input_text=req.input_text,
                        engine_name=engine_name,
                        model_name=model_filename,
                        temperature=req.temperature,
                        max_tokens=req.max_tokens,
                        error=f"Model swap failed: {reload_detail}",
                    )
                    saved = benchmark_repo.create(run)
                    results.append(saved.model_dump())
                    continue
                await _run_single(engine_name, engine, model_filename)
        else:
            # Resolve model name for logging
            model_name: str | None = None
            if isinstance(engine, LocalLLAMAEngine):
                info = engine.get_model_info()
                model_name = info.get("model_name")
            elif isinstance(engine, HTTPAIEngine):
                model_name = engine.model
            await _run_single(engine_name, engine, model_name)

    return {"runs": results}


@app.get("/benchmark/runs")
async def list_benchmark_runs(limit: int = 50):
    """Return the most recent benchmark runs."""
    runs = benchmark_repo.get_recent(limit)
    return {"runs": [r.model_dump() for r in runs]}


@app.delete("/benchmark/run/{run_id}")
async def delete_benchmark_run(run_id: int):
    """Delete a single benchmark run by ID."""
    deleted = benchmark_repo.delete_by_id(run_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "ok"}


@app.delete("/benchmark/session")
async def delete_benchmark_session(input_text: str):
    """Delete all benchmark runs sharing the same input prompt (a session)."""
    count = benchmark_repo.delete_by_input(input_text)
    return {"status": "ok", "deleted": count}


# ── Chat ──────────────────────────────────────────────────────────

CHAT_MODES = {
    "general": "You are a helpful AI assistant. Answer questions clearly and concisely.",
    "writing": "You are a skilled writing assistant. Help the user draft, edit, and improve written content. Focus on clarity, tone, and structure.",
    "coding": "You are an expert programming assistant. Help the user write, debug, and understand code. Provide clear explanations and working examples.",
    "analysis": "You are an analytical assistant. Help the user break down problems, interpret data, evaluate arguments, and draw conclusions with rigorous reasoning.",
    "brainstorm": "You are a creative brainstorming partner. Help the user generate ideas, explore possibilities, and think outside the box. Encourage divergent thinking.",
}

@app.get("/chat/modes")
async def list_chat_modes():
    return {"modes": list(CHAT_MODES.keys())}

@app.post("/chat/session", response_model=ChatSession)
async def create_chat_session(data: dict = {}):
    mode = data.get("mode", "general")
    if mode not in CHAT_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")
    return chat_session_repo.create(mode=mode)

@app.get("/chat/sessions")
async def list_chat_sessions():
    return chat_session_repo.get_all()

@app.get("/chat/session/{session_id}")
async def get_chat_session(session_id: int):
    session = chat_session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    messages = chat_message_repo.get_by_session_id(session_id)
    return {"session": session.model_dump(), "messages": [m.model_dump() for m in messages]}

@app.put("/chat/session/{session_id}/mode")
async def update_chat_mode(session_id: int, data: dict):
    session = chat_session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    mode = data.get("mode", "general")
    if mode not in CHAT_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")
    chat_session_repo.update_mode(session_id, mode)
    return chat_session_repo.get_by_id(session_id)

@app.put("/chat/session/{session_id}/title")
async def update_chat_title(session_id: int, data: dict):
    session = chat_session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    title = data.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    chat_session_repo.update_title(session_id, title)
    return chat_session_repo.get_by_id(session_id)

@app.delete("/chat/session/{session_id}")
async def delete_chat_session(session_id: int):
    session = chat_session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    chat_session_repo.delete(session_id)
    return {"status": "deleted"}

@app.post("/chat/session/{session_id}/message", response_model=ChatMessage)
async def send_chat_message(session_id: int, req: ChatMessageRequest):
    session = chat_session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Auto-title on first message
    if session.title == "New Chat":
        auto_title = req.content.strip()[:40]
        if auto_title:
            chat_session_repo.update_title(session_id, auto_title)

    # Store user message
    chat_message_repo.create(session_id, "user", req.content)

    # Build context from history
    history = chat_message_repo.get_by_session_id(session_id)
    context_parts = []
    for msg in history:
        prefix = "User" if msg.role == "user" else "Assistant"
        context_parts.append(f"{prefix}: {msg.content}")
    user_prompt = "\n".join(context_parts)

    # Resolve system prompt from session mode
    system_prompt = CHAT_MODES.get(session.mode, CHAT_MODES["general"])

    # Generate response (non-streaming: accumulate chunks)
    temperature = req.temperature if req.temperature is not None else 0.7
    max_tokens = req.max_tokens if req.max_tokens is not None else 1024
    full_response = ""
    try:
        async for chunk in engine_manager.get_active().generate_stream(
            system_prompt, user_prompt,
            temperature=temperature, max_tokens=max_tokens,
            json_mode=False,
        ):
            full_response += chunk
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")

    assistant_text = full_response.strip()
    if not assistant_text:
        assistant_text = "(No response generated)"

    # Store assistant message and return it
    assistant_msg = chat_message_repo.create(session_id, "assistant", assistant_text)
    return assistant_msg


@app.post("/chat/upload")
async def upload_chat_file(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF and return it."""
    import pdfplumber
    import io
    data = await file.read()
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            text = "\n\n".join(p.extract_text() or "" for p in pdf.pages)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract PDF text: {e}")
    return {"filename": file.filename, "text": text[:8000]}


# ── Documents ─────────────────────────────────────────────────────

@app.post("/documents", response_model=Document)
async def create_document(req: DocumentCreate):
    return document_repo.create(title=req.title, content_json=req.content_json)

@app.get("/documents")
async def list_documents():
    return document_repo.get_all()

@app.get("/documents/{doc_id}", response_model=Document)
async def get_document(doc_id: str):
    doc = document_repo.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@app.put("/documents/{doc_id}", response_model=Document)
async def update_document(doc_id: str, req: DocumentUpdate):
    doc = document_repo.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return document_repo.update(doc_id, title=req.title, content_json=req.content_json)


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    doc = document_repo.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    document_repo.delete(doc_id)
    return {"status": "deleted"}


@app.post("/documents/{doc_id}/duplicate", response_model=Document)
async def duplicate_document(doc_id: str):
    doc = document_repo.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return document_repo.create(title=f"{doc.title} (copy)", content_json=doc.content_json)


_DOC_AI_FORMAT = """
You MUST respond with ONLY valid semantic HTML. No markdown, no backticks, no explanations, no wrapping.
Allowed tags ONLY: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <blockquote>.
Do NOT wrap output in ```html fences or any code block. Output raw HTML directly.
Preserve the original language.""".strip()

DOCUMENT_AI_ACTIONS = {
    "rewrite": f"Rewrite the following text to improve clarity and flow.\n{_DOC_AI_FORMAT}",
    "summarize": f"Summarize the following text concisely.\n{_DOC_AI_FORMAT}",
    "expand": f"Expand the following text with more detail and depth.\n{_DOC_AI_FORMAT}",
    "fix_grammar": f"Fix all grammar, spelling, and punctuation errors in the following text. Preserve the original structure.\n{_DOC_AI_FORMAT}",
}

@app.post("/documents/ai")
async def document_ai_action(req: DocumentAIRequest):
    system_prompt = DOCUMENT_AI_ACTIONS.get(req.action_type)
    if not system_prompt:
        raise HTTPException(status_code=400, detail=f"Invalid action_type: {req.action_type}. Must be one of: {', '.join(DOCUMENT_AI_ACTIONS.keys())}")
    if not req.selected_text.strip():
        raise HTTPException(status_code=400, detail="selected_text cannot be empty")

    full_response = ""
    try:
        temperature = req.temperature if req.temperature is not None else 0.7
        max_tokens = req.max_tokens if req.max_tokens is not None else 1024
        async for chunk in engine_manager.get_active().generate_stream(
            system_prompt, req.selected_text,
            temperature=temperature, max_tokens=max_tokens,
            json_mode=False,
        ):
            full_response += chunk
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")

    raw = full_response.strip()
    if not raw:
        raise HTTPException(status_code=500, detail="AI returned empty response")

    # Strip markdown code fences if the model wrapped its output
    import re
    html = re.sub(r'^```(?:html)?\s*\n?', '', raw)
    html = re.sub(r'\n?```\s*$', '', html)
    html = html.strip()

    # If the result has no HTML tags at all, wrap in <p>
    if '<' not in html:
        html = f"<p>{html}</p>"

    return {"html": html, "action_type": req.action_type}


# ── Sheets (Table Data Engine) ────────────────────────────────────

@app.post("/sheets/ai-schema")
async def ai_generate_schema(req: dict):
    """AI generates a table schema (title + columns) for user review. Does NOT create the table."""
    prompt = req.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    system_prompt = (
        "You are a spreadsheet schema designer.\n"
        "Given a user description, generate a table schema.\n"
        "Respond with ONLY valid JSON, no markdown fences, no explanation.\n"
        "Format: {\"title\":\"Table Name\",\"columns\":[{\"name\":\"Col\",\"type\":\"text\"}]}\n"
        "Rules:\n"
        "- 3-8 columns appropriate to the domain\n"
        "- Allowed types: text, number, boolean, date\n"
        "- Do NOT include rows, data, or example values\n"
        "- Return ONLY column definitions, no extra metadata fields\n"
        "- Column names should be short and descriptive"
    )
    user_prompt = f"Design a table schema for: {prompt}"

    full_response = ""
    try:
        async with asyncio.timeout(GENERATION_TIMEOUT):
            async for chunk in engine_manager.get_active().generate_stream(
                system_prompt, user_prompt, temperature=0.5, json_mode=False
            ):
                full_response += chunk
    except (TimeoutError, asyncio.TimeoutError):
        full_response = ""
        async for chunk in MockAIEngine().generate_stream(system_prompt, user_prompt, temperature=0.5, json_mode=False):
            full_response += chunk

    import re
    raw = full_response.strip()
    raw = re.sub(r'^```(?:json)?\s*\n?', '', raw)
    raw = re.sub(r'\n?```\s*$', '', raw)
    start = raw.find('{')
    end = raw.rfind('}')
    if start == -1 or end == -1:
        raise HTTPException(status_code=500, detail="AI returned invalid response")
    raw = raw[start:end + 1]

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")

    title = data.get("title", "AI Generated Sheet")
    columns_raw = data.get("columns", [])

    # Validate: must be a list of objects with name+type
    columns = []
    for c in columns_raw:
        if not isinstance(c, dict):
            continue
        name = str(c.get("name", "Column")).strip()
        if not name:
            continue
        ctype = c.get("type", "text")
        if ctype not in ("text", "number", "boolean", "date"):
            ctype = "text"
        columns.append({"name": name, "type": ctype})

    if not columns:
        raise HTTPException(status_code=500, detail="AI returned no valid columns")

    return {"title": title, "columns": columns}


@app.post("/sheets", response_model=Sheet)
async def create_sheet(req: SheetCreate):
    return sheet_repo.create(title=req.title, columns=req.columns, rows=req.rows if req.rows else None)

@app.get("/sheets", response_model=List[Sheet])
async def list_sheets():
    return sheet_repo.get_all()

@app.get("/sheets/{sheet_id}", response_model=Sheet)
async def get_sheet(sheet_id: str):
    sheet = sheet_repo.get_by_id(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.delete("/sheets/{sheet_id}")
async def delete_sheet(sheet_id: str):
    sheet = sheet_repo.get_by_id(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    sheet_repo.delete(sheet_id)
    return {"ok": True}

@app.post("/sheets/{sheet_id}/duplicate", response_model=Sheet)
async def duplicate_sheet(sheet_id: str):
    sheet = sheet_repo.duplicate(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.put("/sheets/{sheet_id}/data", response_model=Sheet)
async def restore_sheet_data(sheet_id: str, body: dict):
    """Wholesale replace columns + rows + formulas (undo/redo)."""
    columns = body.get("columns", [])
    rows = body.get("rows", [])
    formulas = body.get("formulas", None)
    sizes = body.get("sizes", None)
    alignments = body.get("alignments", None)
    formats = body.get("formats", None)
    from backend.models import SheetColumn
    cols = [SheetColumn(**c) for c in columns]
    sheet = sheet_repo.restore_data(sheet_id, cols, rows, formulas, sizes, alignments, formats)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.put("/sheets/{sheet_id}/formats")
async def update_sheet_formats(sheet_id: str, body: dict):
    formats = body.get("formats", {})
    sheet = sheet_repo.update_formats(sheet_id, formats)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.put("/sheets/{sheet_id}/alignments")
async def update_sheet_alignments(sheet_id: str, body: dict):
    alignments = body.get("alignments", {})
    sheet = sheet_repo.update_alignments(sheet_id, alignments)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.put("/sheets/{sheet_id}/sizes")
async def update_sheet_sizes(sheet_id: str, body: dict):
    sizes = {"colWidths": body.get("colWidths", {}), "rowHeights": body.get("rowHeights", {})}
    sheet = sheet_repo.update_sizes(sheet_id, sizes)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.put("/sheets/{sheet_id}/title")
async def update_sheet_title(sheet_id: str, body: dict):
    title = body.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    sheet = sheet_repo.update_title(sheet_id, title)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.post("/sheets/{sheet_id}/rows", response_model=Sheet)
async def add_sheet_row(sheet_id: str):
    sheet = sheet_repo.add_row(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.post("/sheets/{sheet_id}/rows/insert", response_model=Sheet)
async def insert_sheet_row(sheet_id: str, req: dict):
    row_index = req.get("row_index", 0)
    sheet = sheet_repo.insert_row_at(sheet_id, row_index)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.post("/sheets/{sheet_id}/rows/duplicate", response_model=Sheet)
async def duplicate_sheet_row(sheet_id: str, req: dict):
    row_index = req.get("row_index", 0)
    sheet = sheet_repo.duplicate_row(sheet_id, row_index)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found or invalid row")
    return sheet

@app.post("/sheets/{sheet_id}/columns", response_model=Sheet)
async def add_sheet_column(sheet_id: str, req: SheetAddColumn):
    sheet = sheet_repo.add_column(sheet_id, req.name, req.type)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@app.put("/sheets/{sheet_id}/clear-range", response_model=Sheet)
async def clear_cell_range(sheet_id: str, req: dict):
    """Clear all cells in a rectangular range to empty strings."""
    r1, c1, r2, c2 = req.get("r1", 0), req.get("c1", 0), req.get("r2", 0), req.get("c2", 0)
    sheet = sheet_repo.get_by_id(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    formulas = dict(sheet.formulas)
    changed = set()
    with sheet_repo.db.get_connection() as conn:
        for ri in range(r1, r2 + 1):
            for ci in range(c1, c2 + 1):
                key = f"{ri},{ci}"
                changed.add(key)
                if ri < len(sheet.rows) and ci < len(sheet.rows[ri]):
                    sheet.rows[ri][ci] = ""
                formulas.pop(key, None)
        sheet_repo._save(conn, sheet_id, sheet.columns, sheet.rows, formulas,
                         changed_cells=changed)
    return sheet_repo.get_by_id(sheet_id)

@app.put("/sheets/{sheet_id}/paste", response_model=Sheet)
async def paste_cells(sheet_id: str, req: dict):
    """Paste a 2D array of values starting at (start_row, start_col).

    If source_row/source_col are provided, formula references are shifted
    by the delta between source and target positions (relative copy).
    """
    from backend.formula import shift_refs

    start_row = req.get("start_row", 0)
    start_col = req.get("start_col", 0)
    source_row = req.get("source_row")
    source_col = req.get("source_col")
    data: list = req.get("data", [])
    sheet = sheet_repo.get_by_id(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    num_cols = len(sheet.columns)
    formulas = dict(sheet.formulas)
    changed = set()

    # Compute deltas for relative formula shifting
    row_delta = (start_row - source_row) if source_row is not None else 0
    col_delta = (start_col - source_col) if source_col is not None else 0

    # Determine if we need to expand columns
    max_paste_col = start_col + max((len(r) for r in data), default=0) - 1
    if max_paste_col >= num_cols:
        for ci in range(num_cols, max_paste_col + 1):
            sheet.columns.append(SheetColumn(name=f"Column {ci + 1}", type="text"))
            for row in sheet.rows:
                row.append("")
        num_cols = len(sheet.columns)

    with sheet_repo.db.get_connection() as conn:
        for dr, row_vals in enumerate(data):
            ri = start_row + dr
            # Extend rows if needed
            while ri >= len(sheet.rows):
                sheet.rows.append([""] * num_cols)
            for dc, val in enumerate(row_vals):
                ci = start_col + dc
                val_str = str(val)
                key = f"{ri},{ci}"
                changed.add(key)
                if val_str.startswith('='):
                    # Shift formula references relatively
                    if row_delta or col_delta:
                        val_str = shift_refs(val_str, row_delta, col_delta)
                    formulas[key] = val_str
                    sheet.rows[ri][ci] = ""
                else:
                    formulas.pop(key, None)
                    sheet.rows[ri][ci] = val_str
        sheet_repo._save(conn, sheet_id, sheet.columns, sheet.rows, formulas,
                         changed_cells=changed)
    return sheet_repo.get_by_id(sheet_id)

@app.put("/sheets/{sheet_id}/cell", response_model=Sheet)
async def update_sheet_cell(sheet_id: str, req: SheetUpdateCell):
    try:
        sheet = sheet_repo.update_cell(sheet_id, req.row_index, req.col_index, req.value)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found or invalid indices")
    return sheet

@app.post("/sheets/{sheet_id}/explain-formula")
async def explain_formula(sheet_id: str, req: dict):
    """Ask the LLM to explain a formula in plain language."""
    row_index = req.get("row_index", 0)
    col_index = req.get("col_index", 0)
    sheet = sheet_repo.get_by_id(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    key = f"{row_index},{col_index}"
    formula = sheet.formulas.get(key)
    if not formula:
        raise HTTPException(status_code=422, detail="Cell does not contain a formula")
    computed = sheet.rows[row_index][col_index] if row_index < len(sheet.rows) and col_index < len(sheet.rows[row_index]) else ""
    col_name = sheet.columns[col_index].name if col_index < len(sheet.columns) else f"Column {col_index}"
    system_prompt = (
        "You are a spreadsheet assistant. Explain the given formula in one or two short, "
        "plain-language sentences. Do NOT return JSON, code blocks, or markdown. "
        "Just a brief human-readable explanation."
    )
    user_prompt = (
        f'Column: "{col_name}"\n'
        f"Formula: {formula}\n"
        f"Current result: {computed}\n"
        f"Explain what this formula does."
    )
    full_response = ""
    try:
        async for chunk in engine_manager.get_active().generate_stream(
            system_prompt, user_prompt,
            temperature=0.3, max_tokens=256,
            json_mode=False,
        ):
            full_response += chunk
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")
    text = full_response.strip()
    if not text:
        text = "Could not generate an explanation."
    return {"explanation": text}


@app.delete("/sheets/{sheet_id}/rows", response_model=Sheet)
async def delete_sheet_row(sheet_id: str, req: SheetDeleteRow):
    sheet = sheet_repo.delete_row(sheet_id, req.row_index)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found or invalid row index")
    return sheet

@app.delete("/sheets/{sheet_id}/columns", response_model=Sheet)
async def delete_sheet_column(sheet_id: str, req: SheetDeleteColumn):
    sheet = sheet_repo.delete_column(sheet_id, req.col_index)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found or invalid column index")
    return sheet

@app.put("/sheets/{sheet_id}/columns/rename", response_model=Sheet)
async def rename_sheet_column(sheet_id: str, req: dict):
    col_index = req.get("col_index", 0)
    name = req.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    sheet = sheet_repo.rename_column(sheet_id, col_index, name)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found or invalid column index")
    return sheet

@app.put("/sheets/{sheet_id}/columns/move", response_model=Sheet)
async def move_sheet_column(sheet_id: str, req: dict):
    from_index = req.get("from_index", 0)
    to_index = req.get("to_index", 0)
    sheet = sheet_repo.move_column(sheet_id, from_index, to_index)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found or invalid indices")
    return sheet

@app.put("/sheets/{sheet_id}/columns/sort", response_model=Sheet)
async def sort_sheet_column(sheet_id: str, req: dict):
    col_index = req.get("col_index", 0)
    ascending = req.get("ascending", True)
    sheet = sheet_repo.sort_by_column(sheet_id, col_index, ascending)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found or invalid column")
    return sheet


@app.get("/sheets/{sheet_id}/ai-op")
async def ai_range_operation(
    sheet_id: str,
    request: Request,
    mode: str,
    r1: int, c1: int, r2: int, c2: int,
    tr: int, tc: int,
    instruction: str,
    temperature: float = 0.7,
    max_tokens: int = 1024,
    model: Optional[str] = None
):
    """
    Unified SSE endpoint for AI operations on ranges.
    Modes:
    - row-wise: Process each row in source range independently. Target = relative rows starting at tr, tc.
    - aggregate: Concat all source cells -> Single AI call -> Write result to tr, tc.
    - matrix: Process entire source range as a table -> Single AI call -> Write table starting at tr, tc.
    """
    sheet = sheet_repo.get_by_id(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Override model if requested (for local engine)
    if model:
        local = engine_manager._engines.get("local")
        if isinstance(local, LocalLLAMAEngine):
            # Check if already loaded
            info = local.get_model_info()
            if info.get("model_name") != model:
                model_path = os.path.join(LLM_MODELS_DIR, model)
                if os.path.exists(model_path):
                    print(f"[AI-OP] Hot-swapping to model: {model}")
                    # reload is sync in the current implementation (locks internally)
                    # We should ideally run this in a thread or await it if it were async
                    status, detail = local.reload(model_path)
                    if status != "ok":
                        print(f"[AI-OP] Model swap failed: {detail}")
                else:
                    print(f"[AI-OP] Model not found: {model_path}")

    # Helper to get source value
    if r1 > r2 or c1 > c2:
        raise HTTPException(status_code=400, detail="Invalid range coordinates")
    
    cell_count = (r2 - r1 + 1) * (c2 - c1 + 1)
    if cell_count > 50:
        raise HTTPException(status_code=400, detail="Operation exceeds limit of 50 cells")

    # Helper to get source value
    def get_val(r, c):
        if r < len(sheet.rows) and c < len(sheet.rows[r]):
            return str(sheet.rows[r][c])
        return ""

    def clean_ai_result(text: str) -> str:
        """Strip ChatML markers and common LLM headers."""
        import re
        res = text.strip().replace('`', '')
        res = re.sub(r'<\|im_start\|>assistant\n?', '', res, flags=re.IGNORECASE)
        res = re.sub(r'<\|im_start\|>.*?<\|im_end\|>', '', res, flags=re.DOTALL)
        res = re.sub(r'Assistant:', '', res, flags=re.IGNORECASE)
        res = re.sub(r'Response:', '', res, flags=re.IGNORECASE)
        return res.strip()

    async def event_generator():
        try:
            if mode == "row-wise":
                # 1 AI call per row
                for i, ri in enumerate(range(r1, r2 + 1)):
                    if await request.is_disconnected():
                        break
                    
                    row_vals = [get_val(ri, ci) for ci in range(c1, c2 + 1)]
                    source_text = " | ".join(row_vals)
                    
                    if not source_text.strip():
                        # Still yield something to maintain row sync if desired, or skip
                        yield {"data": json.dumps({"type": "skip", "row": tr + i, "reason": "empty"})}
                        continue

                    sys_prompt = "You are a data assistant. Return ONLY plain text. No markdown. No explanations."
                    user_prompt = f"Input: {source_text}\nInstruction: {instruction}"
                    
                    full_resp = ""
                    try:
                        async with asyncio.timeout(GENERATION_TIMEOUT):
                            async for chunk in engine_manager.get_active().generate_stream(
                                sys_prompt, user_prompt, temperature=temperature, max_tokens=max_tokens, json_mode=False
                            ):
                                full_resp += chunk
                        
                        result = clean_ai_result(full_resp)
                        sheet_repo.update_cell(sheet_id, tr + i, tc, result)
                        yield {"data": json.dumps({"type": "cell", "row": tr + i, "col": tc, "value": result})}
                    except Exception as e:
                        yield {"data": json.dumps({"type": "error", "row": tr + i, "error": str(e)})}

            elif mode == "aggregate":
                # Concat ALL cells -> 1 AI call -> 1 Output cell
                all_vals = []
                for ri in range(r1, r2 + 1):
                    row_v = [get_val(ri, ci) for ci in range(c1, c2 + 1)]
                    all_vals.append(" | ".join(row_v))
                source_text = "\n".join(all_vals)

                sys_prompt = "You are a data analyst. Aggregate the input into a single result. Return ONLY plain text."
                user_prompt = f"Data:\n{source_text}\n\nInstruction: {instruction}"

                full_resp = ""
                async with asyncio.timeout(GENERATION_TIMEOUT):
                    async for chunk in engine_manager.get_active().generate_stream(
                        sys_prompt, user_prompt, temperature=temperature, max_tokens=max_tokens, json_mode=False
                    ):
                        full_resp += chunk
                
                result = clean_ai_result(full_resp)
                sheet_repo.update_cell(sheet_id, tr, tc, result)
                yield {"data": json.dumps({"type": "cell", "row": tr, "col": tc, "value": result})}

            elif mode == "matrix":
                # N->N table transformation
                rows_text = []
                for ri in range(r1, r2 + 1):
                    row_v = [get_val(ri, ci).replace('|', '/') for ci in range(c1, c2 + 1)]
                    rows_text.append("| " + " | ".join(row_v) + " |")
                source_table = "\n".join(rows_text)

                sys_prompt = (
                    "You are a table processor. Process the table below.\n"
                    "Output format: Pipe-separated values (| col1 | col2 |).\n"
                    "Maintain the same number of rows and columns.\n"
                    "Return ONLY the table data. No markdown. No explanations."
                )
                user_prompt = f"Table:\n{source_table}\n\nInstruction: {instruction}"

                full_resp = ""
                async with asyncio.timeout(GENERATION_TIMEOUT):
                    async for chunk in engine_manager.get_active().generate_stream(
                        sys_prompt, user_prompt, temperature=temperature, max_tokens=max_tokens, json_mode=False
                    ):
                        full_resp += chunk
                
                # Parse output - filter lines to find actual table rows
                clean_text = clean_ai_result(full_resp)
                lines = [l.strip() for l in clean_text.split('\n') if '|' in l]
                current_r = tr
                for line in lines:
                    # Split by pipe
                    parts = [p.strip() for p in line.split('|')]
                    # Remove empty start/end if pipe-surrounded (| a | b | -> ['', 'a', 'b', ''])
                    if parts and not parts[0]: parts.pop(0)
                    if parts and not parts[-1]: parts.pop()
                    
                    if not parts: continue

                    for i, val in enumerate(parts):
                        sheet_repo.update_cell(sheet_id, current_r, tc + i, val)
                        yield {"data": json.dumps({"type": "cell", "row": current_r, "col": tc + i, "value": val})}
                    current_r += 1

            else:
                yield {"data": json.dumps({"type": "error", "error": f"Unknown mode: {mode}"})}

        except Exception as e:
            yield {"data": json.dumps({"type": "error", "error": f"Global error: {str(e)}", "row": tr})}
        
        yield {"data": "[DONE]"}

    return EventSourceResponse(event_generator())


@app.get("/sheets/{sheet_id}/ai-fill")
async def ai_fill_column(sheet_id: str, request: Request, col_index: int, instruction: str):
    """SSE endpoint: AI fills empty cells in the target column. Single AI call, streams results per cell."""
    sheet = sheet_repo.get_by_id(sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    if col_index < 0 or col_index >= len(sheet.columns):
        raise HTTPException(status_code=400, detail="Invalid column index")

    target_col = sheet.columns[col_index]
    other_cols = [(i, c) for i, c in enumerate(sheet.columns) if i != col_index]

    # Find which rows need filling
    empty_row_indices = []
    for ri, row in enumerate(sheet.rows):
        val = row[col_index] if col_index < len(row) else ""
        if not val.strip():
            empty_row_indices.append(ri)

    if not empty_row_indices:
        async def no_work():
            yield {"data": "[DONE]"}
        return EventSourceResponse(no_work())

    # --- Build row context: all other column values for each empty row ---
    row_context_lines = []
    for idx, ri in enumerate(empty_row_indices):
        row = sheet.rows[ri] if ri < len(sheet.rows) else []
        parts = []
        for ci, col in other_cols:
            val = row[ci] if ci < len(row) else ""
            if val.strip():
                parts.append(f"{col.name}={val}")
        ctx = ", ".join(parts) if parts else "(empty row)"
        row_context_lines.append(f"  Row {idx}: {ctx}")
    row_context = "\n".join(row_context_lines)

    # --- Type constraint string ---
    TYPE_RULES = {
        "number": "Return ONLY numeric values (integer or decimal). Example: \"42\", \"3.14\".",
        "boolean": "Return ONLY \"true\" or \"false\" (lowercase).",
        "date": "Return ONLY dates in YYYY-MM-DD format. Example: \"2025-06-15\".",
        "text": "Return short plain-text strings. No JSON, no objects.",
    }
    type_rule = TYPE_RULES.get(target_col.type, TYPE_RULES["text"])

    # --- EXCEL LITE DEDICATED PROMPT ---
    count = len(empty_row_indices)
    system_prompt = (
        "You are a spreadsheet data assistant.\n"
        "TASK: Generate cell values for a spreadsheet column.\n"
        "RULES:\n"
        "- Return ONLY a JSON array of plain scalar strings. Example: [\"Alice\",\"Bob\",\"Charlie\"]\n"
        "- Each element is ONE cell value — a simple scalar (word, name, number, date).\n"
        "- NEVER return objects, dicts, or nested JSON.\n"
        "- NEVER return objects, dicts, or nested structures as cell values.\n"
        "- NEVER include explanations, labels, or markdown.\n"
        f"- Column type is \"{target_col.type}\". {type_rule}\n"
        "- Use the row context below to produce values that make sense for each row.\n"
        "- Just the raw JSON array, nothing else."
    )
    user_prompt = (
        f"Column: \"{target_col.name}\" (type: {target_col.type})\n"
        f"Instruction: {instruction}\n\n"
        f"Row context (other columns for each row that needs a value):\n{row_context}\n\n"
        f"Generate exactly {count} values — one per row above, in order.\n"
        f"Respond with ONLY a JSON array of {count} strings."
    )

    MAX_RETRIES = 2

    async def _call_ai(sys_p: str, usr_p: str) -> str:
        """Call the AI engine and accumulate the full response."""
        full = ""
        async with asyncio.timeout(GENERATION_TIMEOUT):
            async for chunk in engine_manager.get_active().generate_stream(
                sys_p, usr_p, temperature=0.5, json_mode=False
            ):
                full += chunk
        return full

    def _parse_array(raw_text: str) -> list | str:
        """Parse a JSON array from raw AI output. Returns list on success, error string on failure."""
        import re as _re
        raw = raw_text.strip()
        raw = _re.sub(r'^```(?:json)?\s*\n?', '', raw)
        raw = _re.sub(r'\n?```\s*$', '', raw)
        start = raw.find('[')
        end = raw.rfind(']')
        if start == -1 or end == -1:
            return "AI did not return a valid array"
        try:
            values = json.loads(raw[start:end + 1])
        except json.JSONDecodeError:
            return "AI returned invalid JSON"
        if not isinstance(values, list):
            return "AI did not return an array"
        return values

    def _validate_item(item, col_type: str, col_name: str, ri: int) -> str | None:
        """Validate a single AI output item. Returns cleaned string or None on rejection."""
        if isinstance(item, (dict, list)):
            print(f"[AI_EXCEL] column={col_name}, row={ri}, REJECTED structured output: {type(item).__name__}")
            return None
        value = str(item).strip().strip('"').strip("'")
        if value and (value[0] in ('{', '[') or '\n' in value):
            print(f"[AI_EXCEL] column={col_name}, row={ri}, REJECTED blob: {value[:80]}")
            return None
        validation_error = sheet_repo.validate_cell(value, col_type)
        if validation_error:
            print(f"[AI_EXCEL] column={col_name}, row={ri}, value={value}, valid=false ({validation_error})")
            return None
        return value

    async def event_generator():
        # Initial AI call
        values = None
        last_error = ""
        for attempt in range(1 + MAX_RETRIES):
            try:
                if await request.is_disconnected():
                    return
                full_response = await _call_ai(system_prompt, user_prompt)
                result = _parse_array(full_response)
                if isinstance(result, str):
                    last_error = result
                    print(f"[AI_EXCEL] attempt {attempt + 1}: parse error — {result}")
                    continue
                values = result
                break
            except (TimeoutError, asyncio.TimeoutError):
                last_error = "AI timed out"
                print(f"[AI_EXCEL] attempt {attempt + 1}: timed out")
                continue
            except Exception as e:
                last_error = str(e)
                print(f"[AI_EXCEL] attempt {attempt + 1}: error — {e}")
                continue

        if values is None:
            yield {"data": json.dumps({"type": "error", "row": -1, "error": last_error})}
            yield {"data": "[DONE]"}
            return

        # Stream each value into its cell, retry individual failures
        for i, ri in enumerate(empty_row_indices):
            if await request.is_disconnected():
                return
            if i >= len(values):
                break

            value = _validate_item(values[i], target_col.type, target_col.name, ri)

            # Auto-retry individual cell on validation failure
            if value is None:
                row = sheet.rows[ri] if ri < len(sheet.rows) else []
                ctx_parts = [f"{c.name}={row[ci]}" for ci, c in other_cols if ci < len(row) and row[ci].strip()]
                retry_ctx = ", ".join(ctx_parts) if ctx_parts else "(empty row)"
                retry_prompt = (
                    f"Column: \"{target_col.name}\" (type: {target_col.type})\n"
                    f"Row context: {retry_ctx}\n"
                    f"Instruction: {instruction}\n"
                    f"Generate exactly 1 value. {type_rule}\n"
                    f"Respond with ONLY a JSON array of 1 string."
                )
                for retry in range(MAX_RETRIES):
                    try:
                        retry_resp = await _call_ai(system_prompt, retry_prompt)
                        retry_arr = _parse_array(retry_resp)
                        if isinstance(retry_arr, list) and len(retry_arr) > 0:
                            value = _validate_item(retry_arr[0], target_col.type, target_col.name, ri)
                            if value is not None:
                                print(f"[AI_EXCEL] column={target_col.name}, row={ri}, retry {retry + 1} succeeded")
                                break
                    except Exception:
                        continue

            if value is None:
                yield {"data": json.dumps({"type": "error", "row": ri, "error": "Invalid output after retries"})}
                continue

            try:
                sheet_repo.update_cell(sheet_id, ri, col_index, value)
            except ValueError as e:
                print(f"[AI_EXCEL] column={target_col.name}, row={ri}, value={value}, valid=false ({e})")
                yield {"data": json.dumps({"type": "error", "row": ri, "error": str(e)})}
                continue

            print(f"[AI_EXCEL] column={target_col.name}, row={ri}, value={value}, valid=true")
            yield {"data": json.dumps({"type": "cell", "row": ri, "col": col_index, "value": value})}

        yield {"data": "[DONE]"}

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    import uvicorn
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    print(f"[STARTUP] Event loop policy: {asyncio.get_event_loop_policy().__class__.__name__}")
    uvicorn.run(app, host="127.0.0.1", port=8000, timeout_keep_alive=5, loop="asyncio")
