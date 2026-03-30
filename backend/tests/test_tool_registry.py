"""Tests for ToolRegistry — dynamic async tool dispatch."""

import json
import pytest
from backend.ai.tool_registry import ToolRegistry, TOOL_DEFINITIONS



# ── schemas ───────────────────────────────────────────────────────────────────

class TestSchemas:
    def test_no_handlers_empty_schemas(self):
        r = ToolRegistry()
        assert r.schemas == []

    def test_registered_handler_appears_in_schemas(self):
        r = ToolRegistry()

        async def handler():
            return []

        r.register("list_sheets", handler)
        names = [t["function"]["name"] for t in r.schemas]
        assert "list_sheets" in names

    def test_unregistered_tool_excluded_from_schemas(self):
        r = ToolRegistry()

        async def handler():
            return {}

        r.register("read_sheet", handler)
        names = [t["function"]["name"] for t in r.schemas]
        # list_sheets has no handler yet → not in schemas
        assert "list_sheets" not in names

    def test_all_static_definitions_have_name_and_type(self):
        for defn in TOOL_DEFINITIONS:
            assert defn.get("type") == "function"
            assert "name" in defn["function"]


# ── dynamic definitions ───────────────────────────────────────────────────────

class TestDynamicDefinitions:
    def test_dynamic_def_appears_when_handler_registered(self):
        r = ToolRegistry()
        dyn = {
            "type": "function",
            "function": {"name": "custom_tool", "description": "A custom plugin tool.",
                         "parameters": {"type": "object", "properties": {}, "required": []}},
        }
        r.add_dynamic_definition(dyn)

        async def handler():
            return {"ok": True}

        r.register("custom_tool", handler)
        names = [t["function"]["name"] for t in r.schemas]
        assert "custom_tool" in names

    def test_dynamic_def_without_handler_excluded(self):
        r = ToolRegistry()
        dyn = {
            "type": "function",
            "function": {"name": "no_handler_tool", "description": "",
                         "parameters": {"type": "object", "properties": {}, "required": []}},
        }
        r.add_dynamic_definition(dyn)
        names = [t["function"]["name"] for t in r.schemas]
        assert "no_handler_tool" not in names


# ── call ──────────────────────────────────────────────────────────────────────

class TestCall:
    pytestmark = pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_call_registered_handler(self):
        r = ToolRegistry()

        async def list_sheets():
            return [{"id": "1", "title": "Sheet A"}]

        r.register("list_sheets", list_sheets)
        result = await r.call("list_sheets", {})
        data = json.loads(result)
        assert isinstance(data, list)
        assert data[0]["title"] == "Sheet A"

    @pytest.mark.asyncio
    async def test_call_unknown_tool_returns_error_json(self):
        r = ToolRegistry()
        result = await r.call("does_not_exist", {})
        data = json.loads(result)
        assert "error" in data
        assert "does_not_exist" in data["error"]

    @pytest.mark.asyncio
    async def test_call_handler_exception_returns_error_json(self):
        r = ToolRegistry()

        async def bad_handler(**kwargs):
            raise ValueError("something broke")

        r.register("bad", bad_handler)
        result = await r.call("bad", {})
        data = json.loads(result)
        assert "error" in data
        assert "something broke" in data["error"]

    @pytest.mark.asyncio
    async def test_call_passes_args_to_handler(self):
        r = ToolRegistry()
        received = {}

        async def read_sheet(sheet_id: str, max_rows: int = 100):
            received["sheet_id"] = sheet_id
            received["max_rows"] = max_rows
            return {"id": sheet_id}

        r.register("read_sheet", read_sheet)
        await r.call("read_sheet", {"sheet_id": "abc", "max_rows": 5})
        assert received == {"sheet_id": "abc", "max_rows": 5}

    @pytest.mark.asyncio
    async def test_call_result_is_json_serialisable(self):
        r = ToolRegistry()

        async def handler():
            return {"key": "value", "num": 42}

        r.register("mytool", handler)
        result = await r.call("mytool", {})
        # Must not raise
        data = json.loads(result)
        assert data["num"] == 42
