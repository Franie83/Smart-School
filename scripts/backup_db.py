"""Create a consistent SQLite backup using SQLite's online backup API."""
import os
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw = Path(os.environ.get("DATABASE_PATH", str(ROOT / "instance" / "smart_school.sqlite3")))
source = raw if raw.is_absolute() else ROOT / raw
if not source.exists():
    raise SystemExit(f"Database not found: {source}\nStart the application and save some data first.")
out_dir = ROOT / "backups"
out_dir.mkdir(parents=True, exist_ok=True)
destination = out_dir / f"smart_school_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite3"
with sqlite3.connect(source) as src, sqlite3.connect(destination) as dst:
    src.backup(dst)
print(f"Backup created: {destination}")
