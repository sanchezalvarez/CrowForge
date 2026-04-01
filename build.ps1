# CrowForge 0.4.4 — Full production build with branded splash installer (Windows)
# Run from the project root: .\build.ps1

$ErrorActionPreference = "Stop"
$Version = "0.4.4"

Write-Host ""
Write-Host "=== CrowForge v$Version Build Started ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Ensure dependencies are installed ────────────────────────────────
Write-Host "[0/5] Checking dependencies..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet
Write-Host "      Installing requirements from requirements.txt..."
pip install -r requirements.txt --quiet
Write-Host "      Ensuring llama-cpp-python is installed..."
pip install llama-cpp-python --quiet
pip install pyinstaller --quiet
Write-Host "      Installing frontend dependencies (npm install)..."
npm install --silent

# ── Step 1: Bundle Python backend ────────────────────────────────────────────
Write-Host "[1/5] Bundling Python backend with PyInstaller..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Path "dist" -Recurse -Force }
python -m PyInstaller crowforge-backend.spec --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PyInstaller failed." -ForegroundColor Red
    exit 1
}
Write-Host "      Backend bundled -> dist/crowforge-backend.exe" -ForegroundColor Green

# ── Step 2: Copy sidecar binary ──────────────────────────────────────────────
Write-Host "[2/5] Copying sidecar binary to src-tauri/bin/..." -ForegroundColor Yellow
$binDir = "src-tauri\bin"
if (!(Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir }
$src = "dist\crowforge-backend.exe"
$dst = "src-tauri\bin\crowforge-backend-x86_64-pc-windows-msvc.exe"
Copy-Item -Path $src -Destination $dst -Force
Write-Host "      Sidecar binary ready." -ForegroundColor Green

# ── Step 3: Build main CrowForge NSIS installer ─────────────────────────────
Write-Host "[3/5] Building Tauri installer (npm run tauri build)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Tauri build failed." -ForegroundColor Red
    exit 1
}
Write-Host "      Main NSIS installer built." -ForegroundColor Green

# ── Step 4: Copy NSIS setup for splash installer embedding ──────────────────
Write-Host "[4/5] Preparing splash installer wrapper..." -ForegroundColor Yellow
$nsisOutput = $null
$candidates = @(
    "src-tauri\target\release\bundle\nsis\CrowForge_${Version}_x64-setup.exe",
    "src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\CrowForge_${Version}_x64-setup.exe"
)
foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
        $nsisOutput = $candidate
        break
    }
}
if (-not $nsisOutput) {
    Write-Host "WARNING: NSIS output not found. Splash installer skipped." -ForegroundColor Yellow
    Write-Host "         Looked for: CrowForge_${Version}_x64-setup.exe" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "=== CrowForge v$Version Build Complete (without splash installer) ===" -ForegroundColor Cyan
    Write-Host "Main installer: src-tauri\target\release\bundle\nsis\" -ForegroundColor Green
    exit 0
}
Copy-Item $nsisOutput "installer\crowforge-setup.exe" -Force
Write-Host "      Setup copied: $nsisOutput -> installer\crowforge-setup.exe" -ForegroundColor Green

# ── Step 5: Build branded splash installer wrapper ───────────────────────────
Write-Host "[5/5] Building branded splash installer (CrowForge-Install.exe)..." -ForegroundColor Yellow
Push-Location installer
npm install --silent
npx tauri build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "WARNING: Splash installer build failed. Main installer is still available." -ForegroundColor Yellow
} else {
    # Clean up embedded setup (large file, not needed after build)
    Remove-Item "crowforge-setup.exe" -Force -ErrorAction SilentlyContinue

    # Copy raw exe as the distributable (NOT the NSIS bundle — that would wrap it in another wizard)
    $splashExe = "src-tauri\target\release\crowforge-installer.exe"
    $outputDir = "..\dist"
    if (!(Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir -Force | Out-Null }
    Copy-Item $splashExe "$outputDir\CrowForge-Install.exe" -Force
    Pop-Location
    Write-Host "      Splash installer built successfully." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== CrowForge v$Version Build Complete! ===" -ForegroundColor Cyan
Write-Host "Main NSIS (silent):    src-tauri\target\release\bundle\nsis\" -ForegroundColor Green
Write-Host "Branded installer:     dist\CrowForge-Install.exe" -ForegroundColor Green
Write-Host ""
