"""Flask + SQLite backend for Smart School Record Management.

The React/Vite application is retained as the presentation layer. Flask owns
server-side persistence, CRUD APIs, password hashing, health checks and audit events.
"""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
_db_setting = Path(os.environ.get("DATABASE_PATH", str(ROOT / "instance" / "smart_school.sqlite3")))
DB_PATH = _db_setting if _db_setting.is_absolute() else ROOT / _db_setting

RESOURCES = {
    "schools", "sessions", "terms", "classes", "students", "student_movements",
    "calendar_days", "attendance_records", "attendance_audit_logs", "term_unlock_logs",
    "users", "register_symbol_settings", "subjects", "assessment_scores", "report_cards",
    "settings", "offline_drafts",
}
STORAGE_PREFIX = "smart_register_"

app = Flask(__name__, static_folder=str(ROOT / "dist"), static_url_path="/")
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "local-development-secret-change-before-deployment"),
    MAX_CONTENT_LENGTH=20 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "0") == "1",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 8,
)
_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
CORS(app, resources={r"/api/*": {"origins": _origins or ["http://localhost:3000"], "supports_credentials": True}})


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def audit(db: sqlite3.Connection, action: str, resource: str | None = None,
          record_id: str | None = None, details=None, actor: str | None = None) -> None:
    db.execute(
        "INSERT INTO audit_events(id,actor,action,resource,record_id,details,created_at) VALUES (?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), actor or session.get("account_id"), action, resource,
         record_id, json.dumps(details or {}, ensure_ascii=False), now()),
    )


