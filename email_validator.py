import argparse
import json
import random
import re
import socket
import string
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple
import smtplib
import ssl


# -----------------------------
# Data structures
# -----------------------------


@dataclass
class EmailValidationResult:
    email: str
    normalized_email: Optional[str]
    domain: Optional[str]
    is_valid_syntax: bool
    domain_has_mx: bool
    smtp_connectable: bool
    is_deliverable: Optional[bool]
    is_catch_all: Optional[bool]
    is_disposable: Optional[bool]
    status: str  # deliverable | undeliverable | unknown | invalid_syntax | invalid_domain
    reason: Optional[str]
    mx_hosts: List[str]
    logs: List[str]


# Small built‑in list (extend as needed)
DISPOSABLE_DOMAINS = {
    "mailinator.com",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "tempmail.com",
    "temp-mail.org",
    "throwawaymail.com",
    "moakt.com",
    "trashmail.com",
}


# -----------------------------
# Utilities
# -----------------------------


def _log(logs: List[str], msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    logs.append(f"[{ts}] {msg}")


def normalize_email(email: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Normalize the email: lower-case domain, IDNA (punycode) domain.

    Returns: (normalized_email, local_part, domain)
    """
    if "@" not in email:
        return None, None, None
    local, domain = email.rsplit("@", 1)
    local = local.strip()
    domain = domain.strip().lower()
    try:
        # IDNA encoding to support internationalized domain names
        ascii_domain = domain.encode("idna").decode("ascii")
    except Exception:
        ascii_domain = domain
    normalized = f"{local}@{ascii_domain}"
    return normalized, local, ascii_domain


def is_valid_syntax(email: str) -> Tuple[bool, Optional[str]]:
    """Conservative syntax validation (not a full RFC implementation).

    - local part: 1..64 chars, allowed RFC common atom characters, no leading/trailing dot, no consecutive dots
    - domain: labels 1..63, total <= 253, labels alnum or hyphen (not start/end with hyphen), TLD len >= 2
    """
    if "@" not in email:
        return False, "missing_at"
    local, domain = email.rsplit("@", 1)
    if not (1 <= len(local) <= 64):
        return False, "local_length"
    if local[0] == "." or local[-1] == "." or ".." in local:
        return False, "local_dots"
    # Allowed local part characters per common case (excluding quoted strings for simplicity)
    if not re.fullmatch(r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+", local):
        return False, "local_chars"
    # Domain checks
    try:
        ascii_domain = domain.encode("idna").decode("ascii")
    except Exception:
        return False, "domain_idna"
    if len(ascii_domain) > 253:
        return False, "domain_length"
    labels = ascii_domain.split(".")
    if len(labels) < 2:
        return False, "domain_tld"
    for label in labels:
        if not (1 <= len(label) <= 63):
            return False, "label_length"
        if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label):
            return False, "label_chars"
    if len(labels[-1]) < 2:
        return False, "tld_length"
    return True, None


def nslookup_mx(domain: str, timeout: int, logs: List[str]) -> List[Tuple[int, str]]:
    """Resolve MX via nslookup. Returns list of (preference, host)."""
    try:
        # Windows-friendly: -type=mx
        proc = subprocess.run(
            ["nslookup", "-type=mx", domain],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        out = proc.stdout or ""
        mx_records: List[Tuple[int, str]] = []
        pref_host = re.compile(r"preference\s*=\s*(\d+)\s*,\s*mail exchanger\s*=\s*(\S+)")
        host_only = re.compile(r"mail exchanger\s*=\s*(\S+)")
        for line in out.splitlines():
            line = line.strip()
            m = pref_host.search(line)
            if m:
                pref = int(m.group(1))
                host = m.group(2).rstrip('.')
                mx_records.append((pref, host))
                continue
            m2 = host_only.search(line)
            if m2:
                host = m2.group(1).rstrip('.')
                # Unknown preference; default to 10
                mx_records.append((10, host))
        # Deduplicate by host keeping lowest pref
        best: dict[str, int] = {}
        for pref, host in mx_records:
            if host not in best or pref < best[host]:
                best[host] = pref
        final = sorted([(p, h) for h, p in best.items()], key=lambda x: x[0])
        if final:
            _log(logs, f"MX via nslookup: {[h for _, h in final]}")
        else:
            _log(logs, "No MX records found via nslookup")
        return final
    except subprocess.TimeoutExpired:
        _log(logs, "nslookup MX timed out")
        return []
    except FileNotFoundError:
        _log(logs, "nslookup not found")
        return []
    except Exception as e:
        _log(logs, f"nslookup error: {e}")
        return []


def resolve_a(domain: str, logs: List[str]) -> List[str]:
    """Resolve A/AAAA via socket as fallback when MX missing."""
    try:
        infos = socket.getaddrinfo(domain, None)
        addrs = sorted({info[4][0] for info in infos})
        if addrs:
            _log(logs, f"Fallback A/AAAA for domain: {addrs}")
        return addrs
    except Exception as e:
        _log(logs, f"A/AAAA resolution failed: {e}")
        return []


def smtp_try_rcpt(
    mx_host: str,
    ports: List[int],
    from_addr: str,
    rcpt_addr: str,
    helo_host: str,
    timeout: int,
    verbose: bool,
    logs: List[str],
) -> Tuple[bool, Optional[int], Optional[str], bool]:
    """Try RCPT TO on given MX host. Returns (accepted, code, message, connected).

    connected=False indicates we couldn't reach SMTP at all.
    """
    for port in ports:
        try:
            _log(logs, f"Connecting SMTP {mx_host}:{port}")
            with smtplib.SMTP(mx_host, port, timeout=timeout) as smtp:
                if verbose:
                    smtp.set_debuglevel(1)
                code, banner = smtp.noop()  # warm up socket quickly
                _log(logs, f"Connected: {code} {banner!r}")
                try:
                    smtp.ehlo_or_helo_if_needed()
                except Exception:
                    try:
                        smtp.helo(name=helo_host)
                    except Exception:
                        pass
                # STARTTLS if advertised
                try:
                    if smtp.has_extn("starttls"):
                        context = ssl.create_default_context()
                        smtp.starttls(context=context)
                        smtp.ehlo()
                        _log(logs, "STARTTLS negotiated")
                except Exception as e:
                    _log(logs, f"STARTTLS failed/ignored: {e}")

                code_mail, _ = smtp.mail(from_addr)
                code_rcpt, msg_rcpt = smtp.rcpt(rcpt_addr)
                _log(logs, f"MAIL FROM -> {code_mail}, RCPT TO -> {code_rcpt} {msg_rcpt!r}")

                accepted = code_rcpt in (250, 251)
                return accepted, code_rcpt, (msg_rcpt or b"").decode(errors="ignore"), True
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected) as e:
            _log(logs, f"SMTP connect error {mx_host}:{port} -> {e}")
            continue
        except (socket.timeout, TimeoutError) as e:
            _log(logs, f"SMTP timeout {mx_host}:{port} -> {e}")
            continue
        except Exception as e:
            _log(logs, f"SMTP error {mx_host}:{port} -> {e}")
            continue
    return False, None, None, False


def random_probe_local() -> str:
    return "probe_" + "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(20))


def check_email(
    email: str,
    from_address: str = "verify@example.com",
    helo_host: str = "example.com",
    timeout: int = 7,
    max_mx: int = 3,
    ports: Optional[List[int]] = None,
    verbose: bool = False,
) -> EmailValidationResult:
    logs: List[str] = []
    ports = ports or [25]

    normalized, local, domain = normalize_email(email)
    if normalized is None:
        return EmailValidationResult(
            email=email,
            normalized_email=None,
            domain=None,
            is_valid_syntax=False,
            domain_has_mx=False,
            smtp_connectable=False,
            is_deliverable=False,
            is_catch_all=None,
            is_disposable=None,
            status="invalid_syntax",
            reason="missing_at",
            mx_hosts=[],
            logs=logs,
        )

    ok, why = is_valid_syntax(normalized)
    if not ok:
        return EmailValidationResult(
            email=email,
            normalized_email=normalized,
            domain=domain,
            is_valid_syntax=False,
            domain_has_mx=False,
            smtp_connectable=False,
            is_deliverable=False,
            is_catch_all=None,
            is_disposable=None,
            status="invalid_syntax",
            reason=why,
            mx_hosts=[],
            logs=logs,
        )

    # DNS resolution
    mx = nslookup_mx(domain, timeout=timeout, logs=logs)
    domain_has_mx = len(mx) > 0
    mx_hosts = [host for _, host in mx][:max_mx]
    if not mx_hosts:
        # Fallback to A/AAAA, treat domain as SMTP host
        addrs = resolve_a(domain, logs)
        if not addrs:
            return EmailValidationResult(
                email=email,
                normalized_email=normalized,
                domain=domain,
                is_valid_syntax=True,
                domain_has_mx=False,
                smtp_connectable=False,
                is_deliverable=False,
                is_catch_all=None,
                is_disposable=None,
                status="invalid_domain",
                reason="no_mx_no_a",
                mx_hosts=[],
                logs=logs,
            )
        # Use domain as host when only A exists
        mx_hosts = [domain]

    # SMTP RCPT check
    deliverable = None
    smtp_connectable = False
    rcpt_code = None
    rcpt_msg = None

    for host in mx_hosts:
        accepted, code, msg, connected = smtp_try_rcpt(
            host, ports, from_address, normalized, helo_host, timeout, verbose, logs
        )
        smtp_connectable = smtp_connectable or connected
        if connected and code is not None:
            rcpt_code, rcpt_msg = code, msg
        if accepted:
            deliverable = True
            break
        # Hard rejections -> undeliverable; on temporary errors keep trying
        if code in (550, 551, 552, 553, 554):
            deliverable = False
            # keep iterating other MX in case one accepts, but usually consistent
        elif code in (450, 451, 452, 421):
            # temporary: leave deliverable as None for now
            pass

    # Catch‑all detection if deliverable appears true
    is_catch_all: Optional[bool] = None
    if deliverable:
        probe_local = random_probe_local()
        probe_addr = f"{probe_local}@{domain}"
        for host in mx_hosts:
            accepted_probe, p_code, _p_msg, connected = smtp_try_rcpt(
                host, ports, from_address, probe_addr, helo_host, timeout, verbose, logs
            )
            if accepted_probe:
                is_catch_all = True
                break
            if p_code in (550, 551, 552, 553, 554):
                is_catch_all = False
                break
        if is_catch_all is None:
            is_catch_all = False

    # Disposable
    is_disposable = domain in DISPOSABLE_DOMAINS
    if is_disposable:
        _log(logs, f"Disposable domain detected: {domain}")

    # Final status
    if not smtp_connectable and deliverable is None:
        status = "unknown"
        reason = "smtp_unreachable"
    elif deliverable is True and is_catch_all:
        status = "unknown"
        reason = "accepts_all"
    elif deliverable is True:
        status = "deliverable"
        reason = None
    elif deliverable is False:
        status = "undeliverable"
        reason = f"rcpt_{rcpt_code}" if rcpt_code else "hard_fail"
    else:
        status = "unknown"
        reason = f"rcpt_{rcpt_code}" if rcpt_code else "temp_fail"

    return EmailValidationResult(
        email=email,
        normalized_email=normalized,
        domain=domain,
        is_valid_syntax=True,
        domain_has_mx=domain_has_mx,
        smtp_connectable=smtp_connectable,
        is_deliverable=(deliverable if deliverable is not None else None),
        is_catch_all=is_catch_all,
        is_disposable=is_disposable,
        status=status,
        reason=reason,
        mx_hosts=mx_hosts,
        logs=logs,
    )


# -----------------------------
# CLI
# -----------------------------


def parse_ports(s: str) -> List[int]:
    parts = [p.strip() for p in s.split(",") if p.strip()]
    vals: List[int] = []
    for p in parts:
        try:
            vals.append(int(p))
        except ValueError:
            raise argparse.ArgumentTypeError(f"Invalid port: {p}")
    return vals


def main(argv: Optional[List[str]] = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    parser = argparse.ArgumentParser(description="Email existence validator (DNS + SMTP)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_check = sub.add_parser("check", help="Validate an email address")
    p_check.add_argument("email", help="Email address to validate")
    p_check.add_argument("--from", dest="mail_from", default="verify@example.com", help="MAIL FROM used in SMTP")
    p_check.add_argument("--helo", dest="helo", default="example.com", help="HELO/EHLO hostname")
    p_check.add_argument("--timeout", type=int, default=7, help="Timeout seconds for DNS/SMTP")
    p_check.add_argument("--max-mx", type=int, default=3, help="Max MX hosts to try")
    p_check.add_argument("--ports", type=parse_ports, default=[25], help="Comma-separated SMTP ports (e.g., 25,587)")
    p_check.add_argument("--json", action="store_true", help="Output JSON")
    p_check.add_argument("--verbose", action="store_true", help="Enable SMTP debug output")

    p_bulk = sub.add_parser("bulk", help="Validate many emails from a file or stdin")
    p_bulk.add_argument("--input", "-i", default="-", help="Input file with one email per line, or '-' for stdin")
    p_bulk.add_argument("--from", dest="mail_from", default="verify@example.com", help="MAIL FROM used in SMTP")
    p_bulk.add_argument("--helo", dest="helo", default="example.com", help="HELO/EHLO hostname")
    p_bulk.add_argument("--timeout", type=int, default=7, help="Timeout seconds for DNS/SMTP")
    p_bulk.add_argument("--max-mx", type=int, default=3, help="Max MX hosts to try")
    p_bulk.add_argument("--ports", type=parse_ports, default=[25], help="Comma-separated SMTP ports (e.g., 25,587)")
    p_bulk.add_argument("--concurrency", "-c", type=int, default=10, help="Parallel workers")
    p_bulk.add_argument("--out", choices=["ndjson", "csv", "json"], default="ndjson", help="Output format")
    p_bulk.add_argument("--verbose", action="store_true", help="Enable SMTP debug output (verbose logs omitted from CSV)")

    args = parser.parse_args(argv)

    if args.cmd == "check":
        res = check_email(
            args.email,
            from_address=args.mail_from,
            helo_host=args.helo,
            timeout=args.timeout,
            max_mx=args.max_mx,
            ports=args.ports,
            verbose=args.verbose,
        )

        if args.json:
            print(json.dumps(asdict(res), indent=2))
        else:
            # Human output
            print(f"Email:           {res.email}")
            print(f"Normalized:      {res.normalized_email}")
            print(f"Domain:          {res.domain}")
            print(f"Syntax:          {'valid' if res.is_valid_syntax else 'invalid'}")
            print(f"MX records:      {'yes' if res.domain_has_mx else 'no'}")
            print(f"SMTP connect:    {'yes' if res.smtp_connectable else 'no'}")
            if res.is_catch_all is not None:
                print(f"Catch-all:       {'yes' if res.is_catch_all else 'no'}")
            if res.is_disposable is not None:
                print(f"Disposable:      {'yes' if res.is_disposable else 'no'}")
            print(f"Status:          {res.status}{' (' + res.reason + ')' if res.reason else ''}")
            if res.mx_hosts:
                print(f"MX tried:        {', '.join(res.mx_hosts)}")
            # Print last few logs for brevity
            tail = res.logs[-8:]
            if tail:
                print("\nLogs:")
                for line in tail:
                    print("  " + line)

        # Exit codes per README
        if res.status == "deliverable":
            return 0
        if res.status in ("invalid_syntax", "invalid_domain", "undeliverable"):
            return 1
        return 2

    if args.cmd == "bulk":
        emails: List[str] = []
        if args.input == "-":
            src = sys.stdin
        else:
            src = open(args.input, "r", encoding="utf-8")
        with src:
            for line in src:
                s = line.strip()
                if not s or s.startswith("#"):
                    continue
                emails.append(s)

        if not emails:
            print("No emails to process", file=sys.stderr)
            return 0

        results = []  # used if out=json; otherwise streamed

        # For CSV writer
        csv_writer = None
        if args.out == "csv":
            csv_writer = csv.writer(sys.stdout)
            csv_writer.writerow([
                "email",
                "normalized_email",
                "domain",
                "status",
                "reason",
                "is_deliverable",
                "is_catch_all",
                "is_disposable",
                "domain_has_mx",
                "smtp_connectable",
                "mx_hosts",
            ])

        # Stats
        counts = {"deliverable": 0, "undeliverable": 0, "unknown": 0, "invalid": 0}

        def do_one(email: str):
            return check_email(
                email,
                from_address=args.mail_from,
                helo_host=args.helo,
                timeout=args.timeout,
                max_mx=args.max_mx,
                ports=args.ports,
                verbose=args.verbose,
            )

        with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as ex:
            fut_to_email = {ex.submit(do_one, e): e for e in emails}
            for fut in as_completed(fut_to_email):
                res = fut.result()
                # Update counters
                if res.status == "deliverable":
                    counts["deliverable"] += 1
                elif res.status == "undeliverable":
                    counts["undeliverable"] += 1
                elif res.status in ("invalid_syntax", "invalid_domain"):
                    counts["invalid"] += 1
                else:
                    counts["unknown"] += 1

                if args.out == "ndjson":
                    print(json.dumps(asdict(res), separators=(",", ":")))
                    sys.stdout.flush()
                elif args.out == "csv":
                    row = [
                        res.email,
                        res.normalized_email or "",
                        res.domain or "",
                        res.status,
                        res.reason or "",
                        json.dumps(res.is_deliverable) if res.is_deliverable is not None else "",
                        json.dumps(res.is_catch_all) if res.is_catch_all is not None else "",
                        json.dumps(res.is_disposable) if res.is_disposable is not None else "",
                        "yes" if res.domain_has_mx else "no",
                        "yes" if res.smtp_connectable else "no",
                        ";".join(res.mx_hosts or []),
                    ]
                    csv_writer.writerow(row)  # type: ignore[arg-type]
                else:  # json array output later
                    results.append(asdict(res))

        if args.out == "json":
            print(json.dumps(results, indent=2))

        # Summary to stderr
        total = sum(counts.values())
        print(
            f"Processed {total}: deliverable={counts['deliverable']} undeliverable={counts['undeliverable']} unknown={counts['unknown']} invalid={counts['invalid']}",
            file=sys.stderr,
        )
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
