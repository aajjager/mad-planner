#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
context=$(mktemp -d)
trap 'rm -rf -- "$context"' EXIT HUP INT TERM
cp "$root/worker/Dockerfile" "$context/Dockerfile"
cp "$root/apps/api/pyproject.toml" "$context/pyproject.toml"
cp "$root/apps/web/package.json" "$root/apps/web/package-lock.json" "$context/"
docker build --tag madplanner-worker-tools:1 "$context"
