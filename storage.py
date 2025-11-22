import csv
import io
import json
import os
import sqlite3
import hashlib
import hmac
import sys
from typing import Any, Dict, List, Optional, Tuple




SCHEMA = """
CREATE TABLE IF NOT EXISTS validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT,
    from_name TEXT,
    cc TEXT,
    bcc TEXT,
    reply_to TEXT,
    subject TEXT,
    tracking_id TEXT,
    opened INTEGER,
    last_opened TEXT,
    clicked INTEGER,
    last_clicked TEXT,
    unsubscribed INTEGER,
    user_status TEXT,
    normalized_email TEXT,
    domain TEXT,
    is_valid_syntax INTEGER,
    domain_has_mx INTEGER,
    smtp_connectable INTEGER,
    is_deliverable INTEGER,
    is_catch_all INTEGER,
    is_disposable INTEGER,
    validation_status TEXT,
    validation_reason TEXT,
    bounce_likely INTEGER,
    bounce_reason TEXT,
    mx_hosts TEXT,
    source TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


def _bool_to_int(value: Optional[bool]) -> Optional[int]:
    if value is None:
        return None
    return 1 if bool(value) else 0


def _int_to_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    return bool(value)


def _load_hosts(raw: Optional[str]) -> List[str]:
    if raw is None or raw == "":
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


class ValidationStore:
    def __init__(self, db_path: str = "data/validations.db"):
        self.db_path = db_path
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        self._ensure_schema()
        self._ensure_default_admin()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    def _ensure_default_admin(self) -> None:
        """Create a default admin user if none exists."""
        with self._connect() as conn:
            row = conn.execute("SELECT id FROM users WHERE role='admin' LIMIT 1").fetchone()
            if row:
                return
            # Default credentials: admin / admin123 (can be changed later)
            pwd_hash = hash_password("admin123")
            conn.execute(
                "INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
                ("admin", pwd_hash),
            )
            conn.commit()

    def record(self, input_meta: Dict[str, Any], result: Any, source: str = "api") -> int:
        meta = input_meta or {}
        mx_hosts = json.dumps(getattr(result, "mx_hosts", []) or [])
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO validations (
                    email, name, from_name, cc, bcc, reply_to, subject, tracking_id,
                    opened, last_opened, clicked, last_clicked, unsubscribed, user_status,
                    normalized_email, domain, is_valid_syntax, domain_has_mx, smtp_connectable,
                    is_deliverable, is_catch_all, is_disposable, validation_status,
                    validation_reason, bounce_likely, bounce_reason, mx_hosts, source
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    meta.get("email") or getattr(result, "email", None),
                    meta.get("name"),
                    meta.get("from_name"),
                    meta.get("cc"),
                    meta.get("bcc"),
                    meta.get("reply_to"),
                    meta.get("subject"),
                    meta.get("tracking_id"),
                    _bool_to_int(meta.get("opened")),
                    meta.get("last_opened"),
                    _bool_to_int(meta.get("clicked")),
                    meta.get("last_clicked"),
                    _bool_to_int(meta.get("unsubscribed")),
                    meta.get("user_status"),
                    getattr(result, "normalized_email", None),
                    getattr(result, "domain", None),
                    _bool_to_int(getattr(result, "is_valid_syntax", None)),
                    _bool_to_int(getattr(result, "domain_has_mx", None)),
                    _bool_to_int(getattr(result, "smtp_connectable", None)),
                    _bool_to_int(getattr(result, "is_deliverable", None)),
                    _bool_to_int(getattr(result, "is_catch_all", None)),
                    _bool_to_int(getattr(result, "is_disposable", None)),
                    getattr(result, "status", None),
                    getattr(result, "reason", None),
                    _bool_to_int(getattr(result, "bounce_likely", None)),
                    getattr(result, "bounce_reason", None),
                    mx_hosts,
                    source,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)

    def list_validations(self, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        with self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) FROM validations").fetchone()[0]
            cur = conn.execute(
                """
                SELECT * FROM validations
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            )
            rows = [self._row_to_dict(r) for r in cur.fetchall()]
        return {"total": total, "data": rows}

    def export_csv(self) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "id",
                "created_at",
                "source",
                "email",
                "name",
                "from_name",
                "cc",
                "bcc",
                "reply_to",
                "subject",
                "tracking_id",
                "opened",
                "last_opened",
                "clicked",
                "last_clicked",
                "unsubscribed",
                "user_status",
                "normalized_email",
                "domain",
                "validation_status",
                "validation_reason",
                "bounce_likely",
                "bounce_reason",
                "is_deliverable",
                "is_catch_all",
                "is_disposable",
                "domain_has_mx",
                "smtp_connectable",
                "mx_hosts",
            ]
        )
        for row in self._iterate_rows():
            writer.writerow(
                [
                    row["id"],
                    row.get("created_at"),
                    row.get("source"),
                    row.get("email"),
                    row.get("name") or "",
                    row.get("from_name") or "",
                    row.get("cc") or "",
                    row.get("bcc") or "",
                    row.get("reply_to") or "",
                    row.get("subject") or "",
                    row.get("tracking_id") or "",
                    _bool_to_str(row.get("opened")),
                    row.get("last_opened") or "",
                    _bool_to_str(row.get("clicked")),
                    row.get("last_clicked") or "",
                    _bool_to_str(row.get("unsubscribed")),
                    row.get("user_status") or "",
                    row.get("normalized_email") or "",
                    row.get("domain") or "",
                    row.get("validation_status") or "",
                    row.get("validation_reason") or "",
                    _bool_to_str(row.get("bounce_likely")),
                    row.get("bounce_reason") or "",
                    _bool_to_str(row.get("is_deliverable")),
                    _bool_to_str(row.get("is_catch_all")),
                    _bool_to_str(row.get("is_disposable")),
                    _bool_to_str(row.get("domain_has_mx")),
                    _bool_to_str(row.get("smtp_connectable")),
                    ";".join(row.get("mx_hosts") or []),
                ]
            )
        return buf.getvalue()

    def _iterate_rows(self):
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT * FROM validations ORDER BY datetime(created_at) DESC, id DESC
                """
            )
            for row in cur.fetchall():
                yield self._row_to_dict(row)

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        data["opened"] = _int_to_bool(row["opened"])
        data["clicked"] = _int_to_bool(row["clicked"])
        data["unsubscribed"] = _int_to_bool(row["unsubscribed"])
        data["is_valid_syntax"] = _int_to_bool(row["is_valid_syntax"])
        data["domain_has_mx"] = _int_to_bool(row["domain_has_mx"])
        data["smtp_connectable"] = _int_to_bool(row["smtp_connectable"])
        data["is_deliverable"] = _int_to_bool(row["is_deliverable"])
        data["is_catch_all"] = _int_to_bool(row["is_catch_all"])
        data["is_disposable"] = _int_to_bool(row["is_disposable"])
        data["bounce_likely"] = _int_to_bool(row["bounce_likely"])
        data["mx_hosts"] = _load_hosts(row["mx_hosts"])
        return data

    # ------------------- users ------------------- #

    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            return dict(row) if row else None

    def create_user(self, username: str, password: str, role: str = "user") -> int:
        pwd_hash = hash_password(password)
        with self._connect() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                (username, pwd_hash, role),
            )
            conn.commit()
            return int(cur.lastrowid)

    def verify_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        user = self.get_user(username)
        if not user:
            return None
        if verify_password(password, user["password_hash"]):
            return {"username": user["username"], "role": user["role"], "id": user["id"]}
        return None

    # ------------------- stats ------------------- #

    def stats(self) -> Dict[str, Any]:
        with self._connect() as conn:
            counts = conn.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN validation_status='deliverable' THEN 1 ELSE 0 END) as deliverable,
                    SUM(CASE WHEN validation_status='undeliverable' THEN 1 ELSE 0 END) as undeliverable,
                    SUM(CASE WHEN validation_status IN ('invalid_syntax','invalid_domain') THEN 1 ELSE 0 END) as invalid,
                    SUM(CASE WHEN bounce_likely=1 THEN 1 ELSE 0 END) as bounce_likely
                FROM validations
                """
            ).fetchone()
            recent = conn.execute(
                """
                SELECT email, validation_status, validation_reason, created_at
                FROM validations
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT 10
                """
            ).fetchall()
        return {
            "total": counts["total"] if counts else 0,
            "deliverable": counts["deliverable"] if counts else 0,
            "undeliverable": counts["undeliverable"] if counts else 0,
            "invalid": counts["invalid"] if counts else 0,
            "bounce_likely": counts["bounce_likely"] if counts else 0,
            "recent": [dict(r) for r in (recent or [])],
        }


def _bool_to_str(value: Optional[bool]) -> str:
    if value is None:
        return ""
    return "yes" if value else "no"


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt_bytes = salt.encode("utf-8") if salt else os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 120000)
    return "pbkdf2$120000$" + salt_bytes.hex() + "$" + dk.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, hash_hex = stored.split("$", 3)
        if algo != "pbkdf2":
            sys.stderr.write(f"[AUTH-DEBUG] Invalid algo: {algo}\n")
            return False
        salt_bytes = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, int(iterations))
        match = hmac.compare_digest(dk, expected)
        sys.stderr.write(f"[AUTH-DEBUG] Verify: algo={algo} iter={iterations} match={match}\n")
        if not match:
             sys.stderr.write(f"[AUTH-DEBUG] Hash mismatch. Stored: {hash_hex[:10]}... Computed: {dk.hex()[:10]}...\n")
        return match
    except Exception as e:
        sys.stderr.write(f"[AUTH-DEBUG] Verify exception: {e}\n")
        return False
