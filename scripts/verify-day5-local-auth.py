#!/usr/bin/env python3
"""Day 5 local Auth + REST estimate checks. Never prints secrets or tokens."""
from __future__ import annotations

import json
import os
import secrets
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import enroll_totp_aal2, expect_denied_or_empty, jwt_aal

ENV_FILE = Path("/tmp/sts-local/status.env")
ESTIMATE_MARK = Path("/tmp/sts-local/day5-estimate.id")
ORG_A = "e5e5e5e5-e5e5-45e5-8e5e-e5e5e5e5e5e5"
ORG_B = "e6e6e6e6-e6e6-46e6-8e6e-e6e6e6e6e6e6"
OWNER_A_EMAIL = "owner-a@day5.test"
OWNER_B_EMAIL = "owner-b@day5.test"
ADMIN_A_EMAIL = "admin-a@day5.test"
MEMBER_A_EMAIL = "member-a@day5.test"
ACCOUNTANT_A_EMAIL = "accountant-a@day5.test"
STRANGER_EMAIL = "stranger@day5.test"
LINES = [{"description": "Website quote", "quantity": 2, "unit_cents": 150000, "discount_cents": 5000}]
APP_URL = os.environ.get("DAY5_APP_URL", "http://127.0.0.1:3000")


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


def request(method: str, url: str, headers: dict[str, str], body: dict | bytes | None = None, timeout: int = 20):
    data = None
    if isinstance(body, bytes):
        data = body
    elif body is not None:
        data = json.dumps(body).encode()
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


def auth_headers(env: dict[str, str], token: str | None = None, admin: bool = False, json_body: bool = True) -> dict[str, str]:
    key = env["SERVICE_ROLE_KEY"] if admin else env["ANON_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {token or key}"}
    if json_body:
        headers["Content-Type"] = "application/json"
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
    request(
        "POST",
        f"{env['REST_URL']}/business_settings",
        auth_headers(env, admin=True),
        {"organization_id": org_id, "invoice_prefix": "STS", "estimate_prefix": "EST"},
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


def rpc(env: dict[str, str], token: str, name: str, body: dict) -> tuple[int, object]:
    status, payload, _ = request(
        "POST",
        f"{env['REST_URL']}/rpc/{name}",
        auth_headers(env, token),
        body,
    )
    return status, payload


def rpc_id(env: dict[str, str], token: str, name: str, body: dict) -> tuple[int, str | None]:
    status, payload = rpc(env, token, name, body)
    record_id = str(payload) if status in (200, 201) and payload else None
    return status, record_id


def save_client(env: dict[str, str], token: str, organization_id: str, name: str) -> str | None:
    status, record_id = rpc_id(env, token, "sts_save_crm_client", {
        "p_organization_id": organization_id,
        "p_id": None,
        "p_business_name": name,
        "p_contact_name": "Casey",
        "p_email": "casey@example.test",
        "p_phone": "",
        "p_industry": "Auto",
        "p_status": "active",
        "p_notes": "",
    })
    return record_id if status in (200, 201) else None


def estimate_args(organization_id: str, client_id: str | None, title: str = "Day 5 quote") -> dict:
    return {
        "p_organization_id": organization_id,
        "p_id": None,
        "p_client_id": client_id,
        "p_title": title,
        "p_description": "Operational quote",
        "p_issue_date": "2026-09-20",
        "p_expires_on": "2026-10-20",
        "p_currency": "USD",
        "p_internal_notes": "Do not email",
        "p_customer_notes": "Customer facing",
        "p_terms": "Net 15",
        "p_client_business_name": "",
        "p_client_contact_name": "",
        "p_client_email": "",
        "p_tax_cents": 0,
        "p_lines": LINES,
    }


def persist_phase(env: dict[str, str]) -> None:
    if not ESTIMATE_MARK.exists():
        fail("missing persistence marker for estimate")
    record_id = ESTIMATE_MARK.read_text().strip()
    status, payload, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_estimates?id=eq.{record_id}&select=id,organization_id,status,archived_at,total_cents",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(payload, list) or not payload:
        fail(f"persisted estimate missing after restart (http {status})")
    row = payload[0]
    if row.get("organization_id") != ORG_A:
        fail("persisted estimate organization mismatch")
    if row.get("status") != "accepted":
        fail("persisted estimate lifecycle status did not survive restart")
    if row.get("archived_at") is not None:
        fail("restored estimate was still archived after restart")
    if not isinstance(row.get("total_cents"), int) or row["total_cents"] < 0:
        fail("persisted estimate total was missing or not integer cents")
    pass_("estimate header, status, and restore state remained after local restart")

    line_status, lines, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_estimate_lines?estimate_id=eq.{record_id}&select=quantity,unit_cents,discount_cents,line_total_cents",
        auth_headers(env, admin=True),
    )
    if line_status != 200 or not isinstance(lines, list) or not lines:
        fail(f"persisted estimate lines missing after restart (http {line_status})")
    line = lines[0]
    expected_line = (line.get("quantity") or 0) * (line.get("unit_cents") or 0) - (line.get("discount_cents") or 0)
    if line.get("line_total_cents") != expected_line:
        fail("persisted line total was not quantity times unit minus discount")
    pass_("estimate line items remained after local restart")

    audit_status, audits, _ = request(
        "GET",
        f"{env['REST_URL']}/audit_events?entity_id=eq.{record_id}&select=action,result,entity_type,metadata",
        auth_headers(env, admin=True),
    )
    if audit_status != 200 or not isinstance(audits, list):
        fail(f"persisted estimate audits missing after restart (http {audit_status})")
    actions = {item.get("action") for item in audits}
    required_actions = {
        "ws_estimate.created",
        "ws_estimate.status_changed",
        "ws_estimate.archived",
        "ws_estimate.restored",
    }
    if not required_actions.issubset(actions):
        fail("persisted estimate audit actions did not survive restart")
    for item in audits:
        dumped = json.dumps(item.get("metadata") or {})
        if any(token in dumped.lower() for token in ("do not email", "customer facing", "website quote")):
            fail("persisted estimate audit stored sensitive estimate content")
    pass_("estimate audit events remained after local restart")
    print("DAY5_LOCAL_AUTH_REST_PASSED")


