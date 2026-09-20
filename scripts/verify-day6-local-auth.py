#!/usr/bin/env python3
"""Day 6 local Auth + REST conversion checks. Never prints secrets or tokens."""
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
ESTIMATE_MARK = Path("/tmp/sts-local/day6-estimate.id")
INVOICE_MARK = Path("/tmp/sts-local/day6-invoice.id")
ORG_A = "a6a6a6a6-a6a6-46a6-86a6-a6a6a6a6a6a6"
ORG_B = "b6b6b6b6-b6b6-46b6-86b6-b6b6b6b6b6b6"
OWNER_A_EMAIL = "owner-a@day6.test"
OWNER_B_EMAIL = "owner-b@day6.test"
ADMIN_A_EMAIL = "admin-a@day6.test"
MEMBER_A_EMAIL = "member-a@day6.test"
ACCOUNTANT_A_EMAIL = "accountant-a@day6.test"
STRANGER_EMAIL = "stranger@day6.test"
LINES = [{"description": "Website quote", "quantity": 2, "unit_cents": 150000, "discount_cents": 5000}]
APP_URL = os.environ.get("DAY6_APP_URL", "http://127.0.0.1:3000")


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


def estimate_args(organization_id: str, client_id: str | None, title: str = "Day 6 quote") -> dict:
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
        "p_client_business_name": "Org A Client",
        "p_client_contact_name": "Casey",
        "p_client_email": "casey@example.test",
        "p_tax_cents": 0,
        "p_lines": LINES,
    }


def set_status(env: dict[str, str], token: str, organization_id: str, estimate_id: str, status_name: str) -> int:
    status, _ = rpc(env, token, "sts_set_ws_estimate_status", {
        "p_organization_id": organization_id,
        "p_id": estimate_id,
        "p_status": status_name,
    })
    return status


def persist_phase(env: dict[str, str]) -> None:
    if not ESTIMATE_MARK.exists() or not INVOICE_MARK.exists():
        fail("missing persistence marker for converted invoice")
    estimate_id = ESTIMATE_MARK.read_text().strip()
    invoice_id = INVOICE_MARK.read_text().strip()
    status, payload, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?id=eq.{invoice_id}&select=id,organization_id,status,source_estimate_id,source_estimate_number,subtotal_cents,discount_cents,tax_cents,total_cents,client_business_name,notes,payment_instructions",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(payload, list) or not payload:
        fail(f"persisted converted invoice missing after restart (http {status})")
    row = payload[0]
    if row.get("organization_id") != ORG_A:
        fail("persisted invoice organization mismatch")
    if row.get("status") != "draft":
        fail("converted invoice was not still a draft after restart")
    if row.get("source_estimate_id") != estimate_id:
        fail("persisted source_estimate_id did not survive restart")
    if row.get("subtotal_cents") != 300000 or row.get("discount_cents") != 5000 or row.get("total_cents") != 295000:
        fail("persisted converted totals were not integer cents")
    if row.get("client_business_name") != "Org A Client":
        fail("persisted customer snapshot missing after restart")
    pass_("converted draft invoice header, totals, and source link remained after local restart")

    line_status, lines, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoice_lines?invoice_id=eq.{invoice_id}&select=quantity,unit_cents,line_total_cents,description",
        auth_headers(env, admin=True),
    )
    if line_status != 200 or not isinstance(lines, list) or not lines:
        fail(f"persisted invoice lines missing after restart (http {line_status})")
    line = lines[0]
    if line.get("line_total_cents") != (line.get("quantity") or 0) * (line.get("unit_cents") or 0):
        fail("persisted invoice line total was not quantity times unit")
    pass_("converted invoice line items remained after local restart")

    audit_status, audits, _ = request(
        "GET",
        f"{env['REST_URL']}/audit_events?entity_id=eq.{estimate_id}&action=eq.estimate.converted_to_invoice&select=action,result,entity_type,metadata",
        auth_headers(env, admin=True),
    )
    if audit_status != 200 or not isinstance(audits, list) or not audits:
        fail(f"persisted conversion audit missing after restart (http {audit_status})")
    for item in audits:
        dumped = json.dumps(item.get("metadata") or {})
        if any(token in dumped.lower() for token in ("do not email", "customer facing", "website quote", "net 15")):
            fail("persisted conversion audit stored notes or line content")
        meta = item.get("metadata") or {}
        if "invoice_id" not in meta:
            fail("persisted conversion audit missing invoice identifier")
    pass_("conversion audit remained after local restart without customer content")
    print("DAY6_LOCAL_AUTH_REST_PASSED")


