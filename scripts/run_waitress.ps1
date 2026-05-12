param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Waitress = Join-Path $ProjectRoot ".venv\Scripts\waitress-serve.exe"

if (-not (Test-Path $Waitress)) {
    throw "Waitress was not found. Run: uv pip install -r requirements.txt"
}

$env:APP_ENV = if ($env:APP_ENV) { $env:APP_ENV } else { "production" }
& $Waitress "--listen=$HostName`:$Port" "wsgi:app"
