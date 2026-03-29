import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo, MAX_HISTORY } from "./useUndoRedo";
import { Sheet } from "../lib/cellUtils";

// Mock sheet data
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
  updated_at: ""
};

describe("useUndoRedo Hook", () => {
  it("should initialize with empty stacks", () => {
    const setSheets = vi.fn();
    const setColWidths = vi.fn();
    const setRowHeights = vi.fn();
    
    const { result } = renderHook(() => useUndoRedo({
      sheets: [mockSheet],
      setSheets,
      activeSheet: mockSheet,
      setColWidths,
      setRowHeights
    }));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("should push to undo stack when sheet is updated", () => {
    const setSheets = vi.fn();
    const setColWidths = vi.fn();
    const setRowHeights = vi.fn();
    
    const { result } = renderHook(() => useUndoRedo({
      sheets: [mockSheet],
      setSheets,
      activeSheet: mockSheet,
      setColWidths,
      setRowHeights
    }));

    const updatedSheet = { ...mockSheet, rows: [["updated"]] };
    
    act(() => {
      result.current.updateSheet(updatedSheet);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoStacks.current.get("sheet-1")).toHaveLength(1);
    expect(result.current.undoStacks.current.get("sheet-1")![0].rows).toEqual([["original"]]);
  });

  it("should limit the history to MAX_HISTORY", () => {
    const setSheets = vi.fn();
    const setColWidths = vi.fn();
    const setRowHeights = vi.fn();
    
    let currentSheets = [mockSheet];
    const { result } = renderHook(() => useUndoRedo({
      sheets: currentSheets,
      setSheets: (update) => {
        if (typeof update === 'function') {
           // @ts-ignore
           currentSheets = update(currentSheets);
        }
      },
      activeSheet: mockSheet,
      setColWidths,
      setRowHeights
    }));

    // Perform MAX_HISTORY + 5 updates
    act(() => {
      for (let i = 0; i < MAX_HISTORY + 5; i++) {
        const updated = { ...currentSheets[0], rows: [[`update-${i}`]] };
        result.current.updateSheet(updated);
        currentSheets = [updated];
      }
    });

    expect(result.current.undoStacks.current.get("sheet-1")).toHaveLength(MAX_HISTORY);
  });
});
