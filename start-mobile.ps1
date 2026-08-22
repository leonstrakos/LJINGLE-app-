$ErrorActionPreference = 'Stop'

$mobilePath = Join-Path $PSScriptRoot 'mobile'
$packagePath = Join-Path $mobilePath 'package.json'
$sqlitePackagePath = Join-Path $mobilePath 'node_modules\expo-sqlite\package.json'

if (-not (Test-Path $packagePath)) {
    throw 'This is not the integrated Tracking App v2 root (mobile package.json is missing).'
}

Push-Location $mobilePath
try {
    if (-not (Test-Path $sqlitePackagePath)) {
        Write-Host 'Installing mobile dependencies (first run only).'
        npm ci
    }
    npm run typecheck
    Write-Host 'Starting the offline-first app in the web browser.'
    npm run web
} finally {
    Pop-Location
}
