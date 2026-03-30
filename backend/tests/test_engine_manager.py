"""Tests for AIEngineManager — thread-safe engine registry."""

import pytest
from backend.ai.engine_manager import AIEngineManager
from backend.ai_engine import MockAIEngine


def make_manager(*names: str) -> AIEngineManager:
    """Helper: create a manager pre-populated with MockAIEngine instances."""
    m = AIEngineManager()
    for name in names:
        m.register(name, MockAIEngine())
    return m


# ── registration ──────────────────────────────────────────────────────────────

class TestRegister:
    def test_register_single_engine(self):
        m = make_manager("mock")
        engines = m.list_engines()
        assert len(engines) == 1
        assert engines[0]["name"] == "mock"
        assert engines[0]["type"] == "mock"

    def test_register_multiple_engines(self):
        m = make_manager("a", "b", "c")
        names = {e["name"] for e in m.list_engines()}
        assert names == {"a", "b", "c"}

    def test_overwrite_existing_name(self):
        m = make_manager("x")
        original = m.get_engine("x")
        new_engine = MockAIEngine()
        m.register("x", new_engine)
        assert m.get_engine("x") is new_engine
        assert m.get_engine("x") is not original


# ── set_active / get_active ───────────────────────────────────────────────────

class TestSetActive:
    def test_set_active_known_engine(self):
        m = make_manager("mock")
        m.set_active("mock")
        assert m.active_name == "mock"

    def test_get_active_returns_correct_engine(self):
        m = make_manager("alpha", "beta")
        m.set_active("beta")
        assert isinstance(m.get_active(), MockAIEngine)

    def test_set_active_unknown_raises(self):
        m = make_manager("mock")
        with pytest.raises(ValueError, match="Unknown engine"):
            m.set_active("nonexistent")

    def test_get_active_without_set_raises(self):
        m = make_manager("mock")
        with pytest.raises(RuntimeError, match="No active AI engine"):
            m.get_active()

    def test_active_name_without_set_raises(self):
        m = AIEngineManager()
        with pytest.raises(RuntimeError):
            _ = m.active_name

    def test_list_engines_marks_active(self):
        m = make_manager("a", "b")
        m.set_active("a")
        listing = {e["name"]: e["active"] for e in m.list_engines()}
        assert listing["a"] is True
        assert listing["b"] is False


# ── clear ─────────────────────────────────────────────────────────────────────

class TestClear:
    def test_clear_removes_all_engines(self):
        m = make_manager("x", "y")
        m.set_active("x")
        m.clear()
        assert m.list_engines() == []

    def test_clear_resets_active(self):
        m = make_manager("x")
        m.set_active("x")
        m.clear()
        with pytest.raises(RuntimeError):
            m.get_active()

    def test_register_after_clear(self):
        m = make_manager("x")
        m.clear()
        m.register("y", MockAIEngine())
        m.set_active("y")
        assert m.active_name == "y"


# ── get_engine ────────────────────────────────────────────────────────────────

class TestGetEngine:
    def test_get_existing(self):
        m = make_manager("e1")
        assert isinstance(m.get_engine("e1"), MockAIEngine)

    def test_get_missing_returns_none(self):
        m = make_manager("e1")
        assert m.get_engine("missing") is None
