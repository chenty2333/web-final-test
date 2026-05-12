param(
    [string]$BaseUrl = "http://127.0.0.1:5000"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$HttpExe = Join-Path $ProjectRoot ".venv\Scripts\http.exe"

if (-not (Test-Path $HttpExe)) {
    $HttpCommand = Get-Command http -ErrorAction SilentlyContinue
    if ($HttpCommand) {
        $HttpExe = $HttpCommand.Source
    }
}

if (-not (Test-Path $HttpExe)) {
    throw "HTTPie was not found. Run: uv venv && uv pip install -r requirements-dev.txt"
}

function Invoke-Httpie {
    param([string[]]$Arguments)
    Write-Host ""
    Write-Host "> http $($Arguments -join ' ')" -ForegroundColor Cyan
    $output = & $HttpExe @Arguments
    $text = $output -join "`n"
    if ($text) {
        Write-Host $text
    }
    return $text
}

Invoke-Httpie @("--ignore-stdin", "--print=b", "GET", "$BaseUrl/api/public/overview") | Out-Null
Invoke-Httpie @("--ignore-stdin", "--print=b", "GET", "$BaseUrl/api/public/categories") | Out-Null

$loginText = Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "POST",
    "$BaseUrl/api/auth/login",
    "username=test",
    "password=123456"
)
$token = ($loginText | ConvertFrom-Json).data.access_token

Invoke-Httpie @("--ignore-stdin", "--print=b", "GET", "$BaseUrl/api/auth/me", "Authorization:Bearer $token") | Out-Null
Invoke-Httpie @("--ignore-stdin", "--print=b", "GET", "$BaseUrl/api/summary", "Authorization:Bearer $token") | Out-Null
Invoke-Httpie @("--ignore-stdin", "--print=b", "GET", "$BaseUrl/api/entries", "Authorization:Bearer $token") | Out-Null

$createText = Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "POST",
    "$BaseUrl/api/entries",
    "Authorization:Bearer $token",
    "title=Demo coffee before defense",
    "amount:=16.00",
    "category_id:=2",
    "kind=expense",
    "spent_at=2026-05-12",
    "scene=Library",
    "mood=Focused",
    "note=API test create"
)
$entryId = ($createText | ConvertFrom-Json).data.entry.id

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "PUT",
    "$BaseUrl/api/entries/$entryId",
    "Authorization:Bearer $token",
    "amount:=18.00",
    "mood=Careful"
) | Out-Null

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "POST",
    "$BaseUrl/api/ai/coach",
    "Authorization:Bearer $token",
    "question=How can I spend less this week?"
) | Out-Null

Invoke-Httpie @("--ignore-stdin", "--print=b", "DELETE", "$BaseUrl/api/entries/$entryId", "Authorization:Bearer $token") | Out-Null
