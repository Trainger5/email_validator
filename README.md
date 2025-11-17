Email Validator (DNS + SMTP)

Overview

- Validates email addresses beyond syntax: DNS MX lookup and SMTP RCPT handshake.
- Detects catch‑all domains and flags disposable domains (small built‑in list).
- CLI outputs human‑readable summary or JSON for integration.

Why this approach

- Syntax checks alone are not enough. This tool attempts a live SMTP check
  without sending a message (no DATA step), which is the closest you can get
  to verifying deliverability without actually sending mail.
  Note: Many providers use anti‑abuse tactics (greylisting, tarpits,
  or accept‑all). Results are best‑effort and not guaranteed.

Quick start

1) Ensure Python 3.9+ is installed.
2) Run:

   - Human output: `python email_validator.py check someone@example.com`
   - JSON output:  `python email_validator.py check someone@example.com --json`
   - Verbose SMTP: `python email_validator.py check someone@example.com --json --verbose`

HTTP API

- Start server: `python server.py --port 8080`
- Health: `GET http://localhost:8080/health`
- Validate (GET):
  `GET http://localhost:8080/validate?email=user@example.com&timeout=7&max_mx=3&ports=25,587&from=verify@yourdomain.com&helo=yourdomain.com`
- Validate (POST JSON):
  `POST http://localhost:8080/validate` with body:
  `{ "email": "user@example.com", "timeout": 7, "max_mx": 3, "ports": [25], "from": "verify@yourdomain.com", "helo": "yourdomain.com" }`

Batch endpoint

- POST NDJSON streaming:
  - `curl -N -X POST -H "Content-Type: application/json" -d '{"emails":["a@example.com","b@example.com"],"stream":true}' http://localhost:8080/validate/bulk`
  - PowerShell: `Invoke-WebRequest -Method POST -Uri http://localhost:8080/validate/bulk -ContentType application/json -Body '{"emails":["a@example.com","b@example.com"],"stream":true}' | Select-Object -Expand Content`
  - Returns one JSON object per line, no Content-Length. Read until the connection closes.
- POST JSON array (non-streaming):
  - `curl -X POST -H "Content-Type: application/json" -d '{"emails":["a@example.com","b@example.com"],"concurrency":10}' http://localhost:8080/validate/bulk`
  - Returns `{ results: [...], summary: { deliverable, undeliverable, unknown, invalid }, total }`.
  
Common options (both modes): `from`, `helo`, `timeout`, `max_mx`, `ports` (e.g., `"25,587"` or `[25,587]`), `verbose`, `concurrency`.

Responses are JSON and include the same fields as the CLI’s `--json` output, with an extra `ok` boolean. HTTP codes:

- 200: deliverable
- 202: unknown/temporary (e.g., greylisting, timeouts)
- 400: invalid input (syntax/domain/params)
- 404: undeliverable
- 500: internal error

Exit codes

- 0: Deliverable (or Accepts‑All when treated as deliverable)
- 1: Undeliverable or invalid
- 2: Unknown/temporary (e.g., greylisting, timeouts)

What the tool checks

- Syntax validation with common RFC‑compatible rules
- Domain normalization with IDNA (punycode) support
- DNS MX lookup via `nslookup` (fallback to A record)
- SMTP handshake: EHLO, optional STARTTLS, MAIL FROM, RCPT TO
- Catch‑all detection by probing a random address at the same domain
- Disposable domain detection against a small built‑in list

Configuration flags

- `--from`        MAIL FROM used in SMTP (default: verify@example.com)
- `--helo`        HELO/EHLO hostname (default: example.com)
- `--timeout`     Seconds for DNS/SMTP operations (default: 7)
- `--max-mx`      Max MX hosts to try (default: 3)
- `--ports`       SMTP ports to try (comma: e.g., 25,587) (default: 25)
- `--json`        Output JSON
- `--verbose`     SMTP debug logs

Caveats and notes

- Some servers always accept RCPT (catch‑all). The tool flags this; treat as
  "unknown" unless your workflow considers accept‑all as sufficient.
- Some providers temporarily defer with 4xx codes (greylisting). These are
  reported as unknown/temporary.
- Corporate firewalls or network egress rules may block port 25/587. If so,
  SMTP checks will time out and be reported as unknown.

Examples

- Basic check:
  `python email_validator.py check user@gmail.com`

- JSON for automation:
  `python email_validator.py check user@company.com --json > result.json`

- Tuning timeouts and ports:
  `python email_validator.py check user@domain.com --timeout 10 --ports 25,587`

Bulk validation (CLI)

- One email per line (empty lines and lines starting with `#` ignored)
- NDJSON (streaming):
  `python email_validator.py bulk -i emails.txt --out ndjson --concurrency 10`
- CSV:
  `python email_validator.py bulk -i emails.txt --out csv --concurrency 10 > results.csv`
- JSON array (collects then prints):
  `python email_validator.py bulk -i emails.txt --out json --concurrency 10 > results.json`
- From stdin:
  `type emails.txt | python email_validator.py bulk --out ndjson`

Notes:

- Summary is printed to stderr and won’t pollute NDJSON/CSV.
- Increase `--timeout` for slow MX hosts; throttle with lower `--concurrency` to reduce pressure on providers.
- For best accuracy, set `--from` and `--helo` to a domain you control.

Docker

- Build: `docker build -t email-validator .`
- Run: `docker run --rm -p 8080:8080 --name email-validator email-validator`
- Compose: `docker compose up --build` (uses `docker-compose.yml`)

Test the server

- Health:
  - curl: `curl http://localhost:8080/health`
  - PowerShell: `Invoke-WebRequest http://localhost:8080/health | Select-Object -Expand Content`

- Validate via GET:
  - curl: `curl "http://localhost:8080/validate?email=user@example.com&timeout=7&max_mx=3&ports=25,587&from=verify@yourdomain.com&helo=yourdomain.com"`
  - PowerShell: `Invoke-WebRequest "http://localhost:8080/validate?email=user@example.com&timeout=7&max_mx=3&ports=25,587&from=verify@yourdomain.com&helo=yourdomain.com" | Select-Object -Expand Content`

- Validate via POST JSON:
  - curl: `curl -X POST -H "Content-Type: application/json" -d '{"email":"user@example.com","timeout":7,"ports":[25]}' http://localhost:8080/validate`
  - PowerShell: `Invoke-RestMethod -Method POST -Uri http://localhost:8080/validate -ContentType application/json -Body '{"email":"user@example.com","timeout":7,"ports":[25]}'`

CLI inside container

- Run one-off CLI: `docker run --rm email-validator python email_validator.py check someone@example.com --json`
 - Bulk from a mounted file:
   `docker run --rm -v %CD%:/data email-validator python email_validator.py bulk -i /data/emails.txt --out csv --concurrency 10 > results.csv`

Notes for testing

- Many networks block outbound SMTP (25/587). If blocked, results will show `unknown (smtp_unreachable)` even though DNS works.
- The container installs `bind9-dnsutils` for `nslookup`. If `nslookup` still fails, the tool falls back to A/AAAA and attempts SMTP against the domain.
