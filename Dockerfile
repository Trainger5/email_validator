FROM python:3.11-slim

# Ensure predictable runtime and useful DNS tool
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates bind9-dnsutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY email_validator.py server.py storage.py xlsx_utils.py README.md ./

EXPOSE 8080

# Simple healthcheck using Python stdlib
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python - <<'PY' || exit 1
import sys, urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3) as r:
        sys.exit(0 if r.status==200 else 1)
except Exception:
    sys.exit(1)
PY

CMD ["python", "server.py", "--port", "8080"]
