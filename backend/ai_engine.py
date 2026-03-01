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
    @property
    def supports_tools(self) -> bool:
        """Whether this engine supports tool/function calling for the agent."""
        return False

    @abstractmethod
    async def generate_stream(
        self, system_prompt: str, user_prompt: str, *,
        temperature: float = 0.7, top_p: float = 0.95,
        max_tokens: int = 1024, seed: int | None = None,
        json_mode: bool = True,
    ) -> AsyncGenerator[str, None]:
        pass

    async def generate_with_tools(
        self, *, messages: list[dict], tools: list[dict],
        temperature: float = 0.7, max_tokens: int = 1024,
    ) -> AsyncGenerator[str, None]:
        """Generate with tool-calling support. Yields JSON event strings.
        Default implementation streams text only (no tool calling)."""
        system = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
        non_system = [m for m in messages if m["role"] != "system"]
        user_prompt = "\n".join(f'{m["role"].title()}: {m.get("content", "")}' for m in non_system)
        async for chunk in self.generate_stream(
            system, user_prompt, temperature=temperature, max_tokens=max_tokens, json_mode=False
        ):
            yield chunk

class MockAIEngine(AIEngine):
    """Fallback engine when no real LLM is configured. Returns prompt-appropriate mock data."""

    @property
    def supports_tools(self) -> bool:
        return True

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

    async def generate_with_tools(
        self, *, messages: list[dict], tools: list[dict],
        temperature: float = 0.7, max_tokens: int = 1024,
    ) -> AsyncGenerator[str, None]:
        """Mock agent: if no tool results in history yet, call list_sheets;
        if tool results exist but no read_sheet yet, call read_sheet on first sheet;
        otherwise produce a final text response summarising the data."""
        has_tool_result = any(m.get("role") == "tool" for m in messages)
        has_read_sheet = any(
            m.get("role") == "tool" and "headers" in m.get("content", "")
            for m in messages
        )

        if not has_tool_result:
            # Phase 1: thinking text + list_sheets call
            yield json.dumps({"type": "token", "content": "Let me look at your sheets..."})
            await asyncio.sleep(0.05)
            yield json.dumps({
                "type": "tool_call_delta",
                "tool_call": {
                    "index": 0,
                    "function": {"name": "list_sheets", "arguments": "{}"},
                },
            })
        elif not has_read_sheet:
            # Phase 2: try to read_sheet from the list_sheets result
            # Find the last tool result to extract a sheet id
            sheet_id = "unknown"
            for m in reversed(messages):
                if m.get("role") == "tool":
                    try:
                        data = json.loads(m["content"])
                        if isinstance(data, list) and len(data) > 0 and "id" in data[0]:
                            sheet_id = data[0]["id"]
                    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                        pass
                    break
            yield json.dumps({
                "type": "tool_call_delta",
                "tool_call": {
                    "index": 0,
                    "function": {"name": "read_sheet", "arguments": json.dumps({"sheet_id": sheet_id, "max_rows": 5})},
                },
            })
        else:
            # Phase 3: final text answer
            response = "Here's what I found in your workspace. This is a **mock response** — connect a real LLM engine for actual agent capabilities."
            for i in range(0, len(response), 4):
                yield json.dumps({"type": "token", "content": response[i:i+4]})
                await asyncio.sleep(0.01)

