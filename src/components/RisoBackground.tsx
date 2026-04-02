/**
 * RisoBackground — reusable risograph-style decorative background layer.
 *
 * Replaces the identical blob + crosshair + halftone JSX that was
 * copy-pasted across 10+ pages.  Uses clamp() for blob sizing so
 * the decoration scales correctly on 2.5K+ monitors.
 */

interface RisoBackgroundProps {
  accent?: "teal" | "violet" | "orange";
  variant?: "standard" | "chat";
}

/* ── colour look-up ─────────────────────────────────────────────── */

const ACCENT_COLORS = {
  teal: {
    primary:    "var(--accent-teal)",
    secondary:  "var(--accent-orange)",
    tertiary:   "var(--accent-violet)",
    quaternary: "var(--accent-teal)",
  },
  violet: {
    primary:    "var(--accent-violet)",
    secondary:  "var(--accent-orange)",
    tertiary:   "var(--accent-teal)",
    quaternary: "var(--accent-violet)",
  },
  orange: {
    primary:    "var(--accent-orange)",
    secondary:  "var(--accent-teal)",
    tertiary:   "var(--accent-violet)",
    quaternary: "var(--accent-orange)",
  },
} as const;

/* Crosshair stroke colours keyed by accent */
const CROSSHAIR_COLORS = {
  teal: {
    topRight:    { stroke: "rgba(11,114,104,0.45)", circle: "rgba(11,114,104,0.3)" },
    bottomLeft:  { stroke: "rgba(224,78,14,0.45)",  circle: "rgba(224,78,14,0.3)" },
    topLeft:     { stroke: "rgba(92,58,156,0.35)",   circle: null },
    bottomRight: { stroke: "rgba(11,114,104,0.25)",  circle: null },
  },
  violet: {
    topRight:    { stroke: "rgba(139,98,212,0.45)", circle: "rgba(139,98,212,0.3)" },
    bottomLeft:  { stroke: "rgba(224,78,14,0.45)",  circle: "rgba(224,78,14,0.3)" },
    topLeft:     { stroke: "rgba(11,114,104,0.35)", circle: null },
    bottomRight: { stroke: "rgba(139,98,212,0.25)", circle: null },
  },
  orange: {
    topRight:    { stroke: "rgba(224,78,14,0.45)",  circle: "rgba(224,78,14,0.3)" },
    bottomLeft:  { stroke: "rgba(11,114,104,0.45)", circle: "rgba(11,114,104,0.3)" },
    topLeft:     { stroke: "rgba(92,58,156,0.35)",  circle: null },
    bottomRight: { stroke: "rgba(224,78,14,0.25)",  circle: null },
  },
} as const;

/* Halftone + ink splatter colours keyed by accent */
const HALFTONE_COLORS = {
  teal: {
    cluster1: "rgba(224,78,14,0.28)",
    cluster2: "rgba(11,114,104,0.28)",
    cluster3: "rgba(92,58,156,0.22)",
    ink: {
      orange: "rgba(224,78,14,",
      teal:   "rgba(11,114,104,",
      violet: "rgba(92,58,156,",
    },
  },
  violet: {
    cluster1: "rgba(139,98,212,0.28)",
    cluster2: "rgba(224,78,14,0.28)",
    cluster3: "rgba(139,98,212,0.22)",
    ink: {
      orange: "rgba(139,98,212,",
      teal:   "rgba(11,114,104,",
      violet: "rgba(224,78,14,",
    },
  },
  orange: {
    cluster1: "rgba(224,78,14,0.28)",
    cluster2: "rgba(11,114,104,0.28)",
    cluster3: "rgba(92,58,156,0.22)",
    ink: {
      orange: "rgba(224,78,14,",
      teal:   "rgba(11,114,104,",
      violet: "rgba(92,58,156,",
    },
  },
} as const;

/* ── component ──────────────────────────────────────────────────── */

