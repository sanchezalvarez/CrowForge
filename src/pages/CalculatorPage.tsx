/** Scientific Calculator — standalone tool, no AI features. */
import { useState, useEffect, useCallback, useRef } from "react";
import { Calculator, History, Delete, Trash2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry {
  expression: string;
  result: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Safe expression parser (recursive descent — no eval / no Function)
// ---------------------------------------------------------------------------

interface Token {
  type: "number" | "op" | "lparen" | "rparen" | "func";
  value: number | string;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = expr.replace(/\s+/g, "");

  while (i < src.length) {
    const ch = src[i];

    // Numbers (including decimals)
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < src.length && /[0-9.]/.test(src[i])) {
        num += src[i++];
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    // Named functions and constants
    if (/[a-zA-Z]/.test(ch)) {
      let name = "";
      while (i < src.length && /[a-zA-Z0-9]/.test(src[i])) {
        name += src[i++];
      }
      const lower = name.toLowerCase();
      if (lower === "pi") {
        tokens.push({ type: "number", value: Math.PI });
      } else if (lower === "e" && (i >= src.length || !/[a-zA-Z]/.test(src[i]))) {
        tokens.push({ type: "number", value: Math.E });
      } else {
        tokens.push({ type: "func", value: lower });
      }
      continue;
    }

    if (ch === "(") { tokens.push({ type: "lparen", value: "(" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen", value: ")" }); i++; continue; }
    if ("+-*/^%".includes(ch)) { tokens.push({ type: "op", value: ch }); i++; continue; }

    // Skip unknown characters
    i++;
  }
  return tokens;
}

/*
 * Grammar:
 *   expr     → term (('+' | '-') term)*
 *   term     → power (('*' | '/' | '%') power)*
 *   power    → unary ('^' unary)*
 *   unary    → ('-' | '+') unary | call
 *   call     → FUNC '(' expr ')' | primary
 *   primary  → NUMBER | '(' expr ')'
 */

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  parse(): number {
    const result = this.expr();
    if (this.pos < this.tokens.length) {
      throw new Error("Unexpected token");
    }
    return result;
  }

  private expr(): number {
    let left = this.term();
    while (this.peek()?.type === "op" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
      const op = this.advance().value;
      const right = this.term();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private term(): number {
    let left = this.power();
    while (
      this.peek()?.type === "op" &&
      (this.peek()!.value === "*" || this.peek()!.value === "/" || this.peek()!.value === "%")
    ) {
      const op = this.advance().value;
      const right = this.power();
      if (op === "*") left = left * right;
      else if (op === "/") left = left / right;
      else left = left % right;
    }
    return left;
  }

  private power(): number {
    let base = this.unary();
    while (this.peek()?.type === "op" && this.peek()!.value === "^") {
      this.advance();
      const exp = this.unary();
      base = Math.pow(base, exp);
    }
    return base;
  }

  private unary(): number {
    if (this.peek()?.type === "op" && (this.peek()!.value === "-" || this.peek()!.value === "+")) {
      const op = this.advance().value;
      const val = this.unary();
      return op === "-" ? -val : val;
    }
    return this.call();
  }

  private call(): number {
    if (this.peek()?.type === "func") {
      const fn = String(this.advance().value);
      if (this.peek()?.type !== "lparen") throw new Error(`Expected ( after ${fn}`);
      this.advance(); // consume (
      const arg = this.expr();
      if (this.peek()?.type !== "rparen") throw new Error(`Expected ) after ${fn} argument`);
      this.advance(); // consume )
      switch (fn) {
        case "sin": return Math.sin(arg);
        case "cos": return Math.cos(arg);
        case "tan": return Math.tan(arg);
        case "log": return Math.log10(arg);
        case "ln": return Math.log(arg);
        case "sqrt": return Math.sqrt(arg);
        case "abs": return Math.abs(arg);
        default: throw new Error(`Unknown function: ${fn}`);
      }
    }
    return this.primary();
  }

  private primary(): number {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of expression");

    if (t.type === "number") {
      this.advance();
      return t.value as number;
    }

    if (t.type === "lparen") {
      this.advance(); // consume (
      const val = this.expr();
      if (this.peek()?.type !== "rparen") throw new Error("Missing closing parenthesis");
      this.advance(); // consume )
      return val;
    }

    throw new Error("Unexpected token");
  }
}

function safeEvaluate(expression: string): string {
  try {
    if (!expression.trim()) return "";
    // Normalise display symbols to parseable form
    let normalized = expression
      .replace(/\u00d7/g, "*")  // ×
      .replace(/\u00f7/g, "/")  // ÷
      .replace(/\u03c0/g, "pi") // π
      .replace(/\u221a\(/g, "sqrt(") // √(
      .replace(/\u221a/g, "sqrt(")   // bare √ — user may type √9
      ;

    const tokens = tokenize(normalized);
    const parser = new Parser(tokens);
    const result = parser.parse();

    if (!isFinite(result)) return "Error";
    // Remove floating point noise
    const rounded = parseFloat(result.toPrecision(12));
    return String(rounded);
  } catch {
    return "Error";
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const HISTORY_KEY = "crowforge-calc-history";
const MEMORY_KEY = "crowforge-calc-memory";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function loadMemory(): number {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? parseFloat(raw) : 0;
  } catch {
    return 0;
  }
}

function saveMemory(value: number) {
  localStorage.setItem(MEMORY_KEY, String(value));
}

// ---------------------------------------------------------------------------
// Format helper
// ---------------------------------------------------------------------------

function formatResult(value: string): string {
  if (value === "Error" || value === "") return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  // Large or tiny numbers get scientific notation
  if (Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-8 && num !== 0)) {
    return num.toExponential(6);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalculatorPage() {
  const [expression, setExpression] = useState("");
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [memory, setMemory] = useState<number>(loadMemory);
  const [showHistory, setShowHistory] = useState(true);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Live preview
  useEffect(() => {
    if (expression) {
      const result = safeEvaluate(expression);
      setPreview(result === "Error" ? "" : formatResult(result));
    } else {
      setPreview("");
    }
  }, [expression]);

  // Persist history
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Persist memory
  useEffect(() => {
    saveMemory(memory);
  }, [memory]);

  // Scroll display to end
  useEffect(() => {
    if (displayRef.current) {
      displayRef.current.scrollLeft = displayRef.current.scrollWidth;
    }
  }, [expression]);

  // ------- Actions -------

  const append = useCallback((value: string) => {
    setLastResult(null);
    setExpression((prev) => prev + value);
  }, []);

  const handleEquals = useCallback(() => {
    if (!expression) return;
    const result = safeEvaluate(expression);
    if (result !== "Error" && result !== "") {
      setHistory((prev) => [
        { expression, result, timestamp: Date.now() },
        ...prev.slice(0, 99), // keep last 100
      ]);
      setLastResult(result);
      setExpression(result);
    } else {
      setLastResult("Error");
    }
  }, [expression]);

  const handleClear = useCallback(() => {
    setExpression("");
    setPreview("");
    setLastResult(null);
  }, []);

  const handleClearEntry = useCallback(() => {
    // Remove last number or operator token
    setExpression((prev) => {
      const match = prev.match(/(.*?)(\d+\.?\d*|[a-zA-Z]+\(|.)$/);
      return match ? match[1] : "";
    });
    setLastResult(null);
  }, []);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1));
    setLastResult(null);
  }, []);

  const handleToggleSign = useCallback(() => {
    setExpression((prev) => {
      if (!prev) return prev;
      if (prev.startsWith("-")) return prev.slice(1);
      return "-" + prev;
    });
  }, []);

  const handlePercent = useCallback(() => {
    const result = safeEvaluate(expression);
    if (result !== "Error" && result !== "") {
      const pct = parseFloat(result) / 100;
      setExpression(String(pct));
    }
  }, [expression]);

  const handleSquare = useCallback(() => {
    append("^2");
  }, [append]);

  const handlePower = useCallback(() => {
    append("^");
  }, [append]);

  const handleSqrt = useCallback(() => {
    append("sqrt(");
  }, [append]);

  const handleMemoryClear = useCallback(() => { setMemory(0); }, []);
  const handleMemoryRecall = useCallback(() => { setExpression((p) => p + String(memory)); }, [memory]);
  const handleMemoryAdd = useCallback(() => {
    const result = safeEvaluate(expression);
    if (result !== "Error" && result !== "") setMemory((m) => m + parseFloat(result));
  }, [expression]);
  const handleMemorySub = useCallback(() => {
    const result = safeEvaluate(expression);
    if (result !== "Error" && result !== "") setMemory((m) => m - parseFloat(result));
  }, [expression]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setExpression(entry.result);
    setLastResult(null);
  }, []);

  // ------- Keyboard input -------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      if (e.key >= "0" && e.key <= "9") { append(e.key); e.preventDefault(); }
      else if (e.key === ".") { append("."); e.preventDefault(); }
      else if (e.key === "+") { append("+"); e.preventDefault(); }
      else if (e.key === "-") { append("-"); e.preventDefault(); }
      else if (e.key === "*") { append("\u00d7"); e.preventDefault(); }
      else if (e.key === "/") { append("\u00f7"); e.preventDefault(); }
      else if (e.key === "%") { handlePercent(); e.preventDefault(); }
      else if (e.key === "(" || e.key === ")") { append(e.key); e.preventDefault(); }
      else if (e.key === "^") { append("^"); e.preventDefault(); }
      else if (e.key === "Enter" || e.key === "=") { handleEquals(); e.preventDefault(); }
      else if (e.key === "Backspace") { handleBackspace(); e.preventDefault(); }
      else if (e.key === "Escape") { handleClear(); e.preventDefault(); }
      else if (e.key === "Delete") { handleClearEntry(); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [append, handleEquals, handleBackspace, handleClear, handleClearEntry, handlePercent]);

  // ------- Button definitions -------

  type CalcButton = {
    label: string;
    action: () => void;
    className?: string;
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
    span?: number;
  };

  const memoryRow: CalcButton[] = [
    { label: "MC", action: handleMemoryClear, variant: "ghost", className: "text-xs text-muted-foreground" },
    { label: "MR", action: handleMemoryRecall, variant: "ghost", className: "text-xs text-muted-foreground" },
    { label: "M+", action: handleMemoryAdd, variant: "ghost", className: "text-xs text-muted-foreground" },
    { label: "M\u2212", action: handleMemorySub, variant: "ghost", className: "text-xs text-muted-foreground" },
  ];

  const scientificRow1: CalcButton[] = [
    { label: "sin", action: () => append("sin("), variant: "secondary", className: "text-xs" },
    { label: "cos", action: () => append("cos("), variant: "secondary", className: "text-xs" },
    { label: "tan", action: () => append("tan("), variant: "secondary", className: "text-xs" },
    { label: "log", action: () => append("log("), variant: "secondary", className: "text-xs" },
    { label: "ln", action: () => append("ln("), variant: "secondary", className: "text-xs" },
  ];

  const scientificRow2: CalcButton[] = [
    { label: "\u221a", action: handleSqrt, variant: "secondary" },
    { label: "x\u00b2", action: handleSquare, variant: "secondary", className: "text-xs" },
    { label: "x\u02b8", action: handlePower, variant: "secondary", className: "text-xs" },
    { label: "\u03c0", action: () => append("\u03c0"), variant: "secondary" },
    { label: "e", action: () => append("e"), variant: "secondary" },
  ];

  const mainGrid: CalcButton[][] = [
    [
      { label: "C", action: handleClear, variant: "destructive" },
      { label: "CE", action: handleClearEntry, variant: "outline", className: "text-xs" },
      { label: "(", action: () => append("("), variant: "outline" },
      { label: ")", action: () => append(")"), variant: "outline" },
      { label: "\u00f7", action: () => append("\u00f7"), variant: "secondary", className: "text-lg text-primary" },
    ],
    [
      { label: "7", action: () => append("7"), variant: "outline" },
      { label: "8", action: () => append("8"), variant: "outline" },
      { label: "9", action: () => append("9"), variant: "outline" },
      { label: "\u00d7", action: () => append("\u00d7"), variant: "secondary", className: "text-lg text-primary" },
      { label: "%", action: handlePercent, variant: "secondary" },
    ],
    [
      { label: "4", action: () => append("4"), variant: "outline" },
      { label: "5", action: () => append("5"), variant: "outline" },
      { label: "6", action: () => append("6"), variant: "outline" },
      { label: "\u2212", action: () => append("-"), variant: "secondary", className: "text-lg text-primary" },
      { label: "\u232b", action: handleBackspace, variant: "secondary" },
    ],
    [
      { label: "1", action: () => append("1"), variant: "outline" },
      { label: "2", action: () => append("2"), variant: "outline" },
      { label: "3", action: () => append("3"), variant: "outline" },
      { label: "+", action: () => append("+"), variant: "secondary", className: "text-lg text-primary" },
      { label: "\u00b1", action: handleToggleSign, variant: "secondary" },
    ],
    [
      { label: "0", action: () => append("0"), variant: "outline", span: 2 },
      { label: ".", action: () => append("."), variant: "outline" },
      { label: "=", action: handleEquals, variant: "default", span: 2, className: "text-lg font-bold" },
    ],
  ];

  return (
    <div className="flex h-full w-full items-start justify-center gap-4 overflow-auto p-6">
      {/* Calculator body */}
      <div className="flex w-full max-w-md flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-lg">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calculator className="h-5 w-5" />
            <span className="text-sm font-medium">Scientific Calculator</span>
          </div>
          <div className="flex items-center gap-1">
            {memory !== 0 && (
              <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                M
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowHistory((p) => !p)}
              title="Toggle history"
            >
              <History className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Display */}
        <div className="mb-3 rounded-xl border border-border bg-background p-4">
          <div
            ref={displayRef}
            className="scrollbar-none overflow-x-auto whitespace-nowrap text-right font-mono text-2xl font-light tracking-wide text-foreground"
          >
            {expression || <span className="text-muted-foreground/50">0</span>}
          </div>
          <div className="mt-1 h-6 text-right font-mono text-sm text-muted-foreground">
            {lastResult !== null ? (
              <span className={cn(lastResult === "Error" ? "text-destructive" : "text-primary")}>
                = {formatResult(lastResult)}
              </span>
            ) : preview ? (
              <span className="opacity-60">= {preview}</span>
            ) : null}
          </div>
        </div>

        {/* Memory row */}
        <div className="mb-1 grid grid-cols-4 gap-1">
          {memoryRow.map((btn) => (
            <Button
              key={btn.label}
              variant={btn.variant ?? "outline"}
              className={cn("h-8", btn.className)}
              onClick={btn.action}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        {/* Scientific rows */}
        <div className="mb-1 grid grid-cols-5 gap-1">
          {scientificRow1.map((btn) => (
            <Button
              key={btn.label}
              variant={btn.variant ?? "outline"}
              className={cn("h-9", btn.className)}
              onClick={btn.action}
            >
              {btn.label}
            </Button>
          ))}
        </div>
        <div className="mb-2 grid grid-cols-5 gap-1">
          {scientificRow2.map((btn) => (
            <Button
              key={btn.label}
              variant={btn.variant ?? "outline"}
              className={cn("h-9", btn.className)}
              onClick={btn.action}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        {/* Main grid */}
        <div className="flex flex-col gap-1.5">
          {mainGrid.map((row, ri) => (
            <div key={ri} className="grid grid-cols-5 gap-1.5">
              {row.map((btn) => (
                <Button
                  key={btn.label}
                  variant={btn.variant ?? "outline"}
                  className={cn(
                    "h-12 text-base transition-transform active:scale-95",
                    btn.span === 2 && "col-span-2",
                    btn.className,
                  )}
                  onClick={btn.action}
                >
                  {btn.label === "\u232b" ? <Delete className="h-4 w-4" /> : btn.label}
                </Button>
              ))}
            </div>
          ))}
        </div>

        {/* Keyboard hint */}
        <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
          Keyboard supported &mdash; type numbers, operators, Enter&nbsp;=&nbsp;equals, Esc&nbsp;=&nbsp;clear
        </p>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="hidden w-72 flex-col rounded-2xl border border-border bg-card p-4 shadow-lg md:flex">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <History className="h-4 w-4" />
              <span className="text-sm font-medium">History</span>
            </div>
            <div className="flex gap-1">
              {history.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearHistory} title="Clear history">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)} title="Close history">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1" style={{ height: "calc(100vh - 220px)" }}>
            {history.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground/60">
                No calculations yet
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {history.map((entry, i) => (
                  <button
                    key={entry.timestamp + "-" + i}
                    className="group rounded-lg px-3 py-2 text-right transition-colors hover:bg-accent"
                    onClick={() => handleHistoryClick(entry)}
                    title="Click to use result"
                  >
                    <div className="truncate font-mono text-xs text-muted-foreground group-hover:text-foreground">
                      {entry.expression}
                    </div>
                    <div className="font-mono text-sm font-medium text-foreground">
                      = {formatResult(entry.result)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
