#!/usr/bin/env python3
"""Day 2 local Auth + REST RLS checks. Never prints secrets or tokens."""
from __future__ import annotations

import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import enroll_totp_aal2, expect_denied_or_empty, jwt_aal

ENV_FILE = Path("/tmp/sts-local/status.env")
LEAD_MARK = Path("/tmp/sts-local/day2-lead.id")
ORG_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
ORG_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
OWNER_A_EMAIL = "owner-a@day2.test"
OWNER_B_EMAIL = "owner-b@day2.test"
ADMIN_A_EMAIL = "admin-a@day2.test"
MEMBER_A_EMAIL = "member-a@day2.test"
STRANGER_EMAIL = "stranger@day2.test"


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
    headers = {"apikey": key, "Content-Type": "application/json"}
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


def ensure_org(env: dict[str, str], org_id: str, slug: str) -> None:
    status, _, _ = request(
        "POST",
        f"{env['REST_URL']}/organizations",
        auth_headers(env, admin=True),
        {
            "id": org_id,
            "legal_name": slug,
            "display_name": slug,
            "slug": slug,
            "base_currency": "USD",
            "timezone": "America/New_York",
            "fiscal_year_start": 1,
        },
    )
    if status not in (200, 201, 409):
        request(
            "PATCH",
            f"{env['REST_URL']}/organizations?id=eq.{org_id}",
            auth_headers(env, admin=True),
            {"slug": slug},
        )


def ensure_membership(env: dict[str, str], org_id: str, user_id: str, role: str) -> None:
    request(
        "POST",
        f"{env['REST_URL']}/organization_members",
        auth_headers(env, admin=True),
        {
            "organization_id": org_id,
            "user_id": user_id,
            "role": role,
            "status": "active",
        },
    )


