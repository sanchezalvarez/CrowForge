"""ReAct agent loop: LLM generates with tools, executes tool calls, feeds results back."""

import asyncio
import json
import time
from typing import AsyncGenerator
from backend.ai.tool_registry import ToolRegistry

MAX_ITERATIONS = 6
TOOL_TIMEOUT_SECONDS = 30
MAX_TOOL_RETRIES = 1
MAX_CONSECUTIVE_ERRORS = 3


async def run_agent_loop(
    engine,
    tool_registry: ToolRegistry,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> AsyncGenerator[str, None]:
    """Run the agent loop, yielding SSE-ready string events.

    Events yielded (each is a single SSE `data:` payload):
      - plain text tokens (no JSON wrapping) — only from the final iteration
      - '{"type":"thinking","content":"..."}' — text produced during non-final iterations
      - '{"type":"started_tool","tool":"...","args":{...},"call_id":"..."}'
      - '{"type":"finished_tool","tool":"...","call_id":"...","result":"...","duration_ms":123}'
      - '{"type":"tool_error","tool":"...","call_id":"...","error":"...","duration_ms":123}'
      - '{"type":"error","message":"..."}'
    """
    tools = tool_registry.schemas
    tool_failure_counts: dict[str, int] = {}
    consecutive_errors = 0

    for iteration in range(MAX_ITERATIONS):
        current_text = ""
        tool_calls_collected: list[dict] = []

        async for event_str in engine.generate_with_tools(
            messages=messages,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            try:
                event = json.loads(event_str)
            except (json.JSONDecodeError, TypeError):
                # Plain text token from base-class fallback (no JSON wrapping)
                current_text += event_str
                continue

            # json.loads can return int/float/str/list for valid non-object JSON —
            # only dicts carry structured events.
            if not isinstance(event, dict):
                current_text += event_str
                continue

            evt_type = event.get("type")
            if evt_type == "token":
                token = event.get("content", "")
                current_text += token
                # Don't yield yet — wait to know if tools follow
            elif evt_type == "tool_call_delta":
                tc = event.get("tool_call", {})
                idx = tc.get("index", 0)
                while len(tool_calls_collected) <= idx:
                    tool_calls_collected.append({"name": "", "arguments": ""})
                if tc.get("function", {}).get("name"):
                    tool_calls_collected[idx]["name"] = tc["function"]["name"]
                if tc.get("function", {}).get("arguments"):
                    tool_calls_collected[idx]["arguments"] += tc["function"]["arguments"]
            elif evt_type == "error":
                yield json.dumps({"type": "error", "message": event.get("message", "Unknown error")})
                return

        # ── No tool calls → this is the final iteration ──
        if not tool_calls_collected or not any(tc["name"] for tc in tool_calls_collected):
            if current_text.strip():
                messages.append({"role": "assistant", "content": current_text.strip()})
            # Yield the final text as plain tokens so the frontend renders it normally
            if current_text:
                yield current_text
            return

        # ── Tool calls present → emit thinking text then execute tools ──

        # Any text the LLM produced alongside the tool calls is "thinking" —
        # show it to the user as a structured event, not as the final answer.
        if current_text.strip():
            yield json.dumps({"type": "thinking", "content": current_text.strip()})

        # Build the assistant message with tool_calls for the message history.
        # Only keep the FIRST valid tool call — local models often emit multiple
        # calls before seeing results, causing them to fabricate IDs.
        assistant_msg: dict = {"role": "assistant", "content": current_text or None, "tool_calls": []}
        for i, tc in enumerate(tool_calls_collected):
            if not tc["name"]:
                continue
            assistant_msg["tool_calls"].append({
                "id": f"call_{iteration}_{i}",
                "type": "function",
                "function": {"name": tc["name"], "arguments": tc["arguments"]},
            })
            break  # one tool per turn
        messages.append(assistant_msg)

        # Execute each tool call sequentially
        for tc_msg in assistant_msg["tool_calls"]:
            name = tc_msg["function"]["name"]
            call_id = tc_msg["id"]
            try:
                args = json.loads(tc_msg["function"]["arguments"]) if tc_msg["function"]["arguments"] else {}
            except json.JSONDecodeError:
                args = {}

            # ── started_tool ──
            yield json.dumps({
                "type": "started_tool",
                "tool": name,
                "args": args,
                "call_id": call_id,
            })

            t0 = time.monotonic()
            error_msg = None
            result = None

            try:
                result = await asyncio.wait_for(
                    tool_registry.call(name, args),
                    timeout=TOOL_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                error_msg = f"Tool '{name}' timed out after {TOOL_TIMEOUT_SECONDS}s"
                result = json.dumps({"error": error_msg})
            except Exception as e:
                error_msg = str(e)
                result = json.dumps({"error": error_msg})

            duration_ms = round((time.monotonic() - t0) * 1000)

            # Also check for application-level errors in the result JSON
            if not error_msg and result:
                try:
                    parsed_result = json.loads(result)
                    if isinstance(parsed_result, dict) and "error" in parsed_result:
                        error_msg = parsed_result["error"]
                except (json.JSONDecodeError, TypeError):
                    pass

            if error_msg:
                # Track failure count
                fail_key = f"{name}:{call_id}"
                tool_failure_counts[fail_key] = tool_failure_counts.get(fail_key, 0) + 1
                consecutive_errors += 1

                yield json.dumps({
                    "type": "tool_error",
                    "tool": name,
                    "call_id": call_id,
                    "error": error_msg,
                    "duration_ms": duration_ms,
                })

                if tool_failure_counts[fail_key] <= MAX_TOOL_RETRIES:
                    feedback = f"Tool '{name}' failed: {error_msg}. You may try once more with corrected arguments."
                else:
                    feedback = f"Tool '{name}' permanently failed: {error_msg}. Do not retry this tool — find an alternative or inform the user."

                messages.append({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": feedback,
                })
            else:
                consecutive_errors = 0
                # ── finished_tool ──
                yield json.dumps({
                    "type": "finished_tool",
                    "tool": name,
                    "call_id": call_id,
                    "result": result,
                    "duration_ms": duration_ms,
                })

                messages.append({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": result,
                })

        # Break early if too many consecutive tool errors
        if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
            yield json.dumps({"type": "error", "message": "Too many consecutive tool errors — stopping agent loop."})
            return

        # Loop continues — the LLM gets another turn with tool results

    yield json.dumps({"type": "error", "message": "Agent reached maximum iterations"})
