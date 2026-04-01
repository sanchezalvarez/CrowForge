# CrowForge 0.4.3 — Final production build script (Windows)
# Run from the project root: .\build.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== CrowForge v0.4.3 Build Started ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Ensure dependencies are installed ────────────────────────────────
Write-Host "[0/4] Checking dependencies..." -ForegroundColor Yellow
# Update pip
python -m pip install --upgrade pip --quiet

# Install base requirements
Write-Host "      Installing requirements from requirements.txt..."
pip install -r requirements.txt --quiet

# Install llama-cpp-python specifically with CPU support for maximum compatibility
# If you have CUDA, you might want to install with CMAKE_ARGS="-DGGML_CUDA=on"
Write-Host "      Ensuring llama-cpp-python is installed..."
pip install llama-cpp-python --quiet

# Install PyInstaller for bundling
pip install pyinstaller --quiet

# Install NPM dependencies
Write-Host "      Installing frontend dependencies (npm install)..."
npm install --silent

# ── Step 1: Bundle Python backend ────────────────────────────────────────────
Write-Host "[1/4] Bundling Python backend with PyInstaller..." -ForegroundColor Yellow
# Ensure dist/ exists
if (Test-Path "dist") { Remove-Item -Path "dist" -Recurse -Force }
python -m PyInstaller crowforge-backend.spec --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PyInstaller failed." -ForegroundColor Red
    exit 1
}
Write-Host "      Backend bundled -> dist/crowforge-backend.exe" -ForegroundColor Green

# ── Step 2: Copy sidecar binary ──────────────────────────────────────────────
Write-Host "[2/4] Copying sidecar binary to src-tauri/bin/..." -ForegroundColor Yellow
$binDir = "src-tauri\bin"
if (!(Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir }

$src = "dist\crowforge-backend.exe"
# Tauri sidecars on Windows expect the target triple suffix
$dst = "src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe"
Copy-Item -Path $src -Destination $dst -Force
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Copy failed." -ForegroundColor Red
    exit 1
}
Write-Host "      Sidecar binary ready." -ForegroundColor Green

# ── Step 3: Build Tauri installer ────────────────────────────────────────────
Write-Host "[3/4] Building Tauri installer (npm run tauri build)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Tauri build failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== CrowForge v0.4.3 Build Complete! ===" -ForegroundColor Cyan
Write-Host "Final Installers can be found in: src-tauri\target\release\bundle\" -ForegroundColor Green
Write-Host ""
