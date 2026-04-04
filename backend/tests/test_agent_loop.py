"""Tests for run_agent_loop — tool retry tracking, malformed args handling."""

import json
import pytest
from backend.ai.agent_loop import run_agent_loop
from backend.ai.tool_registry import ToolRegistry


# ── Helpers ──────────────────────────────────────────────────────────────────

class MockEngine:
    """Minimal mock engine that yields pre-scripted events per iteration."""

    def __init__(self, iterations: list[list[str]]):
        """Each entry in *iterations* is a list of JSON event strings to yield."""
        self._iterations = iterations
        self._call_count = 0

    @property
    def supports_tools(self):
        return True

    async def generate_with_tools(self, *, messages, tools, temperature=0.7, max_tokens=1024):
        idx = min(self._call_count, len(self._iterations) - 1)
        self._call_count += 1
        for event_str in self._iterations[idx]:
            yield event_str


def tool_call_event(name: str, arguments: str, index: int = 0) -> str:
    return json.dumps({
        "type": "tool_call_delta",
        "tool_call": {
            "index": index,
            "function": {"name": name, "arguments": arguments},
        },
    })


def token_event(text: str) -> str:
    return json.dumps({"type": "token", "content": text})


async def collect_events(gen) -> list:
    events = []
    async for event in gen:
        events.append(event)
    return events


# ── Tests ────────────────────────────────────────────────────────────────────

class TestTextOnlyResponse:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.asyncio
    async def test_text_only_returns_final_text(self):
        engine = MockEngine([[token_event("Hello world")]])
        registry = ToolRegistry()
        messages = [{"role": "system", "content": "You are helpful."},
                    {"role": "user", "content": "Hi"}]

        events = await collect_events(
            run_agent_loop(engine, registry, messages)
        )

        assert len(events) == 1
        assert events[0] == "Hello world"


class TestMalformedArgs:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.asyncio
    async def test_malformed_json_args_reports_error(self):
        """Bug #8: malformed tool arguments should emit tool_error, not call the tool."""
        # Engine yields a tool call with invalid JSON arguments, then text on 2nd iteration
        engine = MockEngine([
            [tool_call_event("read_sheet", "not{json")],
            [token_event("Done")],
        ])
        registry = ToolRegistry()
        call_count = 0

        async def read_sheet(**kwargs):
            nonlocal call_count
            call_count += 1
            return {"id": "1"}

        registry.register("read_sheet", read_sheet)
        messages = [{"role": "system", "content": "sys"}, {"role": "user", "content": "go"}]

        events = await collect_events(
            run_agent_loop(engine, registry, messages)
        )

        # Tool handler should NOT have been called
        assert call_count == 0

        # Should have yielded a tool_error event
        error_events = [json.loads(e) for e in events if "tool_error" in e]
        assert len(error_events) >= 1
        assert "Malformed JSON" in error_events[0]["error"]

        # Should have appended a tool message explaining the failure
        tool_msgs = [m for m in messages if m.get("role") == "tool"]
        assert len(tool_msgs) >= 1
        assert "invalid JSON" in tool_msgs[0]["content"]

    @pytest.mark.asyncio
    async def test_malformed_args_count_toward_consecutive_errors(self):
        """Bug #8: 3 consecutive malformed tool calls should stop the agent loop."""
        # 3 iterations, each with malformed args
        engine = MockEngine([
            [tool_call_event("tool_a", "{bad")],
            [tool_call_event("tool_b", "nope")],
            [tool_call_event("tool_c", "!!!")],
        ])
        registry = ToolRegistry()
        for name in ("tool_a", "tool_b", "tool_c"):
            async def handler(**kw):
                return {"ok": True}
            registry.register(name, handler)

        messages = [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}]
        events = await collect_events(
            run_agent_loop(engine, registry, messages)
        )

        # Should end with a "Too many consecutive tool errors" event
        last = json.loads(events[-1])
        assert last["type"] == "error"
        assert "consecutive" in last["message"].lower()


class TestRetryCounter:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.asyncio
    async def test_retry_counter_tracks_by_tool_name(self):
        """Bug #7: retry counter must key by tool name, not unique call_id.
        After MAX_TOOL_RETRIES+1 failures of same tool, feedback says 'permanently failed'."""
        # Engine yields read_sheet tool call on each iteration, then gives up with text
        engine = MockEngine([
            [tool_call_event("read_sheet", '{"sheet_id":"1"}')],
            [tool_call_event("read_sheet", '{"sheet_id":"1"}')],
            [token_event("I give up.")],
        ])
        registry = ToolRegistry()

        async def read_sheet(**kwargs):
            raise ValueError("connection failed")

        registry.register("read_sheet", read_sheet)
        messages = [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}]

        events = await collect_events(
            run_agent_loop(engine, registry, messages)
        )

        # Check that tool messages were appended to message history
        tool_msgs = [m for m in messages if m.get("role") == "tool"]
        assert len(tool_msgs) >= 2

        # First failure: "You may try once more"
        assert "try once more" in tool_msgs[0]["content"].lower() or "may try" in tool_msgs[0]["content"].lower()

        # Second failure of SAME tool: "permanently failed"
        assert "permanently failed" in tool_msgs[1]["content"].lower()
