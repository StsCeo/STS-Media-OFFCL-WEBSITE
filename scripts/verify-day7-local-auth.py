#!/usr/bin/env python3
"""Day 7 local Auth + REST schedule/kickoff checks. Never prints secrets or tokens."""
from __future__ import annotations

import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import enroll_totp_aal2, expect_denied_or_empty, jwt_aal, upsert_auth_user

ENV_FILE = Path("/tmp/sts-local/status.env")
PROJECT_MARK = Path("/tmp/sts-local/day7-project.id")
INVOICE_MARK = Path("/tmp/sts-local/day7-invoice.id")
EVENT_MARK = Path("/tmp/sts-local/day7-event.id")
ORG_A = "a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7"
ORG_B = "b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7"
OWNER_A_EMAIL = "owner-a@day7.test"
OWNER_B_EMAIL = "owner-b@day7.test"
ADMIN_A_EMAIL = "admin-a@day7.test"
MEMBER_A_EMAIL = "member-a@day7.test"
ACCOUNTANT_A_EMAIL = "accountant-a@day7.test"
STRANGER_EMAIL = "stranger@day7.test"
LINES = [{"description": "Website quote", "quantity": 2, "unit_cents": 150000, "discount_cents": 5000}]
APP_URL = os.environ.get("DAY7_APP_URL", "http://127.0.0.1:3000")
TODAY = date.today().isoformat()
OVERDUE = (date.today() - timedelta(days=3)).isoformat()
UPCOMING = (date.today() + timedelta(days=14)).isoformat()


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


def estimate_args(organization_id: str, client_id: str | None, title: str = "Day 7 quote") -> dict:
    return {
        "p_organization_id": organization_id,
        "p_id": None,
        "p_client_id": client_id,
        "p_title": title,
        "p_description": "Operational quote",
        "p_issue_date": TODAY,
        "p_expires_on": UPCOMING,
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
    if not PROJECT_MARK.exists() or not INVOICE_MARK.exists() or not EVENT_MARK.exists():
        fail("missing persistence marker for Day 7 records")
    project_id = PROJECT_MARK.read_text().strip()
    invoice_id = INVOICE_MARK.read_text().strip()
    event_id = EVENT_MARK.read_text().strip()
    status, payload, _ = request(
        "GET",
        f"{env['REST_URL']}/ops_projects?id=eq.{project_id}&select=id,organization_id,source_invoice_id,source_estimate_id,stage,notes,description",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(payload, list) or not payload:
        fail(f"persisted kickoff project missing after restart (http {status})")
    row = payload[0]
    if row.get("organization_id") != ORG_A or row.get("source_invoice_id") != invoice_id:
        fail("persisted project source link did not survive restart")
    if row.get("notes") or row.get("description"):
        fail("persisted kickoff project stored source notes or description")
    pass_("kickoff project and source invoice link remained after local restart")

    inv_status, invoices, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?id=eq.{invoice_id}&select=id,status,source_estimate_id",
        auth_headers(env, admin=True),
    )
    if inv_status != 200 or not isinstance(invoices, list) or not invoices:
        fail("persisted converted invoice missing after restart")
    if invoices[0].get("status") != "draft":
        fail("kickoff changed invoice status across restart")
    pass_("converted invoice remained a draft after local restart")

    ev_status, events, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_calendar_events?id=eq.{event_id}&select=id,generated,source_type,source_id,archived_at",
        auth_headers(env, admin=True),
    )
    if ev_status != 200 or not isinstance(events, list) or not events:
        fail("persisted generated calendar event missing after restart")
    event = events[0]
    if event.get("generated") is not True or event.get("source_type") != "project_start":
        fail("persisted generated calendar row lost its source reference")
    pass_("generated schedule entry remained after local restart")
    print("DAY7_LOCAL_AUTH_REST_PASSED")


