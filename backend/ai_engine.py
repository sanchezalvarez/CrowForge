import json
import asyncio
import os
import threading
import httpx
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dotenv import load_dotenv

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
        json_mode: bool = True,
    ) -> AsyncGenerator[str, None]:
        pass

class MockAIEngine(AIEngine):
    """Fallback engine when no real LLM is configured. Returns prompt-appropriate mock data."""

    _MOCK_NAMES = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank", "Iris", "Jack"]

    def _build_response(self, system_prompt: str, user_prompt: str) -> str:
        import re
        combined = (system_prompt + " " + user_prompt).lower()

        # --- EXCEL LITE: AI Fill — "generate exactly N values" ---
        m = re.search(r'exactly\s+(\d+)\s+values', combined)
        if m and "spreadsheet" in combined:
            count = int(m.group(1))
            # Pick mock data based on column type hint in prompt
            if "number" in combined:
                values = [str(10 + i * 7) for i in range(count)]
            elif "boolean" in combined:
                values = ["true" if i % 2 == 0 else "false" for i in range(count)]
            elif "date" in combined:
                values = [f"2025-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}" for i in range(count)]
            else:
                values = [self._MOCK_NAMES[i % len(self._MOCK_NAMES)] for i in range(count)]
            return json.dumps(values)

        # --- EXCEL LITE: AI Schema (no rows) ---
        if "schema designer" in combined or "table schema" in combined:
            return json.dumps({
                "title": "Mock Table",
                "columns": [
                    {"name": "Name", "type": "text"},
                    {"name": "Value", "type": "number"},
                    {"name": "Active", "type": "boolean"},
                    {"name": "Date", "type": "date"}
                ]
            })

        # --- DOCUMENT AI: semantic HTML ---
        if "html" in combined or "semantic" in combined:
            return "<h2>Mock Heading</h2><p>This is mock content. Connect a real LLM engine for actual results.</p>"

        # --- GENERIC FALLBACK: plain text, never marketing objects ---
        return "This is a mock response. Connect a real LLM engine (Settings > AI Engine) to get actual results."

    async def generate_stream(
        self, system_prompt: str, user_prompt: str, *,
        temperature: float = 0.7, top_p: float = 0.95,
        max_tokens: int = 1024, seed: int | None = None,
        json_mode: bool = True,
    ) -> AsyncGenerator[str, None]:
        response_text = self._build_response(system_prompt, user_prompt)
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
        json_mode: bool = True,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            "stream": True,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
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
        self.last_used: float = 0.0  # epoch seconds; 0 means never used

        path = model_path or os.getenv("LLM_MODEL_PATH")
        ctx = n_ctx or int(os.getenv("LLM_CTX_SIZE", "2048"))
        if path and os.path.exists(path):
            self._load_model(path, ctx)

    def _load_model(self, model_path: str, n_ctx: int) -> None:
        """Load model; raises on failure so callers can propagate the real error."""
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
                # Free partially-constructed model if different from old
                if self.llm is not old and self.llm is not None:
                    del self.llm
                    self.llm = old
                raise

            # Free old model memory
            if old is not None and old is not self.llm:
                del old

    def reload(self, model_path: str, n_ctx: int = 2048) -> tuple[str, str]:
        """Reload with a different model. Returns (status, error_detail) tuple."""
        if self._generating:
            return "busy", "Generation is in progress"
        if not os.path.exists(model_path):
            return "not_found", f"File not found: {model_path}"
        try:
            self._load_model(model_path, n_ctx)
            return "ok", ""
        except Exception as e:
            return "failed", str(e)

    def unload(self) -> None:
        """Free the loaded model from memory."""
        with self._lock:
            if self.llm is not None:
                old = self.llm
                self.llm = None
                self.is_ready = False
                self.model_path = None
                self.last_used = 0.0
                del old
                print("[LOCAL_LLM] Model unloaded (idle timeout)")

    def get_model_info(self) -> dict:
        return {
            "model_path": self.model_path,
            "model_name": os.path.basename(self.model_path) if self.model_path else None,
            "n_ctx": self.n_ctx,
            "is_ready": self.is_ready,
            "last_used": self.last_used,
        }

    async def generate_stream(
        self, system_prompt: str, user_prompt: str, *,
        temperature: float = 0.7, top_p: float = 0.95,
        max_tokens: int = 1024, seed: int | None = None,
        json_mode: bool = True,
    ) -> AsyncGenerator[str, None]:
        if not self.is_ready:
            yield "[ERROR] Local model is not loaded."
            return

        import time as _time
        self.last_used = _time.time()
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
                stream=True,
                stop=["<|im_start|>", "<|im_end|>", "<|endoftext|>", "Assistant:", "User:"],
            )
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
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