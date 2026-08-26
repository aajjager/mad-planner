#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_directory=${1:-"$project_root/backups"}
timestamp=$(date +%Y%m%d-%H%M%S)
container_file="/tmp/mad-planner-$timestamp.dump"
backup_file="$backup_directory/mad-planner-$timestamp.dump"

mkdir -p "$backup_directory"
cd "$project_root"
docker compose exec -T db sh -c "pg_dump --format=custom --no-owner --no-privileges --username=\"\$POSTGRES_USER\" --dbname=\"\$POSTGRES_DB\" --file=$container_file"
docker compose cp "db:$container_file" "$backup_file"
docker compose exec -T db rm -f "$container_file"
printf 'Backup created: %s\n' "$backup_file"
