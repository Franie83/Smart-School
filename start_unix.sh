#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
[ -f .env ] || cp .env.example .env
python -m pip install --upgrade pip
pip install -r requirements.txt
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm is required to build the React user interface." >&2
  exit 1
fi
[ -d node_modules ] || npm install
npm run build
exec python run_flask.py