export function RisoBackground({
  accent = "teal",
  variant = "standard",
}: RisoBackgroundProps) {
  const c = ACCENT_COLORS[accent];
  const ch = CROSSHAIR_COLORS[accent];
  const ht = HALFTONE_COLORS[accent];

  const isChat = variant === "chat";

  return (
    <div
      className="pointer-events-none select-none"
      style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}
    >
      {/* ── 1. Colour blobs (clamp-scaled for 2.5K monitors) ── */}
      <div
        className="animate-blob-drift"
        style={{
          position: "absolute",
          width: "clamp(400px, 35vw, 900px)",
          height: "clamp(400px, 35vw, 900px)",
          borderRadius: "50%",
          background: c.primary,
          opacity: 0.1,
          mixBlendMode: "multiply",
          top: -200,
          right: -180,
        }}
      />
      <div
        className="animate-blob-drift-b"
        style={{
          position: "absolute",
          width: "clamp(350px, 28vw, 750px)",
          height: "clamp(350px, 28vw, 750px)",
          borderRadius: "50%",
          background: c.secondary,
          opacity: 0.09,
          mixBlendMode: "multiply",
          bottom: -160,
          left: -160,
        }}
      />
      <div
        className="animate-blob-drift-c"
        style={{
          position: "absolute",
          width: "clamp(260px, 22vw, 600px)",
          height: "clamp(260px, 22vw, 600px)",
          borderRadius: "50%",
          background: c.tertiary,
          opacity: 0.07,
          mixBlendMode: "multiply",
          bottom: 80,
          right: -100,
        }}
      />
      <div
        className="animate-blob-drift-d"
        style={{
          position: "absolute",
          width: "clamp(180px, 15vw, 400px)",
          height: "clamp(180px, 15vw, 400px)",
          borderRadius: "50%",
          background: c.quaternary,
          opacity: 0.06,
          mixBlendMode: "multiply",
          top: "35%",
          left: -100,
        }}
      />

      {/* ── 2. Registration crosshairs ── */}
      {/* Top-right */}
      <svg
        style={{ position: "absolute", top: 8, right: 8, width: 48, height: 48 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="4" y1="20" x2="28" y2="20" stroke={ch.topRight.stroke} strokeWidth="1.5" />
        <line x1="16" y1="8" x2="16" y2="32" stroke={ch.topRight.stroke} strokeWidth="1.5" />
        <circle cx="16" cy="20" r="5" stroke={ch.topRight.circle!} strokeWidth="1" fill="none" />
      </svg>
      {/* Bottom-left */}
      <svg
        style={{ position: "absolute", bottom: 8, left: 8, width: 48, height: 48 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="4" y1="28" x2="28" y2="28" stroke={ch.bottomLeft.stroke} strokeWidth="1.5" />
        <line x1="16" y1="16" x2="16" y2="40" stroke={ch.bottomLeft.stroke} strokeWidth="1.5" />
        <circle cx="16" cy="28" r="5" stroke={ch.bottomLeft.circle!} strokeWidth="1" fill="none" />
      </svg>

      {/* Extra crosshairs — standard only */}
      {!isChat && (
        <>
          {/* Top-left */}
          <svg
            style={{ position: "absolute", top: 8, left: 8, width: 48, height: 48 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="4" y1="20" x2="28" y2="20" stroke={ch.topLeft.stroke} strokeWidth="1.5" />
            <line x1="16" y1="8" x2="16" y2="32" stroke={ch.topLeft.stroke} strokeWidth="1.5" />
          </svg>
          {/* Bottom-right */}
          <svg
            style={{ position: "absolute", bottom: 8, right: 8, width: 48, height: 48 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="4" y1="28" x2="28" y2="28" stroke={ch.bottomRight.stroke} strokeWidth="1" />
            <line x1="16" y1="16" x2="16" y2="40" stroke={ch.bottomRight.stroke} strokeWidth="1" />
          </svg>
        </>
      )}

      {/* ── 3. Halftone dot clusters ── */}
      {/* Always show first halftone cluster */}
      <svg
        style={{ position: "absolute", right: 40, top: 120, width: 100, height: 100 }}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[[20,20,3.5],[38,14,2.5],[12,38,2],[30,35,3],[48,28,2],[55,42,1.5],[22,52,2],[40,50,1.5],[60,30,1],[15,60,1.5]].map(
          ([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={ht.cluster1} />
          ),
        )}
      </svg>

      {/* Second halftone cluster — standard only */}
      {!isChat && (
        <svg
          style={{ position: "absolute", left: 60, bottom: 120, width: 90, height: 90 }}
          viewBox="0 0 90 90"
          xmlns="http://www.w3.org/2000/svg"
        >
          {[[18,18,3],[34,12,2],[10,32,2.5],[28,30,2],[44,22,1.5],[50,36,2],[16,46,1.5],[36,44,1],[55,28,1],[12,58,1.5]].map(
            ([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill={ht.cluster2} />
            ),
          )}
        </svg>
      )}

      {/* ── 4. Ink splatter dots ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="18%" cy="12%" r="3"   fill={`${ht.ink.orange}0.20)`} />
        <circle cx="23%" cy="8%"  r="1.5" fill={`${ht.ink.orange}0.14)`} />
        <circle cx="15%" cy="18%" r="2"   fill={`${ht.ink.orange}0.12)`} />
        <circle cx="72%" cy="55%" r="2.5" fill={`${ht.ink.teal}0.18)`} />
        <circle cx="76%" cy="60%" r="1.5" fill={`${ht.ink.teal}0.12)`} />
        <circle cx="68%" cy="62%" r="1"   fill={`${ht.ink.teal}0.15)`} />
        <circle cx="88%" cy="30%" r="2"   fill={`${ht.ink.violet}0.18)`} />
        <circle cx="92%" cy="35%" r="1.5" fill={`${ht.ink.violet}0.12)`} />
        <circle cx="85%" cy="38%" r="1"   fill={`${ht.ink.violet}0.15)`} />
        <circle cx="40%" cy="85%" r="2.5" fill={`${ht.ink.orange}0.16)`} />
        <circle cx="44%" cy="90%" r="1.5" fill={`${ht.ink.orange}0.10)`} />
        <circle cx="36%" cy="88%" r="1"   fill={`${ht.ink.teal}0.14)`} />
        <circle cx="55%" cy="20%" r="2"   fill={`${ht.ink.violet}0.15)`} />
        <circle cx="60%" cy="15%" r="1"   fill={`${ht.ink.violet}0.10)`} />
        <circle cx="10%" cy="70%" r="2"   fill={`${ht.ink.teal}0.16)`} />
        <circle cx="6%"  cy="75%" r="1.5" fill={`${ht.ink.teal}0.10)`} />
      </svg>
    </div>
  );
}
