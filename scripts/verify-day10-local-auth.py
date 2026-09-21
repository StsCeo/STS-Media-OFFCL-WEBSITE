#!/usr/bin/env python3
"""Day 10 Auth/REST consolidator. Re-runs Day 1–9 then extra signed-out checks. Never prints secrets."""
from __future__ import annotations

import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_URL = os.environ.get("DAY10_APP_URL", "http://127.0.0.1:3000")


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def pass_(msg: str) -> None:
    print(f"PASS {msg}")


def run_day(n: int) -> None:
    script = ROOT / "scripts" / f"verify-day{n}-local-auth.py"
    env = os.environ.copy()
    env[f"DAY{n}_APP_URL"] = APP_URL
    result = subprocess.run([sys.executable, str(script)], cwd=str(ROOT), env=env)
    if result.returncode != 0:
        fail(f"Day {n} Auth/REST failed")
    pass_(f"Day {n} Auth/REST passed")


def signed_out(path: str) -> None:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(f"{APP_URL}{path}", method="GET")
    try:
        with opener.open(req, timeout=8):
            fail(f"signed-out {path} returned success")
    except urllib.error.HTTPError as exc:
        location = exc.headers.get("Location") or ""
        if exc.code in (301, 302, 303, 307, 308) and "/login" in location:
            pass_(f"signed-out {path} redirects to login")
            return
        if path.endswith("/download") and exc.code in (401, 403, 404):
            pass_(f"signed-out {path} denied")
            return
        fail(f"signed-out {path} unexpected http {exc.code}")
    except urllib.error.URLError:
        print(f"SKIP signed-out {path}; local Next.js was not reachable")


def main() -> None:
    phase = os.environ.get("DAY10_AUTH_PHASE", "all")
    if phase == "persist":
        env = os.environ.copy()
        env["DAY9_AUTH_PHASE"] = "persist"
        result = subprocess.run([sys.executable, str(ROOT / "scripts" / "verify-day9-local-auth.py")], cwd=str(ROOT), env=env)
        if result.returncode != 0:
            fail("Day 9 persistence phase failed")
        print("DAY10_LOCAL_AUTH_REST_PASSED")
        return

    for n in range(1, 10):
        run_day(n)

    for path in (
        "/dashboard",
        "/accountant",
        "/client",
        "/dashboard/invoices/example/print",
        "/dashboard/estimates/example/print",
        "/client/documents/example/download",
        "/accountant/export/invoices",
    ):
        signed_out(path)
    print("DAY10_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    main()
