import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(ROOT, relPath), "utf-8"));
}

function readText(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

function extractCargoVersion(content: string): string | null {
  // Match first version = "X.Y.Z" in [package] section
  const match = content.match(/\[package\][\s\S]*?version\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function extractConstVersion(content: string): string | null {
  const match = content.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

describe("Version sync", () => {
  const pkg = readJson("package.json") as { version: string };
  const sourceVersion = pkg.version;

  it("package.json version should be valid semver (X.Y.Z)", () => {
    expect(sourceVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("src-tauri/tauri.conf.json should match", () => {
    const conf = readJson("src-tauri/tauri.conf.json") as { version: string };
    expect(conf.version).toBe(sourceVersion);
  });

  it("src-tauri/Cargo.toml should match", () => {
    const cargo = readText("src-tauri/Cargo.toml");
    expect(extractCargoVersion(cargo)).toBe(sourceVersion);
  });

  it("src/lib/constants.ts APP_VERSION should match", () => {
    const constants = readText("src/lib/constants.ts");
    expect(extractConstVersion(constants)).toBe(sourceVersion);
  });

  it("installer/package.json should match", () => {
    const conf = readJson("installer/package.json") as { version: string };
    expect(conf.version).toBe(sourceVersion);
  });

  it("installer/src-tauri/tauri.conf.json should match", () => {
    const conf = readJson("installer/src-tauri/tauri.conf.json") as { version: string };
    expect(conf.version).toBe(sourceVersion);
  });

  it("installer/src-tauri/Cargo.toml should match", () => {
    const cargo = readText("installer/src-tauri/Cargo.toml");
    expect(extractCargoVersion(cargo)).toBe(sourceVersion);
  });
});
