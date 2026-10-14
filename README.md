# Smart School Record Management — Flask + SQLite

This package replaces the previous Node/Express server-side backend with **Python Flask**. The existing React/Vite code is retained as the browser UI and build system; it is not a backend. SQLite is the shared persistent data store.

## Windows quick start

1. Install Python 3.10+ (Python 3.12 recommended) and Node.js LTS (npm included).
2. Extract the ZIP into a writable folder.
3. Double-click `start_windows.bat`.
4. Open `http://127.0.0.1:5000`.

The first start installs Python/Node dependencies and builds the UI, so it requires internet access. The script keeps the console open while Flask runs. Stop the server with Ctrl+C.

## Manual start (PowerShell)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
python -m pip install -r requirements.txt
npm install
npm run build
python run_flask.py
```

For UI development, run `python run_flask.py` in one terminal and `npm run dev` in another. Vite forwards `/api` calls to Flask on port 5000.

## Endpoints

- `GET /api/health` — Flask and SQLite health check.
- `GET /api` — API catalogue.
- `GET/POST /api/<resource>` and `GET/PUT/PATCH/DELETE /api/<resource>/<id>` — generic CRUD for schools, students, classes, attendance, terms, assessments, report cards, settings and related resources.
- `GET /api/storage` — current shared application-state snapshot.
- `PUT/DELETE /api/storage/<key>` — persist a UI storage key.
- `POST /api/storage/bulk` — initial browser-state migration and merge of missing keys.
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` — password-hash based account login with Flask session cookie.
- `GET /api/audit` — server-side audit events.
- `POST /api/admin/import` — record import protected by `MIGRATION_TOKEN`.

## Data and migration behaviour

- SQLite database: `instance/smart_school.sqlite3` (override with `DATABASE_PATH`).
- On first run, existing `smart_register_*` browser keys are copied into SQLite if the server store is empty.
- When SQLite already contains records, the server snapshot takes precedence over stale browser cache values. Browser-only keys missing on the server are imported without overwriting server values.
- Offline edits are cached and placed in a durable local outbox so a page reload does not discard the queued changes. They sync when connectivity returns. The server remains authoritative when online.
- A consistent database backup can be made with `python scripts/backup_db.py`; backups are written to `backups/`.
- Configure `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` in `.env` before the first start to create an initial server account. The account is created only if no account exists.

## Test suite

After installing requirements, run:

```powershell
python -m unittest discover -s tests -v
```

The tests cover health, SQLite storage round trips and validation, CRUD, audit events, and login/session lifecycle.

## Important scope note

The current application retains its existing demo persona/role switcher for local testing. Flask login endpoints are included, but the existing UI has not yet been converted to a mandatory authenticated login flow, and role/school-level authorization is not enforced on every data endpoint. This is a local migration/testing package, **not a hardened public production deployment**. Before internet-facing deployment, integrate the login flow into the UI, enforce authorization on all write/read endpoints, set a unique long `SECRET_KEY`, use HTTPS and secure cookies, restrict `CORS_ORIGINS`, rotate migration tokens, and establish backups. Keep the demo role switcher for local testing as requested; remove/disable it when preparing the production UI.

## Server-enforced authentication and school permissions

The API now requires a server-side session for data endpoints. The React demo role-switcher has been removed; changing a local browser role cannot change the authenticated server role. On first run, the sign-in screen guides you through creating the first `SUPER_ADMIN` account. Use a unique password of at least 12 characters.

### Permission matrix

- `SUPER_ADMIN`: cross-school read/write, account administration, and audit access.
- `SCHOOL_ADMIN`: read/write within the account's assigned school; cannot create schools or manage server accounts.
- `TEACHER`: read within the assigned school and assigned classes; may write attendance/audit/offline-draft resources only.
- `VIEWER`: read-only within the assigned school.

Requests without a valid session return `401`. Requests that cross a role, school, or class boundary return `403`. School assignment and role are read from the server-side account record, not from browser-provided role values. The `smart_register_current_user` cache key is server-managed. Scoped array writes preserve records belonging to other schools rather than replacing them.

### Create additional server accounts

Sign in as a super administrator and call `POST /api/admin/accounts` with the session cookie. Example JSON body:

```json
{
  "username": "school-admin-01",
  "password": "use-a-unique-password-at-least-10-characters",
  "name": "School Administrator",
  "role": "SCHOOL_ADMIN",
  "schoolId": "your-school-id",
  "assignedClassIds": []
}
```

Allowed roles are `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, and `VIEWER`. Non-super-admin accounts must have a `schoolId`; teachers should also have `assignedClassIds`. Account listing and updates are available through `GET /api/admin/accounts` and `PATCH /api/admin/accounts/<id>`, super-admin only. For API calls from another origin, preserve cookies (`credentials: include`) and configure `CORS_ORIGINS` to the exact frontend origin.

### Migration / testing notes

The backend includes automated permission tests in `tests/test_backend.py`. Run them after installing `requirements.txt` with `python -m unittest discover -s tests -v`. This environment had no network access to install Flask, so the tests could not be executed here; Python syntax compilation was successful. Run the tests and the frontend build locally before relying on this version.
