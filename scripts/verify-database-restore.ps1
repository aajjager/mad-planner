param([Parameter(Mandatory = $true)][string]$BackupFile)

$ErrorActionPreference = "Stop"
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
if ([IO.Path]::GetExtension($resolvedBackup) -ne ".dump") { throw "Expected a .dump backup file." }

$projectRoot = Split-Path -Parent $PSScriptRoot
$testDatabase = "madplanner_restore_test_$(Get-Date -Format 'yyyyMMddHHmmss')"
$containerFile = "/tmp/$testDatabase.dump"
$databaseCreated = $false

Push-Location $projectRoot
try {
    docker compose cp $resolvedBackup "db:$containerFile"
    if ($LASTEXITCODE -ne 0) { throw "The backup could not be copied to the database container." }
    docker compose exec -T db pg_restore --list $containerFile | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL could not read the backup archive." }
    docker compose exec -T db sh -c "createdb --username=`"`$POSTGRES_USER`" $testDatabase"
    if ($LASTEXITCODE -ne 0) { throw "The disposable test database could not be created." }
    $databaseCreated = $true
    docker compose exec -T db sh -c "pg_restore --exit-on-error --no-owner --no-privileges --username=`"`$POSTGRES_USER`" --dbname=$testDatabase $containerFile"
    if ($LASTEXITCODE -ne 0) { throw "The backup could not be restored into the disposable database." }
    function Invoke-RestoreQuery([string]$Query) {
        $value = $Query | docker compose exec -T db sh -c "psql --username=`"`$POSTGRES_USER`" --dbname=$testDatabase --tuples-only --no-align"
        if ($LASTEXITCODE -ne 0) { throw "The restored database could not be queried." }
        return ($value -join "").Trim()
    }
    $summary = @(
        "tables=$(Invoke-RestoreQuery 'SELECT count(*) FROM information_schema.tables WHERE table_schema=current_schema();')"
        "users=$(Invoke-RestoreQuery 'SELECT count(*) FROM users;')"
        "recipes=$(Invoke-RestoreQuery 'SELECT count(*) FROM recipes;')"
        "migration=$(Invoke-RestoreQuery 'SELECT version_num FROM alembic_version;')"
    )
    $summaryText = $summary -join "`n"
    if ($summaryText -notmatch "tables=\d+" -or $summaryText -notmatch "users=\d+" -or $summaryText -notmatch "recipes=\d+" -or $summaryText -notmatch "migration=\S+") { throw "The restored database did not return the required verification summary." }
    Write-Host "Disposable restore verified successfully:"
    $summary | ForEach-Object { if ($_.Trim()) { Write-Host "  $($_.Trim())" } }
} finally {
    if ($databaseCreated) { docker compose exec -T db sh -c "dropdb --if-exists --force --username=`"`$POSTGRES_USER`" $testDatabase" | Out-Null }
    docker compose exec -T db rm -f $containerFile | Out-Null
    Pop-Location
}
