$ErrorActionPreference = 'Stop'

$backendPath = Join-Path $PSScriptRoot 'backend'
$pomPath = Join-Path $backendPath 'pom.xml'
$latestMigration = Join-Path $backendPath 'src\main\resources\db\migration\V9__create_media_catalog.sql'

if (-not (Test-Path $pomPath) -or -not (Test-Path $latestMigration)) {
    throw 'This is not the integrated Tracking App v2 root (pom.xml or V9 is missing).'
}

$databaseUrl = 'jdbc:postgresql://localhost:5432/life_catalogue_v2'
$databaseUser = if ($env:LIFE_CATALOGUE_DB_USERNAME) {
    $env:LIFE_CATALOGUE_DB_USERNAME
} else {
    'library_user'
}
$databasePassword = if ($env:LIFE_CATALOGUE_DB_PASSWORD) {
    $env:LIFE_CATALOGUE_DB_PASSWORD
} else {
    'library_password'
}

$env:DB_URL = $databaseUrl
$env:SPRING_DATASOURCE_URL = $databaseUrl
$env:DB_USERNAME = $databaseUser
$env:SPRING_DATASOURCE_USERNAME = $databaseUser
$env:DB_PASSWORD = $databasePassword
$env:SPRING_DATASOURCE_PASSWORD = $databasePassword

Remove-Item Env:SPRING_FLYWAY_URL -ErrorAction SilentlyContinue
Remove-Item Env:SPRING_FLYWAY_USER -ErrorAction SilentlyContinue
Remove-Item Env:SPRING_FLYWAY_PASSWORD -ErrorAction SilentlyContinue

Write-Host "Starting Tracking App with $databaseUrl"
Push-Location $backendPath
try {
    mvn clean spring-boot:run
} finally {
    Pop-Location
}