def signed_out_app_redirect() -> None:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    for path in ("/dashboard/calendar", "/dashboard/invoices", "/dashboard/projects"):
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

    phase = os.environ.get("DAY7_AUTH_PHASE", "all")
    if phase == "persist":
        persist_phase(env)
        return

    signed_out_app_redirect()

    emails = (OWNER_A_EMAIL, OWNER_B_EMAIL, ADMIN_A_EMAIL, MEMBER_A_EMAIL, ACCOUNTANT_A_EMAIL, STRANGER_EMAIL)
    passwords = {email: secrets.token_urlsafe(24) for email in emails}
    ids = {email: upsert_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 7 users")

    ensure_org(env, ORG_A, "day7-test-org-a")
    ensure_org(env, ORG_B, "day7-test-org-b")
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

    a1_status, a1_count = rest_count(env, aal1_tokens[OWNER_A_EMAIL], "ws_calendar_events")
    expect_denied_or_empty(a1_status, a1_count, "AAL1 owner REST calendar read")
    a1_rpc_status, _ = rpc(env, aal1_tokens[OWNER_A_EMAIL], "sts_reconcile_ws_schedule", {
        "p_organization_id": ORG_A,
    })
    if a1_rpc_status in (200, 201):
        fail("AAL1 owner reconciled the schedule")
    pass_("AAL1 reconcile denied")

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

    project_status, dated_project = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ops_project", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_client_id": client_id,
        "p_name": "Launch site",
        "p_description": "",
        "p_stage": "discovery",
        "p_priority": "medium",
        "p_start_date": TODAY,
        "p_due_date": UPCOMING,
        "p_budget_cents": 250000,
        "p_assigned_member_id": None,
        "p_assigned_to": "Owner",
        "p_at_risk": False,
        "p_notes": "",
    })
    if project_status not in (200, 201) or not dated_project:
        fail("could not save dated project")

    task_status, _ = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ops_task", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_project_id": dated_project,
        "p_client_id": client_id,
        "p_title": "Write copy",
        "p_description": "",
        "p_status": "todo",
        "p_priority": "high",
        "p_due_date": OVERDUE,
        "p_assigned_member_id": None,
        "p_assigned_to": "Owner",
        "p_notes": "",
    })
    if task_status not in (200, 201):
        fail("could not save overdue task")

    recon_status, recon_payload = rpc(env, tokens[OWNER_A_EMAIL], "sts_reconcile_ws_schedule", {
        "p_organization_id": ORG_A,
    })
    if recon_status not in (200, 201):
        fail(f"owner reconcile http {recon_status}")
    again_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_reconcile_ws_schedule", {
        "p_organization_id": ORG_A,
    })
    if again_status not in (200, 201):
        fail("repeated reconcile failed")
    gen_status, generated, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_calendar_events?source_id=eq.{dated_project}&source_type=eq.project_start&select=id,generated,title,archived_at",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if gen_status != 200 or not isinstance(generated, list) or len(generated) != 1:
        fail("repeated reconcile created duplicate project_start rows")
    if generated[0].get("generated") is not True:
        fail("generated calendar row was not labeled")
    EVENT_MARK.parent.mkdir(parents=True, exist_ok=True)
    EVENT_MARK.write_text(str(generated[0]["id"]))
    pass_("generated calendar rows are idempotent and labeled")

    hijack_status, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_save_ws_calendar_event", {
        "p_organization_id": ORG_A,
        "p_id": generated[0]["id"],
        "p_title": "Hijack",
        "p_description": "",
        "p_start_at": f"{TODAY}T00:00:00.000Z",
        "p_end_at": f"{TODAY}T23:59:59.000Z",
        "p_all_day": True,
        "p_timezone": "UTC",
        "p_client_id": None,
        "p_project_id": dated_project,
        "p_location": "",
        "p_kind": "team_meeting",
    })
    if hijack_status in (200, 201):
        fail("generated event was rewritten as a manual event")
    pass_("generated event cannot be edited as a manual event")

    delete_status, _, _ = request(
        "DELETE",
        f"{env['REST_URL']}/ws_calendar_events?id=eq.{generated[0]['id']}",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if delete_status in (200, 204):
        fail("authenticated hard-delete of generated calendar event was accepted")
    pass_("authenticated hard-delete of generated calendar event denied")

    sched_status, schedule, _ = request(
        "GET",
        f"{env['REST_URL']}/sts_internal_schedule?select=source_type,occurs_on,title&order=occurs_on.asc",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if sched_status != 200 or not isinstance(schedule, list):
        fail(f"owner could not read internal schedule (http {sched_status})")
    types = {row.get("source_type") for row in schedule}
    if "project_start" not in types or "task_due" not in types:
        fail("unified schedule missing project or task sources")
    pass_("owner can read labeled internal schedule sources")

    member_recon, _ = rpc(env, tokens[MEMBER_A_EMAIL], "sts_reconcile_ws_schedule", {"p_organization_id": ORG_A})
    if member_recon in (200, 201):
        fail("employee reconciled the schedule")
    pass_("employee reconcile denied")
    acc_cal_status, acc_cal_count = rest_count(env, tokens[ACCOUNTANT_A_EMAIL], "ws_calendar_events")
    expect_denied_or_empty(acc_cal_status, acc_cal_count, "accountant REST calendar read")
    pass_("accountant calendar read denied")

    status, estimate_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_save_ws_estimate", estimate_args(ORG_A, client_id))
    if status not in (200, 201) or not estimate_id:
        fail(f"owner estimate save http {status}")
    if set_status(env, tokens[OWNER_A_EMAIL], ORG_A, estimate_id, "ready") not in (200, 201):
        fail("could not mark estimate ready")
    if set_status(env, tokens[OWNER_A_EMAIL], ORG_A, estimate_id, "accepted") not in (200, 201):
        fail("could not mark estimate accepted")
    convert_status, invoice_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_convert_ws_estimate_to_invoice", {
        "p_organization_id": ORG_A,
        "p_estimate_id": estimate_id,
    })
    if convert_status not in (200, 201) or not invoice_id:
        fail(f"accepted estimate conversion http {convert_status}")
    INVOICE_MARK.write_text(invoice_id)

    kick_status, project_id = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_start_project_from_invoice", {
        "p_organization_id": ORG_A,
        "p_invoice_id": invoice_id,
    })
    if kick_status not in (200, 201) or not project_id:
        fail(f"project kickoff http {kick_status}")
    PROJECT_MARK.write_text(project_id)
    again_kick, again_project = rpc_id(env, tokens[OWNER_A_EMAIL], "sts_start_project_from_invoice", {
        "p_organization_id": ORG_A,
        "p_invoice_id": invoice_id,
    })
    if again_kick not in (200, 201) or again_project != project_id:
        fail("repeated kickoff did not return the existing project")
    count_status, projects, _ = request(
        "GET",
        f"{env['REST_URL']}/ops_projects?source_invoice_id=eq.{invoice_id}&select=id,notes,description,stage,source_estimate_id",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if count_status != 200 or not isinstance(projects, list) or len(projects) != 1:
        fail("repeated kickoff created a duplicate project")
    if projects[0].get("notes") or projects[0].get("description"):
        fail("kickoff copied notes or description")
    if projects[0].get("source_estimate_id") != estimate_id:
        fail("kickoff missing source_estimate_id")
    pass_("project kickoff is idempotent and copies only operational snapshot fields")

    inv_status, invoices, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?id=eq.{invoice_id}&select=status",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if inv_status != 200 or not isinstance(invoices, list) or invoices[0].get("status") != "draft":
        fail("kickoff changed invoice status")
    pass_("kickoff left the invoice as a draft")

    member_kick, _ = rpc(env, tokens[MEMBER_A_EMAIL], "sts_start_project_from_invoice", {
        "p_organization_id": ORG_A,
        "p_invoice_id": invoice_id,
    })
    if member_kick in (200, 201):
        fail("employee started a project from an invoice")
    pass_("employee kickoff denied")
    acc_kick, _ = rpc(env, tokens[ACCOUNTANT_A_EMAIL], "sts_start_project_from_invoice", {
        "p_organization_id": ORG_A,
        "p_invoice_id": invoice_id,
    })
    if acc_kick in (200, 201):
        fail("accountant started a project from an invoice")
    pass_("accountant kickoff denied")

    cross_kick, _ = rpc(env, tokens[OWNER_B_EMAIL], "sts_start_project_from_invoice", {
        "p_organization_id": ORG_B,
        "p_invoice_id": invoice_id,
    })
    if cross_kick in (200, 201):
        fail("cross-organization kickoff succeeded")
    other_status, other_count = rest_count(env, tokens[OWNER_B_EMAIL], "ws_calendar_events")
    expect_denied_or_empty(other_status, other_count, "other-organization REST calendar read")
    pass_("cross-organization kickoff and calendar read denied")

    stranger_status, stranger_count = rest_count(env, tokens[STRANGER_EMAIL], "sts_internal_schedule")
    expect_denied_or_empty(stranger_status, stranger_count, "stranger REST schedule read")
    signed_out_status, signed_out_count = rest_count(env, None, "sts_internal_schedule")
    expect_denied_or_empty(signed_out_status, signed_out_count, "signed-out REST schedule read")

    audit_status, audits, _ = request(
        "GET",
        f"{env['REST_URL']}/audit_events?action=eq.project.started_from_invoice&entity_id=eq.{project_id}&select=action,result,metadata",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if audit_status != 200 or not isinstance(audits, list) or not audits:
        fail("kickoff audit missing")
    dumped = json.dumps(audits)
    if any(token in dumped.lower() for token in ("do not email", "customer facing", "website quote")):
        fail("kickoff audit stored notes or line descriptions")
    if "invoice_id" not in dumped or "estimate_id" not in dumped:
        fail("kickoff audit missing identifiers")
    pass_("kickoff audit stores identifiers only")

    recon_audit_status, recon_audits, _ = request(
        "GET",
        f"{env['REST_URL']}/audit_events?action=eq.schedule.reconciled&select=action,metadata",
        auth_headers(env, tokens[OWNER_A_EMAIL]),
    )
    if recon_audit_status != 200 or not isinstance(recon_audits, list) or not recon_audits:
        fail("reconcile audit missing")
    recon_dump = json.dumps(recon_audits)
    if any(token in recon_dump.lower() for token in ("do not email", "customer facing", "website quote")):
        fail("reconcile audit stored notes or line descriptions")
    pass_("reconcile audit stores source counts only")

    print("DAY7_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    main()
