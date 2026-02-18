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

from backend.models import Client, Campaign, CampaignStatus, PromptTemplate, RefineRequest, BenchmarkRun, BenchmarkRequest, ChatSession, ChatMessage, ChatMessageRequest, Document, DocumentCreate, DocumentUpdate, DocumentAIRequest
from backend.storage import DatabaseManager, ClientRepository, CampaignRepository, AppRepository, PromptTemplateRepository, ConceptRevisionRepository, GenerationVersionRepository, BenchmarkRepository, ChatSessionRepository, ChatMessageRepository, DocumentRepository
from backend.ai_engine import MockAIEngine, HTTPAIEngine, LocalLLAMAEngine, AILogger
from backend.ai.engine_manager import AIEngineManager

# Timeout for a full generation pass (seconds). If the active engine
# produces no output within this window, we abort and fall back to mock.
GENERATION_TIMEOUT = float(os.getenv("LLM_GENERATION_TIMEOUT", "120"))
from backend.prompts import (
    CONCEPT_REQUIRED_KEYS,
    DEFAULT_TONE, DEFAULT_STYLE, DEFAULT_CREATIVITY,
    REFINE_ACTION_INSTRUCTIONS,
    resolve_temperature,
    render_template,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseManager("campaigns.db")
db.initialize_schema(get_resource_path("backend/schema.sql"))

client_repo = ClientRepository(db)
campaign_repo = CampaignRepository(db)
app_repo = AppRepository(db)
template_repo = PromptTemplateRepository(db)
template_repo.seed_default()
revision_repo = ConceptRevisionRepository(db)
version_repo = GenerationVersionRepository(db)
benchmark_repo = BenchmarkRepository(db)
chat_session_repo = ChatSessionRepository(db)
chat_message_repo = ChatMessageRepository(db)
document_repo = DocumentRepository(db)

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
        "last_client_id": app_repo.get_setting("last_client_id"),
        "last_campaign_id": app_repo.get_setting("last_campaign_id"),
        "onboarding_completed": app_repo.get_setting("onboarding_completed") == "true"
    }

@app.post("/state")
async def save_state(data: dict):
    if "client_id" in data:
        app_repo.set_setting("last_client_id", str(data["client_id"]))
    if "campaign_id" in data:
        app_repo.set_setting("last_campaign_id", str(data["campaign_id"]))
    if "onboarding_completed" in data:
        app_repo.set_setting("onboarding_completed", "true" if data["onboarding_completed"] else "false")
    return {"status": "saved"}

@app.get("/clients", response_model=List[Client])
async def list_clients():
    return client_repo.get_all()

@app.post("/clients", response_model=Client)
async def create_client(client: Client):
    return client_repo.create(client, client.brand_profile)

