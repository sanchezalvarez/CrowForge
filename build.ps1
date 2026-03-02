# CrowForge 0.2 — Full production build script (Windows)
# Run from the project root: .\build.ps1
# Prerequisites: Python 3.10+, Node.js 18+, Rust/Cargo 1.70+, pip install -r requirements.txt

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== CrowForge Build ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Bundle Python backend ────────────────────────────────────────────
Write-Host "[1/3] Bundling Python backend with PyInstaller..." -ForegroundColor Yellow
python -m PyInstaller crowforge-backend.spec --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PyInstaller failed." -ForegroundColor Red
    exit 1
}
Write-Host "      Backend bundled -> dist/crowforge-backend.exe" -ForegroundColor Green

# ── Step 2: Copy sidecar binary ──────────────────────────────────────────────
Write-Host "[2/3] Copying sidecar binary to src-tauri/bin/..." -ForegroundColor Yellow
$src = "dist\crowforge-backend.exe"
$dst = "src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe"
Copy-Item -Path $src -Destination $dst -Force
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Copy failed." -ForegroundColor Red
    exit 1
}
Write-Host "      Sidecar binary ready." -ForegroundColor Green

# ── Step 3: Build Tauri installer ────────────────────────────────────────────
Write-Host "[3/3] Building Tauri installer (npm run tauri build)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Tauri build failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Build complete! ===" -ForegroundColor Cyan
Write-Host "Installers: src-tauri\target\release\bundle\" -ForegroundColor Green
Write-Host ""