class HTTPAIEngine(AIEngine):
    @property
    def supports_tools(self) -> bool:
        return True

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
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue
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

    async def generate_with_tools(
        self, *, messages: list[dict], tools: list[dict],
        temperature: float = 0.7, max_tokens: int = 1024,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "tools": tools,
            "tool_choice": "auto",
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", f"{self.base_url}/chat/completions", json=payload, headers=headers) as response:
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            break
                        try:
                            chunk = json.loads(raw)
                            delta = chunk["choices"][0].get("delta", {})
                            # Text content
                            if delta.get("content"):
                                yield json.dumps({"type": "token", "content": delta["content"]})
                            # Tool call deltas
                            if delta.get("tool_calls"):
                                for tc in delta["tool_calls"]:
                                    yield json.dumps({"type": "tool_call_delta", "tool_call": tc})
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
            except ConnectionResetError as e:
                if getattr(e, 'winerror', None) == 10054:
                    print(f"[HTTP_ENGINE] Client disconnected (WinError 10054)")
                else:
                    yield json.dumps({"type": "error", "message": str(e)})
            except httpx.ReadTimeout:
                yield json.dumps({"type": "error", "message": "LLM request timed out"})
            except Exception as e:
                yield json.dumps({"type": "error", "message": str(e)})

class LocalLLAMAEngine(AIEngine):
    """Local GGUF engine with runtime model hot-swap."""

    def __init__(self, model_path: str | None = None, n_ctx: int | None = None, chat_format: str = None):
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
                    chat_format=self.chat_format,  # None = auto-detect from GGUF metadata
                )
                self.model_path = model_path
                self.n_ctx = n_ctx
                self.is_ready = True
                print(f"[LOCAL_LLM] Loaded: {os.path.basename(model_path)} (ctx={n_ctx})")
            except Exception as e:
                print(f"[AI_ERROR] Local model failed to load: {e}")
                # Free partially-constructed model if different from old
                failed_llm = self.llm if self.llm is not old else None
                self.llm = old
                if old is not None:
                    self.is_ready = True
                if failed_llm is not None:
                    del failed_llm
                raise

            # Free old model memory
            if old is not None and old is not self.llm:
                del old

    def reload(self, model_path: str, n_ctx: int = 2048) -> tuple[str, str]:
        """Reload with a different model. Returns (status, error_detail) tuple."""
        with self._lock:
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
                stop=["<|im_end|>", "<|endoftext|>", "<|eot_id|>"],
            )
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            if seed is not None:
                kwargs["seed"] = seed

            # Run blocking llama-cpp inference in a thread so we don't
            # starve the asyncio event loop (keeps SSE heartbeats alive).
            queue: asyncio.Queue = asyncio.Queue()
            loop = asyncio.get_event_loop()

            def _run_inference():
                try:
                    response = self.llm.create_chat_completion(**kwargs)
                    for chunk in response:
                        delta = chunk["choices"][0].get("delta", {})
                        if "content" in delta:
                            loop.call_soon_threadsafe(queue.put_nowait, delta["content"])
                    loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel
                except Exception as exc:
                    loop.call_soon_threadsafe(queue.put_nowait, exc)

            # Start inference thread concurrently, drain chunks as they arrive
            inference_task = asyncio.get_event_loop().run_in_executor(None, _run_inference)
            try:
                while True:
                    item = await queue.get()
                    if item is None:
                        break
                    if isinstance(item, Exception):
                        raise item
                    yield item
                    await asyncio.sleep(0)
            finally:
                # Always await the thread so it doesn't leak on exception/cancellation
                await inference_task
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

    @property
    def supports_tools(self) -> bool:
        return self.is_ready

    async def generate_with_tools(
        self, *, messages: list[dict], tools: list[dict],
        temperature: float = 0.7, max_tokens: int = 1024,
    ) -> AsyncGenerator[str, None]:
        if not self.is_ready:
            yield json.dumps({"type": "error", "message": "Local model is not loaded."})
            return

        import time as _time
        self.last_used = _time.time()
        self._generating = True
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _run_inference():
            try:
                # llama-cpp-python streaming with tools is unreliable for some models;
                # use non-streaming to get a complete, well-formed tool call response.
                kwargs = dict(
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stream=False,
                )
                response = self.llm.create_chat_completion(**kwargs)
                message = response["choices"][0].get("message", {})
                # Emit text content if present
                if message.get("content"):
                    loop.call_soon_threadsafe(queue.put_nowait,
                        json.dumps({"type": "token", "content": message["content"]}))
                # Emit tool calls if present
                tool_calls = message.get("tool_calls") or []
                for i, tc in enumerate(tool_calls):
                    fn = tc.get("function", {})
                    args = fn.get("arguments", "{}")
                    # llama-cpp may return arguments as a dict instead of JSON string
                    if isinstance(args, dict):
                        args = json.dumps(args)
                    loop.call_soon_threadsafe(queue.put_nowait,
                        json.dumps({
                            "type": "tool_call_delta",
                            "tool_call": {
                                "index": i,
                                "id": tc.get("id", f"call_{i}"),
                                "function": {"name": fn.get("name", ""), "arguments": args},
                            },
                        }))
                loop.call_soon_threadsafe(queue.put_nowait, None)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)

        inference_task = loop.run_in_executor(None, _run_inference)
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    raise item
                yield item
                await asyncio.sleep(0)
        except ConnectionResetError as e:
            if getattr(e, 'winerror', None) != 10054:
                yield json.dumps({"type": "error", "message": str(e)})
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)})
        finally:
            self._generating = False
            await inference_task