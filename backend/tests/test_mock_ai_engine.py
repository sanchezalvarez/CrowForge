"""Tests for MockAIEngine — prompt-aware mock responses and streaming."""

import json
import pytest
from backend.ai_engine import MockAIEngine



@pytest.fixture
def engine():
    return MockAIEngine()


# ── supports_tools ────────────────────────────────────────────────────────────

def test_supports_tools(engine):
    assert engine.supports_tools is True


# ── _build_response ───────────────────────────────────────────────────────────

class TestBuildResponse:
    def test_generic_fallback(self, engine):
        resp = engine._build_response("", "hello world")
        assert isinstance(resp, str)
        assert len(resp) > 0
        assert "mock" in resp.lower()

    def test_spreadsheet_exactly_n_values_text(self, engine):
        resp = engine._build_response(
            "You are a spreadsheet AI.",
            "Generate exactly 3 values for a text column."
        )
        data = json.loads(resp)
        assert isinstance(data, list)
        assert len(data) == 3

    def test_spreadsheet_exactly_n_values_number(self, engine):
        resp = engine._build_response(
            "spreadsheet",
            "Generate exactly 4 values for a number column."
        )
        data = json.loads(resp)
        assert len(data) == 4
        for v in data:
            int(v)  # must be parseable as integer

    def test_spreadsheet_exactly_n_values_boolean(self, engine):
        resp = engine._build_response(
            "spreadsheet",
            "Generate exactly 6 values for a boolean column."
        )
        data = json.loads(resp)
        assert len(data) == 6
        for v in data:
            assert v in ("true", "false")

    def test_spreadsheet_exactly_n_values_date(self, engine):
        resp = engine._build_response(
            "spreadsheet",
            "Generate exactly 5 values for a date column."
        )
        data = json.loads(resp)
        assert len(data) == 5
        for v in data:
            assert v.startswith("2025-")

    def test_schema_designer(self, engine):
        resp = engine._build_response("schema designer", "create a table schema")
        data = json.loads(resp)
        assert "title" in data
        assert "columns" in data
        assert isinstance(data["columns"], list)
        assert len(data["columns"]) > 0

    def test_table_schema_keyword(self, engine):
        resp = engine._build_response("", "table schema for inventory")
        data = json.loads(resp)
        assert "columns" in data

    def test_html_semantic_response(self, engine):
        resp = engine._build_response("", "write semantic html for a blog post")
        assert "<" in resp and ">" in resp

    def test_html_keyword(self, engine):
        resp = engine._build_response("generate html", "")
        assert "<" in resp


# ── generate_stream ───────────────────────────────────────────────────────────

class TestGenerateStream:
    pytestmark = pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_stream_yields_all_content(self, engine):
        chunks = []
        async for chunk in engine.generate_stream("", "say hi"):
            chunks.append(chunk)
        combined = "".join(chunks)
        assert len(combined) > 0

    @pytest.mark.asyncio
    async def test_stream_chunks_are_strings(self, engine):
        async for chunk in engine.generate_stream("", "test"):
            assert isinstance(chunk, str)

    @pytest.mark.asyncio
    async def test_stream_reassembles_to_build_response(self, engine):
        expected = engine._build_response("", "test prompt")
        chunks = []
        async for chunk in engine.generate_stream("", "test prompt"):
            chunks.append(chunk)
        assert "".join(chunks) == expected


# ── generate_with_tools ───────────────────────────────────────────────────────

class TestGenerateWithTools:
    pytestmark = pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_phase1_emits_list_sheets_tool_call(self, engine):
        messages = [
            {"role": "system", "content": "You are an agent."},
            {"role": "user", "content": "What sheets do I have?"},
        ]
        events = []
        async for chunk in engine.generate_with_tools(messages=messages, tools=[]):
            events.append(json.loads(chunk))

        types = [e["type"] for e in events]
        assert "tool_call_delta" in types
        tool_calls = [e for e in events if e["type"] == "tool_call_delta"]
        assert tool_calls[0]["tool_call"]["function"]["name"] == "list_sheets"

    @pytest.mark.asyncio
    async def test_phase2_emits_read_sheet_tool_call(self, engine):
        sheet_data = json.dumps([{"id": "sheet-1", "title": "My Sheet"}])
        messages = [
            {"role": "system", "content": "You are an agent."},
            {"role": "user", "content": "Analyse the data."},
            {"role": "tool", "content": sheet_data},
        ]
        events = []
        async for chunk in engine.generate_with_tools(messages=messages, tools=[]):
            events.append(json.loads(chunk))

        tool_calls = [e for e in events if e["type"] == "tool_call_delta"]
        assert len(tool_calls) == 1
        assert tool_calls[0]["tool_call"]["function"]["name"] == "read_sheet"
        args = json.loads(tool_calls[0]["tool_call"]["function"]["arguments"])
        assert args["sheet_id"] == "sheet-1"

    @pytest.mark.asyncio
    async def test_phase3_emits_final_text_tokens(self, engine):
        messages = [
            {"role": "system", "content": "agent"},
            {"role": "user", "content": "summarise"},
            {"role": "tool", "content": "[]"},
            {"role": "tool", "content": json.dumps({"headers": ["a"], "rows": []})},
        ]
        events = []
        async for chunk in engine.generate_with_tools(messages=messages, tools=[]):
            events.append(json.loads(chunk))

        token_events = [e for e in events if e["type"] == "token"]
        assert len(token_events) > 0
        full_text = "".join(e["content"] for e in token_events)
        assert len(full_text) > 0