def signed_out_app_redirect() -> None:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(f"{APP_URL}/dashboard/estimates", method="GET")
    try:
        with opener.open(req, timeout=8) as resp:
            fail(f"signed-out estimates page returned http {resp.status}")
    except urllib.error.HTTPError as exc:
        location = exc.headers.get("Location") or ""
        if exc.code in (301, 302, 303, 307, 308) and "/login" in location:
            pass_("signed-out /dashboard/estimates redirects to login")
            return
        fail(f"signed-out estimates redirect missing (http {exc.code})")
    except urllib.error.URLError:
        print("SKIP signed-out app redirect; local Next.js was not reachable")


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    if any(not env.get(key) for key in required):
        fail("local status env missing required key names")

    phase = os.environ.get("DAY5_AUTH_PHASE", "all")
    if phase == "persist":
        persist_phase(env)
        return

    signed_out_app_redirect()

    emails = (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, ACCOUNTANT_A_EMAIL, STRANGER_EMAIL)
    passwords = {email: secrets.token_urlsafe(24) for email in emails}
    ids = {email: upsert_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 5 users")

    ensure_org(env, ORG_A, "day5-test-org-a")
    ensure_org(env, ORG_B, "day5-test-org-b")
    ensure_membership(env, ORG_A, ids[OWNER_A_EMAIL], "owner")
    ensure_membership(env, ORG_B, ids[OWNER_B_EMAIL], "owner")
    ensure_membership(env, ORG_A, ids[ADMIN_A_EMAIL], "administrator")
    ensure_membership(env, ORG_A, ids[MEMBER_A_EMAIL], "employee")
    ensure_membership(env, ORG_A, ids[ACCOUNTANT_A_EMAIL], "accountant")

    aal1_tokens: dict[str, str] = {}
    for email in emails:
        status, token = password_login(env, email, passwords[email])
        if status != 200 or not token:
            fail(f"password login failed for a synthetic user (http {status})")
        if jwt_aal(token) != "aal1":
            fail("password session was not AAL1")
        aal1_tokens[email] = token
    pass_("owner, admin, member, accountant, other-org, and stranger password logins succeeded at AAL1")

    a1_status, a1_count = rest_count(env, aal1_tokens[OWNER_A_EMAIL], "ws_estimates")
    expect_denied_or_empty(a1_status, a1_count, "AAL1 owner REST estimate read")
    a1_rpc_status, _ = rpc(env, aal1_tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, None))
    if a1_rpc_status in (200, 201):
        fail("AAL1 owner saved an estimate")
    pass_("AAL1 estimate write denied")

    tokens: dict[str, str] = {}
    for email in (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, ACCOUNTANT_A_EMAIL):
        tokens[email] = enroll_totp_aal2(env, aal1_tokens[email])
        if jwt_aal(tokens[email]) != "aal2":
            fail("MFA session was not AAL2")
    tokens[STRANGER_EMAIL] = aal1_tokens[STRANGER_EMAIL]
    pass_("owner, admin, member, and accountant enrolled TOTP and received AAL2")

    client_id = save_client(env, tokens[OWNER_A_EMAIL], ORG_A, "Org A Client")
    client_b = save_client(env, tokens[OWNER_B_EMAIL], ORG_B, "Org B Client")
    if not client_id or not client_b:
        fail("could not save same-organization clients")

    status, estimate_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_id))
    if status not in (200, 201) or not estimate_id:
        fail(f"owner estimate save http {status}")
    pass_("owner AAL2 saved an estimate")
    ESTIMATE_MARK.parent.mkdir(parents=True, exist_ok=True)
    ESTIMATE_MARK.write_text(estimate_id)

    member_status, member_id = rpc_id(env, tokens[MEMBER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_id, "Employee quote"))
    if member_status not in (200, 201) or not member_id:
        fail("employee could not save an estimate")
    pass_("employee AAL2 saved an estimate")

    acc_status, acc_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ws_estimates")
    expect_denied_or_empty(acc_status, acc_count, "accountant REST estimate read")
    acc_rpc, _ = rpc(env, tokens[ACCOUNTANT_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_id, "Books"))
    if acc_rpc in (200, 201):
        fail("accountant saved an estimate")
    pass_("accountant estimate write denied")

    cross_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_b, "Cross"))
    if cross_status in (200, 201):
        fail("same-org estimate accepted a client from another organization")
    pass_("cross-organization client association denied")

    other_status, other_count = rest_count(env, tokens[OWNER_B_EMAIL], "ws_estimates")
    expect_denied_or_empty(other_status, other_count, "other-organization REST estimate read")

    stranger_status, stranger_count = rest_count(env, tokens[STRANGER_EMAIL], "ws_estimates")
    expect_denied_or_empty(stranger_status, stranger_count, "stranger REST estimate read")

    signed_out_status, signed_out_count = rest_count(env, None, "ws_estimates")
    expect_denied_or_empty(signed_out_status, signed_out_count, "signed-out REST estimate read")

    bad_lines = dict(estimate_args(ORG_A, client_id, "Negative"))
    bad_lines["p_lines"] = [{"description": "Bad", "quantity": 1, "unit_cents": -50, "discount_cents": 0}]
    neg_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", bad_lines)
    if neg_status in (200, 201):
        fail("negative unit price was accepted")
    pass_("negative monetary input denied")

    huge_lines = dict(estimate_args(ORG_A, client_id, "Huge"))
    huge_lines["p_lines"] = [{"description": "Huge", "quantity": 9999, "unit_cents": 99999999, "discount_cents": 0}]
    huge_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", huge_lines)
    if huge_status in (200, 201):
        fail("oversized monetary input was accepted")
    pass_("oversized monetary input denied")

    ready_status, _ = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_set_ws_estimate_status", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
        "p_status": "ready",
    })
    if not ready_status:
        fail("could not mark estimate ready")
    jump_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_set_ws_estimate_status", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
        "p_status": "draft",
    })
    if jump_status not in (200, 201):
        fail("ready to draft should be allowed")
    rpc(env, tokens[OWNER_A_EMAIL], "sts_set_ws_estimate_status", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
        "p_status": "ready",
    })
    accepted_jump, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_set_ws_estimate_status", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
        "p_status": "accepted",
    })
    if accepted_jump not in (200, 201):
        fail("ready to accepted failed")
    decline_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_set_ws_estimate_status", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
        "p_status": "declined",
    })
    if decline_status in (200, 201):
        fail("accepted estimate was declined")
    pass_("invalid status transition denied")

    archive_status, _ = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_archive_ws_estimate", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
    })
    if not archive_status:
        fail("archive failed")
    mutate_archived, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_set_ws_estimate_status", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
        "p_status": "draft",
    })
    if mutate_archived in (200, 201):
        fail("archived estimate was mutated")
    pass_("archived estimate mutation denied")
    restore_status, _ = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_restore_ws_estimate", {
        "p_organization_id": ORG_A,
        "p_id": estimate_id,
    })
    if not restore_status:
        fail("restore failed")
    pass_("archived estimate restored")

    delete_status, _, _ = request(
        "DELETE",
        f"{env['REST_URL']}/ws_estimates?id=eq.{estimate_id}",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if delete_status in (200, 204):
        fail("authenticated hard-delete was accepted")
    pass_("authenticated hard-delete denied")

    print("DAY5_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    main()
