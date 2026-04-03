# CrowForge Splash Installer Build Script
# Standalone usage: .\installer\build.ps1 (builds everything)
# From main build.ps1: .\installer\build.ps1 -SkipMainBuild (main app already built)

param(
    [string]$Version = "0.5.2",
    [switch]$SkipMainBuild
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== CrowForge Splash Installer Build ===" -ForegroundColor Cyan
Write-Host "Version: $Version"
Write-Host ""

if (-not $SkipMainBuild) {
    # Step 1: Build the main CrowForge app (NSIS)
    Write-Host "[1/3] Building CrowForge main app..." -ForegroundColor Yellow
    Set-Location $PSScriptRoot\..
    npm run tauri build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Main app build failed." -ForegroundColor Red
        exit 1
    }

    # Find and copy NSIS output
    Write-Host "[2/3] Copying NSIS setup for embedding..." -ForegroundColor Yellow
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
        Write-Host "ERROR: Main NSIS build output not found." -ForegroundColor Red
        exit 1
    }
    Copy-Item $nsisOutput "installer\crowforge-setup.exe" -Force
    Write-Host "      Setup copied for embedding." -ForegroundColor Green
}

# Build the splash installer wrapper
$step = if ($SkipMainBuild) { "1/1" } else { "3/3" }
Write-Host ""
Write-Host "[$step] Building splash installer wrapper..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
npm install --silent
npx tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Installer wrapper build failed." -ForegroundColor Red
    exit 1
}

# Clean up embedded setup (large file, not needed after build)
Remove-Item "crowforge-setup.exe" -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Splash Installer Build Complete ===" -ForegroundColor Green
Write-Host "Output: src-tauri\target\release\bundle\nsis\" -ForegroundColor Cyan
Write-Host ""
