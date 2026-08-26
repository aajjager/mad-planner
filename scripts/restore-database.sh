#!/bin/sh
set -eu

if [ "$#" -ne 2 ] || [ "$2" != "--confirm-restore" ]; then
  printf 'Usage: %s BACKUP.dump --confirm-restore\n' "$0" >&2
  exit 2
fi

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_file=$(CDPATH= cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")
case "$backup_file" in *.dump) ;; *) printf 'Expected a .dump backup file.\n' >&2; exit 2 ;; esac
[ -f "$backup_file" ] || { printf 'Backup not found: %s\n' "$backup_file" >&2; exit 2; }

cd "$project_root"
sh "$project_root/scripts/backup-database.sh"
docker compose stop api web
trap 'docker compose up -d api web' EXIT
docker compose cp "$backup_file" db:/tmp/mad-planner-restore.dump
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" /tmp/mad-planner-restore.dump'
docker compose exec -T db rm -f /tmp/mad-planner-restore.dump
printf 'Database restored from: %s\n' "$backup_file"
