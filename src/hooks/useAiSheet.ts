import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { resolveRange, resolveCellRef, idxToCol, type Sheet } from "../lib/cellUtils";
import { type SheetSnapshot, MAX_HISTORY } from "./useUndoRedo";
import { toast } from "./useToast";
import type { TuningParams } from "../components/AIControlPanel";

const API_BASE = "http://127.0.0.1:8000";

export function useAiSheet({
  activeSheet,
  setSheets,
  setActiveSheetId,
  setColMenu,
  aiDisabled,
  undoStacks,
  redoStacks,
  syncUndoRedoState,
  tuningParams,
}: {
  activeSheet: Sheet | null;
  setSheets: React.Dispatch<React.SetStateAction<Sheet[]>>;
  setActiveSheetId: React.Dispatch<React.SetStateAction<string | null>>;
  setColMenu: React.Dispatch<React.SetStateAction<{ colIndex: number; x: number; y: number } | null>>;
  aiDisabled: boolean;
  undoStacks: React.MutableRefObject<Map<string, SheetSnapshot[]>>;
  redoStacks: React.MutableRefObject<Map<string, SheetSnapshot[]>>;
  syncUndoRedoState: (sheetId: string) => void;
  tuningParams?: TuningParams;
}) {
  // ── AI Generate (schema → create sheet) ──────────────────────────
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiGenPrompt, setAiGenPrompt] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const aiGenRef = useRef<HTMLInputElement>(null);
  const [aiGenPreview, setAiGenPreview] = useState<{ title: string; columns: { name: string; type: string }[] } | null>(null);

  // ── AI Fill ───────────────────────────────────────────────────────
  const [aiFillOpen, setAiFillOpen] = useState(false);
  const [aiFillCol, setAiFillCol] = useState<number>(0);
  const [aiFillInstruction, setAiFillInstruction] = useState("");
  const [aiFilling, setAiFilling] = useState(false);
  const [aiFillProgress, setAiFillProgress] = useState<string | null>(null);
  const [aiFillErrors, setAiFillErrors] = useState<Map<number, string>>(new Map());
  const [aiFilledRows, setAiFilledRows] = useState<Set<number>>(new Set());
  const aiFillRef = useRef<EventSource | null>(null);
  const aiFillInstructionRef = useRef<HTMLInputElement>(null);

  // ── Generate Rows ─────────────────────────────────────────────────
  const [genRowsOpen, setGenRowsOpen] = useState(false);
  const [genRowsInstruction, setGenRowsInstruction] = useState("");
  const [genRowsCount, setGenRowsCount] = useState(10);
  const [genRowsRunning, setGenRowsRunning] = useState(false);
  const [genRowsProgress, setGenRowsProgress] = useState(0);
  const [genRowsError, setGenRowsError] = useState<string | null>(null);
  const genRowsRef = useRef<EventSource | null>(null);

  // ── AI Operation ──────────────────────────────────────────────────
  const [aiOpOpen, setAiOpOpen] = useState(false);
  const [aiOpMode, setAiOpMode] = useState<"row-wise" | "aggregate" | "matrix">("row-wise");
  const [aiOpSourceStr, setAiOpSourceStr] = useState("");
  const [aiOpTargetStr, setAiOpTargetStr] = useState("");
  const [aiOpInstruction, setAiOpInstruction] = useState("");
  const [aiOpAction, setAiOpAction] = useState<"translate" | "rewrite" | "summarize" | "custom">("translate");
  const [aiOpLanguage, setAiOpLanguage] = useState("Slovak");
  const [aiOpModel, setAiOpModel] = useState<string>("");
  const [aiOpTemp, setAiOpTemp] = useState(0.7);
  const [aiOpLoading, setAiOpLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ name: string; id: string }[]>([]);
  const [activeEngine, setActiveEngine] = useState<string>("mock");

  useEffect(() => {
    axios.get(`${API_BASE}/ai/engines`).then(res => {
      const active = (res.data as { name: string; active: boolean }[]).find(e => e.active);
      if (active) setActiveEngine(active.name);
    }).catch(() => { setActiveEngine("mock"); });
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/ai/models`).then(res => {
      const models = res.data.models.map((m: any) => ({ name: m.filename, id: m.filename }));
      setAvailableModels(models);
      if (models.length > 0) setAiOpModel(models[0].id);
    }).catch(() => { setAvailableModels([]); });
  }, []);

  // ── Schema generation ─────────────────────────────────────────────
  async function generateSchema() {
    if (!aiGenPrompt.trim()) return;
    setAiGenLoading(true);
    setAiGenError(null);
    setAiGenPreview(null);
    try {
      const res = await axios.post(`${API_BASE}/sheets/ai-schema`, {
        prompt: aiGenPrompt.trim(),
        temperature: tuningParams?.temperature,
        max_tokens: tuningParams?.maxTokens,
      });
      setAiGenPreview(res.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setAiGenError(detail || "Failed to generate schema");
    } finally {
      setAiGenLoading(false);
    }
  }

  async function confirmAiGenCreate() {
    if (!aiGenPreview) return;
    try {
      const res = await axios.post(`${API_BASE}/sheets`, {
        title: aiGenPreview.title,
        columns: aiGenPreview.columns,
        rows: [],
      });
      const sheet: Sheet = res.data;
      setSheets((prev) => [sheet, ...prev]);
      setActiveSheetId(sheet.id);
      setAiGenPrompt("");
      setAiGenPreview(null);
      setAiGenOpen(false);
    } catch { /* ignore */ }
  }

  function aiGenUpdateCol(idx: number, field: "name" | "type", value: string) {
    if (!aiGenPreview) return;
    const cols = [...aiGenPreview.columns];
    cols[idx] = { ...cols[idx], [field]: value };
    setAiGenPreview({ ...aiGenPreview, columns: cols });
  }

  function aiGenRemoveCol(idx: number) {
    if (!aiGenPreview) return;
    setAiGenPreview({ ...aiGenPreview, columns: aiGenPreview.columns.filter((_, i) => i !== idx) });
  }

  function aiGenAddCol() {
    if (!aiGenPreview) return;
    setAiGenPreview({ ...aiGenPreview, columns: [...aiGenPreview.columns, { name: "New Column", type: "text" }] });
  }

  // ── AI Fill streaming ─────────────────────────────────────────────
  function runAiFillStream(colIndex: number, instruction: string, label?: string) {
    if (!activeSheet || aiDisabled) return;
    // Push undo snapshot before AI fill modifies cells
    const stack = undoStacks.current.get(activeSheet.id) ?? [];
    stack.push({ columns: activeSheet.columns, rows: activeSheet.rows, formulas: activeSheet.formulas ?? {}, sizes: activeSheet.sizes ?? {}, alignments: activeSheet.alignments ?? {}, formats: activeSheet.formats ?? {} });
    if (stack.length > MAX_HISTORY) stack.shift();
    undoStacks.current.set(activeSheet.id, stack);
    redoStacks.current.set(activeSheet.id, []);
    syncUndoRedoState(activeSheet.id);
    setAiFilling(true);
    setAiFillProgress("Starting...");
    setAiFillErrors(new Map());
    setAiFilledRows(new Set());

    const params = new URLSearchParams({ col_index: String(colIndex), instruction });
    if (tuningParams?.temperature !== undefined) params.set("temperature", String(tuningParams.temperature));
    if (tuningParams?.maxTokens !== undefined) params.set("max_tokens", String(tuningParams.maxTokens));
    const es = new EventSource(`${API_BASE}/sheets/${activeSheet.id}/ai-fill?${params}`);
    aiFillRef.current = es;
    const fillSheetId = activeSheet.id;
    let filledCount = 0;
    let fillCompleted = false;

    function finishFill() {
      if (fillCompleted) return;
      fillCompleted = true;
      es.close();
      aiFillRef.current = null;
      setAiFilling(false);
      // Clear green highlight after 2.5s so user can apply their own colors
      setTimeout(() => setAiFilledRows(new Set()), 2500);
    }

    es.onmessage = (event) => {
      const data = event.data;
      if (data === "[DONE]") {
        setAiFillProgress(`Done — ${label ? label.toLowerCase() + ": " : "filled "}${filledCount} cells`);
        finishFill();
        return;
      }
      try {
        const msg = JSON.parse(data);
        if (msg.type === "cell") {
          filledCount++;
          setAiFillProgress(`${label ?? "Filling"} row ${msg.row + 1}...`);
          setAiFilledRows((prev) => new Set(prev).add(msg.row));
          setSheets((prev) =>
            prev.map((s) => {
              if (s.id !== fillSheetId) return s;
              const newRows = s.rows.map((r, ri) => {
                if (ri !== msg.row) return r;
                const nr = [...r];
                nr[msg.col] = msg.value;
                return nr;
              });
              return { ...s, rows: newRows };
            })
          );
        } else if (msg.type === "error") {
          setAiFillErrors((prev) => new Map(prev).set(msg.row, msg.error));
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (fillCompleted) return;
      setAiFillProgress("Connection lost");
      finishFill();
    };
  }

  function startAiFill() {
    if (!aiFillInstruction.trim()) return;
    runAiFillStream(aiFillCol, aiFillInstruction.trim());
  }

  function cancelAiFill() {
    if (aiFillRef.current) {
      aiFillRef.current.close();
      aiFillRef.current = null;
    }
    setAiFilling(false);
    setAiFillProgress(null);
    setAiFillErrors(new Map());
    setAiFilledRows(new Set());
    setAiOpLoading(false);
  }

  // ── AI Column Tools ───────────────────────────────────────────────
  function colToolClean(ci: number) {
    if (!activeSheet) return;
    const col = activeSheet.columns[ci];
    setColMenu(null);
    runAiFillStream(ci,
      `Clean the existing value in column "${col.name}": trim whitespace, fix capitalization (proper Title Case for names, sentence case for text), fix obvious typos. Return ONLY the cleaned value. If already clean, return unchanged.`,
      "Cleaning"
    );
  }

  function colToolNormalize(ci: number) {
    if (!activeSheet) return;
    const col = activeSheet.columns[ci];
    const existing = activeSheet.rows.map((r) => r[ci] ?? "").filter(Boolean);
    const unique = [...new Set(existing)].slice(0, 20).join(", ");
    setColMenu(null);
    runAiFillStream(ci,
      `Normalize the value in column "${col.name}". Existing values in this column: [${unique}]. Map similar/variant values to a single canonical form (e.g. "in progress"/"In Progress"/"WIP" → "In Progress"). Return ONLY the normalized value.`,
      "Normalizing"
    );
  }

  function colToolCategorize(ci: number) {
    if (!activeSheet) return;
    const col = activeSheet.columns[ci];
    setColMenu(null);
    runAiFillStream(ci,
      `Categorize the value in column "${col.name}" into a short category label (1-3 words). Analyze the free text and assign a concise category. Return ONLY the category label, nothing else.`,
      "Categorizing"
    );
  }

  // ── AI Operation ──────────────────────────────────────────────────
  async function runAiOp() {
    if (!activeSheet) return;
    if (!aiOpSourceStr.trim() || !aiOpTargetStr.trim()) {
      toast("Please specify both source and target cell references.", "error");
      return;
    }
    let finalInstruction = aiOpInstruction.trim();
    if (aiOpAction === "translate") {
      finalInstruction = `Translate to ${aiOpLanguage}`;
    } else if (aiOpAction === "rewrite") {
      finalInstruction = "Rewrite this text to be clearer and more professional.";
    } else if (aiOpAction === "summarize") {
      finalInstruction = "Summarize this text concisely.";
    }
    if (!finalInstruction) {
      toast("Please provide an instruction or prompt.", "error");
      return;
    }
    const source = resolveRange(aiOpSourceStr);
    const target = resolveCellRef(aiOpTargetStr);
    if (!source || !target) {
      toast("Invalid source or target cell reference format (e.g. A1 or A1:B5).", "error");
      return;
    }
    const cellCount = (source.r2 - source.r1 + 1) * (source.c2 - source.c1 + 1);
    if (cellCount > 50) {
      toast("Operation exceeds limit of 50 cells.", "error");
      return;
    }
    let targetR2 = target.row;
    let targetC2 = target.col;
    if (aiOpMode === "row-wise") {
      targetR2 = target.row + (source.r2 - source.r1);
    } else if (aiOpMode === "matrix") {
      targetR2 = target.row + (source.r2 - source.r1);
      targetC2 = target.col + (source.c2 - source.c1);
    }
    const overlap = !(target.col > source.c2 || targetC2 < source.c1 || target.row > source.r2 || targetR2 < source.r1);
    if (overlap) {
      toast("Target range overlaps with source range. Please choose a different target.", "error");
      return;
    }
    setAiOpLoading(true);
    setAiOpOpen(false);
    const params = new URLSearchParams({
      mode: aiOpMode,
      r1: String(source.r1),
      c1: String(source.c1),
      r2: String(source.r2),
      c2: String(source.c2),
      tr: String(target.row),
      tc: String(target.col),
      instruction: finalInstruction,
      temperature: String(aiOpTemp),
    });
    if (aiOpModel) params.set("model", aiOpModel);
    if (tuningParams?.maxTokens) params.set("max_tokens", String(tuningParams.maxTokens));
    const opSheetId = activeSheet.id;
    const es = new EventSource(`${API_BASE}/sheets/${opSheetId}/ai-op?${params}`);
    aiFillRef.current = es;
    let opCompleted = false;

    function finishOp() {
      if (opCompleted) return;
      opCompleted = true;
      es.close();
      aiFillRef.current = null;
      setAiFilling(false);
      setAiOpLoading(false);
    }

    setAiFilling(true);
    setAiFillProgress("Starting AI operation...");

    es.onmessage = (event) => {
      const data = event.data;
      if (data === "[DONE]") {
        setAiFillProgress("Operation complete.");
        finishOp();
        return;
      }
      try {
        const msg = JSON.parse(data);
        if (msg.type === "cell") {
          setAiFillProgress(`Updating cell ${idxToCol(msg.col)}${msg.row + 1}...`);
          setSheets((prev) =>
            prev.map((s) => {
              if (s.id !== opSheetId) return s;
              const newRows = [...s.rows];
              while (newRows.length <= msg.row) newRows.push([]);
              newRows[msg.row] = [...(newRows[msg.row] || [])];
              while (newRows[msg.row].length <= msg.col) newRows[msg.row].push("");
              newRows[msg.row][msg.col] = msg.value;
              return { ...s, rows: newRows };
            })
          );
        } else if (msg.type === "error") {
          toast(`Error at ${msg.row !== undefined ? `row ${msg.row + 1}` : "operation"}: ${msg.error}`, "error");
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      if (opCompleted) return;
      toast("AI operation interrupted.", "error");
      finishOp();
    };
  }

  // ── Generate Rows ─────────────────────────────────────────────────
  function handleGenerateRows() {
    if (!activeSheet || genRowsRunning) return;
    const instruction = genRowsInstruction.trim();
    if (!instruction) return;
    setGenRowsRunning(true);
    setGenRowsProgress(0);
    setGenRowsError(null);

    const params = new URLSearchParams({ instruction, count: String(genRowsCount) });
    const es = new EventSource(`${API_BASE}/sheets/${activeSheet.id}/ai-rows?${params}`);
    genRowsRef.current = es;
    const sheetId = activeSheet.id;
    let completed = false;

    function finishGenRows() {
      if (completed) return;
      completed = true;
      es.close();
      genRowsRef.current = null;
      setGenRowsRunning(false);
    }

    es.onmessage = (e) => {
      if (e.data === "[DONE]") {
        finishGenRows();
        axios.get(`${API_BASE}/sheets/${sheetId}`).then((res) => {
          setSheets((prev) => prev.map((s) => (s.id === sheetId ? res.data : s)));
        }).catch(() => {});
        setTimeout(() => setGenRowsOpen(false), 600);
        return;
      }
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "row") {
          if (!Array.isArray(msg.values)) return;
          setSheets((prev) =>
            prev.map((s) => {
              if (s.id !== sheetId) return s;
              return { ...s, rows: [...s.rows, msg.values] };
            })
          );
          setGenRowsProgress((p) => p + 1);
        } else if (msg.type === "error") {
          setGenRowsError(msg.error || "Unknown error");
          finishGenRows();
        }
      } catch {}
    };
    es.onerror = () => {
      if (completed) return;
      setGenRowsError("Connection error — try again");
      finishGenRows();
    };
  }

  function cancelGenerateRows() {
    const sheetId = activeSheet?.id;
    if (genRowsRef.current) {
      genRowsRef.current.close();
      genRowsRef.current = null;
    }
    setGenRowsRunning(false);
    if (sheetId) {
      axios.get(`${API_BASE}/sheets/${sheetId}`).then((res) => {
        setSheets((prev) => prev.map((s) => (s.id === sheetId ? res.data : s)));
      }).catch(() => {});
    }
  }

  return {
    // AI Generate
    aiGenOpen, setAiGenOpen,
    aiGenPrompt, setAiGenPrompt,
    aiGenLoading,
    aiGenError, setAiGenError,
    aiGenRef,
    aiGenPreview, setAiGenPreview,
    generateSchema,
    confirmAiGenCreate,
    aiGenUpdateCol,
    aiGenRemoveCol,
    aiGenAddCol,
    // AI Fill
    aiFillOpen, setAiFillOpen,
    aiFillCol, setAiFillCol,
    aiFillInstruction, setAiFillInstruction,
    aiFilling,
    aiFillProgress, setAiFillProgress,
    aiFillErrors,
    aiFilledRows,
    aiFillInstructionRef,
    runAiFillStream,
    startAiFill,
    cancelAiFill,
    // Column Tools
    colToolClean,
    colToolNormalize,
    colToolCategorize,
    // Generate Rows
    genRowsOpen, setGenRowsOpen,
    genRowsInstruction, setGenRowsInstruction,
    genRowsCount, setGenRowsCount,
    genRowsRunning,
    genRowsProgress, setGenRowsProgress,
    genRowsError, setGenRowsError,
    handleGenerateRows,
    cancelGenerateRows,
    // AI Op
    aiOpOpen, setAiOpOpen,
    aiOpMode, setAiOpMode,
    aiOpSourceStr, setAiOpSourceStr,
    aiOpTargetStr, setAiOpTargetStr,
    aiOpInstruction, setAiOpInstruction,
    aiOpAction, setAiOpAction,
    aiOpLanguage, setAiOpLanguage,
    aiOpModel, setAiOpModel,
    aiOpTemp, setAiOpTemp,
    aiOpLoading,
    availableModels,
    activeEngine,
    runAiOp,
  };
}
