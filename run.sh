#!/usr/bin/env bash
# Single-command launcher: sets up both halves, then runs API + UI together.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

info() { printf '\033[1;34m▸\033[0m %s\n' "$1"; }

# --- backend setup -----------------------------------------------------------
if [ ! -d .venv ]; then
  info "Creating Python virtualenv (.venv)"
  "$PYTHON_BIN" -m venv .venv
fi

if [ ! -f .venv/.deps-installed ] || [ backend/requirements.txt -nt .venv/.deps-installed ]; then
  info "Installing backend dependencies"
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r backend/requirements.txt
  touch .venv/.deps-installed
fi

# --- frontend setup ----------------------------------------------------------
if [ ! -d frontend/node_modules ]; then
  info "Installing frontend dependencies"
  (cd frontend && npm install --no-fund --no-audit)
fi

# --- run ---------------------------------------------------------------------
cleanup() {
  trap - INT TERM EXIT
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${UI_PID:-}" ] && kill "$UI_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

info "Starting FastAPI on http://127.0.0.1:${BACKEND_PORT}"
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload &
API_PID=$!

info "Starting Vite on http://127.0.0.1:${FRONTEND_PORT}"
(cd frontend && npm run dev -- --port "$FRONTEND_PORT" --strictPort) &
UI_PID=$!

cat <<BANNER

  AI-Assisted Knee Analysis Platform
  ----------------------------------
  UI       http://localhost:${FRONTEND_PORT}
  API      http://127.0.0.1:${BACKEND_PORT}
  Docs     http://127.0.0.1:${BACKEND_PORT}/docs

  Ctrl+C stops both processes.

BANNER

# macOS ships bash 3.2, which has no `wait -n`; wait on both children.
wait
