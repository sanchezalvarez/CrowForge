import json
import asyncio
import os
import threading
import httpx
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dotenv import load_dotenv
from backend.prompts import CONCEPT_SCHEMA_V1

load_dotenv()

class AILogger:
    @staticmethod
    def log_event(engine_name: str, duration: float, request_size: int, is_valid: bool, fallback: bool = False):
        status = "SUCCESS" if is_valid else "FAILED/INVALID"
        fallback_str = " (FALLBACK ACTIVE)" if fallback else ""
        print(f"[AI_TRACE] Engine: {engine_name} | Latency: {duration:.2f}s | Req: {request_size} chars | Status: {status}{fallback_str}")

class AIEngine(ABC):
    @abstractmethod
    async def generate_stream(
        self, system_prompt: str, user_prompt: str, *,
        temperature: float = 0.7, top_p: float = 0.95,
        max_tokens: int = 1024, seed: int | None = None,
    ) -> AsyncGenerator[str, None]:
        pass

class MockAIEngine(AIEngine):
    async def generate_stream(
        self, system_prompt: str, user_prompt: str, *,
        temperature: float = 0.7, top_p: float = 0.95,
        max_tokens: int = 1024, seed: int | None = None,
    ) -> AsyncGenerator[str, None]:
        response_text = json.dumps({"schema_version": "v1", "concepts": [
            {"concept_name": "Mock Concept 1", "rationale": "Mock Rationale 1", "target_audience": "Young professionals aged 25-35", "key_message": "Innovation starts here"},
            {"concept_name": "Mock Concept 2", "rationale": "Mock Rationale 2", "target_audience": "Tech-savvy early adopters", "key_message": "Built for the future"},
            {"concept_name": "Mock Concept 3", "rationale": "Mock Rationale 3", "target_audience": "Small business owners", "key_message": "Grow smarter, not harder"}
        ]})
        for i in range(0, len(response_text), 4):
            yield response_text[i:i+4]
            await asyncio.sleep(0.01)

class HTTPAIEngine(AIEngine):
    def __init__(self):
        self.api_key = os.getenv("LLM_API_KEY", "no-key")
        self.base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.timeout = float(os.getenv("LLM_TIMEOUT", "60.0"))

    async def generate_stream(
        self, system_prompt: str, user_prompt: str, *,
        temperature: float = 0.7, top_p: float = 0.95,
        max_tokens: int = 1024, seed: int | None = None,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            "stream": True,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
        }
        if seed is not None:
            payload["seed"] = seed
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", f"{self.base_url}/chat/completions", json=payload, headers=headers) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            try:
                                chunk = json.loads(line[6:])
                                content = chunk["choices"][0].get("delta", {}).get("content", "")
                                if content: yield content
                            except: continue
            # WinError 10054: remote end reset the connection during SSE teardown.
            # This is normal on Windows when the client (browser/EventSource) closes
            # the tab or navigates away — safe to silence, not a real error.
            except ConnectionResetError as e:
                if getattr(e, 'winerror', None) == 10054:
                    print(f"[HTTP_ENGINE] Client disconnected (WinError 10054) — stream closed cleanly")
                else:
                    yield f"[ERROR] {str(e)}"
            except httpx.ReadTimeout:
                print(f"[HTTP_ENGINE] Upstream LLM timed out after {self.timeout}s")
                yield "[ERROR] LLM request timed out"
            except Exception as e:
                yield f"[ERROR] {str(e)}"

class LocalLLAMAEngine(AIEngine):
    """Local GGUF engine with runtime model hot-swap."""

    def __init__(self, model_path: str | None = None, n_ctx: int | None = None, chat_format: str = "chatml"):
        self.llm = None
        self.is_ready = False
        self.model_path: str | None = None
        self.n_ctx: int = 0
        self.chat_format = chat_format
        self._lock = threading.Lock()
        self._generating = False

        path = model_path or os.getenv("LLM_MODEL_PATH")
        ctx = n_ctx or int(os.getenv("LLM_CTX_SIZE", "2048"))
        if path and os.path.exists(path):
            self._load_model(path, ctx)

    def _load_model(self, model_path: str, n_ctx: int) -> None:
        from llama_cpp import Llama
        with self._lock:
            old = self.llm
            self.is_ready = False
            try:
                self.llm = Llama(
                    model_path=model_path,
                    n_ctx=n_ctx,
                    n_threads=os.cpu_count(),
                    verbose=False,
                    chat_format=self.chat_format,
                )
                self.model_path = model_path
                self.n_ctx = n_ctx
                self.is_ready = True
                print(f"[LOCAL_LLM] Loaded: {os.path.basename(model_path)} (ctx={n_ctx})")
            except Exception as e:
                print(f"[AI_ERROR] Local model failed to load: {e}")
                self.llm = old
                if old is not None:
                    self.is_ready = True

            # Free old model memory
            if old is not None and old is not self.llm:
                del old

    def reload(self, model_path: str, n_ctx: int = 2048) -> str:
        """Reload with a different model. Returns status string. Blocks if generation active."""
        if self._generating:
            return "busy"
        if not os.path.exists(model_path):
            return f"not_found:{model_path}"
        self._load_model(model_path, n_ctx)
        return "ok" if self.is_ready else "failed"

    def get_model_info(self) -> dict:
        return {
            "model_path": self.model_path,
            "model_name": os.path.basename(self.model_path) if self.model_path else None,
            "n_ctx": self.n_ctx,
            "is_ready": self.is_ready,
        }

    async def generate_stream(
        self, system_prompt: str, user_prompt: str, *,
        temperature: float = 0.7, top_p: float = 0.95,
        max_tokens: int = 1024, seed: int | None = None,
    ) -> AsyncGenerator[str, None]:
        if not self.is_ready:
            yield "[ERROR] Local model is not loaded."
            return

        self._generating = True
        try:
            kwargs: dict = dict(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                repeat_penalty=1.3,
                response_format={
                    "type": "json_object",
                    "schema": CONCEPT_SCHEMA_V1
                },
                stream=True,
            )
            if seed is not None:
                kwargs["seed"] = seed

            # Run blocking llama-cpp inference in a thread so we don't
            # starve the asyncio event loop (keeps SSE heartbeats alive).
            response = await asyncio.to_thread(
                self.llm.create_chat_completion, **kwargs
            )

            for chunk in response:
                delta = chunk["choices"][0].get("delta", {})
                if "content" in delta:
                    yield delta["content"]
                    # Yield control so SSE frames flush promptly
                    await asyncio.sleep(0)
        # WinError 10054: client closed connection — harmless on Windows
        except ConnectionResetError as e:
            if getattr(e, 'winerror', None) == 10054:
                print("[LOCAL_LLM] Client disconnected (WinError 10054) — stream closed cleanly")
            else:
                yield f"[ERROR] {str(e)}"
        except Exception as e:
            print(f"[LOCAL_LLM] Generation error: {e}")
            yield f"[ERROR] {str(e)}"
        finally:
            self._generating = False