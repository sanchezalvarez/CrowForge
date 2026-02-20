import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import os
import json
from typing import List, Optional
from time import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

load_dotenv()

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.abspath(relative_path)

from backend.models import PromptTemplate, BenchmarkRun, BenchmarkRequest, ChatSession, ChatMessage, ChatMessageRequest, Document, DocumentCreate, DocumentUpdate, DocumentAIRequest, Sheet, SheetCreate, SheetColumn, SheetAddColumn, SheetUpdateCell, SheetDeleteRow, SheetDeleteColumn
from backend.storage import DatabaseManager, AppRepository, PromptTemplateRepository, BenchmarkRepository, ChatSessionRepository, ChatMessageRepository, DocumentRepository, SheetRepository
from backend.ai_engine import MockAIEngine, HTTPAIEngine, LocalLLAMAEngine, AILogger
from backend.ai.engine_manager import AIEngineManager

# Timeout for a full generation pass (seconds). If the active engine
# produces no output within this window, we abort and fall back to mock.
GENERATION_TIMEOUT = float(os.getenv("LLM_GENERATION_TIMEOUT", "120"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseManager("campaigns.db")
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
LLM_MODELS_DIR = os.getenv("LLM_MODELS_DIR", "C:/model")

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
    if not DEBUG_AI:
        return None
    try:
        token_estimate = (len(system_prompt) + len(user_prompt)) // 4
        return json.dumps({
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
        })
    except Exception:
        return None


@app.get("/ai/debug")
async def get_debug_status():
    return {"enabled": DEBUG_AI}


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

    result = local.reload(model_path, n_ctx=ctx)

    if result == "busy":
        raise HTTPException(status_code=409, detail="Cannot reload while generation is in progress")
    if result.startswith("not_found"):
        raise HTTPException(status_code=404, detail=f"Model file not found: {filename}")
    if result == "failed":
        raise HTTPException(status_code=500, detail="Model failed to load — previous model restored if available")

    return {"status": "ok", "model": local.get_model_info()}


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
                result = engine.reload(model_path, n_ctx=int(os.getenv("LLM_CTX_SIZE", "2048")))
                if result != "ok":
                    run = BenchmarkRun(
                        input_text=req.input_text,
                        engine_name=engine_name,
                        model_name=model_filename,
                        temperature=req.temperature,
                        max_tokens=req.max_tokens,
                        error=f"Model swap failed: {result}",
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
