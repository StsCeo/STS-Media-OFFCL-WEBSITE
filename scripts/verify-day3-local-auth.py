#!/usr/bin/env python3
"""Day 3 local Auth + REST RLS checks. Never prints secrets or tokens."""
from __future__ import annotations

import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

ENV_FILE = Path("/tmp/sts-local/status.env")
EXPENSE_MARK = Path("/tmp/sts-local/day3-expense.id")
REVENUE_MARK = Path("/tmp/sts-local/day3-revenue.id")
PROJECT_MARK = Path("/tmp/sts-local/day3-project.id")
TASK_MARK = Path("/tmp/sts-local/day3-task.id")
ORG_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
ORG_B = "ffffffff-ffff-4fff-8fff-ffffffffffff"
OWNER_A_EMAIL = "owner-a@day3.test"
OWNER_B_EMAIL = "owner-b@day3.test"
ADMIN_A_EMAIL = "admin-a@day3.test"
MEMBER_A_EMAIL = "member-a@day3.test"
ACCOUNTANT_A_EMAIL = "accountant-a@day3.test"
STRANGER_EMAIL = "stranger@day3.test"


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


def rpc(env: dict[str, str], token: str, name: str, body: dict) -> tuple[int, object]:
    status, payload, _ = request(
        "POST",
        f"{env['REST_URL']}/rpc/{name}",
        auth_headers(env, token),
        body,
    )
    return status, payload


def save_project(env: dict[str, str], token: str, organization_id: str, name: str) -> tuple[int, str | None]:
    status, payload = rpc(env, token, "sts_save_ops_project", {
        "p_organization_id": organization_id,
        "p_id": None,
        "p_client_id": None,
        "p_name": name,
        "p_description": "REST",
        "p_stage": "lead",
        "p_priority": "medium",
        "p_start_date": "2026-09-20",
        "p_due_date": "2026-10-20",
        "p_budget_cents": 10000,
        "p_assigned_member_id": None,
        "p_assigned_to": "Owner",
        "p_at_risk": False,
        "p_notes": "",
    })
    record_id = str(payload) if status in (200, 201) and payload else None
    return status, record_id


def save_expense(env: dict[str, str], token: str, organization_id: str, vendor: str, amount_cents: int = 2500, **overrides) -> tuple[int, str | None]:
    body = {
        "p_organization_id": organization_id,
        "p_id": None,
        "p_transaction_date": "2026-09-20",
        "p_posted_date": "2026-09-20",
        "p_vendor": vendor,
        "p_description": "REST expense",
        "p_pretax_cents": amount_cents,
        "p_tax_cents": 0,
        "p_currency": "USD",
        "p_category": "Office Supplies",
        "p_subcategory": "",
        "p_client_id": None,
        "p_project_id": None,
        "p_business_purpose": "Ops",
        "p_payment_account": "Operating",
        "p_payment_method": "Card",
        "p_recurring": False,
        "p_billing_frequency": "one_time",
        "p_receipt_name": None,
        "p_receipt_status": "missing",
        "p_reimbursable": False,
        "p_reimbursement_status": "n/a",
        "p_direct_project_cost": False,
        "p_notes": "",
    }
    body.update(overrides)
    status, payload = rpc(env, token, "sts_save_ops_expense", body)
    record_id = str(payload) if status in (200, 201) and payload else None
    return status, record_id


def save_revenue(env: dict[str, str], token: str, organization_id: str, description: str, **overrides) -> tuple[int, str | None]:
    body = {
        "p_organization_id": organization_id,
        "p_id": None,
        "p_client_id": None,
        "p_project_id": None,
        "p_source_label": "REST client",
        "p_description": description,
        "p_amount_cents": 150000,
        "p_currency": "USD",
        "p_invoice_number": "STS-REST-1",
        "p_entry_type": "one_time_project",
        "p_earned_date": "2026-09-20",
        "p_due_date": "2026-10-20",
        "p_paid_date": None,
        "p_invoice_status": "sent",
        "p_payment_status": "unpaid",
        "p_payment_method": "",
        "p_recurring": False,
        "p_recognized": False,
        "p_notes": "",
    }
    body.update(overrides)
    status, payload = rpc(env, token, "sts_save_ops_revenue", body)
    record_id = str(payload) if status in (200, 201) and payload else None
    return status, record_id