def init_db() -> None:
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS records (
            resource TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            PRIMARY KEY(resource,id))""")
        db.execute("""CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL, role TEXT NOT NULL, school_id TEXT, assigned_class_ids TEXT NOT NULL DEFAULT '[]',
            active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)""")
        db.execute("""CREATE TABLE IF NOT EXISTS audit_events (
            id TEXT PRIMARY KEY, actor TEXT, action TEXT NOT NULL, resource TEXT,
            record_id TEXT, details TEXT, created_at TEXT NOT NULL)""")
        db.execute("""CREATE TABLE IF NOT EXISTS app_storage (
            key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)""")
        columns = {row[1] for row in db.execute("PRAGMA table_info(accounts)").fetchall()}
        if "school_id" not in columns:
            db.execute("ALTER TABLE accounts ADD COLUMN school_id TEXT")
        if "assigned_class_ids" not in columns:
            db.execute("ALTER TABLE accounts ADD COLUMN assigned_class_ids TEXT NOT NULL DEFAULT '[]'")
        username = os.environ.get("BOOTSTRAP_ADMIN_USERNAME", "").strip()
        password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
        if username and password and not db.execute("SELECT 1 FROM accounts LIMIT 1").fetchone():
            db.execute(
                "INSERT INTO accounts(id,username,password_hash,display_name,role,school_id,assigned_class_ids,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), username, generate_password_hash(password),
                 os.environ.get("BOOTSTRAP_ADMIN_NAME", "System Administrator"), "SUPER_ADMIN", None, "[]", 1, now()),
            )


ROLE_NAMES = {"SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "VIEWER"}
READ_ONLY_RESOURCES = {"schools", "sessions", "terms", "classes", "students", "student_movements", "calendar_days", "attendance_records", "attendance_audit_logs", "term_unlock_logs", "register_symbol_settings", "subjects", "assessment_scores", "report_cards", "settings", "offline_drafts", "users"}
TEACHER_WRITE_RESOURCES = {"attendance_records", "attendance_audit_logs", "offline_drafts"}
SCHOOL_DATA_KEYS = {
    "smart_register_school", "smart_register_current_user", "smart_register_sessions", "smart_register_terms", "smart_register_classes", "smart_register_students",
    "smart_register_movements", "smart_register_calendar", "smart_register_attendance",
    "smart_register_audit_logs", "smart_register_term_unlock_logs", "smart_register_users",
    "smart_register_subjects", "smart_register_assessment_scores", "smart_register_report_cards",
    "smart_register_drafts",
}

# Storage keys that are wiped by admin reset endpoints.
# smart_register_current_user is deliberately excluded so the caller's session
# remains valid after a reset.
RESETTABLE_STORAGE_KEYS = [
    "smart_register_school",
    "smart_register_sessions",
    "smart_register_terms",
    "smart_register_classes",
    "smart_register_students",
    "smart_register_movements",
    "smart_register_calendar",
    "smart_register_attendance",
    "smart_register_audit_logs",
    "smart_register_term_unlock_logs",
    "smart_register_users",
    "smart_register_subjects",
    "smart_register_assessment_scores",
    "smart_register_report_cards",
    "smart_register_drafts",
    "smart_register_symbols",
]


def _wipe_app_storage(db: sqlite3.Connection) -> int:
    """Delete all resettable storage keys. Returns count of rows removed."""
    removed = 0
    for key in RESETTABLE_STORAGE_KEYS:
        cursor = db.execute("DELETE FROM app_storage WHERE key=?", (key,))
        if cursor.rowcount and cursor.rowcount > 0:
            removed += cursor.rowcount
    return removed


def account():
    account_id = session.get("account_id")
    if not account_id:
        return None
    with connect() as db:
        row = db.execute("SELECT id,username,display_name,role,school_id,assigned_class_ids,active FROM accounts WHERE id=?", (account_id,)).fetchone()
    if not row or not row["active"]:
        session.clear()
        return None
    value = dict(row)
    value["assigned_class_ids"] = json.loads(value.get("assigned_class_ids") or "[]")
    return value


def school_of(item):
    if not isinstance(item, dict): return None
    for key in ("schoolId", "school_id", "schoolID"):
        if item.get(key) is not None: return str(item[key])
    school = item.get("school")
    if isinstance(school, dict): return str(school.get("id")) if school.get("id") is not None else None
    if isinstance(school, str): return school
    return None


def class_of(item):
    if not isinstance(item, dict): return None
    for key in ("classId", "class_id", "assignedClassId"):
        if item.get(key) is not None: return str(item[key])
    return None


def permitted_item(user, item):
    if user["role"] == "SUPER_ADMIN": return True
    if user.get("school_id") is None: return False
    school_id = school_of(item)
    if school_id is None or school_id != str(user["school_id"]): return False
    class_id = class_of(item)
    if user["role"] == "TEACHER" and class_id and class_id not in user["assigned_class_ids"]: return False
    return True


def filter_value(user, key, value):
    if key == "smart_register_current_user":
        return {"id": user["id"], "email": user["username"], "name": user["display_name"], "role": user["role"], "schoolId": user["school_id"], "assignedClassIds": user["assigned_class_ids"]}
    if user["role"] == "SUPER_ADMIN" or key not in SCHOOL_DATA_KEYS: return value
    if isinstance(value, list): return [v for v in value if permitted_item(user, v)]
    if isinstance(value, dict):
        if key == "smart_register_school": return value if str(value.get("id")) == str(user.get("school_id")) else None
        return value if permitted_item(user, value) else None
    return value


def can_write_resource(user, resource):
    role = user["role"]
    if role == "SUPER_ADMIN": return True
    if role == "VIEWER": return False
    if role == "SCHOOL_ADMIN": return resource not in {"users", "schools", "settings"}
    return role == "TEACHER" and resource in TEACHER_WRITE_RESOURCES


def can_write_storage(user, key):
    if key == "smart_register_current_user": return False
    if user["role"] == "SUPER_ADMIN": return True
    if user["role"] == "SCHOOL_ADMIN": return key in SCHOOL_DATA_KEYS
    if user["role"] == "TEACHER": return key in {"smart_register_attendance", "smart_register_audit_logs", "smart_register_drafts"}
    return False


@app.before_request
def enforce_api_authentication():
    if not request.path.startswith("/api/") or request.path in {"/api/health", "/api", "/api/auth/login", "/api/auth/me", "/api/auth/logout", "/api/auth/setup-status", "/api/auth/setup"}:
        return None
    user = account()
    if not user:
        return jsonify(error="Authentication required", code="AUTH_REQUIRED"), 401
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.path.startswith("/api/storage") and user["role"] == "VIEWER":
        return jsonify(error="Your role is read-only", code="FORBIDDEN"), 403
    return None


def valid_resource(name: str) -> bool:
    return name in RESOURCES


def row_payload(row):
    if row is None:
        return None
    value = json.loads(row["data"])
    value.setdefault("id", row["id"])
    return value


@app.get("/api/health")
def health():
    with connect() as db:
        db.execute("SELECT 1").fetchone()
    return jsonify(ok=True, service="Smart School Record Management API",
                   backend="Python Flask", database="SQLite")


@app.get("/api")
def api_index():
    return jsonify(name="Smart School Record Management", version="1.1.0",
                   backend="Flask", database="SQLite", resources=sorted(RESOURCES),
                   endpoints=["GET/POST /api/<resource>", "GET/PUT/PATCH/DELETE /api/<resource>/<id>",
                              "GET/PUT/DELETE /api/storage/<key>", "POST /api/storage/bulk",
                              "POST /api/auth/login", "POST /api/auth/logout", "GET /api/auth/me",
                              "GET /api/audit"])


@app.get("/api/auth/setup-status")
def setup_status():
    with connect() as db:
        count = db.execute("SELECT COUNT(*) AS n FROM accounts").fetchone()["n"]
    return jsonify(setupRequired=(count == 0))


@app.post("/api/auth/setup")
def initial_setup():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    name = str(body.get("name", "")).strip()
    if not username or not name or len(password) < 12:
        return jsonify(error="Enter a username and name; password must be at least 12 characters"), 400
    account_id = str(uuid.uuid4())
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM accounts LIMIT 1").fetchone():
            db.rollback()
            return jsonify(error="Initial setup has already been completed"), 409
        db.execute("INSERT INTO accounts(id,username,password_hash,display_name,role,school_id,assigned_class_ids,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                   (account_id, username, generate_password_hash(password), name, "SUPER_ADMIN", None, "[]", 1, now()))
        audit(db, "initial_super_admin_created", "accounts", account_id, {"username": username})
    session.clear(); session["account_id"] = account_id; session.permanent = True
    return jsonify(user={"id": account_id, "username": username, "name": name, "role": "SUPER_ADMIN", "schoolId": None, "assignedClassIds": []}), 201


@app.post("/api/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    with connect() as db:
        row = db.execute("SELECT * FROM accounts WHERE username=? AND active=1", (username,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify(error="Invalid username or password"), 401
    session.clear(); session["account_id"] = row["id"]; session.permanent = True
    return jsonify(user={"id": row["id"], "username": row["username"], "name": row["display_name"], "role": row["role"], "schoolId": row["school_id"], "assignedClassIds": json.loads(row["assigned_class_ids"] or "[]")})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/auth/me")
def current_account():
    user = account()
    if not user: return jsonify(user=None), 401
    return jsonify(user={"id": user["id"], "username": user["username"], "name": user["display_name"], "role": user["role"], "schoolId": user["school_id"], "assignedClassIds": user["assigned_class_ids"]})


@app.route("/api/<resource>", methods=["GET", "POST"])
def collection(resource):
    if resource == "storage" and request.method == "GET": return storage_snapshot()
    if not valid_resource(resource): return jsonify(error="Unknown resource"), 404
    user = account()
    with connect() as db:
        if request.method == "GET":
            rows = db.execute("SELECT * FROM records WHERE resource=? ORDER BY created_at", (resource,)).fetchall()
            items = [row_payload(row) for row in rows]
            if user["role"] != "SUPER_ADMIN": items = [x for x in items if permitted_item(user, x)]
            query = request.args.get("q", "").strip().lower()
            if query: items = [item for item in items if query in json.dumps(item, ensure_ascii=False).lower()]
            limit = min(max(request.args.get("limit", 500, type=int), 1), 2000)
            return jsonify(items=items[:limit], count=len(items))
        if not can_write_resource(user, resource): return jsonify(error="Role is not allowed to create this resource", code="FORBIDDEN"), 403
        data = request.get_json(silent=True)
        if not isinstance(data, dict): return jsonify(error="JSON object body required"), 400
        if user["role"] != "SUPER_ADMIN":
            if resource == "users": return jsonify(error="Only a super administrator can manage accounts", code="FORBIDDEN"), 403
            if school_of(data) is None: data["schoolId"] = user["school_id"]
            if not permitted_item(user, data): return jsonify(error="Record is outside your assigned school or classes", code="SCHOOL_SCOPE_DENIED"), 403
        record_id = str(data.get("id") or uuid.uuid4()); data["id"] = record_id; stamp = now()
        if db.execute("SELECT 1 FROM records WHERE resource=? AND id=?", (resource, record_id)).fetchone(): return jsonify(error="Record id already exists", id=record_id), 409
        db.execute("INSERT INTO records VALUES (?,?,?,?,?)", (resource, record_id, json.dumps(data, ensure_ascii=False), stamp, stamp))
        audit(db, "create", resource, record_id, {"fields": sorted(data.keys())})
        return jsonify(data), 201


@app.route("/api/<resource>/<record_id>", methods=["GET", "PUT", "PATCH", "DELETE"])
def item(resource, record_id):
    if not valid_resource(resource): return jsonify(error="Unknown resource"), 404
    user = account()
    with connect() as db:
        row = db.execute("SELECT * FROM records WHERE resource=? AND id=?", (resource, record_id)).fetchone()
        if not row: return jsonify(error="Not found"), 404
        current = row_payload(row)
        if user["role"] != "SUPER_ADMIN" and not permitted_item(user, current): return jsonify(error="Record is outside your assigned school or classes", code="SCHOOL_SCOPE_DENIED"), 403
        if request.method == "GET": return jsonify(current)
        if not can_write_resource(user, resource): return jsonify(error="Role is not allowed to modify this resource", code="FORBIDDEN"), 403
        if request.method == "DELETE":
            db.execute("DELETE FROM records WHERE resource=? AND id=?", (resource, record_id)); audit(db, "delete", resource, record_id); return "", 204
        updates = request.get_json(silent=True)
        if not isinstance(updates, dict): return jsonify(error="JSON object body required"), 400
        candidate = {**current, **updates, "id": record_id}
        if user["role"] != "SUPER_ADMIN" and not permitted_item(user, candidate): return jsonify(error="Cannot move records outside your assigned school or classes", code="SCHOOL_SCOPE_DENIED"), 403
        db.execute("UPDATE records SET data=?,updated_at=? WHERE resource=? AND id=?", (json.dumps(candidate, ensure_ascii=False), now(), resource, record_id))
        audit(db, "update", resource, record_id, {"fields": sorted(updates.keys())})
        return jsonify(candidate)


@app.get("/api/storage")
def storage_snapshot():
    user = account()
    with connect() as db:
        rows = db.execute("SELECT key,value,updated_at FROM app_storage ORDER BY key").fetchall()
    items = {row["key"]: filter_value(user, row["key"], json.loads(row["value"])) for row in rows}
    return jsonify(items=items, updatedAt={row["key"]: row["updated_at"] for row in rows})


@app.route("/api/storage/<path:key>", methods=["PUT", "DELETE"])
def storage_write(key):
    if not key.startswith(STORAGE_PREFIX) or len(key) > 180: return jsonify(error="Invalid storage key"), 400
    user = account()
    if not can_write_storage(user, key): return jsonify(error="Your role cannot modify this storage resource", code="FORBIDDEN"), 403
    with connect() as db:
        existing_row = db.execute("SELECT value FROM app_storage WHERE key=?", (key,)).fetchone()
        existing = json.loads(existing_row["value"]) if existing_row else None
        if request.method == "DELETE":
            if user["role"] != "SUPER_ADMIN" and key in SCHOOL_DATA_KEYS:
                return jsonify(error="Scoped data cannot be deleted wholesale", code="FORBIDDEN"), 403
            db.execute("DELETE FROM app_storage WHERE key=?", (key,)); audit(db, "storage_delete", key); return "", 204
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or "value" not in body: return jsonify(error="JSON object with value is required"), 400
        incoming = body["value"]
        if user["role"] != "SUPER_ADMIN" and key in SCHOOL_DATA_KEYS:
            if isinstance(incoming, list):
                old = existing if isinstance(existing, list) else []
                old_by_id = {str(x.get("id")): x for x in old if isinstance(x, dict) and x.get("id") is not None}
                allowed_old = {rid: x for rid, x in old_by_id.items() if permitted_item(user, x)}
                incoming_allowed = {}
                for item in incoming:
                    if not isinstance(item, dict): continue
                    if school_of(item) is None: item = {**item, "schoolId": user["school_id"]}
                    if not permitted_item(user, item): return jsonify(error="Payload contains data outside your assigned school or classes", code="SCHOOL_SCOPE_DENIED"), 403
                    incoming_allowed[str(item.get("id", uuid.uuid4()))] = item
                merged = [x for rid, x in old_by_id.items() if rid not in allowed_old]
                merged.extend(incoming_allowed.values())
                incoming = merged
            elif isinstance(incoming, dict):
                if key == "smart_register_school" and str(incoming.get("id")) != str(user.get("school_id")):
                    return jsonify(error="Cannot modify another school", code="SCHOOL_SCOPE_DENIED"), 403
                if key == "smart_register_current_user": return jsonify(error="Current user identity is server-managed", code="FORBIDDEN"), 403
        stamp = now(); encoded = json.dumps(incoming, ensure_ascii=False, separators=(",", ":"))
        db.execute("INSERT INTO app_storage(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (key, encoded, stamp))
        audit(db, "storage_write", key, details={"bytes": len(encoded)})
    return jsonify(ok=True, key=key, updatedAt=stamp)


@app.post("/api/storage/bulk")
def storage_bulk():
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not isinstance(body.get("items"), dict):
        return jsonify(error="Expected {items: {key: value}}"), 400
    items = body["items"]
    user = account()
    if user["role"] == "VIEWER": return jsonify(error="Your role is read-only", code="FORBIDDEN"), 403
    if len(items) > 100:
        return jsonify(error="Too many storage keys"), 413
    mode = str(body.get("mode", "merge"))
    stamp = now()
    with connect() as db:
        existing = db.execute("SELECT COUNT(*) AS n FROM app_storage").fetchone()["n"]
        if mode == "if-empty" and existing:
            rows = db.execute("SELECT key,value FROM app_storage").fetchall()
            return jsonify(ok=True, imported=0, existing=True,
                           items={row["key"]: filter_value(user, row["key"], json.loads(row["value"])) for row in rows})
        count = 0
        for key, value in items.items():
            if not isinstance(key, str) or not key.startswith(STORAGE_PREFIX) or len(key) > 180:
                continue
            if key == "smart_register_current_user": continue
            if not can_write_storage(user, key):
                return jsonify(error=f"Your role cannot modify {key}", code="FORBIDDEN"), 403
            if user["role"] != "SUPER_ADMIN" and key in SCHOOL_DATA_KEYS:
                old_row = db.execute("SELECT value FROM app_storage WHERE key=?", (key,)).fetchone()
                old_value = json.loads(old_row["value"]) if old_row else ([] if isinstance(value, list) else None)
                if isinstance(value, list):
                    old_list = old_value if isinstance(old_value, list) else []
                    protected = [x for x in old_list if not permitted_item(user, x)]
                    scoped = []
                    for obj in value:
                        if not isinstance(obj, dict): continue
                        if school_of(obj) is None: obj = {**obj, "schoolId": user["school_id"]}
                        if not permitted_item(user, obj): return jsonify(error="Import contains records outside your assigned school", code="SCHOOL_SCOPE_DENIED"), 403
                        scoped.append(obj)
                    value = protected + scoped
                elif isinstance(value, dict):
                    if key == "smart_register_school":
                        if str(value.get("id")) != str(user.get("school_id")):
                            return jsonify(error="Import contains a school outside your assignment", code="SCHOOL_SCOPE_DENIED"), 403
                    elif key == "smart_register_current_user":
                        continue
                    elif not permitted_item(user, value):
                        return jsonify(error="Import contains data outside your assigned school", code="SCHOOL_SCOPE_DENIED"), 403
            encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            if mode == "merge-missing":
                cursor = db.execute("INSERT OR IGNORE INTO app_storage(key,value,updated_at) VALUES (?,?,?)",
                                    (key, encoded, stamp))
                count += max(cursor.rowcount, 0)
            else:
                db.execute("INSERT INTO app_storage(key,value,updated_at) VALUES (?,?,?) "
                           "ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
                           (key, encoded, stamp))
                count += 1
        audit(db, "storage_bulk_sync", details={"keys": count, "mode": mode})
        rows = db.execute("SELECT key,value FROM app_storage").fetchall()
    return jsonify(ok=True, imported=count, items={row["key"]: filter_value(user, row["key"], json.loads(row["value"])) for row in rows})


@app.post("/api/admin/accounts")
def create_account():
    user = account()
    if user["role"] != "SUPER_ADMIN": return jsonify(error="Only a super administrator can create accounts", code="FORBIDDEN"), 403
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    role = str(body.get("role", "")).upper()
    name = str(body.get("name", "")).strip()
    school_id = body.get("schoolId")
    classes = body.get("assignedClassIds", [])
    if not username or len(password) < 10 or not name or role not in ROLE_NAMES:
        return jsonify(error="username, name, valid role, and password of at least 10 characters are required"), 400
    if role != "SUPER_ADMIN" and not school_id: return jsonify(error="School assignment is required for non-super-admin accounts"), 400
    if not isinstance(classes, list) or any(not isinstance(c, str) for c in classes): return jsonify(error="assignedClassIds must be a list of strings"), 400
    account_id = str(uuid.uuid4())
    try:
        with connect() as db:
            db.execute("INSERT INTO accounts(id,username,password_hash,display_name,role,school_id,assigned_class_ids,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                       (account_id, username, generate_password_hash(password), name, role, str(school_id) if school_id else None, json.dumps(classes), 1, now()))
            audit(db, "account_create", "accounts", account_id, {"role": role, "schoolId": school_id})
    except sqlite3.IntegrityError:
        return jsonify(error="Username already exists"), 409
    return jsonify(user={"id": account_id, "username": username, "name": name, "role": role, "schoolId": school_id, "assignedClassIds": classes}), 201


@app.get("/api/admin/accounts")
def list_accounts():
    user = account()
    if user["role"] != "SUPER_ADMIN": return jsonify(error="Only a super administrator can list accounts", code="FORBIDDEN"), 403
    with connect() as db:
        rows = db.execute("SELECT id,username,display_name,role,school_id,assigned_class_ids,active,created_at FROM accounts ORDER BY created_at").fetchall()
    return jsonify([{"id": r["id"], "username": r["username"], "name": r["display_name"], "role": r["role"], "schoolId": r["school_id"], "assignedClassIds": json.loads(r["assigned_class_ids"] or "[]"), "active": bool(r["active"]), "createdAt": r["created_at"]} for r in rows])


@app.patch("/api/admin/accounts/<account_id>")
def update_account(account_id):
    user = account()
    if user["role"] != "SUPER_ADMIN": return jsonify(error="Only a super administrator can update accounts", code="FORBIDDEN"), 403
    body = request.get_json(silent=True) or {}
    allowed = {"role", "schoolId", "assignedClassIds", "active", "name", "password"}
    if set(body) - allowed: return jsonify(error="Unsupported account fields"), 400
    if "role" in body and str(body["role"]).upper() not in ROLE_NAMES: return jsonify(error="Invalid role"), 400
    with connect() as db:
        row = db.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone()
        if not row: return jsonify(error="Account not found"), 404
        role = str(body.get("role", row["role"])).upper()
        school_id = body.get("schoolId", row["school_id"])
        if role != "SUPER_ADMIN" and not school_id: return jsonify(error="School assignment is required for non-super-admin accounts"), 400
        db.execute("UPDATE accounts SET role=?,school_id=?,assigned_class_ids=?,active=?,display_name=?,password_hash=? WHERE id=?",
                   (role, school_id, json.dumps(body.get("assignedClassIds", json.loads(row["assigned_class_ids"] or "[]"))), int(body.get("active", row["active"])), body.get("name", row["display_name"]), generate_password_hash(body["password"]) if body.get("password") else row["password_hash"], account_id))
        audit(db, "account_update", "accounts", account_id, {"fields": sorted(body.keys())})
    return jsonify(ok=True)


@app.post("/api/admin/accounts/<account_id>/reset-password")
def reset_account_password(account_id):
    """Set a new password for an account. SUPER_ADMIN only."""
    user = account()
    if user["role"] != "SUPER_ADMIN":
        return jsonify(error="Only a super administrator can reset passwords", code="FORBIDDEN"), 403

    body = request.get_json(silent=True) or {}
    new_password = str(body.get("password", ""))
    if len(new_password) < 10:
        return jsonify(error="Password must be at least 10 characters"), 400

    with connect() as db:
        row = db.execute("SELECT id, username FROM accounts WHERE id=?", (account_id,)).fetchone()
        if not row:
            return jsonify(error="Account not found"), 404
        db.execute(
            "UPDATE accounts SET password_hash=? WHERE id=?",
            (generate_password_hash(new_password), account_id),
        )
        audit(
            db,
            "account_password_reset",
            "accounts",
            account_id,
            {"target_username": row["username"]},
        )
    return jsonify(ok=True, message="Password updated. The user must sign in with the new password.")


@app.delete("/api/admin/accounts/<account_id>")
def delete_account(account_id):
    """Remove an account. SUPER_ADMIN only.

    Guards:
      - Cannot delete your own account.
      - Cannot delete the last remaining SUPER_ADMIN.
    """
    user = account()
    if user["role"] != "SUPER_ADMIN":
        return jsonify(error="Only a super administrator can delete accounts", code="FORBIDDEN"), 403

    if account_id == user["id"]:
        return jsonify(error="You cannot delete your own account", code="FORBIDDEN"), 403

    with connect() as db:
        row = db.execute("SELECT id, username, role FROM accounts WHERE id=?", (account_id,)).fetchone()
        if not row:
            return jsonify(error="Account not found"), 404

        if row["role"] == "SUPER_ADMIN":
            super_count = db.execute(
                "SELECT COUNT(*) AS n FROM accounts WHERE role='SUPER_ADMIN' AND active=1"
            ).fetchone()["n"]
            if super_count <= 1:
                return jsonify(
                    error="Cannot delete the last Super Admin. Promote another account first.",
                    code="FORBIDDEN",
                ), 403

        db.execute("DELETE FROM accounts WHERE id=?", (account_id,))
        audit(
            db,
            "account_delete",
            "accounts",
            account_id,
            {"target_username": row["username"], "target_role": row["role"]},
        )
    return jsonify(ok=True, message=f"Account {row['username']} removed."), 200


@app.get("/api/audit")
def audit_list():
    """Return recent audit events. Supports optional filters.

    Query params:
      limit     — max rows (default 200, cap 2000)
      action    — filter by exact action name
      resource  — filter by resource name
      actor     — filter by account id
    """
    user = account()
    if user["role"] not in {"SUPER_ADMIN", "SCHOOL_ADMIN"}:
        return jsonify(error="Audit log access denied", code="FORBIDDEN"), 403

    limit = min(max(request.args.get("limit", 200, type=int), 1), 2000)
    action = request.args.get("action", "").strip()
    resource = request.args.get("resource", "").strip()
    actor = request.args.get("actor", "").strip()

    where = []
    params = []
    if action:
        where.append("action=?")
        params.append(action)
    if resource:
        where.append("resource=?")
        params.append(resource)
    if actor:
        where.append("actor=?")
        params.append(actor)

    sql = "SELECT * FROM audit_events"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    with connect() as db:
        rows = db.execute(sql, params).fetchall()

    return jsonify(
        items=[
            {
                "id": row["id"],
                "actor": row["actor"],
                "action": row["action"],
                "resource": row["resource"],
                "recordId": row["record_id"],
                "details": json.loads(row["details"] or "{}"),
                "createdAt": row["created_at"],
            }
            for row in rows
        ],
        count=len(rows),
    )


@app.post("/api/admin/import")
def import_records():
    user = account()
    if not user or user["role"] != "SUPER_ADMIN": return jsonify(error="Super administrator access required", code="FORBIDDEN"), 403
    token = os.environ.get("MIGRATION_TOKEN")
    if not token or request.headers.get("X-Migration-Token") != token:
        return jsonify(error="Forbidden"), 403
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(error="JSON object required"), 400
    counts = {}
    with connect() as db:
        for resource, items in body.items():
            if not valid_resource(resource) or not isinstance(items, list):
                continue
            count = 0
            for data in items:
                if not isinstance(data, dict):
                    continue
                record_id = str(data.get("id") or uuid.uuid4())
                data["id"] = record_id
                stamp = now()
                db.execute("INSERT INTO records VALUES (?,?,?,?,?) ON CONFLICT(resource,id) DO UPDATE SET "
                           "data=excluded.data,updated_at=excluded.updated_at",
                           (resource, record_id, json.dumps(data, ensure_ascii=False), stamp, stamp))
                count += 1
            counts[resource] = count
        audit(db, "migration_import", details=counts)
    return jsonify(imported=counts)


# ---------------------------------------------------------------------------
# Admin: Reset & Reseed utilities (SUPER_ADMIN only)
# ---------------------------------------------------------------------------


@app.post("/api/admin/reset-empty")
def reset_empty():
    """Wipe all school data, keep accounts. SUPER_ADMIN only.

    The caller's session remains valid because smart_register_current_user is
    not in the resettable keys list.
    """
    user = account()
    if not user or user["role"] != "SUPER_ADMIN":
        return jsonify(error="Super administrator access required", code="FORBIDDEN"), 403

    with connect() as db:
        removed = _wipe_app_storage(db)
        audit(
            db,
            "admin_reset_empty",
            details={"keys_removed": removed, "actor": user["username"]},
        )

    return jsonify(
        ok=True,
        mode="empty",
        keysRemoved=removed,
        message="All school data cleared. Accounts preserved.",
    )


@app.post("/api/admin/reset-to-demo")
def reset_to_demo():
    """Wipe school data AND restore a demo seed. SUPER_ADMIN only.

    The caller must supply a 'seed' object: a dict of storage keys (matching
    RESETTABLE_STORAGE_KEYS) to their JSON payloads. Typically generated by
    GET /api/admin/export-seed or the CLI snapshot command.
    """
    user = account()
    if not user or user["role"] != "SUPER_ADMIN":
        return jsonify(error="Super administrator access required", code="FORBIDDEN"), 403

    body = request.get_json(silent=True) or {}
    seed = body.get("seed")
    if not isinstance(seed, dict):
        return jsonify(error="Request must include a 'seed' object with demo data"), 400

    with connect() as db:
        removed = _wipe_app_storage(db)
        stamp = now()
        imported = 0
        for key, value in seed.items():
            if not isinstance(key, str) or not key.startswith(STORAGE_PREFIX):
                continue
            if key not in RESETTABLE_STORAGE_KEYS:
                continue
            encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            db.execute(
                "INSERT INTO app_storage(key,value,updated_at) VALUES (?,?,?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
                (key, encoded, stamp),
            )
            imported += 1
        audit(
            db,
            "admin_reset_to_demo",
            details={
                "keys_removed": removed,
                "keys_imported": imported,
                "actor": user["username"],
            },
        )

    return jsonify(
        ok=True,
        mode="demo",
        keysRemoved=removed,
        keysImported=imported,
        message="School data reset to demo seed. Accounts preserved.",
    )


@app.get("/api/admin/export-seed")
def export_seed():
    """Export the current app_storage state as a seed JSON blob.

    SUPER_ADMIN only. Useful for snapshotting a known-good demo state.
    """
    user = account()
    if not user or user["role"] != "SUPER_ADMIN":
        return jsonify(error="Super administrator access required", code="FORBIDDEN"), 403

    with connect() as db:
        placeholders = ",".join("?" * len(RESETTABLE_STORAGE_KEYS))
        rows = db.execute(
            f"SELECT key, value FROM app_storage WHERE key IN ({placeholders})",
            RESETTABLE_STORAGE_KEYS,
        ).fetchall()

    seed = {row["key"]: json.loads(row["value"]) for row in rows}
    return jsonify(ok=True, seed=seed)


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="Request body exceeds 20 MB limit"), 413


@app.errorhandler(500)
def server_error(_error):
    return jsonify(error="Internal server error"), 500


@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def frontend(path):
    dist = ROOT / "dist"
    candidate = dist / path
    if path and candidate.is_file():
        return send_from_directory(dist, path)
    if (dist / "index.html").is_file():
        return send_from_directory(dist, "index.html")
    return jsonify(message="Flask API is running. Build the React frontend with npm run build to serve the UI.",
                   health="/api/health"), 200


init_db()


@app.post("/api/auth/seed-demo-accounts")
def seed_demo_accounts():
    """Development-only: create demo accounts for quick role switching.

    Disabled unless DEMO_SEED_ENABLED=1 in .env.
    Safe to run multiple times — skips accounts that already exist.
    """
    if os.environ.get("DEMO_SEED_ENABLED", "0") != "1":
        return jsonify(error="Demo seeding is disabled"), 403

    user = account()
    if not user or user["role"] != "SUPER_ADMIN":
        return jsonify(error="Super administrator access required", code="FORBIDDEN"), 403

    demo_accounts = [
        {
            "username": "admin@demointernational.edu",
            "password": "DemoAdmin@2026",
            "name": "Dr. Florence Alabi (Principal)",
            "role": "SCHOOL_ADMIN",
            "school_id": "school_demo_1",
            "classes": [],
        },
        {
            "username": "james.okafor@demointernational.edu",
            "password": "DemoTeacher@2026",
            "name": "Mr. James Okafor",
            "role": "TEACHER",
            "school_id": "school_demo_1",
            "classes": ["class_jss1_a"],
        },
        {
            "username": "grace.adeleke@demointernational.edu",
            "password": "DemoTeacher@2026",
            "name": "Mrs. Grace Adeleke",
            "role": "TEACHER",
            "school_id": "school_demo_1",
            "classes": ["class_jss1_b"],
        },
        {
            "username": "emmanuel.davies@demointernational.edu",
            "password": "DemoTeacher@2026",
            "name": "Mr. Emmanuel Davies",
            "role": "TEACHER",
            "school_id": "school_demo_1",
            "classes": ["class_jss2_a"],
        },
        {
            "username": "inspector@ministry.gov",
            "password": "DemoViewer@2026",
            "name": "Ministry Quality Assurance (Viewer)",
            "role": "VIEWER",
            "school_id": "school_demo_1",
            "classes": [],
        },
    ]

    created, skipped = [], []
    with connect() as db:
        for acct in demo_accounts:
            existing = db.execute(
                "SELECT 1 FROM accounts WHERE username=?", (acct["username"],)
            ).fetchone()
            if existing:
                skipped.append(acct["username"])
                continue
            db.execute(
                "INSERT INTO accounts(id,username,password_hash,display_name,role,"
                "school_id,assigned_class_ids,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()),
                    acct["username"],
                    generate_password_hash(acct["password"]),
                    acct["name"],
                    acct["role"],
                    acct["school_id"],
                    json.dumps(acct["classes"]),
                    1,
                    now(),
                ),
            )
            created.append(acct["username"])
        audit(db, "demo_accounts_seeded", details={"created": created, "skipped": skipped})

    return jsonify(ok=True, created=created, skipped=skipped)


if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "127.0.0.1"),
            port=int(os.environ.get("PORT", "5000")),
            debug=os.environ.get("FLASK_DEBUG", "0") == "1")