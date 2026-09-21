#!/usr/bin/env python3
"""Day 8 local Auth + REST accountant-center checks. Never prints secrets or tokens."""
from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import enroll_totp_aal2, expect_denied_or_empty, jwt_aal, upsert_auth_user

ENV_FILE = Path("/tmp/sts-local/status.env")
INVOICE_MARK = Path("/tmp/sts-local/day8-invoice.id")
EXPENSE_MARK = Path("/tmp/sts-local/day8-expense.id")
ORG_A = "a8a8a8a8-a8a8-48a8-88a8-a8a8a8a8a8a8"
ORG_B = "b8b8b8b8-b8b8-48b8-88b8-b8b8b8b8b8b8"
OWNER_A_EMAIL = "owner-a@day8.test"
OWNER_B_EMAIL = "owner-b@day8.test"
ADMIN_A_EMAIL = "admin-a@day8.test"
EMPLOYEE_A_EMAIL = "employee-a@day8.test"
ACCOUNTANT_A_EMAIL = "accountant-a@day8.test"
CONTRACTOR_A_EMAIL = "contractor-a@day8.test"
CLIENT_A_EMAIL = "client-a@day8.test"
STRANGER_EMAIL = "stranger@day8.test"
APP_URL = os.environ.get("DAY8_APP_URL", "http://127.0.0.1:3000")
TODAY = date.today().isoformat()
OVERDUE = (date.today() - timedelta(days=5)).isoformat()
WITHHELD_KEYS = {
    "notes",
    "payment_instructions",
    "client_email",
    "client_contact_name",
    "payment_account",
    "payment_method",
    "client_id",
    "project_id",
}


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def pass_(msg: str) -> None:
    print(f"PASS {msg}")


def ensure_status_env() -> None:
    if ENV_FILE.exists():
        return
    ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["npx", "--yes", "supabase", "status", "-o", "env"],
        cwd=str(Path(__file__).resolve().parents[1]),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        fail("could not write private local status env from supabase status")
    mapped = []
    for line in result.stdout.splitlines():
        if line.startswith("API_URL="):
            mapped.append(line)
            mapped.append(line.replace("API_URL=", "REST_URL=", 1).rstrip() + "/rest/v1")
        elif line.startswith("ANON_KEY=") or line.startswith("SERVICE_ROLE_KEY="):
            mapped.append(line)
    ENV_FILE.write_text("\n".join(mapped) + "\n")


def load_status_env() -> dict[str, str]:
    ensure_status_env()
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
        {"organization_id": org_id, "invoice_prefix": "STS", "estimate_prefix": "EST"},
    )


