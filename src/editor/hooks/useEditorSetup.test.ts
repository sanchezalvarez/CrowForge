/**
 * Regression tests for useEditorSetup — specifically the debounced save
 * flush behavior on document switch (bug #1: edits were silently lost).
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEditorSetup } from "./useEditorSetup";
import type { EditorDocument } from "./useEditorSetup";

// Mock extractOutline so we don't need a real TipTap editor
vi.mock("../utils/editorUtils", () => ({
  extractOutline: () => [],
}));

function makeEditor() {
  return {
    commands: {
      setContent: vi.fn(),
      focus: vi.fn(),
    },
    getText: vi.fn(() => ""),
  } as unknown as import("@tiptap/react").Editor;
}

function makeDoc(id: string): EditorDocument {
  return {
    id,
    title: `Doc ${id}`,
    content_json: { type: "doc", content: [] },
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
  };
}

function makeProps(overrides: Partial<Parameters<typeof useEditorSetup>[0]> = {}) {
  return {
    editor: makeEditor(),
    activeDoc: makeDoc("doc-1"),
    activeDocId: "doc-1",
    outline: [],
    selection: null,
    wordCount: { words: 0, chars: 0 },
    onSave: vi.fn(),
    onOutlineChange: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useEditorSetup — debouncedSave", () => {
  it("fires onSave after 1200ms debounce delay", () => {
    const props = makeProps();
    const { result } = renderHook(() => useEditorSetup(props));

    act(() => {
      result.current.debouncedSave("doc-1", { type: "doc", content: [{ text: "hello" }] });
    });

    // Not called yet
    expect(props.onSave).not.toHaveBeenCalled();

    // Advance past debounce delay
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(props.onSave).toHaveBeenCalledOnce();
    expect(props.onSave).toHaveBeenCalledWith("doc-1", { type: "doc", content: [{ text: "hello" }] });
  });

  it("debounces rapid calls — only last content is saved", () => {
    const props = makeProps();
    const { result } = renderHook(() => useEditorSetup(props));

    act(() => {
      result.current.debouncedSave("doc-1", { v: 1 });
      result.current.debouncedSave("doc-1", { v: 2 });
      result.current.debouncedSave("doc-1", { v: 3 });
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(props.onSave).toHaveBeenCalledOnce();
    expect(props.onSave).toHaveBeenCalledWith("doc-1", { v: 3 });
  });

  it("flushes pending save when activeDocId changes (bug #1 regression)", () => {
    const props = makeProps();
    const { result, rerender } = renderHook(
      (p) => useEditorSetup(p),
      { initialProps: props },
    );

    // Schedule a save for doc-1
    act(() => {
      result.current.debouncedSave("doc-1", { saved: "content" });
    });

    // Switch to doc-2 BEFORE debounce fires (< 1200ms)
    const newProps = {
      ...props,
      activeDoc: makeDoc("doc-2"),
      activeDocId: "doc-2",
    };
    rerender(newProps);

    // The pending save for doc-1 should have been FLUSHED (not discarded)
    expect(props.onSave).toHaveBeenCalledOnce();
    expect(props.onSave).toHaveBeenCalledWith("doc-1", { saved: "content" });
  });
});
