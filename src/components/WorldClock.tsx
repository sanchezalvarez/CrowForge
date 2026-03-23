import { useState, useEffect, useCallback } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { Clock, MapPin, Search, X } from "lucide-react";
import { cn } from "../lib/utils";

// ── City data ─────────────────────────────────────────────────────────────────
interface City {
  name: string;
  country: string;
  timezone: string;
  coords: [number, number]; // [longitude, latitude]
}

const CITIES: City[] = [
  { name: "Bratislava",   country: "SK", timezone: "Europe/Bratislava",       coords: [17.11,  48.15] },
  { name: "Praha",        country: "CZ", timezone: "Europe/Prague",           coords: [14.42,  50.08] },
  { name: "Londýn",       country: "GB", timezone: "Europe/London",           coords: [-0.13,  51.51] },
  { name: "Paríž",        country: "FR", timezone: "Europe/Paris",            coords: [2.35,   48.85] },
  { name: "Berlín",       country: "DE", timezone: "Europe/Berlin",           coords: [13.40,  52.52] },
  { name: "Madrid",       country: "ES", timezone: "Europe/Madrid",           coords: [-3.70,  40.42] },
  { name: "Rím",          country: "IT", timezone: "Europe/Rome",             coords: [12.50,  41.90] },
  { name: "Varšava",      country: "PL", timezone: "Europe/Warsaw",           coords: [21.02,  52.23] },
  { name: "Kyjev",        country: "UA", timezone: "Europe/Kiev",             coords: [30.52,  50.45] },
  { name: "Moskva",       country: "RU", timezone: "Europe/Moscow",           coords: [37.62,  55.75] },
  { name: "Istanbul",     country: "TR", timezone: "Europe/Istanbul",         coords: [28.98,  41.01] },
  { name: "Dubaj",        country: "AE", timezone: "Asia/Dubai",              coords: [55.30,  25.20] },
  { name: "Bombaj",       country: "IN", timezone: "Asia/Kolkata",            coords: [72.88,  19.08] },
  { name: "Singapur",     country: "SG", timezone: "Asia/Singapore",          coords: [103.82,  1.35] },
  { name: "Hongkong",     country: "HK", timezone: "Asia/Hong_Kong",          coords: [114.17, 22.32] },
  { name: "Peking",       country: "CN", timezone: "Asia/Shanghai",           coords: [116.40, 39.90] },
  { name: "Tokio",        country: "JP", timezone: "Asia/Tokyo",              coords: [139.69, 35.69] },
  { name: "Sydney",       country: "AU", timezone: "Australia/Sydney",        coords: [151.21,-33.87] },
  { name: "Auckland",     country: "NZ", timezone: "Pacific/Auckland",        coords: [174.77,-36.85] },
  { name: "Los Angeles",  country: "US", timezone: "America/Los_Angeles",     coords: [-118.24, 34.05] },
  { name: "Denver",       country: "US", timezone: "America/Denver",          coords: [-104.99, 39.74] },
  { name: "Chicago",      country: "US", timezone: "America/Chicago",         coords: [-87.63,  41.88] },
  { name: "New York",     country: "US", timezone: "America/New_York",        coords: [-74.01,  40.71] },
  { name: "São Paulo",    country: "BR", timezone: "America/Sao_Paulo",       coords: [-46.63, -23.55] },
  { name: "Johannesburg", country: "ZA", timezone: "Africa/Johannesburg",     coords: [28.05, -26.20] },
  { name: "Lagos",        country: "NG", timezone: "Africa/Lagos",            coords: [3.38,    6.45] },
  { name: "Nairobi",      country: "KE", timezone: "Africa/Nairobi",          coords: [36.82,  -1.29] },
  { name: "Káhira",       country: "EG", timezone: "Africa/Cairo",            coords: [31.24,  30.06] },
  { name: "Riad",         country: "SA", timezone: "Asia/Riyadh",             coords: [46.68,  24.69] },
  { name: "Karači",       country: "PK", timezone: "Asia/Karachi",            coords: [67.01,  24.86] },
  { name: "Bangkokg",     country: "TH", timezone: "Asia/Bangkok",            coords: [100.52, 13.75] },
  { name: "Seoul",        country: "KR", timezone: "Asia/Seoul",              coords: [126.98, 37.57] },
  { name: "Mexiko",       country: "MX", timezone: "America/Mexico_City",     coords: [-99.13,  19.43] },
  { name: "Toronto",      country: "CA", timezone: "America/Toronto",         coords: [-79.38,  43.65] },
  { name: "Vancouver",    country: "CA", timezone: "America/Vancouver",       coords: [-123.12, 49.28] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(tz: string, now: Date, use24h: boolean): string {
  return new Intl.DateTimeFormat("sk-SK", {
    timeZone: tz,
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !use24h,
  }).format(now);
}

function formatDate(tz: string, now: Date): string {
  return new Intl.DateTimeFormat("sk-SK", {
    timeZone: tz,
    weekday: "short",
    day:     "numeric",
    month:   "short",
  }).format(now);
}

function getUtcOffset(tz: string, now: Date): number {
  const utcStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric", minute: "numeric", hour12: false,
  }).format(now);
  const tzStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric", minute: "numeric", hour12: false,
  }).format(now);
  const toMins = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  let diff = toMins(tzStr) - toMins(utcStr);
  if (diff > 780) diff -= 1440;
  if (diff < -780) diff += 1440;
  return diff / 60;
}

