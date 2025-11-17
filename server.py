import argparse
import json
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    # Local module with validation logic
    from email_validator import check_email, parse_ports
except Exception as e:  # pragma: no cover - helpful message if file missing
    print("Failed to import validation module: ", e, file=sys.stderr)
    raise


def _json_bytes(obj) -> bytes:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


class _RequestContext:
    def __init__(self, default_from: str, default_helo: str, default_timeout: int, default_max_mx: int, default_ports):
        self.default_from = default_from
        self.default_helo = default_helo
        self.default_timeout = default_timeout
        self.default_max_mx = default_max_mx
        self.default_ports = default_ports


class EmailValidatorHandler(BaseHTTPRequestHandler):
    server_version = "EmailValidatorHTTP/1.0"

    # Injected at server creation
    ctx: _RequestContext = None  # type: ignore

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

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
        self._respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/validate":
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length > 0 else b""
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
                return
            self._handle_validate_json(payload)
            return
        if parsed.path == "/validate/bulk":
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length > 0 else b""
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
                return
            self._handle_validate_bulk(payload)
            return
        self._respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    # ------------------------- helpers -------------------------

    def _handle_validate_query(self, params):
        def first(name, default=None):
            v = params.get(name)
            return v[0] if v else default

        email = first("email")
        if not email:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "missing_email"})
            return

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

        verbose = (first("verbose", "false").lower() in ("1", "true", "yes"))

        self._run_check(email, mail_from, helo, timeout, max_mx, ports, verbose)

    def _handle_validate_json(self, payload):
        email = payload.get("email")
        if not email:
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "missing_email"})
            return
        mail_from = payload.get("from", self.ctx.default_from)
        helo = payload.get("helo", self.ctx.default_helo)
        timeout = payload.get("timeout", self.ctx.default_timeout)
        max_mx = payload.get("max_mx", self.ctx.default_max_mx)
        ports = payload.get("ports", self.ctx.default_ports)
        verbose = bool(payload.get("verbose", False))

        # Normalize ports if provided as string
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

        self._run_check(email, mail_from, helo, timeout, max_mx, ports, verbose)

    def _handle_validate_bulk(self, payload):
        emails = payload.get("emails")
        if not isinstance(emails, list) or not all(isinstance(e, str) for e in emails):
            self._respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_emails"})
            return

        mail_from = payload.get("from", self.ctx.default_from)
        helo = payload.get("helo", self.ctx.default_helo)
        timeout = int(payload.get("timeout", self.ctx.default_timeout))
        max_mx = int(payload.get("max_mx", self.ctx.default_max_mx))
        ports = payload.get("ports", self.ctx.default_ports)
        verbose = bool(payload.get("verbose", False))
        concurrency = int(payload.get("concurrency", 10))
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

        def do_one(addr: str):
            return check_email(
                addr,
                from_address=mail_from,
                helo_host=helo,
                timeout=timeout,
                max_mx=max_mx,
                ports=ports,
                verbose=verbose,
            )

        if stream:
            # Stream NDJSON; no Content-Length header, client reads until close
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
                        line = json.dumps(res.__dict__, separators=(",", ":")) + "\n"
                        self.wfile.write(line.encode("utf-8"))
                        try:
                            self.wfile.flush()
                        except Exception:
                            pass
            except BrokenPipeError:
                # Client closed connection; just stop
                return
            except Exception as e:
                # Attempt to send an error line if possible
                try:
                    err = json.dumps({"error": "internal_error", "detail": str(e)}) + "\n"
                    self.wfile.write(err.encode("utf-8"))
                except Exception:
                    pass
            return

        # Non-streaming: build JSON array with summary
        results = []
        counts = {"deliverable": 0, "undeliverable": 0, "unknown": 0, "invalid": 0}
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as ex:
            fut_to_email = {ex.submit(do_one, e): e for e in emails}
            for fut in as_completed(fut_to_email):
                res = fut.result()
                results.append(res.__dict__)
                if res.status == "deliverable":
                    counts["deliverable"] += 1
                elif res.status == "undeliverable":
                    counts["undeliverable"] += 1
                elif res.status in ("invalid_syntax", "invalid_domain"):
                    counts["invalid"] += 1
                else:
                    counts["unknown"] += 1

        self._respond_json(HTTPStatus.OK, {"results": results, "summary": counts, "total": len(emails)})

    def _run_check(self, email, mail_from, helo, timeout, max_mx, ports, verbose):
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

        # Decide HTTP status: map statuses to HTTP codes for easy integration
        if res.status == "deliverable":
            code = HTTPStatus.OK
        elif res.status in ("invalid_syntax", "invalid_domain"):
            code = HTTPStatus.BAD_REQUEST
        elif res.status == "undeliverable":
            code = HTTPStatus.NOT_FOUND
        else:
            code = HTTPStatus.ACCEPTED  # unknown/temporary

        self._respond_json(code, {"ok": res.status == "deliverable", **res.__dict__})

    def _respond_json(self, status: HTTPStatus, obj):
        body = _json_bytes(obj)
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # Suppress default noisy logging; keep concise
    def log_message(self, format, *args):  # noqa: A003 - match BaseHTTPRequestHandler
        sys.stderr.write("%s - - %s\n" % (self.address_string(), format % args))


class ThreadingHTTPServer(ThreadingMixIn,):
    daemon_threads = True

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    


def serve(host: str, port: int, default_from: str, default_helo: str, default_timeout: int, default_max_mx: int, default_ports):
    from http.server import HTTPServer

    class _Server(ThreadingMixIn, HTTPServer):
        daemon_threads = True

    ctx = _RequestContext(default_from, default_helo, default_timeout, default_max_mx, default_ports)

    def handler_class_factory(context: _RequestContext):
        class Handler(EmailValidatorHandler):
            pass
        Handler.ctx = context
        return Handler

    httpd = _Server((host, port), handler_class_factory(ctx))
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
    args = ap.parse_args(argv)

    try:
        serve(args.host, args.port, args.mail_from, args.helo, args.timeout, args.max_mx, args.ports)
    except KeyboardInterrupt:
        print("Shutting down...")
    return 0


if __name__ == "__main__":
    sys.exit(main())