@app.get("/campaigns/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: int):
    try:
        camp = campaign_repo.get_by_id(campaign_id)
        if not camp:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return camp
    except Exception as e:
        print(f"ERROR fetching campaign {campaign_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns/client/{client_id}", response_model=List[Campaign])
async def list_campaigns(client_id: int):
    return campaign_repo.get_by_client(client_id)

@app.post("/campaigns", response_model=Campaign)
async def create_campaign(campaign: Campaign):
    return campaign_repo.create(campaign)

# ── Prompt Templates ─────────────────────────────────────────────────

@app.get("/prompt-templates", response_model=List[PromptTemplate])
async def list_templates():
    return template_repo.get_all()

@app.get("/prompt-templates/{template_id}", response_model=PromptTemplate)
async def get_template(template_id: int):
    t = template_repo.get_by_id(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t

@app.post("/prompt-templates", response_model=PromptTemplate)
async def create_template(template: PromptTemplate):
    return template_repo.create(template)

@app.put("/prompt-templates/{template_id}", response_model=PromptTemplate)
async def update_template(template_id: int, template: PromptTemplate):
    existing = template_repo.get_by_id(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    return template_repo.update(template_id, template)

@app.delete("/prompt-templates/{template_id}")
async def delete_template(template_id: int):
    existing = template_repo.get_by_id(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    template_repo.delete(template_id)
    return {"status": "deleted"}

# ── Helper: resolve template for a campaign ──────────────────────────

def resolve_prompts(campaign: Campaign, *, tone: str, style: str, creativity: int, project_type: str, concept_count: int = 3, regen: bool = False, template_id: int | None = None):
    """Return (system_prompt, user_prompt, temperature) using the resolved template."""
    template = None
    # Priority: explicit param > campaign field > default
    tid = template_id or campaign.prompt_template_id
    if tid:
        template = template_repo.get_by_id(tid)
    if not template:
        template = template_repo.get_default()
    if not template:
        raise HTTPException(status_code=500, detail="No prompt template available")

    temperature = resolve_temperature(creativity)

    system_prompt = render_template(
        template.system_prompt,
        tone=tone, style=style, concept_count=concept_count,
        regen=regen, project_type=project_type,
    )
    user_prompt = render_template(
        template.user_prompt,
        project_goals=campaign.brief,
    )

    return system_prompt, user_prompt, temperature


def extract_concepts(full_response: str) -> list:
    """Extract and validate concept list from raw AI response text."""
    text = full_response.strip().replace('```json', '').replace('```', '')

    start_obj = text.find('{')
    end_obj = text.rfind('}')
    start_arr = text.find('[')
    end_arr = text.rfind(']')

    cleaned = None
    if start_obj != -1 and end_obj > start_obj:
        cleaned = text[start_obj:end_obj + 1]
    elif start_arr != -1 and end_arr > start_arr:
        cleaned = text[start_arr:end_arr + 1]

    if not cleaned:
        return []

    data = json.loads(cleaned)

    if isinstance(data, dict):
        for key in ['concepts', 'ideas', 'items', 'campaigns']:
            if key in data and isinstance(data[key], list):
                data = data[key]
                break

    if not isinstance(data, list):
        return []

    return [
        item for item in data
        if isinstance(item, dict) and CONCEPT_REQUIRED_KEYS.issubset(item.keys())
    ]


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


@app.get("/generate/ideas/{campaign_id}")
async def generate_ideas(
    campaign_id: int,
    request: Request,
    tone: str = DEFAULT_TONE,
    style: str = DEFAULT_STYLE,
    creativity: int = DEFAULT_CREATIVITY,
    project_type: str = "campaign",
    temperature: float | None = None,
    top_p: float = 0.95,
    max_tokens: int = 1024,
    seed: int | None = None,
    template_id: int | None = None,
):
    campaign = campaign_repo.get_by_id(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    system_prompt, user_prompt, default_temp = resolve_prompts(
        campaign, tone=tone, style=style, creativity=creativity,
        project_type=project_type, template_id=template_id,
    )
    # Explicit temperature overrides the creativity-derived value
    effective_temp = temperature if temperature is not None else default_temp
    print(f"[PROMPT] tone={tone} style={style} creativity={creativity} temp={effective_temp} top_p={top_p} max_tokens={max_tokens} seed={seed} template_id={campaign.prompt_template_id}")

    async def event_generator():
        start_time = time()
        full_response = ""
        is_valid = False
        used_fallback = False
        campaign_repo.update_status(campaign_id, CampaignStatus.GENERATING)
        active_engine = engine_manager.get_active()
        engine_name = engine_manager.active_name
        print(f"[GENERATE] Using engine: {engine_name}")

        try:
            try:
                # Wrap the entire stream in a timeout so hung engines
                # don't block the connection forever.
                async with asyncio.timeout(GENERATION_TIMEOUT):
                    async for chunk in active_engine.generate_stream(
                        system_prompt, user_prompt,
                        temperature=effective_temp, top_p=top_p,
                        max_tokens=max_tokens, seed=seed,
                    ):
                        if await request.is_disconnected():
                            print(f"[GENERATE] Client disconnected mid-stream")
                            break
                        full_response += chunk
                        yield {"data": chunk}
            except (TimeoutError, asyncio.TimeoutError):
                # Engine took too long — fall back to MockAIEngine so the
                # user still gets a response instead of a hung spinner.
                print(f"[GENERATE] Timeout after {GENERATION_TIMEOUT}s on {engine_name}, falling back to mock")
                used_fallback = True
                full_response = ""
                fallback = MockAIEngine()
                async for chunk in fallback.generate_stream(system_prompt, user_prompt):
                    full_response += chunk
                    yield {"data": chunk}

            try:
                valid_items = extract_concepts(full_response)
                if valid_items:
                    campaign_repo.save_ideas(campaign_id, json.dumps(valid_items))
                    parent = version_repo.get_latest(campaign_id)
                    version_repo.create(campaign_id, json.dumps(valid_items), parent.id if parent else None)
                    is_valid = True
                else:
                    print(f"[AI_DEBUG] No valid concepts extracted")
                    print(f"[AI_RAW_OUTPUT] >> {full_response}")
                    yield {"data": "[ERROR] Invalid JSON — the AI model produced incomplete or malformed output. Try reducing max tokens or creativity."}
            except Exception as e:
                print(f"[AI_DEBUG] JSON Parse Error: {e}")
                print(f"[AI_RAW_OUTPUT] >> {full_response}")
                is_valid = False
                yield {"data": f"[ERROR] JSON parse failed — {e}"}

            campaign_repo.update_status(campaign_id, CampaignStatus.COMPLETED)
            debug_json = _build_debug_payload(
                engine_name=engine_name if not used_fallback else f"{engine_name}→mock(fallback)",
                system_prompt=system_prompt,
                user_prompt=user_prompt, temperature=effective_temp,
                top_p=top_p, max_tokens=max_tokens, seed=seed,
                latency_ms=int((time() - start_time) * 1000),
                response_len=len(full_response),
            )
            if debug_json:
                yield {"data": f"[DEBUG]{debug_json}"}
            # Always emit [DONE] so the frontend closes cleanly
            yield {"data": "[DONE]"}

        # WinError 10054: browser closed the SSE connection. Normal on
        # Windows when user navigates away or closes tab mid-generation.
        except ConnectionResetError as e:
            if getattr(e, 'winerror', None) == 10054:
                print(f"[GENERATE] Client reset connection (WinError 10054)")
            else:
                yield {"data": f"[ERROR] {str(e)}"}
        except Exception as e:
            is_valid = False
            yield {"data": f"[ERROR] {str(e)}"}
        finally:
            duration = time() - start_time
            AILogger.log_event(
                engine_name=engine_name,
                duration=duration,
                request_size=len(user_prompt) + len(system_prompt),
                is_valid=is_valid,
                fallback=used_fallback,
            )

    return EventSourceResponse(event_generator())


@app.get("/generate/idea/{campaign_id}/{concept_index}")
async def regenerate_idea(
    campaign_id: int,
    concept_index: int,
    request: Request,
    tone: str = DEFAULT_TONE,
    style: str = DEFAULT_STYLE,
    creativity: int = DEFAULT_CREATIVITY,
    project_type: str = "campaign",
    temperature: float | None = None,
    top_p: float = 0.95,
    max_tokens: int = 1024,
    seed: int | None = None,
    template_id: int | None = None,
):
    campaign = campaign_repo.get_by_id(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.ideas or concept_index < 0 or concept_index >= len(campaign.ideas):
        raise HTTPException(status_code=400, detail="Invalid concept index")

    system_prompt, user_prompt, default_temp = resolve_prompts(
        campaign, tone=tone, style=style, creativity=creativity,
        project_type=project_type, concept_count=1, regen=True, template_id=template_id,
    )
    effective_temp = temperature if temperature is not None else default_temp
    print(f"[PROMPT] regen tone={tone} style={style} creativity={creativity} temp={effective_temp} top_p={top_p} max_tokens={max_tokens} seed={seed} template_id={campaign.prompt_template_id}")

    async def event_generator():
        start_time = time()
        full_response = ""
        is_valid = False
        used_fallback = False
        active_engine = engine_manager.get_active()
        engine_name = engine_manager.active_name
        print(f"[GENERATE] Using engine: {engine_name}")

        try:
            try:
                async with asyncio.timeout(GENERATION_TIMEOUT):
                    async for chunk in active_engine.generate_stream(
                        system_prompt, user_prompt,
                        temperature=effective_temp, top_p=top_p,
                        max_tokens=max_tokens, seed=seed,
                    ):
                        if await request.is_disconnected():
                            print(f"[GENERATE] Client disconnected mid-stream (regen)")
                            break
                        full_response += chunk
                        yield {"data": chunk}
            except (TimeoutError, asyncio.TimeoutError):
                print(f"[GENERATE] Timeout after {GENERATION_TIMEOUT}s on {engine_name} (regen), falling back to mock")
                used_fallback = True
                full_response = ""
                fallback = MockAIEngine()
                async for chunk in fallback.generate_stream(system_prompt, user_prompt):
                    full_response += chunk
                    yield {"data": chunk}

            try:
                valid_items = extract_concepts(full_response)
                if valid_items:
                    new_concept = valid_items[0]
                    current = campaign_repo.get_by_id(campaign_id)
                    existing = current.ideas if current and current.ideas else []
                    ideas_list = [
                        {"concept_name": idea.get("concept_name", ""), "rationale": idea.get("rationale", "")}
                        for idea in existing
                    ]
                    if concept_index < len(ideas_list):
                        ideas_list[concept_index] = new_concept
                    ideas_json = json.dumps(ideas_list)
                    campaign_repo.save_ideas(campaign_id, ideas_json)
                    parent = version_repo.get_latest(campaign_id)
                    version_repo.create(campaign_id, ideas_json, parent.id if parent else None)
                    is_valid = True
                else:
                    print(f"[AI_DEBUG] Regen: no valid concept extracted")
                    print(f"[AI_RAW_OUTPUT] >> {full_response}")
                    yield {"data": "[ERROR] Invalid JSON — the AI model produced incomplete or malformed output. Try reducing max tokens or creativity."}
            except Exception as e:
                print(f"[AI_DEBUG] Regen JSON Parse Error: {e}")
                print(f"[AI_RAW_OUTPUT] >> {full_response}")
                is_valid = False
                yield {"data": f"[ERROR] JSON parse failed — {e}"}

            debug_json = _build_debug_payload(
                engine_name=engine_name if not used_fallback else f"{engine_name}→mock(fallback)",
                system_prompt=system_prompt,
                user_prompt=user_prompt, temperature=effective_temp,
                top_p=top_p, max_tokens=max_tokens, seed=seed,
                latency_ms=int((time() - start_time) * 1000),
                response_len=len(full_response),
            )
            if debug_json:
                yield {"data": f"[DEBUG]{debug_json}"}
            yield {"data": "[DONE]"}

        except ConnectionResetError as e:
            if getattr(e, 'winerror', None) == 10054:
                print(f"[GENERATE] Client reset connection (WinError 10054) (regen)")
            else:
                yield {"data": f"[ERROR] {str(e)}"}
        except Exception as e:
            is_valid = False
            yield {"data": f"[ERROR] {str(e)}"}
        finally:
            duration = time() - start_time
            AILogger.log_event(
                engine_name=engine_name,
                duration=duration,
                request_size=len(user_prompt) + len(system_prompt),
                is_valid=is_valid,
                fallback=used_fallback,
            )

    return EventSourceResponse(event_generator())


@app.post("/refine")
async def refine_field(req: RefineRequest):
    campaign = campaign_repo.get_by_id(req.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.ideas or req.concept_index < 0 or req.concept_index >= len(campaign.ideas):
        raise HTTPException(status_code=400, detail="Invalid concept index")

    action_instruction = REFINE_ACTION_INSTRUCTIONS.get(req.action)
    if not action_instruction:
        raise HTTPException(status_code=400, detail="Invalid action. Must be refine, expand, or shorten.")

    # Resolve the Refine template from DB
    refine_template = template_repo.get_by_name("Refine")
    if not refine_template:
        raise HTTPException(status_code=500, detail="Refine prompt template not found")

    extra = {"action_instruction": action_instruction, "project_goal": req.project_goal, "current_text": req.current_text}
    system_prompt = render_template(refine_template.system_prompt, extra_vars=extra)
    user_prompt = render_template(refine_template.user_prompt, extra_vars=extra)

    full_response = ""
    try:
        async with asyncio.timeout(GENERATION_TIMEOUT):
            async for chunk in engine_manager.get_active().generate_stream(system_prompt, user_prompt, temperature=0.5):
                full_response += chunk
    except (TimeoutError, asyncio.TimeoutError):
        # Refine timed out — fall back to mock so the user isn't stuck
        print(f"[REFINE] Timeout after {GENERATION_TIMEOUT}s, falling back to mock")
        full_response = ""
        async for chunk in MockAIEngine().generate_stream(system_prompt, user_prompt, temperature=0.5):
            full_response += chunk

    refined_text = full_response.strip()

    # Look up the campaign_idea_id for this concept index
    idea = campaign.ideas[req.concept_index]
    idea_id = idea.get("id")
    if idea_id:
        revision_repo.create(
            campaign_idea_id=idea_id,
            field_name=req.field_name,
            original_text=req.current_text,
            refined_text=refined_text,
            action=req.action,
        )

    return {"refined_text": refined_text}


@app.get("/campaigns/{campaign_id}/versions")
async def list_versions(campaign_id: int):
    versions = version_repo.get_by_campaign(campaign_id)
    result = []
    for v in versions:
        try:
            parsed = json.loads(v.content)
        except Exception:
            parsed = []
        result.append({
            "id": v.id,
            "campaign_id": v.campaign_id,
            "content": parsed,
            "parent_version_id": v.parent_version_id,
            "created_at": v.created_at,
        })
    return result

@app.post("/versions/{version_id}/restore")
async def restore_version(version_id: int):
    version = version_repo.get_by_id(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    campaign_repo.save_ideas(version.campaign_id, version.content)
    parent = version_repo.get_latest(version.campaign_id)
    version_repo.create(version.campaign_id, version.content, parent.id if parent else None)
    campaign = campaign_repo.get_by_id(version.campaign_id)
    return campaign

@app.get("/campaigns/{campaign_id}/export/json")
async def export_json(campaign_id: int):
    try:
        campaign = campaign_repo.get_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return campaign.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns/{campaign_id}/export/markdown")
async def export_markdown(campaign_id: int):
    try:
        campaign = campaign_repo.get_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        md = f"# Campaign Report: {campaign.name}\n\n"
        md += f"## Strategy Brief\n{campaign.brief}\n\n"
        md += "---\n\n"
        md += "## Strategic Concepts\n\n"
        
        for i, idea in enumerate(campaign.ideas):
            md += f"### {i+1}. {idea.get('concept_name', 'Unnamed Concept')}\n"
            md += f"**Rationale:** {idea.get('rationale', 'No rationale provided.')}\n\n"
            
        return {"markdown": md}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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


if __name__ == "__main__":
    import uvicorn
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    print(f"[STARTUP] Event loop policy: {asyncio.get_event_loop_policy().__class__.__name__}")
    uvicorn.run(app, host="127.0.0.1", port=8000, timeout_keep_alive=5, loop="asyncio")
