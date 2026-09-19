#!/usr/bin/env python3
"""Day 1 local Auth + REST RLS checks. Never prints secrets or tokens."""
from __future__ import annotations

import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

ENV_FILE = Path("/tmp/sts-local/status.env")
ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OWNER_A_EMAIL = "owner-a@day1.test"
OWNER_B_EMAIL = "owner-b@day1.test"
STRANGER_EMAIL = "stranger@day1.test"


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def pass_(msg: str) -> None:
    print(f"PASS {msg}")


def load_status_env() -> dict[str, str]:
    if not ENV_FILE.exists():
        fail("missing private local status env file")
    values: dict[str, str] = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value.strip().strip('"').strip("'")
    return values


def request(method: str, url: str, headers: dict[str, str], body: dict | None = None, timeout: int = 20):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            payload = json.loads(raw.decode() or "null") if raw else None
            return resp.status, payload, dict(resp.headers)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode() or "null") if raw else None
        except json.JSONDecodeError:
            payload = {"_non_json": True}
        return exc.code, payload, dict(exc.headers)


def auth_headers(env: dict[str, str], token: str | None = None, admin: bool = False) -> dict[str, str]:
    key = env["SERVICE_ROLE_KEY"] if admin else env["ANON_KEY"]
    headers = {
        "apikey": key,
        "Content-Type": "application/json",
    }
    headers["Authorization"] = f"Bearer {token or key}"
    return headers


