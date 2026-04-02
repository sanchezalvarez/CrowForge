import { useEffect, useState } from "react";
import crowforgeIco from "../assets/crowforge_ico.png";
import { APP_VERSION } from "../lib/constants";

const STATUS_MESSAGES = [
  "Starting backend…",
  "Almost ready…",
  "Hang tight…",
  "First launch may take a moment…",
  "Still loading, please wait…",
];

export function SplashScreen({ failed }: { failed?: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [dotPhase, setDotPhase] = useState(0);

  useEffect(() => {
    if (failed) return;
    const msgId = setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2500);
    const dotId = setInterval(() => {
      setDotPhase((p) => (p + 1) % 3);
    }, 480);
    return () => {
      clearInterval(msgId);
      clearInterval(dotId);
    };
  }, [failed]);

  const dots = ["◆", "◆◆", "◆◆◆"];

  return (
    <>
      {/* Main container */}
      <div
        className="animate-ink-in flex flex-col items-center justify-center gap-5 riso-noise riso-noise-live"
        style={{
          width: "100vw",
          height: "100vh",
          background: "var(--background)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Riso background blobs */}
        <div className="pointer-events-none select-none" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <div
            className="animate-blob-drift"
            style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", background: "var(--accent-teal)", opacity: 0.09, mixBlendMode: "multiply", top: -150, right: -150 }}
          />
          <div
            className="animate-blob-drift-b"
            style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", background: "var(--accent-orange)", opacity: 0.08, mixBlendMode: "multiply", bottom: -120, left: -120 }}
          />
          <div
            className="animate-blob-drift-c"
            style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "var(--accent-violet)", opacity: 0.06, mixBlendMode: "multiply", bottom: 80, right: -40 }}
          />
        </div>

        {/* Logo */}
        <div className="riso-stamp-press" style={{ flexShrink: 0 }}>
          <img
            src={crowforgeIco}
            alt="CrowForge"
            className="object-contain"
            style={{ width: 80, height: 80, display: "block" }}
          />
        </div>

        {/* Title with mis-registration effect */}
        <div style={{ textAlign: "center" }}>
          <p
            className="font-mono-ui uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "var(--accent-teal)",
              opacity: 0.8,
              marginBottom: 4,
            }}
          >
            v{APP_VERSION}
          </p>
          <h1
            className="font-display font-black tracking-tight leading-none riso-title"
            style={{ fontSize: "clamp(1.9rem, 5vw, 2.6rem)" }}
          >
            CrowForge
          </h1>
        </div>

        {/* Riso color chips divider */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 28,
              height: 4,
              borderRadius: 2,
              background: "var(--accent-orange)",
              opacity: 0.7,
              display: "block",
            }}
          />
          <span
            style={{
              width: 28,
              height: 4,
              borderRadius: 2,
              background: "var(--accent-teal)",
              opacity: 0.7,
              display: "block",
            }}
          />
          <span
            style={{
              width: 28,
              height: 4,
              borderRadius: 2,
              background: "var(--accent-violet)",
              opacity: 0.7,
              display: "block",
            }}
          />
        </div>

        {/* Status area */}
        {failed ? (
          <div
            className="surface-noise-flat rounded-lg"
            style={{
              textAlign: "center",
              padding: "16px 20px",
              border: "1.5px solid rgba(220,38,38,0.35)",
              background: "color-mix(in srgb, var(--destructive) 8%, var(--card))",
              boxShadow: "3px 3px 0 rgba(220,38,38,0.18)",
              width: "100%",
            }}
          >
            <p
              className="font-mono-ui font-semibold"
              style={{ fontSize: 12, color: "var(--destructive)", letterSpacing: "0.06em", marginBottom: 6 }}
            >
              ✕ Backend failed to start
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Try running{" "}
              <code
                style={{
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 11,
                  background: "var(--background-3)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 3,
                  padding: "1px 6px",
                }}
              >
                python -m backend.app
              </code>{" "}
              manually.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {/* Riso-style loading indicator — three stacked color dots */}
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              {[
                { color: "var(--accent-orange)", delay: "0s" },
                { color: "var(--accent-teal)", delay: "0.18s" },
                { color: "var(--accent-violet)", delay: "0.36s" },
              ].map((dot, i) => (
                <span
                  key={i}
                  className="animate-riso-pulse"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dot.color,
                    display: "block",
                    animationDelay: dot.delay,
                    opacity: 0.85,
                    border: "1.5px solid rgba(20,16,10,0.10)",
                  }}
                />
              ))}
            </div>
            {/* Status message with riso dot counter */}
            <p
              className="font-mono-ui"
              style={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  color: "var(--accent-orange)",
                  fontSize: 7,
                  letterSpacing: 2,
                  minWidth: 22,
                  display: "inline-block",
                }}
              >
                {dots[dotPhase]}
              </span>
              {STATUS_MESSAGES[msgIndex]}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
