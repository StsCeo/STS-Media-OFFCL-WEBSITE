"""Local JWT AAL helpers for Day 1–7 Auth/REST/Storage checks.

Never prints tokens, TOTP secrets, QR contents, or environment values.
Keep any temporary secret only in memory.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import struct
import sys
import time
import urllib.error
import urllib.request
from typing import Any


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def jwt_claim(token: str, name: str) -> str:
    parts = token.split(".")
    if len(parts) < 2:
        return ""
    payload = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
    try:
        data = json.loads(base64.urlsafe_b64decode(payload.encode("ascii")))
    except (ValueError, json.JSONDecodeError):
        return ""
    if not isinstance(data, dict):
        return ""
    value = data.get(name)
    return value if isinstance(value, str) else ""


def jwt_aal(token: str) -> str:
    return jwt_claim(token, "aal")


def totp_code(secret: str, when: float | None = None) -> str:
    padded = secret.strip().upper()
    padded += "=" * ((8 - len(padded) % 8) % 8)
    key = base64.b32decode(padded.encode("ascii"), casefold=True)
    counter = int((time.time() if when is None else when) // 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{number % 1_000_000:06d}"


def _request(
    method: str,
    url: str,
    headers: dict[str, str],
    body: dict | None = None,
    timeout: int = 20,
) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            payload = json.loads(raw.decode() or "null") if raw else None
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode() or "null") if raw else None
        except json.JSONDecodeError:
            payload = {"_non_json": True}
        return exc.code, payload


def _headers(env: dict[str, str], token: str) -> dict[str, str]:
    return {
        "apikey": env["ANON_KEY"],
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _extract_access_token(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    nested = payload.get("access_token")
    if isinstance(nested, str) and nested:
        return nested
    session = payload.get("session")
    if isinstance(session, dict):
        nested = session.get("access_token")
        if isinstance(nested, str) and nested:
            return nested
    return None


def _admin_headers(env: dict[str, str]) -> dict[str, str]:
    return {
        "apikey": env["SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
    }


def _clear_existing_factors(env: dict[str, str], user_id: str) -> None:
    if not user_id:
        return
    status, payload = _request(
        "GET",
        f"{env['API_URL']}/auth/v1/admin/users/{user_id}",
        _admin_headers(env),
    )
    if status != 200 or not isinstance(payload, dict):
        return
    factors = payload.get("factors") or []
    if not isinstance(factors, list):
        return
    for factor in factors:
        if not isinstance(factor, dict) or not factor.get("id"):
            continue
        _request(
            "DELETE",
            f"{env['API_URL']}/auth/v1/admin/users/{user_id}/factors/{factor['id']}",
            _admin_headers(env),
        )


def enroll_totp_aal2(env: dict[str, str], aal1_token: str) -> str:
    """Enroll and verify TOTP. Secret stays in memory and is discarded."""
    _clear_existing_factors(env, jwt_claim(aal1_token, "sub"))
    status, payload = _request(
        "POST",
        f"{env['API_URL']}/auth/v1/factors",
        _headers(env, aal1_token),
        {"factor_type": "totp", "friendly_name": "local-aal-check"},
    )
    if status not in (200, 201) or not isinstance(payload, dict):
        fail(f"TOTP enroll failed (http {status})")
    factor_id = str(payload.get("id") or "")
    totp = payload.get("totp") if isinstance(payload.get("totp"), dict) else {}
    secret = str(totp.get("secret") or "")
    payload["totp"] = {"redacted": True}
    if not factor_id or not secret:
        fail("TOTP enroll did not return a usable factor")

    challenge_status, challenge = _request(
        "POST",
        f"{env['API_URL']}/auth/v1/factors/{factor_id}/challenge",
        _headers(env, aal1_token),
        {},
    )
    if challenge_status not in (200, 201) or not isinstance(challenge, dict) or not challenge.get("id"):
        secret = ""
        fail(f"TOTP challenge failed (http {challenge_status})")
    challenge_id = str(challenge["id"])

    aal2_token = None
    now = time.time()
    for offset in (0, -30, 30):
        code = totp_code(secret, now + offset)
        verify_status, verified = _request(
            "POST",
            f"{env['API_URL']}/auth/v1/factors/{factor_id}/verify",
            _headers(env, aal1_token),
            {"challenge_id": challenge_id, "code": code},
        )
        aal2_token = _extract_access_token(verified)
        if verify_status in (200, 201) and aal2_token and jwt_aal(aal2_token) == "aal2":
            break
        aal2_token = None
    secret = ""
    if not aal2_token:
        fail("TOTP verify did not produce an AAL2 session")
    return aal2_token


def expect_denied_or_empty(status: int, count: int | None, label: str) -> None:
    if status in (401, 403) or (status == 200 and (count in (0, None))):
        print(f"PASS {label}")
        return
    fail(f"{label} http {status} count {count}")
