Email Validator (DNS + SMTP)
============================

Overview
--------
- Validates deliverability with DNS MX lookup and SMTP RCPT handshake (no email is sent).
- Detects catch-all domains, disposable domains, and exposes a bounce-likelihood flag.
- Accepts single checks, pasted bulk lists, or CSV/XLSX uploads (template provided).
- Persists every validation in SQLite with an admin panel + CSV export endpoint.
- Lightweight: Python stdlib only; ships with a React/Vite frontend.

Quick start (CLI)
-----------------
1) Python 3.9+ installed.
2) Run a single check:
   - Human output: `python email_validator.py check someone@example.com`
   - JSON output: `python email_validator.py check someone@example.com --json`
   - Verbose SMTP: `python email_validator.py check someone@example.com --json --verbose`

HTTP API
--------
- Start server: `python server.py --port 8080`
- Health: `GET /health`
- Validate (GET): `GET /validate?email=user@example.com&timeout=7&max_mx=3&ports=25,587&from=verify@yourdomain.com&helo=yourdomain.com`
- Validate (POST): `POST /validate` with JSON  
  `{"email":"user@example.com","timeout":7,"max_mx":3,"ports":[25],"from":"verify@yourdomain.com","helo":"yourdomain.com"}`
- Responses include: status (`deliverable|undeliverable|unknown|invalid_*`), `reason`, `bounce_likely`, `bounce_reason`, SMTP/DNS flags, `mx_hosts`, and `ok` (high-level pass flag).
- HTTP codes: 200 deliverable, 202 unknown/temporary, 400 invalid input, 404 undeliverable, 500 internal error.

Uploads and templates
---------------------
- Download template headers:
  - `GET /template/excel` (XLSX)
  - `GET /template/csv` (CSV)
- Headers: `Email, Name, From Name, CC, BCC, Reply To, Subject, TrackingID, Opened, Last Opened, Clicked, Last Clicked, Unsubscribed, Status`.
- Validate upload: `POST /validate/upload` (multipart form) with `file=<csv/xlsx>` and optional `concurrency`, `ports`, `from`, `helo`, `timeout`, `max_mx`, `verbose`.
- JSON bulk: `POST /validate/bulk`
  - `{"emails":["a@example.com","b@example.com"],"concurrency":10}` (optional `stream:true` for NDJSON)
  - or `{"records":[{...template fields...}], "concurrency":10}` (returns JSON array + summary).

Admin panel & storage
---------------------
- SQLite database: `data/validations.db` by default (configure with `--db-path`).
- Auth: default admin `admin / admin123` is created if none exists.
- Protect admin endpoints with login (Bearer token) or optional `--admin-token <token>` fallback (`Authorization: Bearer <token>` or `?token=`).
- Endpoints:
  - `GET /admin/validations?limit=100&offset=0` -> JSON list + total.
  - `GET /admin/export` -> CSV of all stored validations.
  - `GET /admin/stats` -> totals + recent rows.
- The React frontend includes an admin section consuming these endpoints.

Auth endpoints
--------------
- `POST /auth/login` with `{"username":"...","password":"..."}` returns `{ token, username, role }`.
- `GET /auth/me` with `Authorization: Bearer <token>` returns current user info.

CLI bulk (file or stdin)
------------------------
- One email per line (empty lines / `#` ignored).
- NDJSON streaming: `python email_validator.py bulk -i emails.txt --out ndjson --concurrency 10`
- CSV: `python email_validator.py bulk -i emails.txt --out csv --concurrency 10 > results.csv`
- JSON array: `python email_validator.py bulk -i emails.txt --out json --concurrency 10 > results.json`
- From stdin: `type emails.txt | python email_validator.py bulk --out ndjson`

Docker
------
- Build: `docker build -t email-validator .`
- Run: `docker run --rm -p 8080:8080 --name email-validator email-validator`
- Compose: `docker compose up --build`

React frontend (Vite)
---------------------
- Located in `frontend/` (TypeScript + Vite + React).
- Install deps: `cd frontend && npm install`
- Dev server: `npm run dev` (defaults to http://localhost:5173)
- Build: `npm run build` (outputs to `frontend/dist`)
- Configure API base: set `VITE_API_BASE=http://localhost:8080` in `frontend/.env` (sample in `frontend/.env.example`; leave empty when served from the same origin as the Python API).
- Features: single check, bulk paste, CSV/XLSX upload with template links, admin dashboard with token + CSV export, bounce-likelihood surfacing.

Notes & caveats
---------------
- Outbound SMTP (25/587) may be blocked by your network; results will show `unknown (smtp_unreachable)` if unreachable.
- Some hosts accept-all or greylist; `bounce_likely` and `reason` help surface risk, but they remain best-effort.
- Set `--from` and `--helo` to a domain you control for best accuracy.
