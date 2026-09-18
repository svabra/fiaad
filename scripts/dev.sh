#!/usr/bin/env sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(dirname "$SCRIPT_DIR")
cd "$REPO_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review secrets before non-local use."
fi
docker compose up --build