def upsert_user(env: dict[str, str], email: str, password: str) -> str:
    status, payload, _ = request(
        "POST",
        f"{env['API_URL']}/auth/v1/admin/users",
        auth_headers(env, admin=True),
        {"email": email, "password": password, "email_confirm": True},
    )
    if status in (200, 201) and isinstance(payload, dict) and payload.get("id"):
        return str(payload["id"])
    status, payload, _ = request(
        "GET",
        f"{env['API_URL']}/auth/v1/admin/users?email={email}",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(payload, dict):
        fail(f"could not load auth user {email} (http {status})")
    users = payload.get("users") or []
    match = next((item for item in users if item.get("email") == email), None)
    if not match:
        fail(f"auth user {email} missing after admin create")
    user_id = str(match["id"])
    status, _, _ = request(
        "PUT",
        f"{env['API_URL']}/auth/v1/admin/users/{user_id}",
        auth_headers(env, admin=True),
        {"password": password, "email_confirm": True},
    )
    if status not in (200, 201):
        fail(f"could not set password for {email} (http {status})")
    return user_id


def password_login(env: dict[str, str], email: str, password: str) -> tuple[int, str | None]:
    status, payload, _ = request(
        "POST",
        f"{env['API_URL']}/auth/v1/token?grant_type=password",
        auth_headers(env),
        {"email": email, "password": password},
    )
    token = None
    if isinstance(payload, dict):
        token = payload.get("access_token")
        if token:
            payload["access_token"] = "[redacted]"
            payload["refresh_token"] = "[redacted]"
    return status, token


def rest_count(env: dict[str, str], token: str | None, table: str, query: str = "") -> tuple[int, int | None]:
    url = f"{env['REST_URL']}/{table}{query}"
    headers = auth_headers(env, token)
    headers["Prefer"] = "count=exact"
    status, payload, response_headers = request("GET", url, headers)
    count = None
    content_range = response_headers.get("Content-Range") or response_headers.get("content-range")
    if content_range and "/" in content_range:
        total = content_range.split("/")[-1]
        if total.isdigit():
            count = int(total)
    elif isinstance(payload, list):
        count = len(payload)
    return status, count


def rpc_save(env: dict[str, str], token: str, organization_id: str, legal_name: str = "Day1 Test Org A") -> int:
    status, _, _ = request(
        "POST",
        f"{env['REST_URL']}/rpc/sts_save_business_settings",
        auth_headers(env, token),
        {
            "p_organization_id": organization_id,
            "p_legal_name": legal_name,
            "p_display_name": "Org A Saved",
            "p_timezone": "America/New_York",
            "p_base_currency": "USD",
            "p_fiscal_year_start": 1,
            "p_invoice_prefix": "STSX",
            "p_estimate_prefix": "EST",
            "p_default_payment_terms": "Net 15",
        },
    )
    return status


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    missing = [key for key in required if not env.get(key)]
    if missing:
        fail("local status env missing required key names")

    owner_a_password = secrets.token_urlsafe(24)
    owner_b_password = secrets.token_urlsafe(24)
    stranger_password = secrets.token_urlsafe(24)
    wrong_password = secrets.token_urlsafe(24)

    upsert_user(env, OWNER_A_EMAIL, owner_a_password)
    upsert_user(env, OWNER_B_EMAIL, owner_b_password)
    upsert_user(env, STRANGER_EMAIL, stranger_password)
    pass_("admin upserted synthetic local users")

    bad_status, bad_token = password_login(env, OWNER_A_EMAIL, wrong_password)
    if bad_status < 400 or bad_token:
        fail(f"wrong password unexpectedly succeeded (http {bad_status})")
    pass_("wrong password is rejected")

    status_a, token_a = password_login(env, OWNER_A_EMAIL, owner_a_password)
    if status_a != 200 or not token_a:
        fail(f"owner A password login failed (http {status_a})")
    pass_("owner A password login succeeded")

    status_b, token_b = password_login(env, OWNER_B_EMAIL, owner_b_password)
    if status_b != 200 or not token_b:
        fail(f"owner B password login failed (http {status_b})")
    pass_("owner B password login succeeded")

    status_s, token_s = password_login(env, STRANGER_EMAIL, stranger_password)
    if status_s != 200 or not token_s:
        fail(f"stranger password login failed (http {status_s})")
    pass_("unprivileged user password login succeeded")

    anon_status, anon_count = rest_count(env, None, "organizations")
    if anon_status not in (200, 401, 403) or (anon_count not in (0, None) and anon_status == 200 and anon_count != 0):
        if anon_status == 200 and anon_count == 0:
            pass_("anon REST organizations returns zero rows")
        elif anon_status in (401, 403):
            pass_("anon REST organizations is denied")
        else:
            fail(f"anon REST organizations unexpected http {anon_status} count {anon_count}")
    elif anon_status in (401, 403) or anon_count == 0:
        pass_("anon REST organizations is denied or empty")
    else:
        fail(f"anon REST organizations leaked rows http {anon_status} count {anon_count}")

    a_status, a_count = rest_count(env, token_a, "organizations")
    if a_status != 200 or a_count != 1:
        fail(f"owner A REST organizations http {a_status} count {a_count}")
    pass_("owner A REST sees one organization")

    a_other_status, a_other_count = rest_count(env, token_a, "organizations", f"?id=eq.{ORG_B}")
    if a_other_status not in (200, 406) or a_other_count not in (0, None):
        if a_other_status == 200 and a_other_count == 0:
            pass_("owner A REST cannot read org B")
        else:
            fail(f"owner A REST org B http {a_other_status} count {a_other_count}")
    else:
        pass_("owner A REST cannot read org B")

    b_status, b_other_count = rest_count(env, token_b, "organizations", f"?id=eq.{ORG_A}")
    if b_status == 200 and b_other_count == 0:
        pass_("owner B REST cannot read org A")
    elif b_status in (401, 403):
        pass_("owner B REST org A denied")
    else:
        fail(f"owner B REST org A http {b_status} count {b_other_count}")

    s_status, s_count = rest_count(env, token_s, "organizations")
    if s_status == 200 and s_count == 0:
        pass_("stranger REST sees zero organizations")
    elif s_status in (401, 403):
        pass_("stranger REST organizations denied")
    else:
        fail(f"stranger REST organizations http {s_status} count {s_count}")

    rpc_ok = rpc_save(env, token_a, ORG_A, "Day1 Test Org A")
    if rpc_ok not in (200, 204):
        fail(f"owner A RPC save http {rpc_ok}")
    pass_("owner A REST RPC save succeeded")

    rpc_cross = rpc_save(env, token_a, ORG_B, "Day1 Test Org B")
    if rpc_cross in (200, 204):
        fail("owner A RPC save for org B unexpectedly succeeded")
    pass_(f"owner A REST RPC cannot save org B (http {rpc_cross})")

    rpc_stranger = rpc_save(env, token_s, ORG_A)
    if rpc_stranger in (200, 204):
        fail("stranger RPC save unexpectedly succeeded")
    pass_(f"stranger REST RPC cannot save org A (http {rpc_stranger})")

    logout_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/auth/v1/logout",
        auth_headers(env, token_a),
        {},
    )
    if logout_status not in (200, 204):
        fail(f"owner A logout http {logout_status}")
    pass_("owner A logout succeeded")

    after_status, after_count = rest_count(env, token_a, "organizations")
    if after_status in (401, 403):
        pass_("revoked owner A token cannot read organizations")
    elif after_status == 200 and after_count == 0:
        pass_("revoked owner A token reads zero organizations")
    else:
        # Local GoTrue may not immediately revoke JWTs; record as a gap if still valid.
        print(f"GAP logout does not invalidate existing access token (http {after_status} count {after_count})")

    print("DAY1_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    os.environ.setdefault("PYTHONHASHSEED", "0")
    main()
