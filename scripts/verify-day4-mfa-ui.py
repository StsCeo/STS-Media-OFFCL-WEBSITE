#!/usr/bin/env python3
"""Interactive MFA UI checks for Day 4 closure. Never prints secrets, QR, tokens, or env values."""
from __future__ import annotations

import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import expect_denied_or_empty, jwt_aal, totp_code

ENV_FILE = Path("/tmp/sts-local/status.env")
APP_URL = os.environ.get("DAY4_APP_URL", "http://127.0.0.1:3000")
OWNER_EMAIL = f"owner-ui-{secrets.token_hex(3)}@day4-mfa.test"
ORG_ID = "f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4"


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


def request(method: str, url: str, headers: dict[str, str], body: dict | bytes | None = None):
    data = None
    if isinstance(body, bytes):
        data = body
    elif body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
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


def secret_from_qr_data_url(src: str) -> str:
    from PIL import Image, ImageOps
    import cairosvg
    from pyzbar.pyzbar import decode as qr_decode

    if not src.startswith("data:image/"):
        fail("enrollment image was not a data URL")
    header, _, payload = src.partition(",")
    if "svg" in header:
        if "base64" in header:
            svg = __import__("base64").b64decode(payload)
        elif payload.lstrip().startswith("<") or payload.lstrip().startswith("<?xml"):
            svg = payload.encode()
        else:
            from urllib.parse import unquote
            svg = unquote(payload).encode()
        svg_text = svg.decode("utf-8", errors="ignore")
        if "otpauth://" in svg_text:
            start = svg_text.index("otpauth://")
            end = start
            while end < len(svg_text) and svg_text[end] not in "\"'<> \n":
                end += 1
            uri = svg_text[start:end]
            query = parse_qs(urlparse(uri).query)
            secret = (query.get("secret") or [""])[0]
            if secret:
                return secret
        png = cairosvg.svg2png(bytestring=svg, output_width=800, output_height=800, background_color="white")
        image = Image.open(BytesIO(png)).convert("L")
        image = ImageOps.autocontrast(image)
    else:
        image = Image.open(BytesIO(__import__("base64").b64decode(payload))).convert("L")
        image = ImageOps.autocontrast(image)
    candidates = [image, ImageOps.invert(image), image.resize((image.width * 2, image.height * 2))]
    for candidate in candidates:
        decoded = qr_decode(candidate)
        if decoded:
            uri = decoded[0].data.decode("utf-8")
            query = parse_qs(urlparse(uri).query)
            secret = (query.get("secret") or [""])[0]
            if secret:
                return secret
        try:
            import zxingcpp
            result = zxingcpp.read_barcode(candidate)
            if result and result.text:
                query = parse_qs(urlparse(result.text).query)
                secret = (query.get("secret") or [""])[0]
                if secret:
                    return secret
        except Exception:
            pass
    fail(f"could not decode enrollment QR in memory (type={header[:48]} len={len(src)})")

    uri = decoded[0].data.decode("utf-8")
    query = parse_qs(urlparse(uri).query)
    secret = (query.get("secret") or [""])[0]
    if not secret:
        fail("enrollment QR did not contain a TOTP secret")
    return secret


def http_redirect(path: str) -> tuple[int, str]:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(f"{APP_URL}{path}", method="GET")
    try:
        with opener.open(req, timeout=15) as resp:
            return resp.status, resp.headers.get("Location") or resp.geturl()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers.get("Location") or ""


