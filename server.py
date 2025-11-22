import argparse
import csv
import io
import json
import re
import sys
from email import policy
from email.parser import BytesParser
import uuid
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs, urlparse
from typing import Any, Dict, List, Optional

try:
    from email_validator import check_email, parse_ports
    from storage import ValidationStore
    from xlsx_utils import build_template_xlsx, parse_xlsx_rows
except Exception as e:  # pragma: no cover - helpful message if file missing
    print("Failed to import validation module: ", e, file=sys.stderr)
    raise


TEMPLATE_HEADERS = [
    "Email",
    "Name",
    "From Name",
    "CC",
    "BCC",
    "Reply To",
    "Subject",
    "TrackingID",
    "Opened",
    "Last Opened",
    "Clicked",
    "Last Clicked",
    "Unsubscribed",
    "Status",
]

HEADER_MAP = {
    "email": "email",
    "emailaddress": "email",
    "name": "name",
    "fromname": "from_name",
    "cc": "cc",
    "bcc": "bcc",
    "replyto": "reply_to",
    "subject": "subject",
    "trackingid": "tracking_id",
    "tracking_id": "tracking_id",
    "opened": "opened",
    "lastopened": "last_opened",
    "clicked": "clicked",
    "lastclicked": "last_clicked",
    "unsubscribed": "unsubscribed",
    "status": "user_status",
}

BOOL_FIELDS = {"opened", "clicked", "unsubscribed"}


def _normalize_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _parse_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    s = str(value).strip().lower()
    if s in ("1", "true", "yes", "y", "open", "opened", "clicked"):
        return True
    if s in ("0", "false", "no", "n", "closed"):
        return False
    return None


def _normalize_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    record: Dict[str, Any] = {
        "email": "",
        "name": None,
        "from_name": None,
        "cc": None,
        "bcc": None,
        "reply_to": None,
        "subject": None,
        "tracking_id": None,
        "opened": None,
        "last_opened": None,
        "clicked": None,
        "last_clicked": None,
        "unsubscribed": None,
        "user_status": None,
    }
    for key, value in raw.items():
        dest = HEADER_MAP.get(_normalize_key(key))
        if not dest:
            continue
        if isinstance(value, str):
            value = value.strip()
        if dest in BOOL_FIELDS:
            record[dest] = _parse_bool(value)
        else:
            record[dest] = value if value != "" else None
    record["email"] = (record.get("email") or "").strip()
    return record


