/** Workspace Tools — Multitasking Dashboard with Calculators, Converter & World Clock */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calculator, Trash2, ArrowRightLeft,
  Ruler, Weight, Thermometer, ChevronRight, Zap, Wrench,
  Droplets, RefreshCw, DollarSign, AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { cn } from "../lib/utils";
import { getErrorDetail } from "../lib/errorUtils";
import type { CalcBtnProps } from "../types/api";
import { RisoBackground } from "../components/RisoBackground";

// ---------------------------------------------------------------------------
// Math Engine
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
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let name = "";
      while (i < src.length && /[a-zA-Z0-9]/.test(src[i])) name += src[i++];
      const lower = name.toLowerCase();
      if (lower === "pi") tokens.push({ type: "number", value: Math.PI });
      else if (lower === "e" && (i >= src.length || !/[a-zA-Z]/.test(src[i]))) tokens.push({ type: "number", value: Math.E });
      else tokens.push({ type: "func", value: lower });
      continue;
    }
    if (ch === "(") { tokens.push({ type: "lparen", value: "(" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen", value: ")" }); i++; continue; }
    if ("+-*/^%".includes(ch)) { tokens.push({ type: "op", value: ch }); i++; continue; }
    i++;
  }
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;
  constructor(tokens: Token[]) { this.tokens = tokens; }
  private peek() { return this.tokens[this.pos]; }
  private advance() { return this.tokens[this.pos++]; }
  parse() { const res = this.expr(); if (this.pos < this.tokens.length) throw new Error(); return res; }
  private expr() {
    let left = this.term();
    while (this.peek()?.type === "op" && ["+", "-"].includes(String(this.peek()!.value))) {
      const op = this.advance().value;
      const right = this.term();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  private term() {
    let left = this.power();
    while (this.peek()?.type === "op" && ["*", "/", "%"].includes(String(this.peek()!.value))) {
      const op = this.advance().value;
      const right = this.power();
      if (op === "*") left = left * right;
      else if (op === "/") left = left / right;
      else left = left % right;
    }
    return left;
  }
  private power() {
    let base = this.unary();
    while (this.peek()?.type === "op" && this.peek()!.value === "^") {
      this.advance();
      const exp = this.unary();
      base = Math.pow(base, exp);
    }
    return base;
  }
  private unary(): number {
    if (this.peek()?.type === "op" && ["-", "+"].includes(String(this.peek()!.value))) {
      const op = this.advance().value;
      const val = this.unary();
      return op === "-" ? -val : val;
    }
    return this.call();
  }
  private call(): number {
    if (this.peek()?.type === "func") {
      const fn = String(this.advance().value);
      this.advance(); // (
      const arg = this.expr();
      this.advance(); // )
      switch (fn) {
        case "sin": return Math.sin(arg);
        case "cos": return Math.cos(arg);
        case "tan": return Math.tan(arg);
        case "log": return Math.log10(arg);
        case "ln": return Math.log(arg);
        case "sqrt": return Math.sqrt(arg);
        case "abs": return Math.abs(arg);
        default: throw new Error();
      }
    }
    return this.primary();
  }
  private primary(): number {
    const t = this.peek();
    if (!t) throw new Error();
    if (t.type === "number") { this.advance(); return t.value as number; }
    if (t.type === "lparen") { this.advance(); const v = this.expr(); this.advance(); return v; }
    throw new Error();
  }
}

function safeEvaluate(expression: string): string {
  try {
    if (!expression.trim()) return "";
    let normalized = expression
      .replace(/\u00d7/g, "*").replace(/\u00f7/g, "/").replace(/\u03c0/g, "pi")
      .replace(/\u221a\(/g, "sqrt(").replace(/\u221a/g, "sqrt(");
    const tokens = tokenize(normalized);
    const result = new Parser(tokens).parse();
    if (!isFinite(result)) return "Error";
    return String(parseFloat(result.toPrecision(12)));
  } catch { return "Error"; }
}

function formatResult(value: string): string {
  if (value === "Error" || value === "") return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-8 && num !== 0)) return num.toExponential(6);
  return value;
}

// ---------------------------------------------------------------------------
// Unit Converter Logic
// ---------------------------------------------------------------------------

const UNITS: Record<string, any> = {
  length: {
    label: "Length",
    icon: Ruler,
    units: {
      m: 1, cm: 0.01, mm: 0.001, km: 1000,
      in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.34
    }
  },
  weight: {
    label: "Weight",
    icon: Weight,
    units: {
      kg: 1, g: 0.001, mg: 0.000001,
      lb: 0.453592, oz: 0.0283495
    }
  },
  volume: {
    label: "Volume",
    icon: Droplets,
    units: {
      l: 1, ml: 0.001, m3: 1000,
      gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588
    }
  },
  temp: {
    label: "Temperature",
    icon: Thermometer,
    units: { c: "Celsius", f: "Fahrenheit", k: "Kelvin" }
  }
};

function convertUnit(val: number, from: string, to: string, type: string): number {
  if (type === "temp") {
    let celsius = val;
    if (from === "f") celsius = (val - 32) * 5 / 9;
    if (from === "k") celsius = val - 273.15;
    if (to === "c") return celsius;
    if (to === "f") return (celsius * 9 / 5) + 32;
    if (to === "k") return celsius + 273.15;
    return val;
  }
  const factors = UNITS[type].units;
  const baseVal = val * factors[from];
  return baseVal / factors[to];
}

// ---------------------------------------------------------------------------
// Calculator Widget
// ---------------------------------------------------------------------------

interface CalcWidgetProps {
  id: string;
  title: string;
  isActive: boolean;
  onActivate: () => void;
}

function CalculatorWidget({ id, title, isActive, onActivate }: CalcWidgetProps) {
  const [expression, setExpression] = useState("");
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState<{ expr: string; res: string; ts: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem(`calc-history-${id}`) || "[]"); } catch { return []; }
  });
  const [lastResult, setLastResult] = useState<string | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  const append = useCallback((v: string) => { 
    onActivate();
    setLastResult(null); 
    setExpression(p => {
      const ops = "+-*/^%\u00d7\u00f7";
      const isOp = ops.includes(v);
      const lastChar = p.slice(-1);
      const isLastOp = ops.includes(lastChar);
      if (p === "" && isOp && v !== "-") return p;
      if (isOp && isLastOp) return p.slice(0, -1) + v;
      if (v === ".") {
        const parts = p.split(/[+\-*/^%\u00d7\u00f7()]/);
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes(".")) return p;
      }
      return p + v;
    });
  }, [onActivate]);

  const clear = useCallback(() => { 
    onActivate();
    setExpression(""); 
    setLastResult(null); 
  }, [onActivate]);

  const backspace = useCallback(() => { 
    onActivate();
    setExpression(p => p.slice(0, -1)); 
    setLastResult(null); 
  }, [onActivate]);

  const equals = useCallback(() => {
    onActivate();
    if (!expression) return;
    const res = safeEvaluate(expression);
    if (res !== "Error") {
      setHistory(p => [{ expr: expression, res, ts: Date.now() }, ...p].slice(0, 20));
      setLastResult(res);
      setExpression(res);
    }
  }, [expression, onActivate, id]);

  useEffect(() => {
    if (expression) {
      const res = safeEvaluate(expression);
      setPreview(res === "Error" ? "" : formatResult(res));
    } else setPreview("");
    if (displayRef.current) displayRef.current.scrollLeft = displayRef.current.scrollWidth;
  }, [expression]);

  useEffect(() => localStorage.setItem(`calc-history-${id}`, JSON.stringify(history)), [history, id]);

  useEffect(() => {
    if (!isActive) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.startsWith("F") && e.key.length > 1) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key;
      if (/[0-9.]/.test(key)) { append(key); e.preventDefault(); }
      else if (key === "+") { append("+"); e.preventDefault(); }
      else if (key === "-") { append("-"); e.preventDefault(); }
      else if (key === "*") { append("\u00d7"); e.preventDefault(); }
      else if (key === "/") { append("\u00f7"); e.preventDefault(); }
      else if (key === "^") { append("^"); e.preventDefault(); }
      else if (key === "(") { append("("); e.preventDefault(); }
      else if (key === ")") { append(")"); e.preventDefault(); }
      else if (key === "Enter" || key === "=") { equals(); e.preventDefault(); }
      else if (key === "Backspace") { backspace(); e.preventDefault(); }
      else if (key === "Escape") { clear(); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, append, equals, backspace, clear]);

  const CalcBtn = ({ label, onClick, variant = "outline", className, span = 1 }: CalcBtnProps) => (
    <Button
      variant={variant}
      onClick={onClick}
      className={cn(
        "h-10 text-base font-medium transition-all active:scale-95 px-0", 
        span === 2 && "col-span-2",
        className
      )}
    >
      {label}
    </Button>
  );

  return (
    <Card className={cn(
      "card-riso card-riso-orange flex flex-col shadow-md border-border/60 overflow-hidden transition-all duration-300 h-full",
      isActive ? "ring-2 ring-primary/20 border-primary/40 shadow-lg" : "opacity-95"
    )} onClick={onActivate}>
      <CardHeader className="py-3 px-5 border-b bg-muted/10 flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Calculator className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
          {title}
        </CardTitle>
        {isActive && <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />}
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
        {/* Display */}
        <div className="bg-muted/20 border border-border/40 rounded-xl p-4 flex flex-col justify-end items-end h-24 relative overflow-hidden shrink-0">
          <div ref={displayRef} className="text-2xl font-light tracking-wide w-full text-right overflow-x-auto whitespace-nowrap scrollbar-none font-mono">
            {expression || <span className="text-muted-foreground/30">0</span>}
          </div>
          <div className="text-muted-foreground font-mono mt-1.5 h-5 text-sm">
            {lastResult ? (
              <span className="text-primary font-semibold flex items-center gap-1">
                <ChevronRight className="h-3 w-3" /> {formatResult(lastResult)}
              </span>
            ) : preview ? (
              <span className="opacity-50 flex items-center gap-1">
                <ChevronRight className="h-3 w-3" /> {preview}
              </span>
            ) : null}
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-5 gap-1.5 shrink-0">
          <CalcBtn label="sin" onClick={() => append("sin(")} variant="secondary" className="text-[10px] h-9" />
          <CalcBtn label="cos" onClick={() => append("cos(")} variant="secondary" className="text-[10px] h-9" />
          <CalcBtn label="tan" onClick={() => append("tan(")} variant="secondary" className="text-[10px] h-9" />
          <CalcBtn label="C" onClick={clear} variant="destructive" className="font-bold h-9" />
          <CalcBtn label="⌫" onClick={backspace} variant="secondary" className="h-9" />

          <CalcBtn label="log" onClick={() => append("log(")} variant="secondary" className="text-[10px] h-9" />
          <CalcBtn label="ln" onClick={() => append("ln(")} variant="secondary" className="text-[10px] h-9" />
          <CalcBtn label="(" onClick={() => append("(")} variant="secondary" className="h-9" />
          <CalcBtn label=")" onClick={() => append(")")} variant="secondary" className="h-9" />
          <CalcBtn label="÷" onClick={() => append("\u00f7")} variant="secondary" className="text-primary h-9" />

          <CalcBtn label="√" onClick={() => append("sqrt(")} variant="secondary" className="h-9" />
          <CalcBtn label="7" onClick={() => append("7")} className="bg-background h-9" />
          <CalcBtn label="8" onClick={() => append("8")} className="bg-background h-9" />
          <CalcBtn label="9" onClick={() => append("9")} className="bg-background h-9" />
          <CalcBtn label="×" onClick={() => append("\u00d7")} variant="secondary" className="text-primary h-9" />

          <CalcBtn label="x²" onClick={() => append("^2")} variant="secondary" className="text-[10px] h-9" />
          <CalcBtn label="4" onClick={() => append("4")} className="bg-background h-9" />
          <CalcBtn label="5" onClick={() => append("5")} className="bg-background h-9" />
          <CalcBtn label="6" onClick={() => append("6")} className="bg-background h-9" />
          <CalcBtn label="-" onClick={() => append("-")} variant="secondary" className="text-primary font-bold h-9" />

          <CalcBtn label="xʸ" onClick={() => append("^")} variant="secondary" className="text-[10px] h-9" />
          <CalcBtn label="1" onClick={() => append("1")} className="bg-background h-9" />
          <CalcBtn label="2" onClick={() => append("2")} className="bg-background h-9" />
          <CalcBtn label="3" onClick={() => append("3")} className="bg-background h-9" />
          <CalcBtn label="+" onClick={() => append("+")} variant="secondary" className="text-primary font-bold h-9" />

          <CalcBtn label="π" onClick={() => append("pi")} variant="secondary" className="h-9" />
          <CalcBtn label="0" onClick={() => append("0")} span={2} className="bg-background h-9" />
          <CalcBtn label="." onClick={() => append(".")} className="bg-background h-9" />
          <CalcBtn label="=" onClick={equals} variant="default" className="bg-primary hover:bg-primary/90 h-9" />
        </div>

        {/* History */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">History</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-destructive" onClick={() => setHistory([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 bg-muted/5 rounded-lg border border-dashed p-1">
            <div className="flex flex-col gap-1.5">
              {history.length === 0 ? (
                <p className="text-[10px] text-center text-muted-foreground/30 py-8 italic uppercase tracking-widest">Empty</p>
              ) : (
                history.map((h, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setExpression(h.res); setLastResult(null); }}
                    className="flex flex-col items-end p-2 rounded-lg hover:bg-muted/50 transition-all w-full text-right border border-transparent hover:border-border/40"
                  >
                    <span className="text-[10px] text-muted-foreground font-mono leading-none mb-1">{h.expr}</span>
                    <span className="text-sm font-semibold text-primary font-mono leading-none">= {formatResult(h.res)}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Converter Widget
// ---------------------------------------------------------------------------

function ConverterWidget() {
  const [convType, setConvType] = useState<string>("length");
  const [convFrom, setConvFrom] = useState("m");
  const [convTo, setConvTo] = useState("ft");
  const [convVal, setConvVal] = useState("1");
  const [convRes, setConvRes] = useState("");
  const [history, setHistory] = useState<{ val: string; from: string; to: string; res: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("conv-history") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    const val = parseFloat(convVal);
    if (!isNaN(val)) {
      const resNum = convertUnit(val, convFrom, convTo, convType);
      const resStr = resNum.toLocaleString(undefined, { maximumFractionDigits: 4 });
      setConvRes(resStr);
    } else {
      setConvRes("...");
    }
  }, [convVal, convFrom, convTo, convType]);

  const saveToHistory = () => {
    if (convRes === "..." || convRes === "") return;
    const entry = { val: convVal, from: convFrom, to: convTo, res: convRes };
    setHistory(p => [entry, ...p].slice(0, 20));
  };

  useEffect(() => localStorage.setItem("conv-history", JSON.stringify(history)), [history]);

  const handleSwap = () => {
    const oldFrom = convFrom;
    const oldTo = convTo;
    setConvFrom(oldTo);
    setConvTo(oldFrom);
    if (convRes !== "..." && convRes !== "") {
      setConvVal(convRes.replace(/[^0-9.]/g, ""));
    }
  };

  return (
    <Card className="card-riso card-riso-violet flex flex-col shadow-md border-border/60 h-full overflow-hidden">
      <CardHeader className="py-3 px-5 border-b bg-muted/10">
        <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-500" />
          Unit Converter
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-5 flex-1 overflow-hidden">
        <div className="grid grid-cols-2 gap-2 shrink-0">
          {Object.entries(UNITS).map(([id, info]: [string, any]) => (
            <Button
              key={id}
              variant={convType === id ? "secondary" : "ghost"}
              className={cn(
                "flex flex-col h-16 gap-2 border border-transparent rounded-xl p-0 transition-all",
                convType === id && "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 shadow-sm"
              )}
              onClick={() => {
                setConvType(id);
                if (id === "length") { setConvFrom("m"); setConvTo("ft"); }
                if (id === "weight") { setConvFrom("kg"); setConvTo("lb"); }
                if (id === "volume") { setConvFrom("l"); setConvTo("gal"); }
                if (id === "temp") { setConvFrom("c"); setConvTo("f"); }
              }}
            >
              <info.icon className={cn("h-4 w-4", convType === id ? "animate-pulse" : "")} />
              <span className="text-[9px] font-black uppercase tracking-tight">{info.label}</span>
            </Button>
          ))}
        </div>

        <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border/40 shadow-inner shrink-0">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">From</Label>
            <div className="flex gap-2">
              <input 
                type="number" 
                value={convVal} 
                onChange={(e) => setConvVal(e.target.value)} 
                onBlur={saveToHistory}
                className="flex-1 min-w-0 h-10 px-3 bg-background border border-input rounded-lg font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              <Select value={convFrom} onValueChange={setConvFrom}>
                <SelectTrigger className="w-24 h-10 text-xs font-mono rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(UNITS[convType].units).map((u) => (
                    <SelectItem key={u} value={u} className="font-mono text-xs">{u.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-7 w-7 rounded-full bg-background shadow-md hover:text-emerald-600 hover:border-emerald-500/50 transition-all active:scale-90"
              onClick={handleSwap}
              title="Swap Units"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 rotate-90" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">To</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center px-3 h-10 border border-border/50 rounded-lg bg-background/50 font-mono text-base font-bold text-emerald-600">
                {convRes}
              </div>
              <Select value={convTo} onValueChange={setConvTo}>
                <SelectTrigger className="w-24 h-10 text-xs font-mono rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(UNITS[convType].units).map((u) => (
                    <SelectItem key={u} value={u} className="font-mono text-xs">{u.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Recent Conversions</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-destructive" onClick={() => setHistory([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 bg-muted/5 rounded-lg border border-dashed p-1">
            <div className="flex flex-col gap-1.5">
              {history.length === 0 ? (
                <p className="text-[10px] text-center text-muted-foreground/30 py-8 italic uppercase tracking-widest">Empty</p>
              ) : (
                history.map((h, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-end p-2 rounded-lg hover:bg-muted/50 transition-all w-full text-right border border-transparent hover:border-border/40"
                  >
                    <span className="text-[10px] text-muted-foreground font-mono leading-none mb-1">{h.val} {h.from.toUpperCase()}</span>
                    <span className="text-sm font-semibold text-emerald-600 font-mono leading-none">= {h.res} {h.to.toUpperCase()}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Currency Converter Widget
// ---------------------------------------------------------------------------

const CURRENCY_META: Record<string, { name: string; symbol: string; flag: string }> = {
  USD: { name: "US Dollar",         symbol: "$",   flag: "🇺🇸" },
  EUR: { name: "Euro",              symbol: "€",   flag: "🇪🇺" },
  CZK: { name: "Czech Koruna",      symbol: "Kč",  flag: "🇨🇿" },
  GBP: { name: "British Pound",     symbol: "£",   flag: "🇬🇧" },
  PLN: { name: "Polish Złoty",      symbol: "zł",  flag: "🇵🇱" },
  CNY: { name: "Chinese Yuan",      symbol: "¥",   flag: "🇨🇳" },
  CHF: { name: "Swiss Franc",       symbol: "Fr",  flag: "🇨🇭" },
  JPY: { name: "Japanese Yen",      symbol: "¥",   flag: "🇯🇵" },
  HUF: { name: "Hungarian Forint",  symbol: "Ft",  flag: "🇭🇺" },
  CAD: { name: "Canadian Dollar",   symbol: "C$",  flag: "🇨🇦" },
};

const ALL_CURRENCY_CODES = Object.keys(CURRENCY_META);

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  updatedAt: string; // ISO string
}

const RATES_CACHE_KEY = "currency-rates-cache";

function loadCachedRates(): RatesCache | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RatesCache;
  } catch { return null; }
}

function saveCachedRates(cache: RatesCache) {
  localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cache));
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CurrencyWidget() {
  const [amount, setAmount] = useState("1");
  const [base, setBase] = useState("USD");
  const [cache, setCache] = useState<RatesCache | null>(loadCachedRates);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert amount in `base` → `target` — returns raw number or NaN
  function convertRaw(target: string): number {
    if (!cache) return NaN;
    const num = parseFloat(amount);
    if (isNaN(num) || num < 0) return NaN;
    if (target === base) return num;
    const toBase = cache.rates[base];
    const toTarget = cache.rates[target];
    if (!toBase || !toTarget) return NaN;
    return (num / toBase) * toTarget;
  }

  // Convert and format for display
  function convert(target: string): string {
    const result = convertRaw(target);
    if (isNaN(result)) return "—";
    if (result >= 100) return result.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (result >= 1) return result.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return result.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  async function fetchRates() {
    setLoading(true);
    setError(null);
    try {
      const symbols = ALL_CURRENCY_CODES.join(",");
      const res = await fetch(
        `https://api.frankfurter.app/latest?base=USD&symbols=${symbols}`,
        { signal: AbortSignal.timeout(30_000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // frankfurter returns rates relative to base=USD; add USD itself
      const rates: Record<string, number> = { USD: 1, ...data.rates };
      const newCache: RatesCache = {
        base: "USD",
        rates,
        updatedAt: new Date().toISOString(),
      };
      setCache(newCache);
      saveCachedRates(newCache);
    } catch (e: unknown) {
      const msg = getErrorDetail(e);
      if (msg.includes("timeout") || msg.includes("signal") || msg.includes("TimeoutError"))
        setError("Request timed out — check your internet connection and try again.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const others = ALL_CURRENCY_CODES.filter(c => c !== base);

  return (
    <Card className="card-riso flex flex-col shadow-md border-border/60 h-full overflow-hidden">
      <CardHeader className="py-3 px-5 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-amber-500" />
            Currency
          </CardTitle>
          <div className="flex items-center gap-2">
            {cache && (
              <span className="text-[9px] text-muted-foreground/60 font-mono">
                {timeAgoShort(cache.updatedAt)}
              </span>
            )}
            <button
              onClick={fetchRates}
              disabled={loading}
              title="Fetch live rates"
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border/60 hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
        {/* Amount + base selector */}
        <div className="flex gap-2 shrink-0">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 min-w-0 h-10 px-3 bg-background border border-input rounded-lg font-mono text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
            placeholder="1"
          />
          <Select value={base} onValueChange={setBase}>
            <SelectTrigger className="w-28 h-10 text-xs font-mono rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_CURRENCY_CODES.map(code => (
                <SelectItem key={code} value={code} className="font-mono text-xs">
                  {CURRENCY_META[code].flag} {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* No rates yet */}
        {!cache && !loading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <DollarSign className="h-8 w-8 opacity-20" />
            <p className="text-xs">No rates loaded yet.</p>
            <button
              onClick={fetchRates}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Fetch live rates
            </button>
          </div>
        )}

        {/* Rates list */}
        {cache && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-1.5 pr-1">
              {/* Base row */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-base">{CURRENCY_META[base].flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold font-mono">{base}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{CURRENCY_META[base].name}</p>
                </div>
                <span className="font-mono text-sm font-bold text-amber-600">
                  {parseFloat(amount) >= 0 ? parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
                </span>
              </div>
              {/* Other currencies */}
              {others.map(code => {
                const meta = CURRENCY_META[code];
                return (
                  <button
                    key={code}
                    onClick={() => {
                      const raw = convertRaw(code);
                      if (!isNaN(raw)) { setAmount(parseFloat(raw.toPrecision(10)).toString()); setBase(code); }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left border border-transparent hover:border-border/40"
                    title={`Switch to ${code}`}
                  >
                    <span className="text-base">{meta.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold font-mono">{code}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{meta.name}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {convert(code)}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Source note */}
        {cache && (
          <p className="text-[9px] text-muted-foreground/40 text-center shrink-0">
            Source: frankfurter.app (ECB) · Click a currency to use it as base
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Compact time strip
// ---------------------------------------------------------------------------

const TIME_CITIES = [
  { name: "Los Angeles", tz: "America/Los_Angeles" },
  { name: "Denver",      tz: "America/Denver"      },
  { name: "Chicago",     tz: "America/Chicago"     },
  { name: "New York",    tz: "America/New_York"    },
  { name: "São Paulo",   tz: "America/Sao_Paulo"   },
  { name: "London",      tz: "Europe/London"       },
  { name: "Paris",       tz: "Europe/Paris"        },
  { name: "Bratislava",  tz: "Europe/Bratislava"   },
  { name: "Cairo",       tz: "Africa/Cairo"        },
  { name: "Moscow",      tz: "Europe/Moscow"       },
  { name: "Dubai",       tz: "Asia/Dubai"          },
  { name: "Mumbai",      tz: "Asia/Kolkata"        },
  { name: "Bangkok",     tz: "Asia/Bangkok"        },
  { name: "Singapore",   tz: "Asia/Singapore"      },
  { name: "Tokyo",       tz: "Asia/Tokyo"          },
  { name: "Sydney",      tz: "Australia/Sydney"    },
];

function fmt(tz: string, now: Date) {
  return new Intl.DateTimeFormat("sk-SK", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
}

function fmtDate(tz: string, now: Date) {
  return new Intl.DateTimeFormat("sk-SK", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short",
  }).format(now);
}

function isDaytz(tz: string, now: Date) {
  const h = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now), 10);
  return h >= 6 && h < 20;
}

function TimeStrip() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TIME_CITIES.map((c) => {
        const isUser = c.tz === userTz;
        const day    = isDaytz(c.tz, now);
        return (
          <div
            key={c.name}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono-ui",
              isUser
                ? "border-[var(--accent-teal)]/30"
                : "bg-muted/40 border-border/50 text-foreground",
            )}
            style={isUser ? { background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)', color: 'var(--accent-teal)' } : {}}
          >
            <span className="text-[10px] text-muted-foreground shrink-0">
              {day ? "☀️" : "🌙"}
            </span>
            <span className={cn("font-medium shrink-0", isUser && "text-primary")}>
              {c.name}
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {fmt(c.tz, now)}
            </span>
            <span className="text-[9px] text-muted-foreground hidden lg:block">
              {fmtDate(c.tz, now)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ToolsPage() {
  const [activeCalc, setActiveCalc] = useState<"A" | "B">("A");

  return (
    <div className="relative flex flex-col h-full overflow-hidden p-4 md:p-6 lg:p-8 gap-6 max-w-[2400px] mx-auto w-full riso-noise">
      <RisoBackground />
      <header className="flex flex-col gap-3 shrink-0 animate-ink-in" style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)' }}>
            <Wrench className="h-6 w-6" style={{ color: 'var(--accent-orange)' }} />
          </div>
          <div>
            <h1 className="font-display font-black tracking-tight" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', textShadow: '2px 2px 0 rgba(224,78,14,0.18), -1px -1px 0 rgba(11,114,104,0.12)' }}>Workspace Tools</h1>
            <p className="font-mono-ui text-muted-foreground uppercase opacity-60" style={{ fontSize: 10, letterSpacing: '0.20em' }}>Productivity Powerhouse</p>
          </div>
        </div>
        <TimeStrip />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 flex-1 min-h-0" style={{ position: 'relative', zIndex: 1 }}>
        <CalculatorWidget
          id="A"
          title="Engine Alpha"
          isActive={activeCalc === "A"}
          onActivate={() => setActiveCalc("A")}
        />
        <CalculatorWidget
          id="B"
          title="Engine Beta"
          isActive={activeCalc === "B"}
          onActivate={() => setActiveCalc("B")}
        />
        <CurrencyWidget />
        <ConverterWidget />
      </div>

      <div className="flex items-center justify-center gap-6 py-2 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.3em] flex items-center gap-2">
          <Zap className="h-3 w-3" /> Click a tool to focus keyboard input
        </p>
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.3em] flex items-center gap-2">
          <Zap className="h-3 w-3" /> Data is persisted locally
        </p>
      </div>
    </div>
  );
}