function offsetLabel(h: number): string {
  const sign = h >= 0 ? "+" : "-";
  const abs  = Math.abs(h);
  const hh   = Math.floor(abs);
  const mm   = Math.round((abs - hh) * 60);
  return `UTC${sign}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Map UTC offset (hours) to a hue so adjacent zones look different */
function offsetToColor(h: number): string {
  // Normalize -12..+14 → 0..1
  const t = (h + 12) / 26;
  // Cycle through hues 200°..340° (cool blues → purples → warm)
  const hue = Math.round(200 + t * 160);
  return `hsl(${hue} 60% 55% / 0.18)`;
}

/** Returns hour fraction 0-1 to drive day/night dot color */
function isDaytime(tz: string, now: Date): boolean {
  const h = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now),
    10,
  );
  return h >= 6 && h < 20;
}

// Country → UTC offset (approximate, good enough for coloring)
const COUNTRY_OFFSET: Record<string, number> = {
  "840": -5,  "124": -5,   "484": -6,  "032": -3,  "076": -3,  "152": -4,
  "826": 0,   "250": 1,    "276": 1,   "380": 1,   "724": 1,   "620": 0,
  "528": 1,   "056": 1,    "036": 10,  "554": 12,  "392": 9,   "410": 9,
  "156": 8,   "344": 8,    "702": 8,   "764": 7,   "356": 5.5, "586": 5,
  "784": 4,   "682": 3,    "818": 2,   "404": 3,   "710": 2,   "566": 1,
  "012": 1,   "504": 1,    "024": 1,   "729": 3,   "792": 3,
  "643": 3,   "804": 2,    "616": 1,   "203": 1,   "703": 1,   "040": 1,
  "756": 1,   "208": 1,    "752": 1,   "578": 1,   "246": 2,   "233": 2,
  "428": 2,   "440": 2,    "112": 3,   "398": 5,   "860": 5,   "268": 4,
  "051": 4,   "031": 4,    "144": 5.5, "104": 6.5, "116": 7,
  "360": 7,   "458": 8,    "608": 8,   "418": 7,   "704": 7,   "496": 8,
};

// ── Main Component ────────────────────────────────────────────────────────────
export function WorldClock() {
  const [now,       setNow]       = useState(() => new Date());
  const [use24h,    setUse24h]    = useState(true);
  const [search,    setSearch]    = useState("");
  const [hovered,   setHovered]   = useState<City | null>(null);
  const [pinned,    setPinned]    = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("wc_pinned") ?? "[]"); }
    catch { return []; }
  });
  const [zoom,      setZoom]      = useState(1);
  const [center,    setCenter]    = useState<[number, number]>([15, 25]);

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const togglePin = useCallback((name: string) => {
    setPinned((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      localStorage.setItem("wc_pinned", JSON.stringify(next));
      return next;
    });
  }, []);

  const filtered = search.trim()
    ? CITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.country.toLowerCase().includes(search.toLowerCase()),
      )
    : CITIES;

  // Pinned cities first in sidebar
  const sidebarCities = [
    ...CITIES.filter((c) => pinned.includes(c.name)),
    ...CITIES.filter((c) => !pinned.includes(c.name)),
  ].filter((c) =>
    !search.trim() ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.country.toLowerCase().includes(search.toLowerCase()),
  );

  const userCity = CITIES.find((c) => c.timezone === userTz);

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <span className="font-semibold text-sm">World Clock</span>
          {userCity && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
              <MapPin size={9} />
              {userCity.name} · {formatTime(userTz, now, use24h)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 12/24h toggle */}
          <button
            className={cn(
              "text-[10px] font-mono px-2 py-1 rounded border transition-colors",
              use24h
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground border-border hover:bg-muted",
            )}
            onClick={() => setUse24h((v) => !v)}
          >
            {use24h ? "24h" : "12h"}
          </button>
          {/* Zoom reset */}
          <button
            className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => { setZoom(1); setCenter([15, 25]); }}
          >
            Reset zoom
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 min-w-0 relative overflow-hidden bg-muted/20">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 130, center }}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={center}
              onMoveEnd={({ zoom: z, coordinates }) => {
                setZoom(z);
                setCenter(coordinates as [number, number]);
              }}
              minZoom={0.8}
              maxZoom={8}
            >
              <Geographies geography="/countries-110m.json">
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const numId  = geo.id as string;
                    const offset = COUNTRY_OFFSET[numId] ?? 0;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={offsetToColor(offset)}
                        stroke="hsl(var(--border))"
                        strokeWidth={0.4}
                        style={{
                          default:  { outline: "none" },
                          hover:    { outline: "none", fill: "hsl(var(--primary) / 0.25)" },
                          pressed:  { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>

              {/* City markers */}
              {filtered.map((city) => {
                const isUser   = city.timezone === userTz || city.name === userCity?.name;
                const isPinned = pinned.includes(city.name);
                const day      = isDaytime(city.timezone, now);
                return (
                  <Marker
                    key={city.name}
                    coordinates={city.coords}
                    onMouseEnter={() => setHovered(city)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => togglePin(city.name)}
                  >
                    <circle
                      r={isUser ? 5 : isPinned ? 4.5 : 3.5}
                      fill={
                        isUser
                          ? "hsl(var(--primary))"
                          : isPinned
                            ? "#f59e0b"
                            : day
                              ? "hsl(var(--foreground) / 0.7)"
                              : "hsl(var(--foreground) / 0.25)"
                      }
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                      style={{ cursor: "pointer", transition: "r 0.15s" }}
                    />
                    {(isUser || isPinned) && (
                      <text
                        textAnchor="middle"
                        y={-8}
                        style={{
                          fontSize: "5px",
                          fill: "hsl(var(--foreground))",
                          fontFamily: "sans-serif",
                          pointerEvents: "none",
                          userSelect: "none",
                        }}
                      >
                        {city.name}
                      </text>
                    )}
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>

          {/* Hover tooltip */}
          {hovered && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg px-3 py-2 pointer-events-none z-10 min-w-[180px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm">{hovered.name}</p>
                  <p className="text-[10px] text-muted-foreground">{hovered.country} · {offsetLabel(getUtcOffset(hovered.timezone, now))}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-lg tabular-nums leading-none">
                    {formatTime(hovered.timezone, now, use24h)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(hovered.timezone, now)}</p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-1">Klikni pre pripnutie</p>
            </div>
          )}

          {/* Zoom hint */}
          <p className="absolute top-2 right-2 text-[9px] text-muted-foreground/40 pointer-events-none select-none">
            Scroll = zoom · Drag = posun
          </p>
        </div>

        {/* Sidebar — city list */}
        <div className="w-[200px] shrink-0 border-l flex flex-col">
          {/* Search */}
          <div className="px-2 py-2 border-b shrink-0">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                className="w-full text-xs bg-muted/40 border border-border/50 rounded-md pl-6 pr-6 py-1 outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="Hľadaj mesto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch("")}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {sidebarCities.map((city) => {
              const isUser   = city.timezone === userTz;
              const isPinned = pinned.includes(city.name);
              const day      = isDaytime(city.timezone, now);
              const offset   = getUtcOffset(city.timezone, now);
              return (
                <button
                  key={city.name}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors border-b border-border/30 last:border-0",
                    isUser
                      ? "bg-primary/8 hover:bg-primary/12"
                      : isPinned
                        ? "bg-amber-500/5 hover:bg-amber-500/10"
                        : "hover:bg-muted/60",
                  )}
                  onClick={() => togglePin(city.name)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isUser
                          ? "bg-primary"
                          : isPinned
                            ? "bg-amber-400"
                            : day
                              ? "bg-foreground/50"
                              : "bg-foreground/20",
                      )}
                    />
                    <div className="min-w-0">
                      <p className={cn(
                        "text-[11px] leading-tight truncate",
                        isUser ? "font-semibold text-primary" : isPinned ? "font-medium" : "text-foreground",
                      )}>
                        {city.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground leading-tight">
                        {offsetLabel(offset)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-1">
                    <p className="font-mono text-[11px] tabular-nums font-medium">
                      {formatTime(city.timezone, now, use24h).slice(0, use24h ? 5 : 8)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{day ? "☀️" : "🌙"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