def _records_from_csv_bytes(data: bytes) -> List[Dict[str, Any]]:
    try:
        text = data.decode("utf-8-sig")
    except Exception:
        text = data.decode(errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []
    records: List[Dict[str, Any]] = []
    for row in reader:
        record = _normalize_record(row)
        if record.get("email"):
            records.append(record)
    return records


def _records_from_xlsx_bytes(data: bytes) -> List[Dict[str, Any]]:
    rows = parse_xlsx_rows(data)
    while rows and not any(cell.strip() for cell in rows[0] if isinstance(cell, str)):
        rows.pop(0)
    if not rows:
        return []
    headers = rows[0]
    idx_to_field: Dict[int, str] = {}
    for i, header in enumerate(headers):
        dest = HEADER_MAP.get(_normalize_key(str(header)))
        if dest:
            idx_to_field[i] = dest
    records: List[Dict[str, Any]] = []
    for raw_row in rows[1:]:
        raw: Dict[str, Any] = {}
        for idx, cell in enumerate(raw_row):
            dest = idx_to_field.get(idx)
            if not dest:
                continue
            raw[dest] = cell
        record = _normalize_record(raw)
        if record.get("email"):
            records.append(record)
    return records


def _csv_template_bytes() -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(TEMPLATE_HEADERS)
    writer.writerow(
        [
            "user@example.com",
            "Jane Smith",
            "Marketing",
            "cc@example.com",
            "bcc@example.com",
            "reply@example.com",
            "Welcome message",
            "track-001",
            "true",
            "2024-01-01",
            "false",
            "",
            "false",
            "new",
        ]
    )
    return buf.getvalue().encode("utf-8")


def _xlsx_template_bytes() -> bytes:
    return build_template_xlsx(TEMPLATE_HEADERS)


def _ok_flag(res) -> bool:
    return (
        getattr(res, "is_valid_syntax", False)
        and getattr(res, "domain_has_mx", False)
        and res.status in ("deliverable", "unknown")
        and not bool(getattr(res, "is_disposable", False))
    )


class _RequestContext:
    def __init__(
        self,
        default_from: str,
        default_helo: str,
        default_timeout: int,
        default_max_mx: int,
        default_ports,
        store: Optional[ValidationStore],
        admin_token: Optional[str],
    ):
        self.default_from = default_from
        self.default_helo = default_helo
        self.default_timeout = default_timeout
        self.default_max_mx = default_max_mx
        self.default_ports = default_ports
        self.store = store
        self.admin_token = admin_token
        self.sessions: dict[str, dict[str, Any]] = {}


class EmailValidatorHandler(BaseHTTPRequestHandler):
    server_version = "EmailValidatorHTTP/1.1"

    ctx: _RequestContext = None  # type: ignore

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")

    def do_OPTIONS(self):  # CORS preflight
        self.send_response(HTTPStatus.NO_CONTENT)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._respond_json(HTTPStatus.OK, {"status": "ok"})
            return
        if parsed.path == "/validate":
            params = parse_qs(parsed.query or "")
            self._handle_validate_query(params)
            return
        if parsed.path == "/admin/stats":
            self._handle_admin_stats(parsed)
            return
        if parsed.path == "/template/csv":
            content = _csv_template_bytes()
            self._respond_bytes(
                HTTPStatus.OK,
                content,
                "text/csv; charset=utf-8",
                filename="email-validation-template.csv",
            )
            return
        if parsed.path == "/template/excel":
            content = _xlsx_template_bytes()
            self._respond_bytes(
                HTTPStatus.OK,
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename="email-validation-template.xlsx",
            )
            return
        if parsed.path == "/admin/validations":
            self._handle_admin_list(parsed)
            return
        if parsed.path == "/admin/export":
            self._handle_admin_export(parsed)
            return
        self._respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/validate":
            payload = self._read_json_body()
            if payload is None:
                return
            self._handle_validate_json(payload)
            return
        if parsed.path == "/validate/bulk":
            payload = self._read_json_body()
            if payload is None:
                return
            self._handle_validate_bulk(payload)
            return
        if parsed.path == "/auth/login":
            payload = self._read_json_body()
            if payload is None:
                return
            self._handle_login(payload)
            return
        if parsed.path == "/auth/me":
            self._handle_me()
            return
        if parsed.path == "/validate/upload":
            self._handle_validate_upload()
            return
        self._respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    # ------------------------- helpers -------------------------

    def _read_json_body(self) -> Optional[Dict[str, Any]]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
            return None

    def _current_user(self) -> Optional[Dict[str, Any]]:
        auth = self.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()
            return self.ctx.sessions.get(token)
        return None

    def _handle_me(self):
        user = self._current_user()
        if not user:
            self._respond_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return
        self._respond_json(HTTPStatus.OK, {"username": user["username"], "role": user["role"]})

    def _handle_login(self, payload):
        username = (payload.get("username") or "").strip()
        password = payload.get("password") or ""
        if not username or not password:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "missing_credentials"})
            return
        if not self.ctx.store:
            self._respond_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "storage_disabled"})
            return
        user = self.ctx.store.verify_user(username, password)
        if not user:
            self._respond_json(HTTPStatus.UNAUTHORIZED, {"error": "invalid_credentials"})
            return
        token = uuid.uuid4().hex
        self.ctx.sessions[token] = {"username": user["username"], "role": user["role"], "issued_at": datetime.datetime.utcnow().isoformat()}
        self._respond_json(HTTPStatus.OK, {"token": token, "username": user["username"], "role": user["role"]})

    def _handle_validate_query(self, params):
        def first(name, default=None):
            v = params.get(name)
            return v[0] if v else default

        email = first("email")
        if not email:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "missing_email"})
            return

        meta = _normalize_record(
            {
                "email": email,
                "name": first("name"),
                "from_name": first("from_name"),
                "cc": first("cc"),
                "bcc": first("bcc"),
                "reply_to": first("reply_to"),
                "subject": first("subject"),
                "tracking_id": first("tracking_id"),
                "opened": first("opened"),
                "last_opened": first("last_opened"),
                "clicked": first("clicked"),
                "last_clicked": first("last_clicked"),
                "unsubscribed": first("unsubscribed"),
                "user_status": first("status"),
            }
        )

        mail_from = first("from", self.ctx.default_from)
        helo = first("helo", self.ctx.default_helo)

        try:
            timeout = int(first("timeout", str(self.ctx.default_timeout)))
        except ValueError:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_timeout"})
            return

        try:
            max_mx = int(first("max_mx", str(self.ctx.default_max_mx)))
        except ValueError:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_max_mx"})
            return

        ports_q = first("ports")
        try:
            ports = parse_ports(ports_q) if ports_q else self.ctx.default_ports
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_ports"})
            return

        verbose = first("verbose", "false").lower() in ("1", "true", "yes")

        self._run_check(meta, mail_from, helo, timeout, max_mx, ports, verbose, source="single_get")

    def _handle_validate_json(self, payload):
        email = payload.get("email")
        if not email:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "missing_email"})
            return

        meta = _normalize_record({**payload, "email": email})
        mail_from = payload.get("from", self.ctx.default_from)
        helo = payload.get("helo", self.ctx.default_helo)
        timeout = payload.get("timeout", self.ctx.default_timeout)
        max_mx = payload.get("max_mx", self.ctx.default_max_mx)
        ports = payload.get("ports", self.ctx.default_ports)
        verbose = bool(payload.get("verbose", False))

        if isinstance(ports, str):
            try:
                ports = parse_ports(ports)
            except Exception:
                self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_ports"})
                return
        if not isinstance(ports, list):
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_ports"})
            return

        try:
            timeout = int(timeout)
            max_mx = int(max_mx)
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_numeric"})
            return

        self._run_check(meta, mail_from, helo, timeout, max_mx, ports, verbose, source="single_post")

    def _handle_validate_bulk(self, payload):
        mails = payload.get("emails")
        records_payload = payload.get("records")

        mail_from = payload.get("from", self.ctx.default_from)
        helo = payload.get("helo", self.ctx.default_helo)
        try:
            timeout = int(payload.get("timeout", self.ctx.default_timeout))
            max_mx = int(payload.get("max_mx", self.ctx.default_max_mx))
            concurrency = int(payload.get("concurrency", 10))
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_numeric"})
            return
        ports = payload.get("ports", self.ctx.default_ports)
        verbose = bool(payload.get("verbose", False))
        stream = bool(payload.get("stream", False)) or bool(payload.get("ndjson", False))

        if isinstance(ports, str):
            try:
                ports = parse_ports(ports)
            except Exception:
                self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_ports"})
                return
        if not isinstance(ports, list):
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_ports"})
            return

        if records_payload is not None:
            if stream:
                self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "stream_not_supported_for_records"})
                return
            if not isinstance(records_payload, list):
                self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_records"})
                return
            records = []
            for rec in records_payload:
                if not isinstance(rec, dict):
                    continue
                norm = _normalize_record(rec)
                if norm.get("email"):
                    records.append(norm)
            if not records:
                self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "no_valid_records"})
                return
            self._run_bulk_records(
                records,
                mail_from,
                helo,
                timeout,
                max_mx,
                ports,
                verbose,
                concurrency,
                source="bulk_records",
            )
            return

        if not isinstance(mails, list) or not all(isinstance(e, str) for e in mails):
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_emails"})
            return

        emails = []
        for e in mails:
            s = e.strip()
            if s and not s.startswith("#"):
                emails.append(s)
        if not emails:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "no_emails"})
            return

        self._run_bulk_emails(
            emails,
            mail_from,
            helo,
            timeout,
            max_mx,
            ports,
            verbose,
            concurrency,
            stream,
            source="bulk_emails",
        )

    def _handle_validate_upload(self):
        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", "0") or 0)
        if not content_type.startswith("multipart/form-data"):
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "expected_multipart"})
            return
        try:
            raw = self.rfile.read(length)
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_form"})
            return

        try:
            parser = BytesParser(policy=policy.default)
            msg = parser.parsebytes(b"Content-Type: " + content_type.encode("utf-8") + b"\r\n\r\n" + raw)
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_form"})
            return

        fields: dict[str, str] = {}
        file_bytes: Optional[bytes] = None
        filename = ""

        for part in msg.iter_parts():
            if part.get_content_disposition() != "form-data":
                continue
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue
            if part.get_filename():
                filename = (part.get_filename() or "").lower()
                file_bytes = part.get_payload(decode=True) or b""
            else:
                payload = part.get_payload(decode=True)
                value = payload.decode(errors="ignore") if isinstance(payload, (bytes, bytearray)) else (payload or "")
                fields[name] = value

        if not file_bytes:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "missing_file"})
            return

        if filename.endswith(".xlsx"):
            records = _records_from_xlsx_bytes(file_bytes)
        elif filename.endswith(".csv"):
            records = _records_from_csv_bytes(file_bytes)
        else:
            if file_bytes.startswith(b"PK"):
                records = _records_from_xlsx_bytes(file_bytes)
            else:
                records = _records_from_csv_bytes(file_bytes)

        if not records:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "no_valid_records"})
            return

        mail_from = fields.get("from") or self.ctx.default_from
        helo = fields.get("helo") or self.ctx.default_helo
        try:
            timeout = int(fields.get("timeout") or self.ctx.default_timeout)
            max_mx = int(fields.get("max_mx") or self.ctx.default_max_mx)
            concurrency = int(fields.get("concurrency") or 5)
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_numeric"})
            return
        ports_val = fields.get("ports")
        try:
            ports = parse_ports(ports_val) if ports_val else self.ctx.default_ports
        except Exception:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_ports"})
            return
        verbose = (fields.get("verbose") or "false").lower() in ("1", "true", "yes")

        self._run_bulk_records(
            records,
            mail_from,
            helo,
            timeout,
            max_mx,
            ports,
            verbose,
            concurrency,
            source="upload",
        )

    # ------------------------- bulk helpers -------------------------

    def _run_bulk_records(
        self,
        records: List[Dict[str, Any]],
        mail_from: str,
        helo: str,
        timeout: int,
        max_mx: int,
        ports: List[int],
        verbose: bool,
        concurrency: int,
        source: str,
    ):
        results = []
        counts = {"deliverable": 0, "undeliverable": 0, "unknown": 0, "invalid": 0}

        def do_one(record: Dict[str, Any]):
            res = check_email(
                record["email"],
                from_address=mail_from,
                helo_host=helo,
                timeout=timeout,
                max_mx=max_mx,
                ports=ports,
                verbose=verbose,
            )
            ok = _ok_flag(res)
            rec_id = self._store_record(record, res, source)
            payload = {"ok": ok, **res.__dict__, "record_id": rec_id, "input": record}
            return res.status, payload

        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as ex:
            fut_to_email = {ex.submit(do_one, r): r for r in records}
            for fut in as_completed(fut_to_email):
                status, payload = fut.result()
                results.append(payload)
                if status == "deliverable":
                    counts["deliverable"] += 1
                elif status == "undeliverable":
                    counts["undeliverable"] += 1
                elif status in ("invalid_syntax", "invalid_domain"):
                    counts["invalid"] += 1
                else:
                    counts["unknown"] += 1

        self._respond_json(HTTPStatus.OK, {"results": results, "summary": counts, "total": len(records)})

    def _run_bulk_emails(
        self,
        emails: List[str],
        mail_from: str,
        helo: str,
        timeout: int,
        max_mx: int,
        ports: List[int],
        verbose: bool,
        concurrency: int,
        stream: bool,
        source: str,
    ):
        def do_one(addr: str):
            res = check_email(
                addr,
                from_address=mail_from,
                helo_host=helo,
                timeout=timeout,
                max_mx=max_mx,
                ports=ports,
                verbose=verbose,
            )
            ok = _ok_flag(res)
            rec_id = self._store_record({"email": addr}, res, source)
            payload = {"ok": ok, **res.__dict__, "record_id": rec_id}
            return payload

        if stream:
            self.send_response(HTTPStatus.OK)
            self._set_cors()
            self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                with ThreadPoolExecutor(max_workers=max(1, concurrency)) as ex:
                    fut_to_email = {ex.submit(do_one, e): e for e in emails}
                    for fut in as_completed(fut_to_email):
                        res = fut.result()
                        line = json.dumps(res, separators=(",", ":")) + "\n"
                        self.wfile.write(line.encode("utf-8"))
                        try:
                            self.wfile.flush()
                        except Exception:
                            pass
            except BrokenPipeError:
                return
            except Exception as e:
                try:
                    err = json.dumps({"error": "internal_error", "detail": str(e)}) + "\n"
                    self.wfile.write(err.encode("utf-8"))
                except Exception:
                    pass
            return

        results = []
        counts = {"deliverable": 0, "undeliverable": 0, "unknown": 0, "invalid": 0}
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as ex:
            fut_to_email = {ex.submit(do_one, e): e for e in emails}
            for fut in as_completed(fut_to_email):
                res = fut.result()
                results.append(res)
                status = res.get("status")
                if status == "deliverable":
                    counts["deliverable"] += 1
                elif status == "undeliverable":
                    counts["undeliverable"] += 1
                elif status in ("invalid_syntax", "invalid_domain"):
                    counts["invalid"] += 1
                else:
                    counts["unknown"] += 1

        self._respond_json(HTTPStatus.OK, {"results": results, "summary": counts, "total": len(emails)})

    # ------------------------- storage and responses -------------------------

    def _store_record(self, meta: Dict[str, Any], res, source: str) -> Optional[int]:
        if not self.ctx.store:
            return None
        try:
            return self.ctx.store.record(meta, res, source=source)
        except Exception as e:  # pragma: no cover - best effort logging
            sys.stderr.write(f"[storage] failed to persist record for {meta.get('email')}: {e}\n")
            return None

    def _run_check(
        self,
        meta: Dict[str, Any],
        mail_from: str,
        helo: str,
        timeout: int,
        max_mx: int,
        ports: List[int],
        verbose: bool,
        source: str,
    ):
        email = meta.get("email")
        if not email:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "missing_email"})
            return
        try:
            res = check_email(
                email,
                from_address=mail_from,
                helo_host=helo,
                timeout=timeout,
                max_mx=max_mx,
                ports=ports,
                verbose=verbose,
            )
        except Exception as e:
            self._respond_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "internal_error", "detail": str(e)})
            return

        if res.status == "deliverable":
            code = HTTPStatus.OK
        elif res.status in ("invalid_syntax", "invalid_domain"):
            code = HTTPStatus.BAD_REQUEST
        elif res.status == "undeliverable":
            code = HTTPStatus.NOT_FOUND
        else:
            code = HTTPStatus.ACCEPTED

        ok = _ok_flag(res)
        record_id = self._store_record(meta, res, source)

        payload = {"ok": ok, **res.__dict__}
        if record_id is not None:
            payload["record_id"] = record_id
        if meta:
            payload["input"] = meta

        self._respond_json(code, payload)

    def _respond_json(self, status: HTTPStatus, obj):
        body = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _respond_bytes(self, status: HTTPStatus, data: bytes, content_type: str, filename: Optional[str] = None):
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(data)

    # ------------------------- admin -------------------------

    def _require_admin(self, parsed) -> bool:
        # First, allow admin token fallback if configured
        token = self.ctx.admin_token
        supplied = None
        auth_header = self.headers.get("Authorization") or ""
        if auth_header.startswith("Bearer "):
            supplied = auth_header.split(" ", 1)[1].strip()
        if not supplied:
            params = parse_qs(parsed.query or "")
            supplied = (params.get("token") or [None])[0]
        if token and supplied == token:
            return True

        # Otherwise, require logged-in admin
        user = self._current_user()
        if user and user.get("role") == "admin":
            return True
        self._respond_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
        return False

    def _handle_admin_list(self, parsed):
        if not self._require_admin(parsed):
            return
        limit = 100
        offset = 0
        params = parse_qs(parsed.query or "")
        try:
            limit = min(500, int((params.get("limit") or [limit])[0]))
            offset = max(0, int((params.get("offset") or [offset])[0]))
        except Exception:
            pass
        if not self.ctx.store:
            self._respond_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "storage_disabled"})
            return
        data = self.ctx.store.list_validations(limit=limit, offset=offset)
        self._respond_json(HTTPStatus.OK, data)

    def _handle_admin_export(self, parsed):
        if not self._require_admin(parsed):
            return
        if not self.ctx.store:
            self._respond_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "storage_disabled"})
            return
        csv_text = self.ctx.store.export_csv()
        self._respond_bytes(
            HTTPStatus.OK,
            csv_text.encode("utf-8"),
            "text/csv; charset=utf-8",
            filename="validations-export.csv",
        )

    def _handle_admin_stats(self, parsed):
        if not self._require_admin(parsed):
            return
        if not self.ctx.store:
            self._respond_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "storage_disabled"})
            return
        stats = self.ctx.store.stats()
        self._respond_json(HTTPStatus.OK, stats)

    # Suppress default noisy logging
    def log_message(self, format, *args):  # noqa: A003 - match BaseHTTPRequestHandler
        sys.stderr.write("%s - - %s\n" % (self.address_string(), format % args))


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def serve(host: str, port: int, default_from: str, default_helo: str, default_timeout: int, default_max_mx: int, default_ports, db_path: str, admin_token: Optional[str]):
    try:
        store = ValidationStore(db_path=db_path)
    except Exception as e:  # pragma: no cover
        sys.stderr.write(f"Failed to init storage: {e}\n")
        store = None

    ctx = _RequestContext(default_from, default_helo, default_timeout, default_max_mx, default_ports, store, admin_token)

    def handler_class_factory(context: _RequestContext):
        class Handler(EmailValidatorHandler):
            pass
        Handler.ctx = context
        return Handler

    httpd = ThreadingHTTPServer((host, port), handler_class_factory(ctx))
    print(f"Serving on http://{host}:{port}")
    httpd.serve_forever()


def main(argv=None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    ap = argparse.ArgumentParser(description="HTTP API for email validator")
    ap.add_argument("--host", default="0.0.0.0", help="Bind host")
    ap.add_argument("--port", type=int, default=8080, help="Bind port")
    ap.add_argument("--from", dest="mail_from", default="verify@example.com", help="Default MAIL FROM")
    ap.add_argument("--helo", dest="helo", default="example.com", help="Default HELO/EHLO hostname")
    ap.add_argument("--timeout", type=int, default=7, help="Default DNS/SMTP timeout seconds")
    ap.add_argument("--max-mx", type=int, default=3, help="Default max MX hosts to try")
    ap.add_argument("--ports", type=parse_ports, default=[25], help="Default SMTP ports (comma: 25,587)")
    ap.add_argument("--db-path", default="data/validations.db", help="SQLite path for storing validation attempts")
    ap.add_argument("--admin-token", default=None, help="Optional admin token for admin/export endpoints")
    args = ap.parse_args(argv)

    try:
        serve(args.host, args.port, args.mail_from, args.helo, args.timeout, args.max_mx, args.ports, args.db_path, args.admin_token)
    except KeyboardInterrupt:
        print("Shutting down...")
    return 0


if __name__ == "__main__":
    sys.exit(main())
