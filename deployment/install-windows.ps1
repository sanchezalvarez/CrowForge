# CrowForge Server — Windows installation script
# Run as Administrator in PowerShell

param(
    [string]$InstallPath = "C:\CrowForge-Server",
    [string]$Port = "8000"
)

Write-Host "=== CrowForge Server Installation ===" -ForegroundColor Cyan

# Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Error "Python not found. Install Python 3.11+ from python.org"
    exit 1
}

# Create install directory
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallPath\data" | Out-Null
Copy-Item -Recurse -Force "backend" "$InstallPath\"
Copy-Item -Force "requirements.txt" "$InstallPath\"
Copy-Item -Force "start-server.py" "$InstallPath\"

# Install dependencies
Push-Location $InstallPath
python -m pip install -r requirements.txt
Pop-Location

# Generate API key
$chars = "abcdefghijklmnopqrstuvwxyz0123456789"
$apiKey = "sk-cf-"
for ($i = 0; $i -lt 24; $i++) {
    $apiKey += $chars[(Get-Random -Maximum $chars.Length)]
}

# Create .env file
@"
CROWFORGE_HOST_API_KEY=$apiKey
CROWFORGE_HOST_PORT=$Port
CROWFORGE_DB_PATH=$InstallPath\data\crowforge.db
CROWFORGE_LOG_LEVEL=INFO
"@ | Out-File -FilePath "$InstallPath\.env" -Encoding UTF8

# Check NSSM
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    Write-Host "Installing as Windows Service via NSSM..." -ForegroundColor Yellow
    nssm install CrowForge python "$InstallPath\start-server.py"
    nssm set CrowForge AppDirectory $InstallPath
    nssm set CrowForge AppEnvironmentExtra "CROWFORGE_HOST_API_KEY=$apiKey" "CROWFORGE_HOST_PORT=$Port"
    nssm start CrowForge
    Write-Host "Service installed and started!" -ForegroundColor Green
} else {
    Write-Host "NSSM not found - run manually:" -ForegroundColor Yellow
    Write-Host "  cd $InstallPath"
    Write-Host "  python start-server.py"
}

# Open firewall
Write-Host ""
Write-Host "Opening Windows Firewall for port $Port..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "CrowForge Server" `
    -Direction Inbound -Protocol TCP -LocalPort $Port `
    -Action Allow -ErrorAction SilentlyContinue
Write-Host "Firewall rule added." -ForegroundColor Green

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host "API Key: $apiKey" -ForegroundColor Cyan
Write-Host "Port: $Port"
Write-Host "Share API key with your team!"
