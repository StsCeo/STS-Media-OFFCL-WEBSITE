#!/usr/bin/env python3
"""Day 4 local Auth + REST + Storage RLS checks. Never prints secrets or tokens."""
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
from local_aal import enroll_totp_aal2, expect_denied_or_empty, jwt_aal, upsert_auth_user

ENV_FILE = Path("/tmp/sts-local/status.env")
NOTE_MARK = Path("/tmp/sts-local/day4-note.id")
EVENT_MARK = Path("/tmp/sts-local/day4-event.id")
DOC_MARK = Path("/tmp/sts-local/day4-document.id")
INVOICE_MARK = Path("/tmp/sts-local/day4-invoice.id")
ORG_A = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4"
ORG_B = "d5d5d5d5-d5d5-45d5-8d5d-d5d5d5d5d5d5"
OWNER_A_EMAIL = "owner-a@day4.test"
OWNER_B_EMAIL = "owner-b@day4.test"
ADMIN_A_EMAIL = "admin-a@day4.test"
MEMBER_A_EMAIL = "member-a@day4.test"
ACCOUNTANT_A_EMAIL = "accountant-a@day4.test"
STRANGER_EMAIL = "stranger@day4.test"


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
    return upsert_auth_user(env, email, password)


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
        {"organization_id": org_id, "invoice_prefix": "STS"},
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


