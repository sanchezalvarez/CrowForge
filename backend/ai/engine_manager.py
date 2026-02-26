from __future__ import annotations

import logging
import threading
from typing import Dict, Optional

from backend.ai_engine import AIEngine, MockAIEngine, HTTPAIEngine, LocalLLAMAEngine

logger = logging.getLogger(__name__)


class AIEngineManager:
    """Runtime-switchable registry of AI engines."""

    def __init__(self) -> None:
        self._engines: Dict[str, AIEngine] = {}
        self._active_name: Optional[str] = None
        self._lock = threading.RLock()

    # ── registration ─────────────────────────────────────────────────

    def register(self, name: str, engine: AIEngine) -> None:
        with self._lock:
            self._engines[name] = engine
            logger.info("Registered engine %r", name)

    def _ensure_active(self) -> None:
        if self._active_name is None or self._active_name not in self._engines:
            raise RuntimeError("No active AI engine configured")

    # ── switching ────────────────────────────────────────────────────

    def set_active(self, name: str) -> None:
        with self._lock:
            if name not in self._engines:
                raise ValueError(f"Unknown engine: {name!r}. Available: {list(self._engines)}")
            self._active_name = name
            logger.info("Active engine set to %r", name)

    def get_active(self) -> AIEngine:
        with self._lock:
            self._ensure_active()
            return self._engines[self._active_name]

    @property
    def active_name(self) -> str:
        with self._lock:
            self._ensure_active()
            return self._active_name

    # ── management ───────────────────────────────────────────────────

    def clear(self) -> None:
        """Unregister all engines and reset active selection."""
        with self._lock:
            self._engines.clear()
            self._active_name = None
            logger.info("All engines cleared")

    # ── introspection ────────────────────────────────────────────────

    def list_engines(self) -> list[dict]:
        with self._lock:
            type_map = {
                MockAIEngine: "mock",
                HTTPAIEngine: "http",
                LocalLLAMAEngine: "local",
            }
            return [
                {
                    "name": name,
                    "type": type_map.get(type(engine), "unknown"),
                    "active": name == self._active_name,
                }
                for name, engine in self._engines.items()
            ]