def main() -> None:
    env = load_status_env()
    password = secrets.token_urlsafe(24)

    status, payload, _ = request(
        "POST",
        f"{env['API_URL']}/auth/v1/admin/users",
        auth_headers(env, admin=True),
        {"email": OWNER_EMAIL, "password": password, "email_confirm": True},
    )
    user_id = ""
    if status in (200, 201) and isinstance(payload, dict) and payload.get("id"):
        user_id = str(payload["id"])
    else:
        status, payload, _ = request(
            "GET",
            f"{env['API_URL']}/auth/v1/admin/users?email={OWNER_EMAIL}",
            auth_headers(env, admin=True),
        )
        users = payload.get("users") if isinstance(payload, dict) else []
        match = next((item for item in users or [] if item.get("email") == OWNER_EMAIL), None)
        if not match:
            fail(f"could not create disposable MFA owner (http {status})")
        user_id = str(match["id"])
        request(
            "PUT",
            f"{env['API_URL']}/auth/v1/admin/users/{user_id}",
            auth_headers(env, admin=True),
            {"password": password, "email_confirm": True},
        )
    request(
        "POST",
        f"{env['REST_URL']}/organizations",
        auth_headers(env, admin=True),
        {
            "id": ORG_ID,
            "legal_name": "Day4 MFA UI Org",
            "display_name": "Day4 MFA UI",
            "slug": "day4-mfa-ui-org",
            "base_currency": "USD",
            "timezone": "America/New_York",
            "fiscal_year_start": 1,
        },
    )
    request(
        "POST",
        f"{env['REST_URL']}/organization_members",
        auth_headers(env, admin=True),
        {"organization_id": ORG_ID, "user_id": user_id, "role": "owner", "status": "active"},
    )

    dash_status, dash_loc = http_redirect("/dashboard")
    if dash_status not in (301, 302, 303, 307, 308) or "/login" not in dash_loc:
        fail(f"signed-out dashboard did not redirect to login (http {dash_status})")
    pass_("signed-out dashboard redirects to login")

    aal1_status, aal1_payload, _ = request(
        "POST",
        f"{env['API_URL']}/auth/v1/token?grant_type=password",
        auth_headers(env),
        {"email": OWNER_EMAIL, "password": password},
    )
    aal1_token = aal1_payload.get("access_token") if isinstance(aal1_payload, dict) else None
    if aal1_status != 200 or not aal1_token or jwt_aal(str(aal1_token)) != "aal1":
        fail("password sign-in did not produce an AAL1 token")
    pass_("password sign-in produces an AAL1 session")
    notes_status, notes_payload, notes_headers = request(
        "GET",
        f"{env['REST_URL']}/ws_notes?select=id",
        auth_headers(env, str(aal1_token)),
    )
    count = None
    rng = notes_headers.get("Content-Range") or notes_headers.get("content-range")
    if rng and "/" in rng and rng.split("/")[-1].isdigit():
        count = int(rng.split("/")[-1])
    elif isinstance(notes_payload, list):
        count = len(notes_payload)
    expect_denied_or_empty(notes_status, count, "AAL1 session cannot read protected notes")

    from playwright.sync_api import sync_playwright

    totp_secret = ""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{APP_URL}/login", wait_until="networkidle")
            page.fill("#email", OWNER_EMAIL)
            page.fill("#password", password)
            page.get_by_role("button", name="Sign in").click()
            page.wait_for_url(lambda url: "/mfa/" in url or "/auth/locked" in url, timeout=20000)
            if "/auth/locked" in page.url:
                fail("password sign-in was rate-limited")
            if "/mfa/" not in page.url:
                fail("password sign-in did not reach MFA")
            pass_("AAL1 session is held on the MFA path")

            page.goto(f"{APP_URL}/mfa/enroll", wait_until="networkidle")
            page.get_by_role("button", name="Start enrollment").click()
            page.wait_for_selector('img[alt="Authenticator enrollment"]', timeout=20000)
            qr_src = page.locator('img[alt="Authenticator enrollment"]').evaluate("el => el.getAttribute('src') || el.src || ''")
            header = str(qr_src).split(",", 1)[0]
            totp_secret = secret_from_qr_data_url(str(qr_src))
            page.fill("#code", totp_code(totp_secret))
            page.get_by_role("button", name="Finish enrollment").click()
            page.wait_for_url("**/dashboard**", timeout=20000)
            if "/dashboard" not in page.url:
                fail("MFA enrollment did not reach the Command Center")
            pass_("MFA enrollment upgraded the session to AAL2 Command Center")

            page.goto(f"{APP_URL}/dashboard/notes", wait_until="networkidle")
            page.fill('input[name="title"]', "Day 4 MFA closure note")
            page.fill('textarea[name="body"]', "Harmless local note")
            page.get_by_role("button", name="Save note").click()
            page.wait_for_timeout(1500)
            if "Day 4 MFA closure note" not in page.content():
                fail("AAL2 UI did not persist the harmless note")
            pass_("AAL2 UI created a harmless note")

            page.reload(wait_until="networkidle")
            if "Day 4 MFA closure note" not in page.content():
                fail("refresh lost the protected note")
            pass_("refresh preserves the protected session and note")

            page.goto(f"{APP_URL}/dashboard/documents", wait_until="domcontentloaded")
            harmless = Path("/tmp/sts-local/day4-mfa-harmless.txt")
            harmless.parent.mkdir(mode=0o700, exist_ok=True)
            harmless.write_text("harmless local file\n")
            os.chmod(harmless, 0o600)
            page.fill('input[name="name"]', "Day4 MFA harmless.txt")
            page.set_input_files('input[type="file"]', str(harmless))
            page.get_by_role("button", name="Upload document").click()
            page.wait_for_timeout(2500)
            download_link = page.get_by_role("link", name="Download")
            if download_link.count() == 0:
                fail("AAL2 document list did not expose a download link")
            with page.expect_navigation():
                download_link.first.click()
            pass_("private document download used the authorized AAL2 session")
            harmless.unlink(missing_ok=True)

            page.goto(f"{APP_URL}/dashboard/notes", wait_until="networkidle")
            page.get_by_label("Sign out").click()
            page.wait_for_timeout(800)
            cookies = page.context.cookies()
            if any("auth-token" in cookie.get("name", "") and cookie.get("value") for cookie in cookies):
                fail("sign-out left an auth-token cookie")
            pass_("sign-out clears the cookie session")

            page.goto(f"{APP_URL}/dashboard", wait_until="networkidle")
            if "/login" not in page.url:
                fail("protected page did not redirect after sign-out")
            pass_("protected pages redirect to login after sign-out")

            page.goto(f"{APP_URL}/login", wait_until="networkidle")
            second = browser.new_context().new_page()
            second.goto(f"{APP_URL}/login", wait_until="networkidle")
            second.fill("#email", OWNER_EMAIL)
            second.fill("#password", password)
            second.get_by_role("button", name="Sign in").click()
            second.wait_for_url(lambda url: "/mfa/verify" in url or "/auth/locked" in url, timeout=20000)
            if "/auth/locked" in second.url:
                fail("second sign-in was rate-limited")
            if "/mfa/verify" not in second.url:
                fail("second sign-in did not require the MFA challenge")
            second.fill("#code", totp_code(totp_secret))
            second.get_by_role("button", name="Verify").click()
            second.wait_for_url("**/dashboard**", timeout=20000)
            if "/dashboard" not in second.url:
                fail("second MFA challenge did not reach the Command Center")
            pass_("second sign-in requires MFA and grants AAL2")
            browser.close()
    finally:
        totp_secret = ""
        request("DELETE", f"{env['API_URL']}/auth/v1/admin/users/{user_id}", auth_headers(env, admin=True))
        request("DELETE", f"{env['REST_URL']}/organization_members?user_id=eq.{user_id}", auth_headers(env, admin=True))

    notes_status, notes_payload, notes_headers = request(
        "GET",
        f"{env['REST_URL']}/ws_notes?select=id",
        auth_headers(env, str(aal1_token)),
    )
    count = 0
    if isinstance(notes_payload, list):
        count = len(notes_payload)
    expect_denied_or_empty(notes_status, count if notes_status == 200 else 0, "direct AAL1 REST retry remains denied")
    print("DAY4_MFA_UI_PASSED")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
