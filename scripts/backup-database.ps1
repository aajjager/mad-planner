param([string]$OutputDirectory = "backups")

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupDirectory = Join-Path $projectRoot $OutputDirectory
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$containerFile = "/tmp/mad-planner-$timestamp.dump"
$backupFile = Join-Path $backupDirectory "mad-planner-$timestamp.dump"

New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
Push-Location $projectRoot
try {
    docker compose exec -T db sh -c "pg_dump --format=custom --no-owner --no-privileges --username=`"`$POSTGRES_USER`" --dbname=`"`$POSTGRES_DB`" --file=$containerFile"
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL backup failed." }
    docker compose cp "db:$containerFile" $backupFile
    if ($LASTEXITCODE -ne 0) { throw "The backup could not be copied from the database container." }
    docker compose exec -T db rm -f $containerFile
    Write-Host "Backup created: $backupFile"
} finally {
    Pop-Location
}