def save_lead(env: dict[str, str], token: str, organization_id: str, name: str) -> tuple[int, str | None]:
    status, payload, _ = request(
        "POST",
        f"{env['REST_URL']}/rpc/sts_save_crm_lead",
        auth_headers(env, token),
        {
            "p_organization_id": organization_id,
            "p_id": None,
            "p_business_name": name,
            "p_contact_name": "REST",
            "p_email": "",
            "p_phone": "",
            "p_source": "Manual",
            "p_requested_service": "",
            "p_estimated_value_cents": 1000,
            "p_probability": 10,
            "p_stage": "new_inquiry",
            "p_last_contact": None,
            "p_next_follow_up": None,
            "p_calls_made": 0,
            "p_emails_sent": 0,
            "p_meetings": 0,
            "p_notes": "",
            "p_assigned_to": "Owner",
        },
    )
    lead_id = str(payload) if status in (200, 201) and payload else None
    return status, lead_id


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    if any(not env.get(key) for key in required):
        fail("local status env missing required key names")

    phase = os.environ.get("DAY2_AUTH_PHASE", "all")
    if phase == "persist":
        if not LEAD_MARK.exists():
            fail("missing persistence marker")
        lead_id = LEAD_MARK.read_text().strip()
        status, payload, _ = request(
            "GET",
            f"{env['REST_URL']}/crm_leads?id=eq.{lead_id}&select=id,organization_id,business_name",
            auth_headers(env, admin=True),
        )
        if status != 200 or not isinstance(payload, list) or not payload:
            fail(f"persisted lead missing after restart (http {status})")
        if payload[0].get("organization_id") != ORG_A:
            fail("persisted lead organization mismatch")
        pass_("CRM lead remained after local restart")
        print("DAY2_LOCAL_AUTH_REST_PASSED")
        return

    passwords = {email: secrets.token_urlsafe(24) for email in (
        OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, STRANGER_EMAIL
    )}
    ids = {email: upsert_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 2 users")

    ensure_org(env, ORG_A, "day2-test-org-a")
    ensure_org(env, ORG_B, "day2-test-org-b")
    ensure_membership(env, ORG_A, ids[OWNER_A_EMAIL], "owner")
    ensure_membership(env, ORG_B, ids[OWNER_B_EMAIL], "owner")
    ensure_membership(env, ORG_A, ids[ADMIN_A_EMAIL], "administrator")
    ensure_membership(env, ORG_A, ids[MEMBER_A_EMAIL], "employee")

    aal1_tokens: dict[str, str] = {}
    for email in (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, STRANGER_EMAIL):
        status, token = password_login(env, email, passwords[email])
        if status != 200 or not token:
            fail(f"password login failed for a synthetic user (http {status})")
        if jwt_aal(token) != "aal1":
            fail("password session was not AAL1")
        aal1_tokens[email] = token
    pass_("owner, admin, member, other-org, and stranger password logins succeeded at AAL1")

    s_status, s_count = rest_count(env, aal1_tokens[STRANGER_EMAIL], "crm_leads")
    expect_denied_or_empty(s_status, s_count, "authenticated user without membership sees zero leads")
    o1_status, o1_count = rest_count(env, aal1_tokens[OWNER_A_EMAIL], "crm_leads")
    expect_denied_or_empty(o1_status, o1_count, "owner A AAL1 REST cannot read crm_leads")
    save_aal1, _ = save_lead(env, aal1_tokens[OWNER_A_EMAIL], ORG_A, "AAL1 Lead")
    if save_aal1 in (200, 201):
        fail("owner A AAL1 CRM save unexpectedly succeeded")
    pass_(f"owner A AAL1 REST CRM save denied (http {save_aal1})")

    tokens: dict[str, str] = {
        STRANGER_EMAIL: aal1_tokens[STRANGER_EMAIL],
    }
    for email in (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL):
        tokens[email] = enroll_totp_aal2(env, aal1_tokens[email])
        if jwt_aal(tokens[email]) != "aal2":
            fail("MFA verify did not raise AAL2")
    pass_("member sessions upgraded to AAL2")

    anon_status, anon_count = rest_count(env, None, "crm_leads")
    if anon_status in (401, 403) or (anon_status == 200 and anon_count == 0):
        pass_("signed-out REST cannot read crm_leads")
    else:
        fail(f"anon REST crm_leads http {anon_status} count {anon_count}")

    s_status, s_count = rest_count(env, tokens[STRANGER_EMAIL], "crm_leads")
    if s_status == 200 and s_count == 0:
        pass_("authenticated user without membership sees zero leads")
    elif s_status in (401, 403):
        pass_("authenticated user without membership is denied crm_leads")
    else:
        fail(f"stranger REST crm_leads http {s_status} count {s_count}")

    save_status, lead_id = save_lead(env, tokens[OWNER_A_EMAIL], ORG_A, "Day2 Persist Lead")
    if save_status not in (200, 201) or not lead_id:
        fail(f"owner A CRM save http {save_status}")
    pass_("owner A REST CRM lead save succeeded")
    LEAD_MARK.parent.mkdir(parents=True, exist_ok=True)
    LEAD_MARK.write_text(lead_id)

    member_status, member_lead = save_lead(env, tokens[MEMBER_A_EMAIL], ORG_A, "Day2 Member Lead")
    if member_status not in (200, 201) or not member_lead:
        fail(f"member CRM save http {member_status}")
    pass_("organization member REST CRM lead save succeeded")

    admin_status, admin_count = rest_count(env, tokens[ADMIN_A_EMAIL], "crm_leads")
    if admin_status != 200 or not admin_count or admin_count < 1:
        fail(f"admin REST crm_leads http {admin_status} count {admin_count}")
    pass_("organization admin REST can read org A leads")

    cross = save_lead(env, tokens[OWNER_B_EMAIL], ORG_A, "Cross Org")
    if cross[0] in (200, 201):
        fail("other-organization owner unexpectedly saved into org A")
    pass_(f"other-organization write failed closed (http {cross[0]})")

    b_status, b_count = rest_count(env, tokens[OWNER_B_EMAIL], "crm_leads", f"?organization_id=eq.{ORG_A}")
    if b_status == 200 and b_count == 0:
        pass_("other-organization owner cannot read org A leads")
    elif b_status in (401, 403):
        pass_("other-organization owner is denied org A leads")
    else:
        fail(f"owner B REST org A leads http {b_status} count {b_count}")

    bad_status, _ = save_lead(env, tokens[OWNER_A_EMAIL], ORG_A, "X")
    if bad_status in (200, 201):
        fail("malformed CRM write unexpectedly succeeded")
    pass_(f"malformed CRM write failed closed (http {bad_status})")

    print("DAY2_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    os.environ.setdefault("PYTHONHASHSEED", "0")
    main()