def signed_out_app_redirect() -> None:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    paths = (
        "/dashboard/estimates",
        "/dashboard/estimates/00000000-0000-4000-8000-000000000000/print",
        "/dashboard/invoices/00000000-0000-4000-8000-000000000000/print",
    )
    for path in paths:
        req = urllib.request.Request(f"{APP_URL}{path}", method="GET")
        try:
            with opener.open(req, timeout=8) as resp:
                fail(f"signed-out {path} returned http {resp.status}")
        except urllib.error.HTTPError as exc:
            location = exc.headers.get("Location") or ""
            if exc.code in (301, 302, 303, 307, 308) and "/login" in location:
                pass_(f"signed-out {path} redirects to login")
                continue
            fail(f"signed-out {path} redirect missing (http {exc.code})")
        except urllib.error.URLError:
            print(f"SKIP signed-out app redirect for {path}; local Next.js was not reachable")
            return


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    if any(not env.get(key) for key in required):
        fail("local status env missing required key names")

    phase = os.environ.get("DAY6_AUTH_PHASE", "all")
    if phase == "persist":
        persist_phase(env)
        return

    signed_out_app_redirect()

    emails = (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, ACCOUNTANT_A_EMAIL, STRANGER_EMAIL)
    passwords = {email: secrets.token_urlsafe(24) for email in emails}
    ids = {email: upsert_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 6 users")

    ensure_org(env, ORG_A, "day6-test-org-a")
    ensure_org(env, ORG_B, "day6-test-org-b")
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

    a1_status, a1_count = rest_count(env, aal1_tokens[OWNER_A_EMAIL], "ws_invoices")
    expect_denied_or_empty(a1_status, a1_count, "AAL1 owner REST invoice read")
    a1_rpc_status, _ = rpc(env, aal1_tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": ORG_A,
    })
    if a1_rpc_status in (200, 201):
        fail("AAL1 owner converted an estimate")
    pass_("AAL1 conversion denied")

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
    ESTIMATE_MARK.parent.mkdir(parents=True, exist_ok=True)
    ESTIMATE_MARK.write_text(estimate_id)

    draft_convert, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": estimate_id,
    })
    if draft_convert in (200, 201):
        fail("draft estimate was converted")
    pass_("draft estimate conversion denied")

    if set_status(env, tokens[OWNER_A_EMAIL], ORG_A, estimate_id, "ready") not in (200, 201):
        fail("could not mark estimate ready")
    ready_convert, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": estimate_id,
    })
    if ready_convert in (200, 201):
        fail("ready estimate was converted")
    pass_("ready estimate conversion denied")

    if set_status(env, tokens[OWNER_A_EMAIL], ORG_A, estimate_id, "accepted") not in (200, 201):
        fail("could not mark estimate accepted")

    convert_status, invoice_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": estimate_id,
    })
    if convert_status not in (200, 201) or not invoice_id:
        fail(f"accepted estimate conversion http {convert_status}")
    INVOICE_MARK.write_text(invoice_id)
    pass_("accepted estimate converted to a draft invoice")

    again_status, again_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": estimate_id,
    })
    if again_status not in (200, 201) or again_id != invoice_id:
        fail("repeated conversion did not return the existing invoice")
    count_status, payload, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?source_estimate_id=eq.{estimate_id}&select=id",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if count_status != 200 or not isinstance(payload, list) or len(payload) != 1:
        fail("repeated conversion created a duplicate invoice")
    pass_("conversion is idempotent")

    inv_status, invoices, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?id=eq.{invoice_id}&select=status,source_estimate_id,source_estimate_number,subtotal_cents,discount_cents,tax_cents,total_cents,notes,payment_instructions,client_business_name,org_display_name",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if inv_status != 200 or not isinstance(invoices, list) or not invoices:
        fail("could not read converted invoice")
    invoice = invoices[0]
    if invoice.get("status") != "draft":
        fail("conversion did not create a draft invoice")
    if invoice.get("source_estimate_id") != estimate_id:
        fail("converted invoice missing source_estimate_id")
    if invoice.get("subtotal_cents") != 300000 or invoice.get("discount_cents") != 5000 or invoice.get("total_cents") != 295000:
        fail("converted totals were not recalculated as integer cents")
    if invoice.get("notes") != "Customer facing" or invoice.get("payment_instructions") != "Net 15":
        fail("converted invoice did not snapshot notes and terms")
    if invoice.get("client_business_name") != "Org A Client":
        fail("converted invoice did not snapshot customer information")
    pass_("converted invoice snapshotted customer, terms, notes, and integer-cent totals")

    member_convert, _ = rpc(env, tokens[MEMBER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": estimate_id,
    })
    if member_convert in (200, 201):
        fail("employee converted an estimate to an invoice")
    pass_("employee conversion denied")

    acc_convert, _ = rpc(env, tokens[ACCOUNTANT_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": estimate_id,
    })
    if acc_convert in (200, 201):
        fail("accountant converted an estimate to an invoice")
    pass_("accountant conversion denied")

    cross_convert, _ = rpc(env, tokens[OWNER_B_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_B,
        "p_estimate_id": estimate_id,
    })
    if cross_convert in (200, 201):
        fail("cross-organization conversion succeeded")
    other_status, other_count = rest_count(env, tokens[OWNER_B_EMAIL], "ws_invoices")
    expect_denied_or_empty(other_status, other_count, "other-organization REST invoice read")
    pass_("cross-organization conversion and invoice read denied")

    stranger_status, stranger_count = rest_count(env, tokens[STRANGER_EMAIL], "ws_invoices")
    expect_denied_or_empty(stranger_status, stranger_count, "stranger REST invoice read")
    signed_out_status, signed_out_count = rest_count(env, None, "ws_invoices")
    expect_denied_or_empty(signed_out_status, signed_out_count, "signed-out REST invoice read")

    declined_id_status, declined_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_id, "Declined quote"))
    if not declined_id:
        fail("could not save declined fixture")
    set_status(env, tokens[OWNER_A_EMAIL], ORG_A, declined_id, "ready")
    set_status(env, tokens[OWNER_A_EMAIL], ORG_A, declined_id, "declined")
    declined_convert, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": declined_id,
    })
    if declined_convert in (200, 201):
        fail("declined estimate was converted")
    pass_("declined estimate conversion denied")

    expired_id_status, expired_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_id, "Expired quote"))
    if not expired_id:
        fail("could not save expired fixture")
    set_status(env, tokens[OWNER_A_EMAIL], ORG_A, expired_id, "ready")
    set_status(env, tokens[OWNER_A_EMAIL], ORG_A, expired_id, "expired")
    expired_convert, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": expired_id,
    })
    if expired_convert in (200, 201):
        fail("expired estimate was converted")
    pass_("expired estimate conversion denied")

    archived_id_status, archived_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_id, "Archived accepted"))
    if not archived_id:
        fail("could not save archived fixture")
    set_status(env, tokens[OWNER_A_EMAIL], ORG_A, archived_id, "ready")
    set_status(env, tokens[OWNER_A_EMAIL], ORG_A, archived_id, "accepted")
    archive_status, _ = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_archive_ws_estimate", {
        "p_organization_id": ORG_A,
        "p_id": archived_id,
    })
    if not archive_status:
        fail("archive failed")
    archived_convert, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": archived_id,
    })
    if archived_convert in (200, 201):
        fail("archived accepted estimate was converted")
    pass_("archived estimate conversion denied")

    delete_status, _, _ = request(
        "DELETE",
        f"{env['REST_URL']}/ws_invoices?id=eq.{invoice_id}",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if delete_status in (200, 204):
        fail("authenticated hard-delete of converted invoice was accepted")
    est_delete, _, _ = request(
        "DELETE",
        f"{env['REST_URL']}/ws_estimates?id=eq.{estimate_id}",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if est_delete in (200, 204):
        fail("authenticated hard-delete of estimate was accepted")
    pass_("authenticated hard-delete denied")

    audit_status, audits, _ = request(
        "GET",
        f"{env['REST_URL']}/audit_events?entity_id=eq.{estimate_id}&action=eq.estimate.converted_to_invoice&select=action,result,metadata",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if audit_status != 200 or not isinstance(audits, list) or not audits:
        fail("conversion audit missing")
    dumped = json.dumps(audits)
    if any(token in dumped.lower() for token in ("do not email", "customer facing", "website quote")):
        fail("conversion audit stored notes or line descriptions")
    if "invoice_id" not in dumped:
        fail("conversion audit missing invoice identifier")
    pass_("conversion audit stores identifiers only")

    print("DAY6_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    main()
