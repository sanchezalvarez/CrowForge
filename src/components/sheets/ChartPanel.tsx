import { useState, useRef, useCallback } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, X, Plus, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Sheet } from "../../lib/cellUtils";

// ─── Types ────────────────────────────────────────────────────────

type ChartType = "bar" | "line" | "pie";

interface ChartPanelProps {
  sheet: Sheet;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────

const SERIES_COLORS = [
  "hsl(var(--primary))",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
];

const CHART_TYPES: { type: ChartType; label: string; Icon: typeof BarChart3 }[] = [
  { type: "bar",  label: "Bar",  Icon: BarChart3 },
  { type: "line", label: "Line", Icon: LineIcon  },
  { type: "pie",  label: "Pie",  Icon: PieIcon   },
];

// ─── Helpers ──────────────────────────────────────────────────────

function colName(sheet: Sheet, index: number): string {
  return sheet.columns[index]?.name || `Col ${index + 1}`;
}

// ─── ChartPanel ───────────────────────────────────────────────────

export function ChartPanel({ sheet, onClose }: ChartPanelProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xCol, setXCol] = useState<number>(0);
  const [yCols, setYCols] = useState<number[]>(
    sheet.columns.length >= 2 ? [1] : []
  );
  const [panelHeight, setPanelHeight] = useState(256); // 256px = h-64
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(256);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = panelHeight;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - ev.clientY; // drag up = bigger
      setPanelHeight(Math.max(120, Math.min(600, startHRef.current + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelHeight]);

  const numCols = sheet.columns.length;
  const numRows = sheet.rows.length;
  const canChart = numCols >= 2 && numRows > 0;

  // ── Data transform ──────────────────────────────────────────────
  const barLineData = sheet.rows
    .filter(row => row[xCol] !== undefined && row[xCol] !== "")
    .map(row => {
      const point: Record<string, string | number> = { name: row[xCol] ?? "" };
      for (const c of yCols) {
        point[colName(sheet, c)] = parseFloat(row[c]) || 0;
      }
      return point;
    });

  const pieData = sheet.rows
    .filter(row => row[xCol] !== undefined && row[xCol] !== "")
    .map(row => ({
      name: row[xCol] ?? "",
      value: parseFloat(row[yCols[0]]) || 0,
    }));

  // ── Y series helpers ────────────────────────────────────────────
  function addYCol() {
    const used = new Set([xCol, ...yCols]);
    const next = Array.from({ length: numCols }, (_, i) => i).find(i => !used.has(i));
    if (next !== undefined && yCols.length < 4) {
      setYCols(prev => [...prev, next]);
    }
  }

  function removeYCol(idx: number) {
    if (yCols.length > 1) setYCols(prev => prev.filter((_, i) => i !== idx));
  }

  function setYCol(idx: number, col: number) {
    setYCols(prev => prev.map((c, i) => i === idx ? col : c));
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="shrink-0 border-t bg-background flex flex-col overflow-hidden" style={{ height: panelHeight }}>
      {/* Drag resize handle at the top */}
      <div
        className="h-1.5 w-full cursor-row-resize hover:bg-primary/30 transition-colors shrink-0"
        onMouseDown={onResizeMouseDown}
      />
      {/* Header */}
      <div className="h-9 shrink-0 flex items-center gap-2 px-3 border-b">
        {/* Chart type tabs */}
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
          {CHART_TYPES.map(({ type, label, Icon }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors",
                chartType === type
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* X-axis column */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground shrink-0">X:</span>
          <select
            value={xCol}
            onChange={e => {
              const val = Number(e.target.value);
              setXCol(val);
              if (yCols.includes(val)) {
                const otherY = yCols.filter(c => c !== val);
                const alt = Array.from({ length: numCols }, (_, i) => i).find(
                  i => i !== val && !otherY.includes(i)
                );
                if (alt !== undefined) setYCols(prev => prev.map(c => c === val ? alt : c));
              }
            }}
            className="h-6 text-xs rounded border bg-background px-1 py-0 max-w-28 focus:outline-none"
          >
            {sheet.columns.map((col, i) => (
              <option key={i} value={i}>{col.name || `Col ${i + 1}`}</option>
            ))}
          </select>
        </div>

        {/* Y-axis columns */}
        {chartType !== "pie" ? (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">Y:</span>
            {yCols.map((col, idx) => (
              <div key={idx} className="flex items-center gap-0.5">
                <select
                  value={col}
                  onChange={e => setYCol(idx, Number(e.target.value))}
                  className="h-6 text-xs rounded border bg-background px-1 py-0 max-w-24 focus:outline-none"
                  style={{ color: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                >
                  {sheet.columns.map((c, i) => (
                    i !== xCol
                      ? <option key={i} value={i}>{c.name || `Col ${i + 1}`}</option>
                      : null
                  ))}
                </select>
                {yCols.length > 1 && (
                  <button onClick={() => removeYCol(idx)} className="text-muted-foreground hover:text-destructive">
                    <Minus size={10} />
                  </button>
                )}
              </div>
            ))}
            {yCols.length < 4 && numCols > yCols.length + 1 && (
              <button onClick={addYCol} className="text-muted-foreground hover:text-foreground" title="Add series">
                <Plus size={12} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground shrink-0">Values:</span>
            <select
              value={yCols[0] ?? 1}
              onChange={e => setYCols([Number(e.target.value)])}
              className="h-6 text-xs rounded border bg-background px-1 py-0 max-w-28 focus:outline-none"
            >
              {sheet.columns.map((c, i) =>
                i !== xCol
                  ? <option key={i} value={i}>{c.name || `Col ${i + 1}`}</option>
                  : null
              )}
            </select>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={onClose}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Close chart"
        >
          <X size={14} />
        </button>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 px-2 py-1.5">
        {!canChart ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            {numCols < 2
              ? "Add at least 2 columns to create a chart"
              : "Add some rows with data to create a chart"}
          </div>
        ) : chartType === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barLineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                cursor={{ fill: "hsl(var(--muted))" }}
              />
              {yCols.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {yCols.map((col, idx) => (
                <Bar
                  key={col}
                  dataKey={colName(sheet, col)}
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : chartType === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={barLineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
              />
              {yCols.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {yCols.map((col, idx) => (
                <Line
                  key={col}
                  type="monotone"
                  dataKey={colName(sheet, col)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="80%"
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
