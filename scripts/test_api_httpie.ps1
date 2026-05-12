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
    throw "未找到 HTTPie。请先执行：uv venv && uv pip install -r requirements-dev.txt"
}

function Format-HttpArg {
    param([string]$Arg)
    if ($Arg -match "\s") {
        return '"' + $Arg.Replace('"', '\"') + '"'
    }
    return $Arg
}

function Invoke-Httpie {
    param([string[]]$Arguments)

    $displayHttp = if ($HttpExe -like "$ProjectRoot*") { ".venv\Scripts\http.exe" } else { "http" }
    $commandText = $displayHttp + " " + (($Arguments | ForEach-Object { Format-HttpArg $_ }) -join " ")
    Write-Host ""
    Write-Host "> $commandText" -ForegroundColor Cyan
    $output = & $HttpExe @Arguments
    $text = $output -join "`n"
    if ($text) {
        Write-Host $text
    }
    return $text
}

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "POST",
    "$BaseUrl/api/init-test-user"
) | Out-Null

$loginText = Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "POST",
    "$BaseUrl/api/auth/login",
    "username=test",
    "password=123456"
)
$token = ($loginText | ConvertFrom-Json).data.access_token

$createText = Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "POST",
    "$BaseUrl/api/records",
    "Authorization:Bearer $token",
    "item_name=lunch",
    "amount:=18.50"
)
$recordId = ($createText | ConvertFrom-Json).data.id

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "GET",
    "$BaseUrl/api/records",
    "Authorization:Bearer $token"
) | Out-Null

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "PUT",
    "$BaseUrl/api/records/$recordId",
    "Authorization:Bearer $token",
    "item_name=dinner",
    "amount:=26.80"
) | Out-Null

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "GET",
    "$BaseUrl/api/records/$recordId",
    "Authorization:Bearer $token"
) | Out-Null

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "DELETE",
    "$BaseUrl/api/records/$recordId",
    "Authorization:Bearer $token"
) | Out-Null

Invoke-Httpie @(
    "--ignore-stdin",
    "--print=b",
    "GET",
    "$BaseUrl/api/records",
    "Authorization:Bearer $token"
) | Out-Null
