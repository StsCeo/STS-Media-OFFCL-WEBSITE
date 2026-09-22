#!/usr/bin/env python3
"""Hosted staging Auth, REST, RLS, and storage checks for Day 11 Phase 2.

Reuses scripts/local_aal.py for password sessions and TOTP. Reads API URL,
publishable key, and the disposable password from the process environment or
from DAY11_HOSTED_ENV (a mode-600 file outside the repository). Never prints
secrets, tokens, or environment values. Does not send mail. Does not call
application routes.
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import enroll_totp_aal2, expect_denied_or_empty, jwt_aal, jwt_claim

ORG_A = "a11a11a1-a11a-41a1-81a1-a11a11a11a11"
ORG_B = "b11b11b1-b11b-41b1-81b1-b11b11b11b11"
OWNER_A = "owner-a@day11.test"
OWNER_B = "owner-b@day11.test"
ADMIN_A = "admin-a@day11.test"
EMPLOYEE_A = "employee-a@day11.test"
ACCOUNTANT_A = "accountant-a@day11.test"
CLIENT_A = "client-a@day11.test"
CLIENT_INACTIVE = "client-inactive@day11.test"
CLIENT_B = "client-b@day11.test"
STRANGER = "stranger@day11.test"
TODAY = date.today().isoformat()
DUE = (date.today() + timedelta(days=14)).isoformat()
WITHHELD = ("notes", "payment_instructions", "internal_notes", "storage_path", "client_email")


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def pass_(msg: str) -> None:
    print(f"PASS {msg}")


def load_env() -> dict[str, str]:
    values = {
        "API_URL": os.environ.get("DAY11_API_URL", ""),
        "ANON_KEY": os.environ.get("DAY11_ANON_KEY", ""),
        "TEST_PASSWORD": os.environ.get("DAY11_TEST_PASSWORD", ""),
    }
    env_file = os.environ.get("DAY11_HOSTED_ENV", "")
    if env_file:
        path = Path(env_file)
        if not path.is_file():
            fail("hosted env file is missing")
        for line in path.read_text().splitlines():
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    if not values["API_URL"] or not values["ANON_KEY"] or not values["TEST_PASSWORD"]:
        fail("hosted runtime env is incomplete")
    if "SERVICE_ROLE" in values["ANON_KEY"] or values["ANON_KEY"].startswith("sb_secret"):
        fail("refusing to use a secret key as the publishable key")
    values["REST_URL"] = values["API_URL"].rstrip("/") + "/rest/v1"
    return values


def request(method: str, url: str, headers: dict[str, str], body: dict | bytes | None = None):
    import urllib.error
    import urllib.request

    data = None
    if isinstance(body, bytes):
        data = body
    elif body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            try:
                payload = json.loads(raw.decode() or "null") if raw else None
            except json.JSONDecodeError:
                payload = {"_non_json": True}
            return resp.status, payload, dict(resp.headers)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode() or "null") if raw else None
        except json.JSONDecodeError:
            payload = {"_non_json": True}
        return exc.code, payload, dict(exc.headers)


def headers(env: dict[str, str], token: str | None = None, json_body: bool = True) -> dict[str, str]:
    out = {
        "apikey": env["ANON_KEY"],
        "Authorization": f"Bearer {token or env['ANON_KEY']}",
    }
    if json_body:
        out["Content-Type"] = "application/json"
    return out


def login(env: dict[str, str], email: str) -> str:
    status, payload, _ = request(
        "POST",
        f"{env['API_URL']}/auth/v1/token?grant_type=password",
        headers(env),
        {"email": email, "password": env["TEST_PASSWORD"]},
    )
    token = payload.get("access_token") if isinstance(payload, dict) else None
    if isinstance(payload, dict):
        payload["access_token"] = "[redacted]"
        payload["refresh_token"] = "[redacted]"
    if status != 200 or not isinstance(token, str) or not token:
        fail(f"password login failed for {email} (http {status})")
    if jwt_aal(token) != "aal1":
        fail(f"password session for {email} was not AAL1")
    return token


def rpc(env: dict[str, str], token: str, name: str, body: dict | None = None):
    status, payload, _ = request(
        "POST",
        f"{env['REST_URL']}/rpc/{name}",
        headers(env, token),
        body or {},
    )
    return status, payload


def rpc_id(env: dict[str, str], token: str, name: str, body: dict) -> str | None:
    status, payload = rpc(env, token, name, body)
    if status not in (200, 201) or payload in (None, ""):
        return None
    return str(payload)


def rest_count(env: dict[str, str], token: str | None, table: str, query: str = "") -> tuple[int, int | None]:
    hdrs = headers(env, token)
    hdrs["Prefer"] = "count=exact"
    status, payload, response_headers = request("GET", f"{env['REST_URL']}/{table}{query}", hdrs)
    count = None
    content_range = response_headers.get("Content-Range") or response_headers.get("content-range")
    if content_range and "/" in content_range:
        total = content_range.split("/")[-1]
        if total.isdigit():
            count = int(total)
    elif isinstance(payload, list):
        count = len(payload)
    return status, count


def denied(status: int, payload: object) -> bool:
    if status in (401, 403, 404):
        return True
    if status in (200, 201) and payload in (None, [], {}, ""):
        return True
    if status == 400 and isinstance(payload, dict):
        return True
    return False


def assert_minimized(payload: object, label: str) -> None:
    dumped = json.dumps(payload)
    if any(key in dumped for key in ("Wire instructions", "Hidden invoice notes", "Hidden expense note")):
        fail(f"{label} leaked withheld text")
    if isinstance(payload, list):
        for row in payload:
            if isinstance(row, dict) and any(key in row for key in WITHHELD):
                fail(f"{label} exposed withheld columns")


def upload(env: dict[str, str], token: str, bucket: str, path: str, body: bytes, content_type: str = "text/plain"):
    hdrs = headers(env, token, json_body=False)
    hdrs["Content-Type"] = content_type
    return request("POST", f"{env['API_URL']}/storage/v1/object/{bucket}/{path}", hdrs, body)


def download(env: dict[str, str], token: str | None, bucket: str, path: str):
    return request("GET", f"{env['API_URL']}/storage/v1/object/{bucket}/{path}", headers(env, token, json_body=False))


def main() -> None:
    env = load_env()
    emails = (
        OWNER_A, OWNER_B, ADMIN_A, EMPLOYEE_A, ACCOUNTANT_A,
        CLIENT_A, CLIENT_INACTIVE, CLIENT_B, STRANGER,
    )
    aal1 = {email: login(env, email) for email in emails}
    pass_("disposable password logins succeeded at AAL1")

    note_aal1, _ = rpc(env, aal1[OWNER_A], "sts_save_ws_note", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_title": "AAL1 note",
        "p_body": "should fail",
        "p_related_type": "none",
        "p_related_id": None,
        "p_pinned": False,
    })
    if note_aal1 in (200, 201):
        fail("owner AAL1 note save succeeded")
    pass_(f"owner AAL1 note RPC denied (http {note_aal1})")

    a1_upload, _, _ = upload(env, aal1[OWNER_A], "org-documents", f"{ORG_A}/{uuid.uuid4()}/aal1.txt", b"nope\n")
    if a1_upload in (200, 201):
        fail("owner AAL1 org-documents upload succeeded")
    pass_(f"owner AAL1 org-documents upload denied (http {a1_upload})")

    a1_receipt, _, _ = upload(env, aal1[OWNER_A], "receipts", f"{ORG_A}/aal1.txt", b"nope\n")
    if a1_receipt in (200, 201):
        fail("owner AAL1 receipts upload succeeded")
    pass_(f"owner AAL1 receipts upload denied (http {a1_receipt})")

    acc_aal1, acc_payload = rpc(env, aal1[ACCOUNTANT_A], "sts_list_accountant_invoices")
    if acc_aal1 in (200, 201) and acc_payload:
        fail("AAL1 accountant listed invoices")
    pass_("AAL1 accountant invoice RPC denied")

    client_aal1, client_payload = rpc(env, aal1[CLIENT_A], "sts_list_client_portal_invoices")
    if client_aal1 in (200, 201) and client_payload:
        fail("AAL1 client listed invoices")
    pass_("AAL1 client invoice RPC denied")

    for table in ("organizations", "crm_clients", "ws_invoices", "ws_documents", "client_portal_identities"):
        status, count = rest_count(env, None, table)
        expect_denied_or_empty(status, count, f"anonymous REST {table}")
        status, count = rest_count(env, aal1[STRANGER], table)
        expect_denied_or_empty(status, count, f"no-membership AAL1 REST {table}")

    anon_up, _, _ = upload(env, env["ANON_KEY"], "documents", "anon.txt", b"nope\n")
    if anon_up in (200, 201):
        fail("anonymous documents upload succeeded")
    pass_(f"anonymous documents upload denied (http {anon_up})")

    tokens = {email: enroll_totp_aal2(env, aal1[email]) for email in emails}
    for email, token in tokens.items():
        if jwt_aal(token) != "aal2":
            fail(f"{email} did not reach AAL2")
    pass_("disposable users reached AAL2")
    ids = {email: jwt_claim(tokens[email], "sub") for email in emails}

    for table in ("organizations", "ws_invoices", "ops_expenses", "client_portal_publications"):
        status, count = rest_count(env, tokens[STRANGER], table)
        expect_denied_or_empty(status, count, f"no-membership AAL2 REST {table}")
    stranger_note, _ = rpc(env, tokens[STRANGER], "sts_save_ws_note", {
        "p_organization_id": ORG_A, "p_id": None, "p_title": "Nope", "p_body": "nope",
        "p_related_type": "none", "p_related_id": None, "p_pinned": False,
    })
    if stranger_note in (200, 201):
        fail("no-membership user saved a note")
    pass_("no-membership AAL2 note RPC denied")

    existing_links, existing_rows = rpc(env, tokens[OWNER_A], "sts_list_client_portal_identities")
    linked = {}
    if existing_links in (200, 201) and isinstance(existing_rows, list):
        for row in existing_rows:
            if isinstance(row, dict) and row.get("status") == "active" and row.get("user_email") and row.get("crm_client_id"):
                linked[str(row["user_email"]).lower()] = str(row["crm_client_id"])
    existing_b, rows_b = rpc(env, tokens[OWNER_B], "sts_list_client_portal_identities")
    if existing_b in (200, 201) and isinstance(rows_b, list):
        for row in rows_b:
            if isinstance(row, dict) and row.get("status") == "active" and row.get("user_email") and row.get("crm_client_id"):
                linked[str(row["user_email"]).lower()] = str(row["crm_client_id"])

    crm_a = linked.get(CLIENT_A)
    if not crm_a:
        crm_a = rpc_id(env, tokens[OWNER_A], "sts_save_crm_client", {
        "p_organization_id": ORG_A, "p_id": None, "p_business_name": "North Synthetic",
        "p_contact_name": "Casey Synthetic", "p_email": "casey@day11.test", "p_phone": "555-0100",
        "p_industry": "Test", "p_status": "active", "p_notes": "Internal CRM note",
    })
    crm_b = linked.get(CLIENT_B)
    if not crm_b:
        crm_b = rpc_id(env, tokens[OWNER_B], "sts_save_crm_client", {
            "p_organization_id": ORG_B, "p_id": None, "p_business_name": "South Synthetic",
            "p_contact_name": "Riley Synthetic", "p_email": "riley@day11.test", "p_phone": "555-0101",
            "p_industry": "Test", "p_status": "active", "p_notes": "Other org note",
        })
    if not crm_a or not crm_b:
        fail("owner could not create synthetic CRM clients")
    if CLIENT_A not in linked:
        link_a, _ = rpc(env, tokens[OWNER_A], "sts_link_client_portal_identity", {
            "p_user_id": ids[CLIENT_A], "p_crm_client_id": crm_a,
        })
        if link_a not in (200, 201):
            fail("owner could not link a same-organization client")
    if CLIENT_B not in linked:
        link_b, _ = rpc(env, tokens[OWNER_B], "sts_link_client_portal_identity", {
            "p_user_id": ids[CLIENT_B], "p_crm_client_id": crm_b,
        })
        if link_b not in (200, 201):
            fail("owner could not link a same-organization client")
    pass_("owners linked same-organization client mappings")

    emp_link, _ = rpc(env, tokens[EMPLOYEE_A], "sts_link_client_portal_identity", {
        "p_user_id": ids[CLIENT_A], "p_crm_client_id": crm_a,
    })
    if emp_link in (200, 201):
        fail("employee linked a client identity")
    pass_("employee client-link RPC denied")

    note_id = rpc_id(env, tokens[EMPLOYEE_A], "sts_save_ws_note", {
        "p_organization_id": ORG_A, "p_id": None, "p_title": "Employee note",
        "p_body": "scoped", "p_related_type": "none", "p_related_id": None, "p_pinned": False,
    })
    if not note_id:
        fail("employee note save failed")
    pass_("employee note save succeeded inside the organization")
    cross_note, _ = rpc(env, tokens[EMPLOYEE_A], "sts_save_ws_note", {
        "p_organization_id": ORG_B, "p_id": None, "p_title": "Cross",
        "p_body": "nope", "p_related_type": "none", "p_related_id": None, "p_pinned": False,
    })
    if cross_note in (200, 201):
        fail("employee wrote a note in the other organization")
    pass_("employee cross-organization note denied")
    emp_invoice = rpc_id(env, tokens[EMPLOYEE_A], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A, "p_id": None, "p_client_id": crm_a,
        "p_issue_date": TODAY, "p_due_date": DUE, "p_currency": "USD",
        "p_notes": "", "p_payment_instructions": "", "p_discount_cents": 0, "p_tax_cents": 0,
        "p_lines": [{"description": "Nope", "quantity": 1, "unit_cents": 100}],
    })
    if emp_invoice:
        fail("employee saved an invoice")
    pass_("employee invoice save denied")

    expense_id = rpc_id(env, tokens[OWNER_A], "sts_save_ops_expense", {
        "p_organization_id": ORG_A, "p_id": None, "p_transaction_date": TODAY, "p_posted_date": TODAY,
        "p_vendor": "Synthetic Vendor", "p_description": "Design tools", "p_pretax_cents": 20000,
        "p_tax_cents": 0, "p_currency": "USD", "p_category": "Software & Subscriptions",
        "p_subcategory": "", "p_client_id": None, "p_project_id": None, "p_business_purpose": "",
        "p_payment_account": "Operating", "p_payment_method": "card", "p_recurring": False,
        "p_billing_frequency": "one_time", "p_receipt_name": None, "p_receipt_status": "missing",
        "p_reimbursable": False, "p_reimbursement_status": "n/a", "p_direct_project_cost": False,
        "p_notes": "Hidden expense note",
    })
    if not expense_id:
        fail("owner could not save a synthetic expense")
    invoice_a = rpc_id(env, tokens[OWNER_A], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A, "p_id": None, "p_client_id": crm_a,
        "p_issue_date": TODAY, "p_due_date": DUE, "p_currency": "USD",
        "p_notes": "Hidden invoice notes", "p_payment_instructions": "Wire instructions",
        "p_discount_cents": 0, "p_tax_cents": 0,
        "p_lines": [{"description": "Open work", "quantity": 1, "unit_cents": 15000}],
    })
    invoice_b = rpc_id(env, tokens[OWNER_B], "sts_save_ws_invoice", {
        "p_organization_id": ORG_B, "p_id": None, "p_client_id": crm_b,
        "p_issue_date": TODAY, "p_due_date": DUE, "p_currency": "USD",
        "p_notes": "Other org", "p_payment_instructions": "Private",
        "p_discount_cents": 0, "p_tax_cents": 0,
        "p_lines": [{"description": "South work", "quantity": 1, "unit_cents": 8000}],
    })
    if not invoice_a or not invoice_b:
        fail("owner could not save synthetic invoices")
    if rpc(env, tokens[OWNER_A], "sts_issue_ws_invoice", {"p_organization_id": ORG_A, "p_id": invoice_a})[0] not in (200, 201):
        fail("owner could not issue the org A invoice")
    if rpc(env, tokens[OWNER_B], "sts_issue_ws_invoice", {"p_organization_id": ORG_B, "p_id": invoice_b})[0] not in (200, 201):
        fail("owner could not issue the org B invoice")
    if rpc(env, tokens[OWNER_A], "sts_publish_client_portal_record", {"p_source_type": "invoice", "p_source_id": invoice_a})[0] not in (200, 201):
        fail("owner could not publish the org A invoice")
    if rpc(env, tokens[OWNER_B], "sts_publish_client_portal_record", {"p_source_type": "invoice", "p_source_id": invoice_b})[0] not in (200, 201):
        fail("owner could not publish the org B invoice")
    if rpc(env, tokens[ADMIN_A], "sts_list_accountant_invoices")[0] not in (200, 201):
        fail("administrator could not read the accountant invoice function")
    pass_("owner and administrator AAL2 writes and allowlisted reads succeeded")

    acc_status, invoices = rpc(env, tokens[ACCOUNTANT_A], "sts_list_accountant_invoices")
    if acc_status not in (200, 201) or not isinstance(invoices, list) or not invoices:
        fail(f"accountant invoice RPC http {acc_status}")
    assert_minimized(invoices, "accountant invoices")
    pass_("accountant AAL2 invoice RPC returned allowlisted rows")
    exp_status, expenses = rpc(env, tokens[ACCOUNTANT_A], "sts_list_accountant_expenses")
    if exp_status not in (200, 201) or not isinstance(expenses, list) or not expenses:
        fail("accountant expense RPC returned no rows")
    assert_minimized(expenses, "accountant expenses")
    pass_("accountant AAL2 expense RPC returned allowlisted rows")
    export_status, _ = rpc(env, tokens[ACCOUNTANT_A], "sts_record_accountant_export", {
        "p_export_type": "invoices", "p_row_count": len(invoices),
    })
    if export_status not in (200, 201):
        fail(f"accountant export RPC http {export_status}")
    pass_("accountant AAL2 export RPC succeeded")
    for table in ("ws_invoices", "ops_expenses", "ws_documents", "crm_clients"):
        status, count = rest_count(env, tokens[ACCOUNTANT_A], table)
        expect_denied_or_empty(status, count, f"accountant REST {table}")
    if rpc_id(env, tokens[ACCOUNTANT_A], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A, "p_id": None, "p_client_id": crm_a,
        "p_issue_date": TODAY, "p_due_date": DUE, "p_currency": "USD",
        "p_notes": "", "p_payment_instructions": "", "p_discount_cents": 0, "p_tax_cents": 0,
        "p_lines": [{"description": "Nope", "quantity": 1, "unit_cents": 100}],
    }):
        fail("accountant saved an invoice")
    pass_("accountant invoice write denied")

    listed, payload = rpc(env, tokens[CLIENT_A], "sts_list_client_portal_invoices")
    if listed not in (200, 201) or not isinstance(payload, list):
        fail("mapped client could not list invoices")
    seen = {row.get("id") for row in payload if isinstance(row, dict)}
    if invoice_a not in seen or invoice_b in seen:
        fail("mapped client did not receive only the published own invoice")
    assert_minimized(payload, "client invoices")
    pass_("mapped client sees only the published own invoice")
    for table in ("ws_invoices", "client_portal_publications", "client_portal_identities", "crm_clients"):
        status, count = rest_count(env, tokens[CLIENT_A], table)
        expect_denied_or_empty(status, count, f"client REST {table}")
    object_status, object_payload = rpc(env, tokens[CLIENT_A], "sts_client_portal_document_object_name", {"p_id": invoice_a})
    if object_status in (200, 201) and object_payload not in (None, ""):
        fail("client executed the document object-name RPC")
    pass_(f"document object-name RPC denied to client (http {object_status})")
    if rpc(env, tokens[CLIENT_A], "sts_publish_client_portal_record", {"p_source_type": "invoice", "p_source_id": invoice_a})[0] in (200, 201):
        fail("client published a record")
    pass_("client publication RPC denied")

    inactive, inactive_payload = rpc(env, tokens[CLIENT_INACTIVE], "sts_list_client_portal_invoices")
    if inactive in (200, 201) and inactive_payload:
        fail("inactive client listed invoices")
    pass_("inactive client invoice RPC denied")
    other, other_payload = rpc(env, tokens[CLIENT_B], "sts_list_client_portal_invoices")
    if other not in (200, 201) or not isinstance(other_payload, list):
        fail("other-organization client list failed closed unexpectedly")
    if any(isinstance(row, dict) and row.get("id") == invoice_a for row in other_payload):
        fail("other-organization client saw the org A invoice")
    pass_("other-organization client cannot see org A invoices")
    if rpc(env, tokens[OWNER_B], "sts_publish_client_portal_record", {"p_source_type": "invoice", "p_source_id": invoice_a})[0] in (200, 201):
        fail("other-organization owner published an org A invoice")
    pass_("other-organization owner cannot publish org A records")
    b_status, b_count = rest_count(env, tokens[OWNER_B], "ws_invoices", f"?id=eq.{invoice_a}")
    expect_denied_or_empty(b_status, b_count, "other-organization owner REST org A invoice")

    document_id = str(uuid.uuid4())
    storage_path = f"{ORG_A}/{document_id}/day11-harmless.txt"
    created: list[tuple[str, str]] = []
    up_status, _, _ = upload(env, tokens[OWNER_A], "org-documents", storage_path, b"harmless day11 document\n")
    if up_status not in (200, 201):
        fail(f"owner org-documents upload http {up_status}")
    created.append(("org-documents", storage_path))
    pass_("owner AAL2 org-documents upload succeeded")
    bad, _, _ = upload(env, tokens[OWNER_A], "org-documents", f"{ORG_A}/{document_id}/bad.html", b"<html></html>", "text/html")
    if bad in (200, 201):
        fail("disallowed HTML upload was accepted")
    pass_("disallowed HTML upload rejected")
    cross, _, _ = upload(env, tokens[OWNER_B], "org-documents", storage_path, b"cross\n")
    if cross in (200, 201):
        fail("other-organization user uploaded into org A")
    pass_("cross-organization org-documents upload denied")
    emp_path = f"{ORG_A}/{uuid.uuid4()}/employee.txt"
    emp_up, _, _ = upload(env, tokens[EMPLOYEE_A], "org-documents", emp_path, b"employee\n")
    if emp_up not in (200, 201):
        fail(f"employee org-documents upload http {emp_up}")
    created.append(("org-documents", emp_path))
    pass_("employee org-documents upload succeeded")
    acc_up, _, _ = upload(env, tokens[ACCOUNTANT_A], "org-documents", f"{ORG_A}/{uuid.uuid4()}/accountant.txt", b"nope\n")
    if acc_up in (200, 201):
        fail("accountant org-documents upload succeeded")
    pass_("accountant org-documents upload denied")
    client_up, _, _ = upload(env, tokens[CLIENT_A], "org-documents", storage_path, b"nope\n")
    if client_up in (200, 201):
        fail("client org-documents upload succeeded")
    pass_("client org-documents upload denied")

    owner_get, _, _ = download(env, tokens[OWNER_A], "org-documents", storage_path)
    if owner_get != 200:
        fail(f"owner org-documents download http {owner_get}")
    pass_("owner AAL2 org-documents download succeeded")
    for email, label in ((STRANGER, "no-membership"), (OWNER_B, "other-organization"), (ACCOUNTANT_A, "accountant"), (CLIENT_A, "client"), (CLIENT_INACTIVE, "inactive client")):
        status, _, _ = download(env, tokens[email], "org-documents", storage_path)
        if status == 200:
            fail(f"{label} downloaded an org-documents object")
        pass_(f"{label} org-documents download denied (http {status})")
    anon_get, _, _ = download(env, None, "org-documents", storage_path)
    if anon_get == 200:
        fail("anonymous org-documents download succeeded")
    pass_(f"anonymous org-documents download denied (http {anon_get})")

    doc_id = rpc_id(env, tokens[OWNER_A], "sts_save_ws_document", {
        "p_organization_id": ORG_A, "p_id": document_id, "p_storage_path": storage_path,
        "p_display_filename": "day11-harmless.txt", "p_content_type": "text/plain",
        "p_byte_size": len(b"harmless day11 document\n"), "p_description": "Synthetic",
        "p_category": "other", "p_client_id": crm_a, "p_project_id": None,
    })
    if doc_id != document_id:
        fail("owner could not save the synthetic document row")
    if rpc(env, tokens[OWNER_A], "sts_publish_client_portal_record", {"p_source_type": "document", "p_source_id": document_id})[0] not in (200, 201):
        fail("owner could not publish the synthetic document")
    docs_status, docs = rpc(env, tokens[CLIENT_A], "sts_list_client_portal_documents")
    if docs_status not in (200, 201) or not any(isinstance(row, dict) and row.get("id") == document_id for row in docs or []):
        fail("mapped client did not see the published document")
    assert_minimized(docs, "client documents")
    auth_status, _ = rpc(env, tokens[CLIENT_A], "sts_client_portal_authorize_document", {"p_id": document_id})
    if auth_status not in (200, 201):
        fail(f"mapped client document authorization http {auth_status}")
    pass_("mapped client can see and authorize only the published document")
    inactive_docs, inactive_docs_payload = rpc(env, tokens[CLIENT_INACTIVE], "sts_list_client_portal_documents")
    if inactive_docs in (200, 201) and inactive_docs_payload:
        fail("inactive client listed documents")
    pass_("inactive client document RPC denied")

    receipt_path = f"{ORG_A}/expense-{uuid.uuid4().hex}/day11-receipt.txt"
    receipt_up, _, _ = upload(env, tokens[OWNER_A], "receipts", receipt_path, b"synthetic receipt\n")
    if receipt_up not in (200, 201):
        fail(f"owner receipts upload http {receipt_up}")
    created.append(("receipts", receipt_path))
    pass_("same-organization owner AAL2 receipts upload succeeded")
    receipt_get, _, _ = download(env, tokens[OWNER_A], "receipts", receipt_path)
    if receipt_get != 200:
        fail(f"owner receipts download http {receipt_get}")
    pass_("same-organization owner AAL2 receipts download succeeded")
    admin_get, _, _ = download(env, tokens[ADMIN_A], "receipts", receipt_path)
    if admin_get != 200:
        fail(f"same-organization administrator receipts download http {admin_get}")
    pass_("same-organization administrator AAL2 receipts download succeeded")
    own_delete, _, _ = request(
        "DELETE",
        f"{env['API_URL']}/storage/v1/object/receipts/{receipt_path}",
        headers(env, tokens[OWNER_A], json_body=False),
    )
    if own_delete in (200, 204):
        fail("same-organization owner deleted a receipt")
    pass_(f"same-organization receipt delete remains denied (http {own_delete})")

    other_into_a, _, _ = upload(env, tokens[OWNER_B], "receipts", f"{ORG_A}/expense-cross/nope.txt", b"cross\n")
    if other_into_a in (200, 201):
        fail("other-organization owner uploaded into org A receipts")
    pass_("cross-organization receipts upload denied")
    other_get, _, _ = download(env, tokens[OWNER_B], "receipts", receipt_path)
    if other_get == 200:
        fail("other-organization owner downloaded an org A receipt")
    pass_(f"cross-organization receipts download denied (http {other_get})")
    list_status, listed, _ = request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/list/receipts",
        headers(env, tokens[OWNER_B]),
        {"prefix": f"{ORG_A}/", "limit": 100},
    )
    if list_status in (200, 201) and isinstance(listed, list) and listed:
        fail("other-organization owner listed org A receipts")
    pass_("cross-organization receipts listing is empty or denied")
    other_put, _, _ = request(
        "PUT",
        f"{env['API_URL']}/storage/v1/object/receipts/{receipt_path}",
        {**headers(env, tokens[OWNER_B], json_body=False), "Content-Type": "text/plain"},
        b"overwrite\n",
    )
    if other_put in (200, 201):
        fail("other-organization owner updated an org A receipt")
    pass_(f"cross-organization receipts update denied (http {other_put})")
    other_delete, _, _ = request(
        "DELETE",
        f"{env['API_URL']}/storage/v1/object/receipts/{receipt_path}",
        headers(env, tokens[OWNER_B], json_body=False),
    )
    if other_delete in (200, 204):
        fail("other-organization owner deleted an org A receipt")
    pass_(f"cross-organization receipts delete denied (http {other_delete})")
    own_b = f"{ORG_B}/expense-{uuid.uuid4().hex}/own.txt"
    own_b_up, _, _ = upload(env, tokens[OWNER_B], "receipts", own_b, b"own org\n")
    if own_b_up not in (200, 201):
        fail(f"other-organization owner same-org receipts upload http {own_b_up}")
    created.append(("receipts", own_b))
    pass_("other-organization owner can upload only inside their organization")
    if download(env, tokens[OWNER_A], "receipts", own_b)[0] == 200:
        fail("org A owner downloaded an org B receipt")
    pass_("org A owner cannot read an org B receipt")

    for email, label in (
        (EMPLOYEE_A, "employee"),
        (ACCOUNTANT_A, "accountant"),
        (CLIENT_A, "client"),
        (CLIENT_INACTIVE, "inactive client"),
        (STRANGER, "no-membership"),
    ):
        status, _, _ = upload(env, tokens[email], "receipts", f"{ORG_A}/expense-{label.replace(' ', '-')}.txt", b"nope\n")
        if status in (200, 201):
            fail(f"{label} receipts upload succeeded")
        got, _, _ = download(env, tokens[email], "receipts", receipt_path)
        if got == 200:
            fail(f"{label} receipts download succeeded")
        pass_(f"{label} receipts access denied")
    if upload(env, env["ANON_KEY"], "receipts", f"{ORG_A}/anon.txt", b"nope\n")[0] in (200, 201):
        fail("anonymous receipts upload succeeded")
    if download(env, None, "receipts", receipt_path)[0] == 200:
        fail("anonymous receipts download succeeded")
    pass_("anonymous receipts access denied")

    legacy_doc = f"{ORG_A}/day11-private-{uuid.uuid4().hex}.txt"
    doc_up, _, _ = upload(env, tokens[OWNER_A], "documents", legacy_doc, b"synthetic private\n")
    if doc_up in (200, 201):
        fail("owner uploaded to the closed documents bucket")
    pass_(f"unused documents bucket upload denied (http {doc_up})")
    if download(env, tokens[OWNER_A], "documents", legacy_doc)[0] == 200:
        fail("owner downloaded from the closed documents bucket")
    if upload(env, tokens[OWNER_B], "documents", f"{ORG_B}/cross.txt", b"nope\n")[0] in (200, 201):
        fail("other-organization owner uploaded to the documents bucket")
    if upload(env, tokens[EMPLOYEE_A], "documents", f"{ORG_A}/employee-doc.txt", b"nope\n")[0] in (200, 201):
        fail("employee documents upload succeeded")
    if download(env, None, "documents", legacy_doc)[0] == 200:
        fail("anonymous documents download succeeded")
    pass_("documents bucket stays closed for every tested role")

    if rpc(env, tokens[OWNER_A], "sts_unpublish_client_portal_record", {"p_source_type": "invoice", "p_source_id": invoice_a})[0] not in (200, 201):
        fail("owner could not unpublish")
    after, after_payload = rpc(env, tokens[CLIENT_A], "sts_list_client_portal_invoices")
    after_ids = {row.get("id") for row in after_payload if isinstance(row, dict)} if isinstance(after_payload, list) else set()
    if after in (200, 201) and invoice_a in after_ids:
        fail("unpublished invoice remained visible")
    pass_("unpublish removed client access")

    for bucket, path in created:
        status, _, _ = request(
            "DELETE",
            f"{env['API_URL']}/storage/v1/object/{bucket}/{path}",
            headers(env, tokens[OWNER_A], json_body=False),
        )
        if status not in (200, 204):
            print(f"NOTE storage delete http {status} for {bucket}; catalog cleanup must remove it")
    print("DAY11_HOSTED_SECURITY_PASSED")


if __name__ == "__main__":
    main()