def ensure_membership(env: dict[str, str], org_id: str, user_id: str, role: str) -> None:
    request(
        "POST",
        f"{env['REST_URL']}/organization_members",
        auth_headers(env, admin=True),
        {"organization_id": org_id, "user_id": user_id, "role": role, "status": "active"},
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


def assert_minimized(rows: list, label: str) -> None:
    dumped = json.dumps(rows)
    if any(key in dumped for key in ("notes", "payment_instructions", "client_email", "555-0100")):
        fail(f"{label} leaked withheld fields")
    for row in rows:
        if not isinstance(row, dict):
            continue
        overlap = WITHHELD_KEYS.intersection(row.keys())
        if overlap:
            fail(f"{label} exposed columns {sorted(overlap)}")


def signed_out_app_redirect() -> None:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    for path in ("/accountant", "/accountant/export/invoices", "/dashboard"):
        req = urllib.request.Request(f"{APP_URL}{path}", method="GET")
        try:
            with opener.open(req, timeout=8) as resp:
                fail(f"signed-out {path} returned http {resp.status}")
        except urllib.error.HTTPError as exc:
            location = exc.headers.get("Location") or ""
            if exc.code in (301, 302, 303, 307, 308) and "/login" in location:
                pass_(f"signed-out {path} redirects to login")
                continue
            if path.startswith("/accountant/export") and exc.code in (401, 403):
                pass_(f"signed-out {path} denied")
                continue
            fail(f"signed-out {path} redirect missing (http {exc.code})")
        except urllib.error.URLError:
            print(f"SKIP signed-out app redirect for {path}; local Next.js was not reachable")
            return


def persist_phase(env: dict[str, str]) -> None:
    if not INVOICE_MARK.exists() or not EXPENSE_MARK.exists():
        fail("missing persistence marker for Day 8 records")
    invoice_id = INVOICE_MARK.read_text().strip()
    expense_id = EXPENSE_MARK.read_text().strip()
    status, invoices, _ = request(
        "GET",
        f"{env['REST_URL']}/sts_accountant_invoices?id=eq.{invoice_id}&select=id,organization_id,invoice_number,total_cents,client_business_name",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(invoices, list) or not invoices:
        fail(f"persisted accountant invoice missing after restart (http {status})")
    if invoices[0].get("organization_id") != ORG_A:
        fail("persisted invoice changed organization")
    assert_minimized(invoices, "persisted invoice view")
    pass_("accountant invoice view remained after local restart")
    status, expenses, _ = request(
        "GET",
        f"{env['REST_URL']}/sts_accountant_expenses?id=eq.{expense_id}&select=id,organization_id,total_cents,description",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(expenses, list) or not expenses:
        fail("persisted accountant expense missing after restart")
    if expenses[0].get("organization_id") != ORG_A:
        fail("persisted expense changed organization")
    pass_("accountant expense view remained after local restart")
    print("DAY8_LOCAL_AUTH_REST_PASSED")


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    if any(not env.get(key) for key in required):
        fail("local status env missing required key names")

    phase = os.environ.get("DAY8_AUTH_PHASE", "all")
    if phase == "persist":
        persist_phase(env)
        return

    signed_out_app_redirect()

    emails = (
        OWNER_A_EMAIL,
        OWNER_B_EMAIL,
        ADMIN_A_EMAIL,
        EMPLOYEE_A_EMAIL,
        ACCOUNTANT_A_EMAIL,
        CONTRACTOR_A_EMAIL,
        CLIENT_A_EMAIL,
        STRANGER_EMAIL,
    )
    passwords = {email: secrets.token_urlsafe(24) for email in emails}
    ids = {email: upsert_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 8 users")

    ensure_org(env, ORG_A, "day8-test-org-a")
    ensure_org(env, ORG_B, "day8-test-org-b")
    ensure_membership(env, ORG_A, ids[OWNER_A_EMAIL], "owner")
    ensure_membership(env, ORG_B, ids[OWNER_B_EMAIL], "owner")
    ensure_membership(env, ORG_A, ids[ADMIN_A_EMAIL], "administrator")
    ensure_membership(env, ORG_A, ids[EMPLOYEE_A_EMAIL], "employee")
    ensure_membership(env, ORG_A, ids[ACCOUNTANT_A_EMAIL], "accountant")
    ensure_membership(env, ORG_A, ids[CONTRACTOR_A_EMAIL], "contractor")
    ensure_membership(env, ORG_A, ids[CLIENT_A_EMAIL], "client")

    aal1_tokens: dict[str, str] = {}
    for email in emails:
        status, token = password_login(env, email, passwords[email])
        if status != 200 or not token:
            fail(f"password login failed (http {status})")
        if jwt_aal(token) != "aal1":
            fail("password session was not AAL1")
        aal1_tokens[email] = token
    pass_("synthetic Day 8 password logins succeeded at AAL1")

    a1_status, a1_count = rest_count(env, aal1_tokens[ACCOUNTANT_A_EMAIL], "sts_accountant_invoices")
    expect_denied_or_empty(a1_status, a1_count, "AAL1 accountant REST invoice view")
    a1_export, _ = rpc(env, aal1_tokens[ACCOUNTANT_A_EMAIL], "sts_record_accountant_export", {
        "p_export_type": "invoices",
        "p_row_count": 1,
    })
    if a1_export in (200, 201):
        fail("AAL1 accountant recorded an export")
    pass_("AAL1 accountant export denied")

    tokens: dict[str, str] = {}
    for email in (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, EMPLOYEE_A_EMAIL, ACCOUNTANT_A_EMAIL, CONTRACTOR_A_EMAIL, CLIENT_A_EMAIL):
        tokens[email] = enroll_totp_aal2(env, aal1_tokens[email])
        if jwt_aal(tokens[email]) != "aal2":
            fail("MFA session was not AAL2")
    tokens[STRANGER_EMAIL] = aal1_tokens[STRANGER_EMAIL]
    pass_("owner, admin, employee, accountant, contractor, and client received AAL2")

    client_status, client_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_crm_client", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_business_name": "North Client",
        "p_contact_name": "Casey",
        "p_email": "casey@day8.test",
        "p_phone": "555-0100",
        "p_industry": "Auto",
        "p_status": "active",
        "p_notes": "Internal CRM note",
    })
    if client_status not in (200, 201) or not client_id:
        fail("could not save org A client")

    rev_status, _ = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ops_revenue", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_client_id": client_id,
        "p_project_id": None,
        "p_source_label": "Launch",
        "p_description": "Website launch",
        "p_amount_cents": 100000,
        "p_currency": "USD",
        "p_invoice_number": "STS-PAID",
        "p_entry_type": "one_time_project",
        "p_earned_date": TODAY,
        "p_due_date": TODAY,
        "p_paid_date": TODAY,
        "p_invoice_status": "paid",
        "p_payment_status": "paid",
        "p_payment_method": "check",
        "p_recurring": False,
        "p_recognized": True,
        "p_notes": "Do not expose revenue notes",
    })
    if rev_status not in (200, 201):
        fail("could not save paid revenue")

    exp_status, expense_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ops_expense", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_transaction_date": TODAY,
        "p_posted_date": TODAY,
        "p_vendor": "Adobe",
        "p_description": "Design tools",
        "p_pretax_cents": 20000,
        "p_tax_cents": 0,
        "p_currency": "USD",
        "p_category": "Software & Subscriptions",
        "p_subcategory": "",
        "p_client_id": None,
        "p_project_id": None,
        "p_business_purpose": "",
        "p_payment_account": "Operating",
        "p_payment_method": "card",
        "p_recurring": False,
        "p_billing_frequency": "one_time",
        "p_receipt_name": None,
        "p_receipt_status": "missing",
        "p_reimbursable": False,
        "p_reimbursement_status": "n/a",
        "p_direct_project_cost": False,
        "p_notes": "Hidden expense note",
    })
    if exp_status not in (200, 201) or not expense_id:
        fail("could not save expense")
    EXPENSE_MARK.parent.mkdir(parents=True, exist_ok=True)
    EXPENSE_MARK.write_text(expense_id)

    inv_status, invoice_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_client_id": client_id,
        "p_issue_date": OVERDUE,
        "p_due_date": OVERDUE,
        "p_currency": "USD",
        "p_notes": "Hidden invoice notes",
        "p_payment_instructions": "Wire instructions",
        "p_discount_cents": 0,
        "p_tax_cents": 0,
        "p_lines": [{"description": "Overdue work", "quantity": 1, "unit_cents": 7500}],
    })
    if inv_status not in (200, 201) or not invoice_id:
        fail("could not save invoice")
    issue_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_issue_ws_invoice", {
        "p_organization_id": ORG_A,
        "p_id": invoice_id,
    })
    if issue_status not in (200, 201):
        fail("could not issue invoice")
    INVOICE_MARK.write_text(invoice_id)

    acc_status, invoices, _ = request(
        "GET",
        f"{env['REST_URL']}/sts_accountant_invoices?select=id,invoice_number,status,client_business_name,total_cents,archived_at",
        auth_headers(env, tokens[ACCOUNTANT_A_EMAIL]),
    )
    if acc_status != 200 or not isinstance(invoices, list) or not invoices:
        fail(f"accountant AAL2 invoice view http {acc_status}")
    assert_minimized(invoices, "accountant invoice view")
    if invoices[0].get("client_business_name") != "North Client":
        fail("accountant invoice view missing client business name")
    pass_("accountant AAL2 can read minimized invoice view")

    acc_exp_status, expenses, _ = request(
        "GET",
        f"{env['REST_URL']}/sts_accountant_expenses?select=id,description,category,total_cents,reimbursement_status,archived_at",
        auth_headers(env, tokens[ACCOUNTANT_A_EMAIL]),
    )
    if acc_exp_status != 200 or not isinstance(expenses, list) or not expenses:
        fail("accountant expense view missing rows")
    assert_minimized(expenses, "accountant expense view")
    pass_("accountant AAL2 can read minimized expense view")

    admin_status, admin_rows, _ = request(
        "GET",
        f"{env['REST_URL']}/sts_accountant_revenue?select=id,amount_cents,payment_status,entry_type,archived_at",
        auth_headers(env, tokens[ADMIN_A_EMAIL]),
    )
    if admin_status != 200 or not isinstance(admin_rows, list) or not admin_rows:
        fail("administrator could not oversee accountant revenue view")
    assert_minimized(admin_rows, "admin revenue view")
    pass_("administrator can oversee accountant views")

    for email, label in (
        (EMPLOYEE_A_EMAIL, "employee"),
        (CONTRACTOR_A_EMAIL, "contractor"),
        (CLIENT_A_EMAIL, "client"),
        (STRANGER_EMAIL, "stranger"),
        (OWNER_B_EMAIL, "cross-organization owner"),
    ):
        status, count = rest_count(env, tokens[email], "sts_accountant_invoices")
        expect_denied_or_empty(status, count, f"{label} REST accountant invoice view")

    write_status, _ = rpc(env, tokens[ACCOUNTANT_A_EMAIL], "sts_save_ops_expense", {
        "p_organization_id": ORG_A,
        "p_id": expense_id,
        "p_transaction_date": TODAY,
        "p_posted_date": TODAY,
        "p_vendor": "Hack",
        "p_description": "Nope",
        "p_pretax_cents": 1,
        "p_tax_cents": 0,
        "p_currency": "USD",
        "p_category": "Office Supplies",
        "p_subcategory": "",
        "p_client_id": None,
        "p_project_id": None,
        "p_business_purpose": "",
        "p_payment_account": "",
        "p_payment_method": "",
        "p_recurring": False,
        "p_billing_frequency": "one_time",
        "p_receipt_name": None,
        "p_receipt_status": "missing",
        "p_reimbursable": False,
        "p_reimbursement_status": "n/a",
        "p_direct_project_cost": False,
        "p_notes": "",
    })
    if write_status in (200, 201):
        fail("accountant executed expense save RPC")
    pass_("accountant write RPC denied")

    insert_status, _, _ = request(
        "POST",
        f"{env['REST_URL']}/ops_expenses",
        auth_headers(env, tokens[ACCOUNTANT_A_EMAIL]),
        {
            "organization_id": ORG_A,
            "transaction_date": TODAY,
            "posted_date": TODAY,
            "vendor": "Hack",
            "description": "Direct insert",
            "pretax_cents": 1,
            "tax_cents": 0,
            "total_cents": 1,
            "category": "Office Supplies",
        },
    )
    if insert_status in (200, 201):
        fail("accountant direct expense insert succeeded")
    pass_("accountant direct table write denied")

    proj_status, proj_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ops_projects")
    expect_denied_or_empty(proj_status, proj_count, "accountant REST project read")
    note_status, note_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ws_notes")
    expect_denied_or_empty(note_status, note_count, "accountant REST notes read")
    est_status, est_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ws_estimates")
    expect_denied_or_empty(est_status, est_count, "accountant REST estimate read")

    export_status, export_id = rpc(env, tokens[ACCOUNTANT_A_EMAIL], "sts_record_accountant_export", {
        "p_export_type": "invoices",
        "p_row_count": len(invoices),
    })
    if export_status not in (200, 201) or not export_id:
        fail(f"accountant export audit http {export_status}")
    bad_export, _ = rpc(env, tokens[ACCOUNTANT_A_EMAIL], "sts_record_accountant_export", {
        "p_export_type": "payroll",
        "p_row_count": 1,
    })
    if bad_export in (200, 201):
        fail("payroll export type was accepted")
    pass_("accountant export audit accepts invoices/revenue/expenses only")

    audit_status, audits, _ = request(
        "GET",
        f"{env['REST_URL']}/audit_events?action=eq.accountant.exported&select=action,entity_id,metadata,result",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if audit_status != 200 or not isinstance(audits, list) or not audits:
        fail("export audit missing")
    dumped = json.dumps(audits)
    if any(token in dumped.lower() for token in ("hidden invoice", "wire instructions", "casey@", "555-0100")):
        fail("export audit stored row contents or personal information")
    if "invoices" not in dumped or "row_count" not in dumped:
        fail("export audit missing type or count")
    pass_("export audit stores type and count only")

    emp_export, _ = rpc(env, tokens[EMPLOYEE_A_EMAIL], "sts_record_accountant_export", {
        "p_export_type": "expenses",
        "p_row_count": 1,
    })
    if emp_export in (200, 201):
        fail("employee recorded an accountant export")
    pass_("employee export denied")

    print("DAY8_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    main()
