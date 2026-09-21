#!/usr/bin/env python3
"""Day 9 local Auth + REST client-portal checks. Never prints secrets or tokens."""
from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import enroll_totp_aal2, jwt_aal, upsert_auth_user

ENV_FILE = Path("/tmp/sts-local/status.env")
PUB_MARK = Path("/tmp/sts-local/day9-publication.id")
INV_MARK = Path("/tmp/sts-local/day9-invoice.id")
DOC_MARK = Path("/tmp/sts-local/day9-document.id")
ORG_A = "a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9"
ORG_B = "b9b9b9b9-b9b9-49b9-89b9-b9b9b9b9b9b9"
OWNER_A_EMAIL = "owner-a@day9.test"
OWNER_B_EMAIL = "owner-b@day9.test"
ADMIN_A_EMAIL = "admin-a@day9.test"
EMPLOYEE_A_EMAIL = "employee-a@day9.test"
ACCOUNTANT_A_EMAIL = "accountant-a@day9.test"
CONTRACTOR_A_EMAIL = "contractor-a@day9.test"
CLIENT_A_EMAIL = "client-a@day9.test"
CLIENT_B_EMAIL = "client-b@day9.test"
CLIENT_C_EMAIL = "client-c@day9.test"
STRANGER_EMAIL = "stranger@day9.test"
APP_URL = os.environ.get("DAY9_APP_URL", "http://127.0.0.1:3000")
TODAY = date.today().isoformat()
DUE = (date.today() + timedelta(days=14)).isoformat()
WITHHELD_KEYS = {
    "notes",
    "internal_notes",
    "payment_instructions",
    "client_email",
    "payment_account",
    "payment_method",
    "client_id",
    "project_id",
    "storage_path",
    "budget_cents",
    "assigned_member_id",
    "assigned_to",
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
    import urllib.error
    import urllib.request

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


def rpc(env: dict[str, str], token: str, name: str, body: dict | None = None) -> tuple[int, object]:
    status, payload, _ = request(
        "POST",
        f"{env['REST_URL']}/rpc/{name}",
        auth_headers(env, token),
        body or {},
    )
    return status, payload


def rpc_id(env: dict[str, str], token: str, name: str, body: dict) -> str | None:
    status, payload = rpc(env, token, name, body)
    if status not in (200, 201) or payload in (None, ""):
        return None
    return str(payload)


def assert_minimized(rows: object, label: str) -> None:
    dumped = json.dumps(rows)
    if any(key in dumped for key in ("payment_instructions", "internal_notes", "storage_path", "Wire instructions")):
        fail(f"{label} leaked withheld fields")
    if not isinstance(rows, list):
        return
    for row in rows:
        if not isinstance(row, dict):
            continue
        overlap = WITHHELD_KEYS.intersection(row.keys())
        if overlap:
            fail(f"{label} exposed columns {sorted(overlap)}")


def signed_out_app_redirect() -> None:
    import urllib.error
    import urllib.request

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    for path in ("/client", "/client/invoices/example", "/client/documents/example/download", "/dashboard"):
        req = urllib.request.Request(f"{APP_URL}{path}", method="GET")
        try:
            with opener.open(req, timeout=8) as resp:
                fail(f"signed-out {path} returned http {resp.status}")
        except urllib.error.HTTPError as exc:
            location = exc.headers.get("Location") or ""
            if exc.code in (301, 302, 303, 307, 308) and "/login" in location:
                pass_(f"signed-out {path} redirects to login")
                continue
            if path.endswith("/download") and exc.code in (401, 403, 404):
                pass_(f"signed-out {path} denied")
                continue
            fail(f"signed-out {path} redirect missing (http {exc.code})")
        except urllib.error.URLError:
            print(f"SKIP signed-out app redirect for {path}; local Next.js was not reachable")
            return


def persist_phase(env: dict[str, str]) -> None:
    if not PUB_MARK.exists() or not INV_MARK.exists():
        fail("missing persistence marker for Day 9 records")
    invoice_id = INV_MARK.read_text().strip()
    status, invoices, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?id=eq.{invoice_id}&select=id,organization_id,invoice_number",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(invoices, list) or not invoices:
        fail(f"persisted client invoice missing after restart (http {status})")
    if invoices[0].get("organization_id") != ORG_A:
        fail("persisted invoice changed organization")
    pass_("invoice record remained after local restart")
    status, pubs, _ = request(
        "GET",
        f"{env['REST_URL']}/client_portal_publications?source_id=eq.{invoice_id}&select=id,organization_id,source_type",
        auth_headers(env, admin=True),
    )
    if status != 200 or not isinstance(pubs, list) or not pubs:
        fail("persisted publication missing after restart")
    pass_("publication row remained after local restart")
    print("DAY9_LOCAL_AUTH_REST_PASSED")


def main() -> None:
    env = load_status_env()
    required = ["API_URL", "REST_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]
    if any(not env.get(key) for key in required):
        fail("local status env missing required key names")

    phase = os.environ.get("DAY9_AUTH_PHASE", "all")
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
        CLIENT_B_EMAIL,
        CLIENT_C_EMAIL,
        STRANGER_EMAIL,
    )
    passwords = {email: secrets.token_urlsafe(24) for email in emails}
    ids = {email: upsert_auth_user(env, email, password) for email, password in passwords.items()}
    pass_("admin upserted synthetic Day 9 users")

    ensure_org(env, ORG_A, "day9-test-org-a")
    ensure_org(env, ORG_B, "day9-test-org-b")
    ensure_membership(env, ORG_A, ids[OWNER_A_EMAIL], "owner")
    ensure_membership(env, ORG_B, ids[OWNER_B_EMAIL], "owner")
    ensure_membership(env, ORG_A, ids[ADMIN_A_EMAIL], "administrator")
    ensure_membership(env, ORG_A, ids[EMPLOYEE_A_EMAIL], "employee")
    ensure_membership(env, ORG_A, ids[ACCOUNTANT_A_EMAIL], "accountant")
    ensure_membership(env, ORG_A, ids[CONTRACTOR_A_EMAIL], "contractor")
    ensure_membership(env, ORG_A, ids[CLIENT_A_EMAIL], "client")
    ensure_membership(env, ORG_A, ids[CLIENT_B_EMAIL], "client")
    ensure_membership(env, ORG_B, ids[CLIENT_C_EMAIL], "client")

    aal1_tokens: dict[str, str] = {}
    for email in emails:
        status, token = password_login(env, email, passwords[email])
        if status != 200 or not token:
            fail(f"password login failed (http {status})")
        if jwt_aal(token) != "aal1":
            fail("password session was not AAL1")
        aal1_tokens[email] = token
    pass_("synthetic Day 9 password logins succeeded at AAL1")

    a1_status, a1_payload = rpc(env, aal1_tokens[CLIENT_A_EMAIL], "sts_list_client_portal_invoices")
    if a1_status in (200, 201) and a1_payload:
        fail("AAL1 client listed invoices through the safe read function")
    pass_("AAL1 client invoice read function denied")

    tokens: dict[str, str] = {}
    enroll_emails = (
        OWNER_A_EMAIL,
        OWNER_B_EMAIL,
        ADMIN_A_EMAIL,
        EMPLOYEE_A_EMAIL,
        ACCOUNTANT_A_EMAIL,
        CONTRACTOR_A_EMAIL,
        CLIENT_A_EMAIL,
        CLIENT_B_EMAIL,
        CLIENT_C_EMAIL,
    )
    for email in enroll_emails:
        tokens[email] = enroll_totp_aal2(env, aal1_tokens[email])
        if jwt_aal(tokens[email]) != "aal2":
            fail("MFA session was not AAL2")
    pass_("Day 9 synthetic users reached AAL2")

    crm_a = rpc_id(
        env,
        tokens[OWNER_A_EMAIL],
        "sts_save_crm_client",
        {
            "p_organization_id": ORG_A,
            "p_id": None,
            "p_business_name": "North Client",
            "p_contact_name": "Casey",
            "p_email": "casey@day9.test",
            "p_phone": "555-0100",
            "p_industry": "Auto",
            "p_status": "active",
            "p_notes": "Internal CRM note",
        },
    )
    crm_b = rpc_id(
        env,
        tokens[OWNER_A_EMAIL],
        "sts_save_crm_client",
        {
            "p_organization_id": ORG_A,
            "p_id": None,
            "p_business_name": "East Client",
            "p_contact_name": "Drew",
            "p_email": "drew@day9.test",
            "p_phone": "555-0101",
            "p_industry": "Auto",
            "p_status": "active",
            "p_notes": "Other client note",
        },
    )
    crm_c = rpc_id(
        env,
        tokens[OWNER_B_EMAIL],
        "sts_save_crm_client",
        {
            "p_organization_id": ORG_B,
            "p_id": None,
            "p_business_name": "South Client",
            "p_contact_name": "Riley",
            "p_email": "riley@day9.test",
            "p_phone": "555-0199",
            "p_industry": "Auto",
            "p_status": "active",
            "p_notes": "",
        },
    )
    if not crm_a or not crm_b or not crm_c:
        fail("could not create disposable CRM clients")

    link_a, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_link_client_portal_identity", {
        "p_user_id": ids[CLIENT_A_EMAIL],
        "p_crm_client_id": crm_a,
    })
    link_b, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_link_client_portal_identity", {
        "p_user_id": ids[CLIENT_B_EMAIL],
        "p_crm_client_id": crm_b,
    })
    if link_a not in (200, 201) or link_b not in (200, 201):
        fail("owner could not link client portal identities")
    pass_("owner linked same-organization client mappings")

    emp_link, _ = rpc(env, tokens[EMPLOYEE_A_EMAIL], "sts_link_client_portal_identity", {
        "p_user_id": ids[CLIENT_A_EMAIL],
        "p_crm_client_id": crm_a,
    })
    if emp_link in (200, 201):
        fail("employee linked a client portal identity")
    pass_("employee identity link denied")

    invoice_a = rpc_id(
        env,
        tokens[OWNER_A_EMAIL],
        "sts_save_ws_invoice",
        {
            "p_organization_id": ORG_A,
            "p_id": None,
            "p_client_id": crm_a,
            "p_issue_date": TODAY,
            "p_due_date": DUE,
            "p_currency": "USD",
            "p_notes": "Hidden invoice notes",
            "p_payment_instructions": "Wire instructions",
            "p_discount_cents": 0,
            "p_tax_cents": 0,
            "p_lines": [{"description": "Open work", "quantity": 1, "unit_cents": 15000}],
        },
    )
    invoice_b = rpc_id(
        env,
        tokens[OWNER_A_EMAIL],
        "sts_save_ws_invoice",
        {
            "p_organization_id": ORG_A,
            "p_id": None,
            "p_client_id": crm_b,
            "p_issue_date": TODAY,
            "p_due_date": DUE,
            "p_currency": "USD",
            "p_notes": "East invoice notes",
            "p_payment_instructions": "Private payment",
            "p_discount_cents": 0,
            "p_tax_cents": 0,
            "p_lines": [{"description": "East work", "quantity": 1, "unit_cents": 8800}],
        },
    )
    if not invoice_a or not invoice_b:
        fail("could not create disposable invoices")
    rpc(env, tokens[OWNER_A_EMAIL], "sts_issue_ws_invoice", {"p_organization_id": ORG_A, "p_id": invoice_a})
    rpc(env, tokens[OWNER_A_EMAIL], "sts_issue_ws_invoice", {"p_organization_id": ORG_A, "p_id": invoice_b})

    pub_a, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_publish_client_portal_record", {
        "p_source_type": "invoice",
        "p_source_id": invoice_a,
    })
    pub_b, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_publish_client_portal_record", {
        "p_source_type": "invoice",
        "p_source_id": invoice_b,
    })
    if pub_a not in (200, 201) or pub_b not in (200, 201):
        fail("owner could not publish invoices")
    pass_("owner/admin publication authorization succeeded for owner")
    dup, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_publish_client_portal_record", {
        "p_source_type": "invoice",
        "p_source_id": invoice_a,
    })
    if dup in (200, 201):
        fail("duplicate live publication succeeded")
    pass_("duplicate publication prevention")

    for email, label in (
        (EMPLOYEE_A_EMAIL, "employee"),
        (ACCOUNTANT_A_EMAIL, "accountant"),
        (CONTRACTOR_A_EMAIL, "contractor"),
        (CLIENT_A_EMAIL, "client"),
    ):
        status, _ = rpc(env, tokens[email], "sts_publish_client_portal_record", {
            "p_source_type": "invoice",
            "p_source_id": invoice_a,
        })
        if status in (200, 201):
            fail(f"{label} published a client portal record")
        pass_(f"{label} publication denied")

    listed, payload = rpc(env, tokens[CLIENT_A_EMAIL], "sts_list_client_portal_invoices")
    if listed not in (200, 201) or not isinstance(payload, list) or len(payload) != 1:
        fail("client A AAL2 did not receive exactly one published invoice")
    assert_minimized(payload, "client A invoices")
    if payload[0].get("client_business_name") == "East Client":
        fail("client A received client B invoice identity")
    pass_("client AAL2 access and same-organization client A versus client B isolation")

    listed_b, payload_b = rpc(env, tokens[CLIENT_B_EMAIL], "sts_list_client_portal_invoices")
    if listed_b not in (200, 201) or not isinstance(payload_b, list):
        fail("client B could not list invoices")
    if any(row.get("client_business_name") == "North Client" for row in payload_b if isinstance(row, dict)):
        fail("client B received client A invoice identity")
    pass_("client B isolation from client A")

    listed_c, payload_c = rpc(env, tokens[CLIENT_C_EMAIL], "sts_list_client_portal_invoices")
    if listed_c in (200, 201) and isinstance(payload_c, list) and payload_c:
        fail("cross-organization client listed org A invoices")
    pass_("cross-organization isolation")

    owner_list, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_list_client_portal_invoices")
    if owner_list in (200, 201) and _:
        if isinstance(_, list) and _:
            fail("owner silently used the client invoice read function")
    pass_("owner cannot impersonate a client read session")

    for table in (
        "ws_invoices",
        "ws_estimates",
        "ops_projects",
        "ws_documents",
        "client_portal_publications",
        "client_portal_identities",
    ):
        status, count = rest_count(env, tokens[CLIENT_A_EMAIL], table)
        if status in (200, 201) and (count or 0) > 0:
            fail(f"client received rows from {table}")
        pass_(f"direct base-table access denial for {table}")

    probe_status, probe_payload, _ = request(
        "GET",
        f"{env['REST_URL']}/ws_invoices?select=notes,payment_instructions,client_email,storage_path",
        auth_headers(env, tokens[CLIENT_A_EMAIL]),
    )
    if probe_status in (200, 201) and probe_payload:
        fail("sensitive-column REST probe returned invoice fields")
    pass_("sensitive-column REST probing denial")

    object_status, _ = rpc(env, tokens[CLIENT_A_EMAIL], "sts_client_portal_document_object_name", {"p_id": invoice_a})
    if object_status in (200, 201):
        fail("client executed the document object-name function")
    pass_("storage-path RPC is not granted to authenticated clients")

    write_status, _ = rpc(env, tokens[CLIENT_A_EMAIL], "sts_save_ws_invoice", {
        "p_organization_id": ORG_A,
        "p_id": None,
        "p_client_id": crm_a,
        "p_issue_date": TODAY,
        "p_due_date": DUE,
        "p_currency": "USD",
        "p_notes": "",
        "p_payment_instructions": "",
        "p_discount_cents": 0,
        "p_tax_cents": 0,
        "p_lines": [{"description": "Nope", "quantity": 1, "unit_cents": 100}],
    })
    if write_status in (200, 201):
        fail("client wrote an invoice")
    pass_("direct mutation and write-RPC denial")

    unpub, _ = rpc(env, tokens[OWNER_A_EMAIL], "sts_unpublish_client_portal_record", {
        "p_source_type": "invoice",
        "p_source_id": invoice_a,
    })
    if unpub not in (200, 201):
        fail("owner could not unpublish")
    listed_after, payload_after = rpc(env, tokens[CLIENT_A_EMAIL], "sts_list_client_portal_invoices")
    if listed_after in (200, 201) and isinstance(payload_after, list) and payload_after:
        fail("unpublished invoice remained visible")
    pass_("unpublish access removal")
    rpc(env, tokens[OWNER_A_EMAIL], "sts_publish_client_portal_record", {
        "p_source_type": "invoice",
        "p_source_id": invoice_a,
    })

    audit_status, audits, _ = request(
        "GET",
        f"{env['REST_URL']}/audit_events?organization_id=eq.{ORG_A}&action=like.client_portal.*&select=action,entity_type,result,metadata",
        auth_headers(env, admin=True),
    )
    if audit_status != 200 or not isinstance(audits, list) or not audits:
        fail("client portal audits missing")
    dumped = json.dumps(audits)
    if any(s in dumped for s in ("storage_path", "Wire instructions", "Hidden invoice notes", "https://")):
        fail("client portal audits stored withheld metadata")
    actions = {row.get("action") for row in audits if isinstance(row, dict)}
    if "client_portal.published" not in actions or "client_portal.unpublished" not in actions:
        fail("required publication audit actions missing")
    pass_("sanitized audits")

    PUB_MARK.parent.mkdir(parents=True, exist_ok=True)
    PUB_MARK.write_text(invoice_a)
    INV_MARK.write_text(invoice_a)
    print("DAY9_LOCAL_AUTH_REST_PASSED")


if __name__ == "__main__":
    main()