def persist_phase(env: dict[str, str]) -> None:
    checks = (
        (NOTE_MARK, "note", "ws_notes"),
        (EVENT_MARK, "event", "ws_calendar_events"),
        (DOC_MARK, "document", "ws_documents"),
        (INVOICE_MARK, "invoice", "ws_invoices"),
    )
    for marker, label, table in checks:
        if not marker.exists():
            fail(f"missing persistence marker for {label}")
        record_id = marker.read_text().strip()
        status, payload, _ = request(
            "GET",
            f"{env['REST_URL']}/{table}?id=eq.{record_id}&select=id,organization_id",
            auth_headers(env, admin=True),
        )
        if status != 200 or not isinstance(payload, list) or not payload:
            fail(f"persisted {label} missing after restart (http {status})")
        if payload[0].get("organization_id") != ORG_A:
            fail(f"persisted {label} organization mismatch")
        pass_(f"{label} remained after local restart")
    print("DAY4_LOCAL_AUTH_REST_PASSED")


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    if any(not env.get(key) for key in required):
        fail("local status env missing required key names")

    phase = os.environ.get("DAY4_AUTH_PHASE", "all")
    if phase == "persist":
        persist_phase(env)
        return

    emails = (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, ACCOUNTANT_A_EMAIL, STRANGER_EMAIL)
    passwords = {email: secrets.token_urlsafe(24) for email in emails}
    ids = {email: upsert_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 4 users")

    ensure_org(env, ORG_A, "day4-test-org-a")
    ensure_org(env, ORG_B, "day4-test-org-b")
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

    for table in ("ws_notes", "ws_documents", "ws_calendar_events", "ws_invoices", "ws_invoice_lines"):
        o1_status, o1_count = rest_count(env, aal1_tokens[OWNER_A_EMAIL], table)
        expect_denied_or_empty(o1_status, o1_count, f"owner A AAL1 REST cannot read {table}")
    note_aal1, _ = rpc_id(env, aal1_tokens[OWNER_A_EMAIL], "sts_save_ws_note", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_title": "AAL1 note",
        "p_body": "Nope",
        "p_related_type": "none",
        "p_related_id": None,
        "p_pinned": False,
    })
    if note_aal1 in (200, 201):
        fail("owner A AAL1 note save unexpectedly succeeded")
    pass_(f"owner A AAL1 REST note RPC denied (http {note_aal1})")
    a1_upload_headers = auth_headers(env, aal1_tokens[OWNER_A_EMAIL], json_body=False)
    a1_upload_headers["Content-Type"] = "text/plain"
    a1_upload_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{ORG_A}/{uuid.uuid4()}/aal1.txt",
        a1_upload_headers,
        b"aal1 should not upload\n",
    )
    if a1_upload_status in (200, 201):
        fail("owner A AAL1 storage upload unexpectedly succeeded")
    pass_(f"owner A AAL1 storage upload denied (http {a1_upload_status})")

    tokens: dict[str, str] = {STRANGER_EMAIL: aal1_tokens[STRANGER_EMAIL]}
    for email in (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, ACCOUNTANT_A_EMAIL):
        tokens[email] = enroll_totp_aal2(env, aal1_tokens[email])
        if jwt_aal(tokens[email]) != "aal2":
            fail("MFA verify did not raise AAL2")
    pass_("member sessions upgraded to AAL2")

    for table in ("ws_notes", "ws_documents", "ws_calendar_events", "ws_invoices", "ws_invoice_lines"):
        anon_status, anon_count = rest_count(env, None, table)
        if anon_status in (401, 403) or (anon_status == 200 and anon_count == 0):
            pass_(f"signed-out REST cannot read {table}")
        else:
            fail(f"anon REST {table} http {anon_status} count {anon_count}")
        s_status, s_count = rest_count(env, tokens[STRANGER_EMAIL], table)
        if s_status == 200 and s_count == 0:
            pass_(f"authenticated user without membership sees zero {table}")
        elif s_status in (401, 403):
            pass_(f"authenticated user without membership is denied {table}")
        else:
            fail(f"stranger REST {table} http {s_status} count {s_count}")

    client_id = save_client(env, tokens[OWNER_A_EMAIL], ORG_A, "Day4 Persist Client")
    if not client_id:
        fail("owner A could not save a CRM client for invoice tests")

    note_status, note_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_note", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_title": "Persist note",
        "p_body": "Harmless <b>markup</b>",
        "p_related_type": "none",
        "p_related_id": None,
        "p_pinned": True,
    })
    if note_status not in (200, 201) or not note_id:
        fail(f"owner A note save http {note_status}")
    pass_("owner A REST note save succeeded")

    event_status, event_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_calendar_event", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_title": "Persist event",
        "p_description": "Internal",
        "p_start_at": "2026-09-22T14:00:00Z",
        "p_end_at": "2026-09-22T15:00:00Z",
        "p_all_day": False,
        "p_timezone": "America/New_York",
        "p_client_id": client_id,
        "p_project_id": None,
        "p_location": "Office",
        "p_kind": "team_meeting",
    })
    if event_status not in (200, 201) or not event_id:
        fail(f"owner A calendar save http {event_status}")
    pass_("owner A REST calendar save succeeded")

    member_note_status, _ = rpc_id(env, tokens[MEMBER_A_EMAIL], "sts_save_ws_note", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_title": "Member note",
        "p_body": "Operational",
        "p_related_type": "none",
        "p_related_id": None,
        "p_pinned": False,
    })
    if member_note_status not in (200, 201):
        fail(f"employee note save http {member_note_status}")
    pass_("employee REST note save succeeded")

    member_invoice_status, _ = rpc_id(env, tokens[MEMBER_A_EMAIL], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_client_id": client_id,
        "p_issue_date": "2026-09-20",
        "p_due_date": "2026-10-05",
        "p_currency": "USD",
        "p_notes": "",
        "p_payment_instructions": "",
        "p_discount_cents": 0,
        "p_tax_cents": 0,
        "p_lines": [{"description": "Build", "quantity": 1, "unit_cents": 10000}],
    })
    if member_invoice_status in (200, 201):
        fail("employee was able to save an invoice")
    pass_("employee REST invoice save denied")

    accountant_invoice_status, _ = rpc_id(env, tokens[ACCOUNTANT_A_EMAIL], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_client_id": client_id,
        "p_issue_date": "2026-09-20",
        "p_due_date": "2026-10-05",
        "p_currency": "USD",
        "p_notes": "",
        "p_payment_instructions": "",
        "p_discount_cents": 0,
        "p_tax_cents": 0,
        "p_lines": [{"description": "Build", "quantity": 1, "unit_cents": 10000}],
    })
    if accountant_invoice_status in (200, 201):
        fail("accountant was able to save an invoice")
    pass_("accountant REST invoice write denied")

    invoice_status, invoice_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_client_id": client_id,
        "p_issue_date": "2026-09-20",
        "p_due_date": "2026-10-05",
        "p_currency": "USD",
        "p_notes": "",
        "p_payment_instructions": "Mail a check. Not collected here.",
        "p_discount_cents": 0,
        "p_tax_cents": 500,
        "p_lines": [
            {"description": "Website build", "quantity": 2, "unit_cents": 150000},
            {"description": "Launch support", "quantity": 1, "unit_cents": 25000},
        ],
    })
    if invoice_status not in (200, 201) or not invoice_id:
        fail(f"owner A invoice save http {invoice_status}")
    status, payload, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?id=eq.{invoice_id}&select=subtotal_cents,total_cents,tax_cents,status",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if status != 200 or not isinstance(payload, list) or not payload:
        fail("could not read saved invoice totals")
    if payload[0].get("subtotal_cents") != 325000 or payload[0].get("total_cents") != 325500:
        fail("server invoice totals did not match integer-cent calculation")
    pass_("owner A REST invoice save used server-calculated totals")

    admin_read_status, admin_count = rest_count(env, tokens[ADMIN_A_EMAIL], "ws_invoices")
    if admin_read_status != 200 or not admin_count:
        fail("administrator could not read invoices")
    pass_("administrator REST invoice read succeeded")

    acc_read_status, acc_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ws_invoices")
    if acc_read_status != 200 or not acc_count:
        fail("accountant could not read invoices")
    pass_("accountant REST invoice read succeeded")

    b_status, b_count = rest_count(env, tokens[OWNER_B_EMAIL], "ws_invoices")
    if b_status == 200 and b_count == 0:
        pass_("other-organization owner sees zero org A invoices")
    elif b_status in (401, 403):
        pass_("other-organization owner is denied org A invoices")
    else:
        fail(f"cross-org invoice leak http {b_status} count {b_count}")

    delete_status, _, _ = request(
        "DELETE",
        f"{env['REST_URL']}/ws_notes?id=eq.{note_id}",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if delete_status not in (401, 403, 405):
        remaining_status, remaining, _ = request(
            "GET",
            f"{env['REST_URL']}/ws_notes?id=eq.{note_id}&select=id",
            auth_headers(env, admin=True),
        )
        if remaining_status == 200 and isinstance(remaining, list) and remaining:
            pass_("owner REST hard-delete did not remove the note")
        else:
            fail(f"owner REST hard-delete notes http {delete_status}")
    else:
        pass_("owner REST hard-delete notes denied")

    document_id = str(uuid.uuid4())
    storage_path = f"{ORG_A}/{document_id}/day4-harmless.txt"
    upload_headers = auth_headers(env, tokens[OWNER_A_EMAIL], json_body=False)
    upload_headers["Content-Type"] = "text/plain"
    upload_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{storage_path}",
        upload_headers,
        b"harmless day4 document\n",
    )
    if upload_status not in (200, 201):
        fail(f"owner storage upload http {upload_status}")
    pass_("owner storage upload of a harmless text file succeeded")

    html_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{ORG_A}/{document_id}/bad.html",
        upload_headers,
        b"<html><script>alert(1)</script></html>",
    )
    if html_status in (200, 201):
        fail("HTML upload was accepted")
    pass_("disallowed HTML upload rejected")

    traversal_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{ORG_A}/../secret.txt",
        upload_headers,
        b"nope",
    )
    if traversal_status in (200, 201):
        fail("path traversal upload was accepted")
    pass_("path traversal upload rejected")

    cross_headers = auth_headers(env, tokens[OWNER_B_EMAIL], json_body=False)
    cross_headers["Content-Type"] = "text/plain"
    cross_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{storage_path}",
        cross_headers,
        b"cross",
    )
    if cross_status in (200, 201):
        fail("other-organization user uploaded into org A storage")
    pass_("cross-organization storage upload denied")

    list_status, list_payload, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/list/org-documents",
        auth_headers(env, tokens[OWNER_B_EMAIL]),
        {"prefix": f"{ORG_A}/", "limit": 100},
    )
    listed = list_payload if isinstance(list_payload, list) else []
    if list_status in (200, 201) and listed:
        fail("other-organization user listed org A storage objects")
    pass_("cross-organization storage listing is empty or denied")

    exe_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{ORG_A}/{document_id}/run.exe",
        upload_headers,
        b"MZ",
    )
    if exe_status in (200, 201):
        fail("executable upload was accepted")
    pass_("executable upload rejected")

    oversized = b"a" * (8 * 1024 * 1024 + 1)
    big_headers = auth_headers(env, tokens[OWNER_A_EMAIL], json_body=False)
    big_headers["Content-Type"] = "text/plain"
    big_status, _, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{ORG_A}/{document_id}/huge.txt",
        big_headers,
        oversized,
    )
    if big_status in (200, 201):
        fail("oversized upload was accepted")
    pass_("oversized upload rejected")

    doc_status, doc_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_document", {
        "p_organization_id": ORG_A,
        "p_id": document_id,
        "p_storage_path": storage_path,
        "p_display_filename": "day4-harmless.txt",
        "p_content_type": "text/plain",
        "p_byte_size": 22,
        "p_description": "Harmless generated file",
        "p_category": "other",
        "p_client_id": client_id,
        "p_project_id": None,
    })
    if doc_status not in (200, 201) or not doc_id:
        fail(f"document metadata save http {doc_status}")
    pass_("document metadata saved after private upload")

    acc_doc_status, acc_doc_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ws_documents")
    if acc_doc_status != 200 or not acc_doc_count:
        fail("accountant could not read document metadata")
    pass_("accountant REST document read succeeded")

    a1_get_status, _, _ = request(
        "GET",
        f"{env['API_URL']}/storage/v1/object/org-documents/{storage_path}",
        auth_headers(env, aal1_tokens[OWNER_A_EMAIL], json_body=False),
    )
    if a1_get_status in (200, 201):
        fail("owner A AAL1 storage download unexpectedly succeeded")
    pass_(f"owner A AAL1 storage download denied (http {a1_get_status})")

    a1_retry, _ = rpc_id(env, aal1_tokens[OWNER_A_EMAIL], "sts_save_ws_note", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_title": "AAL1 retry",
        "p_body": "Nope",
        "p_related_type": "none",
        "p_related_id": None,
        "p_pinned": False,
    })
    if a1_retry in (200, 201):
        fail("direct AAL1 RPC retry unexpectedly succeeded")
    pass_(f"direct AAL1 RPC retry remains denied (http {a1_retry})")

    NOTE_MARK.write_text(note_id)
    EVENT_MARK.write_text(event_id)
    DOC_MARK.write_text(doc_id)
    INVOICE_MARK.write_text(invoice_id)
    print("DAY4_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    main()
