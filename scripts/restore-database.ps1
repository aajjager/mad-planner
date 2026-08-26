param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmRestore) { throw "Restore replaces the current database. Run again with -ConfirmRestore." }
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
if ([IO.Path]::GetExtension($resolvedBackup) -ne ".dump") { throw "Expected a .dump backup file." }

$projectRoot = Split-Path -Parent $PSScriptRoot
$containerFile = "/tmp/mad-planner-restore.dump"
Push-Location $projectRoot
try {
    & (Join-Path $PSScriptRoot "backup-database.ps1")
    docker compose stop api web
    docker compose cp $resolvedBackup "db:$containerFile"
    if ($LASTEXITCODE -ne 0) { throw "The backup could not be copied to the database container." }
    docker compose exec -T db sh -c "pg_restore --clean --if-exists --no-owner --no-privileges --username=`"`$POSTGRES_USER`" --dbname=`"`$POSTGRES_DB`" $containerFile"
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL restore failed. The safety backup is in the backups folder." }
    docker compose exec -T db rm -f $containerFile
    Write-Host "Database restored from: $resolvedBackup"
} finally {
    docker compose up -d api web
    Pop-Location
}
