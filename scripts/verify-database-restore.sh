#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then printf 'Usage: %s BACKUP.dump\n' "$0" >&2; exit 2; fi
backup_file=$(CDPATH= cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")
case "$backup_file" in *.dump) ;; *) printf 'Expected a .dump backup file.\n' >&2; exit 2 ;; esac
[ -f "$backup_file" ] || { printf 'Backup not found: %s\n' "$backup_file" >&2; exit 2; }

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_database="madplanner_restore_test_$(date +%Y%m%d%H%M%S)"
container_file="/tmp/$test_database.dump"
database_created=false
cd "$project_root"

cleanup() {
  if [ "$database_created" = true ]; then docker compose exec -T db sh -c "dropdb --if-exists --force --username=\"\$POSTGRES_USER\" $test_database" >/dev/null; fi
  docker compose exec -T db rm -f "$container_file" >/dev/null || true
}
trap cleanup EXIT

docker compose cp "$backup_file" "db:$container_file"
docker compose exec -T db pg_restore --list "$container_file" >/dev/null
docker compose exec -T db sh -c "createdb --username=\"\$POSTGRES_USER\" $test_database"
database_created=true
docker compose exec -T db sh -c "pg_restore --exit-on-error --no-owner --no-privileges --username=\"\$POSTGRES_USER\" --dbname=$test_database $container_file"
tables=$(printf '%s\n' 'SELECT count(*) FROM information_schema.tables WHERE table_schema=current_schema();' | docker compose exec -T db sh -c "psql --username=\"\$POSTGRES_USER\" --dbname=$test_database --tuples-only --no-align")
users=$(printf '%s\n' 'SELECT count(*) FROM users;' | docker compose exec -T db sh -c "psql --username=\"\$POSTGRES_USER\" --dbname=$test_database --tuples-only --no-align")
recipes=$(printf '%s\n' 'SELECT count(*) FROM recipes;' | docker compose exec -T db sh -c "psql --username=\"\$POSTGRES_USER\" --dbname=$test_database --tuples-only --no-align")
migration=$(printf '%s\n' 'SELECT version_num FROM alembic_version;' | docker compose exec -T db sh -c "psql --username=\"\$POSTGRES_USER\" --dbname=$test_database --tuples-only --no-align")
summary=$(printf 'tables=%s\nusers=%s\nrecipes=%s\nmigration=%s\n' "$tables" "$users" "$recipes" "$migration")
printf '%s\n' "$summary"
printf '%s\n' "$summary" | grep -Eq '^tables=[0-9]+$'
printf '%s\n' "$summary" | grep -Eq '^users=[0-9]+$'
printf '%s\n' "$summary" | grep -Eq '^recipes=[0-9]+$'
printf '%s\n' "$summary" | grep -Eq '^migration=.+$'
printf 'Disposable restore verified successfully.\n'