def save_task(env: dict[str, str], token: str, organization_id: str, title: str, project_id: str | None = None) -> tuple[int, str | None]:
    status, payload = rpc(env, token, "sts_save_ops_task", {
        "p_organization_id": organization_id,
        "p_id": None,
        "p_project_id": project_id,
        "p_client_id": None,
        "p_title": title,
        "p_description": "REST",
        "p_status": "todo",
        "p_priority": "medium",
        "p_due_date": "2026-09-25",
        "p_assigned_member_id": None,
        "p_assigned_to": "Owner",
        "p_notes": "",
    })
    record_id = str(payload) if status in (200, 201) and payload else None
    return status, record_id


def persist_phase(env: dict[str, str]) -> None:
    for marker, label, org_key in (
        (EXPENSE_MARK, "expense", "ops_expenses"),
        (REVENUE_MARK, "revenue", "ops_revenue"),
        (PROJECT_MARK, "project", "ops_projects"),
        (TASK_MARK, "task", "ops_tasks"),
    ):
        if not marker.exists():
            fail(f"missing persistence marker for {label}")
        record_id = marker.read_text().strip()
        status, payload, _ = request(
            "GET",
            f"{env['REST_URL']}/{org_key}?id=eq.{record_id}&select=id,organization_id",
            auth_headers(env, admin=True),
        )
        if status != 200 or not isinstance(payload, list) or not payload:
            fail(f"persisted {label} missing after restart (http {status})")
        if payload[0].get("organization_id") != ORG_A:
            fail(f"persisted {label} organization mismatch")
        pass_(f"{label} remained after local restart")
    print("DAY3_LOCAL_AUTH_REST_PASSED")


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    if any(not env.get(key) for key in required):
        fail("local status env missing required key names")

    phase = os.environ.get("DAY3_AUTH_PHASE", "all")
    if phase == "persist":
        persist_phase(env)
        return

    emails = (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, ACCOUNTANT_A_EMAIL, STRANGER_EMAIL)
    passwords = {email: secrets.token_urlsafe(24) for email in emails}
    ids = {email: upsert_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 3 users")

    ensure_org(env, ORG_A, "day3-test-org-a")
    ensure_org(env, ORG_B, "day3-test-org-b")
    ensure_membership(env, ORG_A, ids[OWNER_A_EMAIL], "owner")
    ensure_membership(env, ORG_B, ids[OWNER_B_EMAIL], "owner")
    ensure_membership(env, ORG_A, ids[ADMIN_A_EMAIL], "administrator")
    ensure_membership(env, ORG_A, ids[MEMBER_A_EMAIL], "employee")
    ensure_membership(env, ORG_A, ids[ACCOUNTANT_A_EMAIL], "accountant")

    tokens: dict[str, str] = {}
    for email in emails:
        status, token = password_login(env, email, passwords[email])
        if status != 200 or not token:
            fail(f"password login failed for a synthetic user (http {status})")
        tokens[email] = token
    pass_("owner, admin, member, accountant, other-org, and stranger password logins succeeded")
    pass_("password sessions are AAL1; dashboard AAL2 remains an application gate from Day 1/2")

    for table in ("ops_expenses", "ops_revenue", "ops_projects", "ops_tasks"):
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

    project_status, project_id = save_project(env, tokens[OWNER_A_EMAIL], ORG_A, "Day3 Persist Project")
    if project_status not in (200, 201) or not project_id:
        fail(f"owner A project save http {project_status}")
    pass_("owner A REST project save succeeded")

    expense_status, expense_id = save_expense(env, tokens[OWNER_A_EMAIL], ORG_A, "Office Depot", p_reimbursable=True, p_reimbursement_status="pending")
    if expense_status not in (200, 201) or not expense_id:
        fail(f"owner A expense save http {expense_status}")
    pass_("owner A REST expense save succeeded")

    reimbursed_status, reimbursed_id = save_expense(
        env,
        tokens[OWNER_A_EMAIL],
        ORG_A,
        "Office Depot",
        p_id=expense_id,
        p_reimbursable=True,
        p_reimbursement_status="reimbursed",
        p_description="REST expense",
        p_pretax_cents=2500,
    )
    if reimbursed_status not in (200, 201) or not reimbursed_id:
        fail(f"owner A reimbursement update http {reimbursed_status}")
    pass_("owner A REST can mark an expense reimbursed")

    paid_status, revenue_id = save_revenue(
        env,
        tokens[OWNER_A_EMAIL],
        ORG_A,
        "Day3 Persist Revenue",
        p_payment_status="paid",
        p_payment_method="Check",
        p_paid_date="2026-09-20",
        p_invoice_status="paid",
        p_recognized=True,
    )
    if paid_status not in (200, 201) or not revenue_id:
        fail(f"owner A revenue save http {paid_status}")
    pass_("owner A REST revenue save succeeded")

    task_status, task_id = save_task(env, tokens[OWNER_A_EMAIL], ORG_A, "Day3 Persist Task", project_id)
    if task_status not in (200, 201) or not task_id:
        fail(f"owner A task save http {task_status}")
    pass_("owner A REST task save succeeded")

    EXPENSE_MARK.parent.mkdir(parents=True, exist_ok=True)
    EXPENSE_MARK.write_text(expense_id)
    REVENUE_MARK.write_text(revenue_id)
    PROJECT_MARK.write_text(project_id)
    TASK_MARK.write_text(task_id)

    member_status, member_expense = save_expense(env, tokens[MEMBER_A_EMAIL], ORG_A, "Staples")
    if member_status not in (200, 201) or not member_expense:
        fail(f"member expense save http {member_status}")
    pass_("organization member REST expense save succeeded")

    member_rev = save_revenue(env, tokens[MEMBER_A_EMAIL], ORG_A, "Member revenue")
    if member_rev[0] in (200, 201):
        fail("employee unexpectedly saved revenue")
    pass_(f"employee REST revenue write failed closed (http {member_rev[0]})")

    admin_status, admin_count = rest_count(env, tokens[ADMIN_A_EMAIL], "ops_projects")
    if admin_status != 200 or not admin_count or admin_count < 1:
        fail(f"admin REST ops_projects http {admin_status} count {admin_count}")
    pass_("organization admin REST can read org A projects")

    acc_status, acc_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ops_expenses")
    if acc_status != 200 or not acc_count or acc_count < 1:
        fail(f"accountant REST ops_expenses http {acc_status} count {acc_count}")
    pass_("accountant REST can read org A expenses")

    acc_write = save_expense(env, tokens[ACCOUNTANT_A_EMAIL], ORG_A, "Accountant write")
    if acc_write[0] in (200, 201):
        fail("accountant unexpectedly saved an expense")
    pass_(f"accountant REST expense write failed closed (http {acc_write[0]})")

    cross = save_expense(env, tokens[OWNER_B_EMAIL], ORG_A, "Cross Org")
    if cross[0] in (200, 201):
        fail("other-organization owner unexpectedly saved into org A")
    pass_(f"other-organization write failed closed (http {cross[0]})")

    b_status, b_count = rest_count(env, tokens[OWNER_B_EMAIL], "ops_expenses", f"?organization_id=eq.{ORG_A}")
    if b_status == 200 and b_count == 0:
        pass_("other-organization owner cannot read org A expenses")
    elif b_status in (401, 403):
        pass_("other-organization owner is denied org A expenses")
    else:
        fail(f"owner B REST org A expenses http {b_status} count {b_count}")

    bad_status, _ = save_expense(env, tokens[OWNER_A_EMAIL], ORG_A, "X", amount_cents=-5)
    if bad_status in (200, 201):
        fail("negative expense write unexpectedly succeeded")
    pass_(f"negative expense write failed closed (http {bad_status})")

    huge_status, _ = save_expense(env, tokens[OWNER_A_EMAIL], ORG_A, "Huge Co", amount_cents=10000000000)
    if huge_status in (200, 201):
        fail("excessively large expense write unexpectedly succeeded")
    pass_(f"excessively large expense write failed closed (http {huge_status})")

    unpaid_paid = save_revenue(env, tokens[OWNER_A_EMAIL], ORG_A, "Missing paid fields", p_payment_status="paid", p_payment_method="", p_paid_date=None)
    if unpaid_paid[0] in (200, 201):
        fail("paid revenue without payment information unexpectedly succeeded")
    pass_(f"paid revenue without payment information failed closed (http {unpaid_paid[0]})")

    rest_insert, payload, _ = request(
        "POST",
        f"{env['REST_URL']}/ops_expenses",
        auth_headers(env, tokens[OWNER_B_EMAIL]),
        {
            "organization_id": ORG_A,
            "transaction_date": "2026-09-20",
            "posted_date": "2026-09-20",
            "vendor": "Direct REST",
            "description": "Bypass UI",
            "pretax_cents": 100,
            "tax_cents": 0,
            "total_cents": 100,
            "currency": "USD",
            "category": "Other",
        },
    )
    if rest_insert in (200, 201):
        fail("direct REST insert into another organization unexpectedly succeeded")
    pass_(f"direct REST bypass insert failed closed (http {rest_insert})")

    print("DAY3_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    os.environ.setdefault("PYTHONHASHSEED", "0")
    main()
