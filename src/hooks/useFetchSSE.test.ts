import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFetchSSE } from "./useFetchSSE";

// Helper: build a ReadableStream from an array of SSE-formatted strings
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockFetch(chunks: string[], status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      body: makeStream(chunks),
    })
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useFetchSSE", () => {
  it("calls onToken for each data line and onDone on [DONE]", async () => {
    mockFetch(["data: hello\n\ndata: world\n\ndata: [DONE]\n\n"]);
    const { result } = renderHook(() => useFetchSSE());

    const tokens: string[] = [];
    let done = false;

    await act(async () => {
      await result.current.start(
        "http://test/stream",
        { prompt: "hi" },
        {
          onToken: (t) => tokens.push(t),
          onDone: () => { done = true; },
          onError: (e) => { throw new Error(e); },
        }
      );
    });

    expect(tokens).toEqual(["hello", "world"]);
    expect(done).toBe(true);
  });

  it("calls onError for [ERROR] payload", async () => {
    mockFetch(["data: [ERROR] something went wrong\n\n"]);
    const { result } = renderHook(() => useFetchSSE());

    let errorMsg = "";
    await act(async () => {
      await result.current.start("http://test", {}, {
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: (e) => { errorMsg = e; },
      });
    });

    expect(errorMsg).toBe("something went wrong");
  });

  it("calls onError on HTTP error status", async () => {
    mockFetch([], 500);
    const { result } = renderHook(() => useFetchSSE());

    let errorMsg = "";
    await act(async () => {
      await result.current.start("http://test", {}, {
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: (e) => { errorMsg = e; },
      });
    });

    expect(errorMsg).toBe("HTTP 500");
  });

  it("fires onStructuredEvent for JSON agent events", async () => {
    const event = JSON.stringify({ type: "thinking", content: "reasoning..." });
    mockFetch([`data: ${event}\n\ndata: [DONE]\n\n`]);
    const { result } = renderHook(() => useFetchSSE());

    const structuredEvents: unknown[] = [];
    const tokens: string[] = [];

    await act(async () => {
      await result.current.start("http://test", {}, {
        onToken: (t) => tokens.push(t),
        onDone: vi.fn(),
        onError: vi.fn(),
        onStructuredEvent: (e) => structuredEvents.push(e),
      });
    });

    expect(structuredEvents).toHaveLength(1);
    expect((structuredEvents[0] as { type: string }).type).toBe("thinking");
    // structured events should NOT be forwarded to onToken
    expect(tokens).toHaveLength(0);
  });

  it("treats plain JSON (non-agent) as a regular token", async () => {
    const json = JSON.stringify({ foo: "bar" });
    mockFetch([`data: ${json}\n\ndata: [DONE]\n\n`]);
    const { result } = renderHook(() => useFetchSSE());

    const tokens: string[] = [];
    await act(async () => {
      await result.current.start("http://test", {}, {
        onToken: (t) => tokens.push(t),
        onDone: vi.fn(),
        onError: vi.fn(),
        onStructuredEvent: vi.fn(),
      });
    });

    expect(tokens).toEqual([json]);
  });

  it("calls onDone when stream ends without explicit [DONE]", async () => {
    mockFetch(["data: token\n\n"]);
    const { result } = renderHook(() => useFetchSSE());

    let done = false;
    await act(async () => {
      await result.current.start("http://test", {}, {
        onToken: vi.fn(),
        onDone: () => { done = true; },
        onError: vi.fn(),
      });
    });

    expect(done).toBe(true);
  });

  it("cancel aborts an in-flight request silently", async () => {
    // fetch that never resolves
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    const { result } = renderHook(() => useFetchSSE());

    let errorCalled = false;
    act(() => {
      result.current.start("http://test", {}, {
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: () => { errorCalled = true; },
      });
      result.current.cancel();
    });

    // Give microtask queue a chance to flush
    await act(async () => {});
    expect(errorCalled).toBe(false);
  });

  it("handles multi-chunk delivery (split across reads)", async () => {
    // Simulate the SSE data arriving in two separate network chunks
    mockFetch(["data: hel", "lo\n\ndata: [DONE]\n\n"]);
    const { result } = renderHook(() => useFetchSSE());

    const tokens: string[] = [];
    await act(async () => {
      await result.current.start("http://test", {}, {
        onToken: (t) => tokens.push(t),
        onDone: vi.fn(),
        onError: vi.fn(),
      });
    });

    expect(tokens).toEqual(["hello"]);
  });
});
