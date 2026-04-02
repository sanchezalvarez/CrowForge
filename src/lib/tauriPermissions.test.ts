import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CAPABILITIES_PATH = resolve(__dirname, "../../src-tauri/capabilities/default.json");

function loadPermissions(): string[] {
  const raw = JSON.parse(readFileSync(CAPABILITIES_PATH, "utf-8"));
  return raw.permissions.map((p: string | { identifier: string }) =>
    typeof p === "string" ? p : p.identifier
  );
}

// These permissions are required by frontend Tauri API calls.
// If you add a new Tauri API call, add the corresponding permission here.
const REQUIRED_PERMISSIONS = [
  // App.tsx — window.show() on mount and after ready
  "core:window:allow-show",
  // App.tsx — window.setMinSize(new LogicalSize(...))
  "core:window:allow-set-min-size",
  // App.tsx — window.maximize()
  "core:window:allow-maximize",
  // Window title bar controls
  "core:window:allow-minimize",
  "core:window:allow-toggle-maximize",
  "core:window:allow-close",
  // Window dragging (custom title bar)
  "core:window:allow-start-dragging",
  // Single instance focus
  "core:window:allow-set-focus",
  "core:window:allow-unminimize",
  "core:window:allow-is-maximized",
  // Window sizing/positioning
  "core:window:allow-set-size",
  "core:window:allow-set-position",
  // Clipboard (copy/paste in editor, sheets, etc.)
  "clipboard-manager:allow-write-text",
  "clipboard-manager:allow-read-text",
  // Backend sidecar spawn
  "shell:allow-spawn",
];

describe("Tauri capabilities", () => {
  const permissions = loadPermissions();

  it.each(REQUIRED_PERMISSIONS)(
    "should include required permission: %s",
    (permission) => {
      expect(permissions).toContain(permission);
    }
  );

  it("capabilities file should be valid JSON with permissions array", () => {
    const raw = JSON.parse(readFileSync(CAPABILITIES_PATH, "utf-8"));
    expect(raw).toHaveProperty("permissions");
    expect(Array.isArray(raw.permissions)).toBe(true);
    expect(raw.permissions.length).toBeGreaterThan(0);
  });
});
