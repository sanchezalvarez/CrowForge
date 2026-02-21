from __future__ import annotations

import logging
from typing import Dict, Optional

from backend.ai_engine import AIEngine, MockAIEngine, HTTPAIEngine, LocalLLAMAEngine

logger = logging.getLogger(__name__)


class AIEngineManager:
    """Runtime-switchable registry of AI engines."""

    def __init__(self) -> None:
        self._engines: Dict[str, AIEngine] = {}
        self._active_name: Optional[str] = None

    # ── registration ─────────────────────────────────────────────────

    def register(self, name: str, engine: AIEngine, *, enabled: bool = True) -> None:
        self._engines[name] = engine
        logger.info("Registered engine %r (enabled=%s)", name, enabled)

    def _ensure_active(self) -> None:
        if self._active_name is None or self._active_name not in self._engines:
            raise RuntimeError("No active AI engine configured")

    # ── switching ────────────────────────────────────────────────────

    def set_active(self, name: str) -> None:
        if name not in self._engines:
            raise ValueError(f"Unknown engine: {name!r}. Available: {list(self._engines)}")
        self._active_name = name
        logger.info("Active engine set to %r", name)

    def get_active(self) -> AIEngine:
        self._ensure_active()
        return self._engines[self._active_name]

    @property
    def active_name(self) -> str:
        self._ensure_active()
        return self._active_name

    # ── introspection ────────────────────────────────────────────────

    def list_engines(self) -> list[dict]:
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
