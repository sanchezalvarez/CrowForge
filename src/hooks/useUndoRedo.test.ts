import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo, MAX_HISTORY } from "./useUndoRedo";
import { Sheet } from "../lib/cellUtils";

vi.mock("axios");
import axios from "axios";

const mockSheet: Sheet = {
  id: "sheet-1",
  title: "Test Sheet",
  columns: [],
  rows: [["original"]],
  formulas: {},
  sizes: {},
  alignments: {},
  formats: {},
  created_at: "",
  updated_at: "",
};

function makeHook(overrides?: { activeSheet?: Sheet | null }) {
  let currentSheets = [mockSheet];
  const setSheets = vi.fn((update: unknown) => {
    if (typeof update === "function") {
      currentSheets = (update as (s: Sheet[]) => Sheet[])(currentSheets);
    }
  });
  const setColWidths = vi.fn();
  const setRowHeights = vi.fn();
  const activeSheet = overrides?.activeSheet !== undefined ? overrides.activeSheet : mockSheet;

  return renderHook(() =>
    useUndoRedo({
      sheets: currentSheets,
      setSheets,
      activeSheet,
      setColWidths,
      setRowHeights,
    })
  );
}

describe("useUndoRedo Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with empty stacks (canUndo and canRedo both false)", () => {
    const { result } = makeHook();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("should set canUndo=true and canRedo=false after an update", () => {
    const { result } = makeHook();
    const updatedSheet = { ...mockSheet, rows: [["updated"]] };

    act(() => {
      result.current.updateSheet(updatedSheet);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("should cap history at MAX_HISTORY entries", () => {
    let currentSheets = [mockSheet];
    const { result } = renderHook(() =>
      useUndoRedo({
        sheets: currentSheets,
        setSheets: (update) => {
          if (typeof update === "function") {
            // @ts-ignore
            currentSheets = update(currentSheets);
          }
        },
        activeSheet: mockSheet,
        setColWidths: vi.fn(),
        setRowHeights: vi.fn(),
      })
    );

    act(() => {
      for (let i = 0; i < MAX_HISTORY + 5; i++) {
        const updated = { ...currentSheets[0], rows: [[`update-${i}`]] };
        result.current.updateSheet(updated);
        currentSheets = [updated];
      }
    });

    // History is capped — canUndo still true, and internal stack exactly MAX_HISTORY
    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoStacks.current.get("sheet-1")).toHaveLength(MAX_HISTORY);
  });

  it("should set canRedo=true and canUndo=false after undoSheet", async () => {
    const { result } = makeHook();
    const updatedSheet = { ...mockSheet, rows: [["updated"]] };

    act(() => {
      result.current.updateSheet(updatedSheet);
    });

    // Mock API returning the original snapshot
    vi.mocked(axios.put).mockResolvedValueOnce({ data: mockSheet });

    await act(async () => {
      await result.current.undoSheet();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("should restore canRedo=false after redoSheet", async () => {
    const { result } = makeHook();
    const updatedSheet = { ...mockSheet, rows: [["updated"]] };

    act(() => {
      result.current.updateSheet(updatedSheet);
    });

    vi.mocked(axios.put).mockResolvedValueOnce({ data: mockSheet });
    await act(async () => {
      await result.current.undoSheet();
    });

    vi.mocked(axios.put).mockResolvedValueOnce({ data: updatedSheet });
    await act(async () => {
      await result.current.redoSheet();
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it("should clear redo stack when a new updateSheet is called after undo", async () => {
    const { result } = makeHook();
    const updatedSheet = { ...mockSheet, rows: [["updated"]] };

    act(() => {
      result.current.updateSheet(updatedSheet);
    });

    vi.mocked(axios.put).mockResolvedValueOnce({ data: mockSheet });
    await act(async () => {
      await result.current.undoSheet();
    });

    expect(result.current.canRedo).toBe(true);

    // New update should wipe the redo stack
    const newSheet = { ...mockSheet, rows: [["new-change"]] };
    act(() => {
      result.current.updateSheet(newSheet);
    });

    expect(result.current.canRedo).toBe(false);
  });
});
