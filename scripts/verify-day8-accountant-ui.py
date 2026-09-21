#!/usr/bin/env python3
"""Exercise the dedicated Accountant Center UI with a disposable local accountant.

Never prints passwords, JWTs, cookies, TOTP secrets, CSV bodies, or env values.
"""
from __future__ import annotations

import importlib.util
import os
import secrets
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_aal import (  # noqa: E402
    _clear_existing_factors,
    _extract_access_token,
    _headers,
    _request,
    jwt_aal,
    jwt_claim,
    totp_code,
    upsert_auth_user,
)

AUTH_SPEC = importlib.util.spec_from_file_location(
    "verify_day8_local_auth",
    Path(__file__).resolve().parent / "verify-day8-local-auth.py",
)
auth = importlib.util.module_from_spec(AUTH_SPEC)
assert AUTH_SPEC and AUTH_SPEC.loader
AUTH_SPEC.loader.exec_module(auth)

APP_URL = os.environ.get("DAY8_APP_URL", "http://127.0.0.1:3000")
UI_EMAIL = "accountant-ui@day8.test"
SHOT_DIR = Path("/opt/cursor/artifacts/screenshots")
DOWNLOAD_DIR = Path("/tmp/sts-local/day8-csv")
NPM_PREFIX = Path("/tmp/day8-ui")
HELPER = NPM_PREFIX / "day8-ui.mjs"


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def enroll_ui_totp(env: dict[str, str], aal1_token: str) -> str:
    _clear_existing_factors(env, jwt_claim(aal1_token, "sub"))
    status, payload = _request(
        "POST",
        f"{env['API_URL']}/auth/v1/factors",
        _headers(env, aal1_token),
        {"factor_type": "totp", "friendly_name": "day8-ui"},
    )
    if status not in (200, 201) or not isinstance(payload, dict):
        fail(f"UI TOTP enroll failed (http {status})")
    factor_id = str(payload.get("id") or "")
    totp = payload.get("totp") if isinstance(payload.get("totp"), dict) else {}
    secret = str(totp.get("secret") or "")
    payload["totp"] = {"redacted": True}
    if not factor_id or not secret:
        fail("UI TOTP enroll missing factor")
    challenge_status, challenge = _request(
        "POST",
        f"{env['API_URL']}/auth/v1/factors/{factor_id}/challenge",
        _headers(env, aal1_token),
        {},
    )
    if challenge_status not in (200, 201) or not isinstance(challenge, dict) or not challenge.get("id"):
        fail("UI TOTP challenge failed")
    code = totp_code(secret)
    verify_status, verified = _request(
        "POST",
        f"{env['API_URL']}/auth/v1/factors/{factor_id}/verify",
        _headers(env, aal1_token),
        {"challenge_id": str(challenge["id"]), "code": code},
    )
    token = _extract_access_token(verified)
    if verify_status not in (200, 201) or not token or jwt_aal(token) != "aal2":
        fail("UI TOTP verify failed")
    return secret


def next_totp_code(secret: str) -> str:
    now = time.time()
    wait = 30 - (now % 30) + 0.4
    time.sleep(wait)
    return totp_code(secret)


def write_helper() -> None:
    HELPER.write_text(
        r"""
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const app = process.env.DAY8_APP_URL || "http://127.0.0.1:3000";
const email = process.env.DAY8_UI_EMAIL || "";
const password = process.env.DAY8_UI_PASSWORD || "";
const code = process.env.DAY8_UI_CODE || "";
const shotDir = process.env.DAY8_SHOT_DIR || "/opt/cursor/artifacts/screenshots";
const downloadDir = process.env.DAY8_DOWNLOAD_DIR || "/tmp/sts-local/day8-csv";

function fail(msg) {
  console.error("FAIL " + msg);
  process.exit(1);
}
function pass(msg) {
  console.log("PASS " + msg);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.setDefaultTimeout(25000);

await page.goto(app + "/login?next=/accountant", { waitUntil: "load" });
await page.waitForSelector('input[name="email"]');
await page.click('input[name="email"]');
await page.keyboard.type(email, { delay: 0 });
await page.click('input[name="password"]');
await page.keyboard.type(password, { delay: 0 });
await Promise.all([
  page.click('form button[type="submit"]'),
  page.waitForNavigation({ waitUntil: "load" }).catch(() => {}),
]);
await page.waitForFunction(
  () => location.pathname === "/mfa/verify" || location.pathname === "/accountant",
  { timeout: 20000 },
);
if (new URL(page.url()).pathname === "/mfa/verify") {
  const fresh = process.env.DAY8_UI_CODE || code;
  await page.waitForSelector('input[name="code"]');
  await page.click('input[name="code"]');
  await page.keyboard.type(fresh, { delay: 0 });
  await Promise.all([
    page.click('form button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "load" }).catch(() => {}),
  ]);
  try {
    await page.waitForFunction(
      () => location.pathname === "/accountant",
      { timeout: 20000 },
    );
  } catch {
    fail("MFA did not open Accountant Center");
  }
}
if (new URL(page.url()).pathname !== "/accountant") fail("AAL2 accountant did not land on /accountant");
await page.waitForSelector("[data-surface='accountant']", { timeout: 20000 });
const html = await page.content();
const text = await page.evaluate(() => document.body ? document.body.innerText : "");
fs.mkdirSync("/tmp/sts-local", { recursive: true });
fs.writeFileSync("/tmp/sts-local/day8-html.txt", html.slice(0, 8000));
fs.writeFileSync("/tmp/sts-local/day8-page-url.txt", page.url() + "\n" + text.slice(0, 2000));
await page.screenshot({ path: path.join(shotDir, "accountant_center_desktop.png"), fullPage: true }).catch(() => {});
if (!/Accountant Center/i.test(html + text)) fail("Accountant Center heading missing");
if (!/not tax returns/i.test(html + text)) fail("operational-not-tax disclaimer missing");
if (!/Estimates and quotes are not recognized revenue/i.test(html)) fail("estimates disclaimer missing");
if (/sts_save_|sts_archive_|sts_issue_|sts_record_ws_invoice_payment|sts_reconcile_/.test(html)) {
  fail("write RPC names leaked into accountant page");
}
await page.screenshot({ path: path.join(shotDir, "accountant_center_desktop.png"), fullPage: true });
pass("accountant AAL2 desktop Accountant Center is read-only");

await page.goto(app + "/dashboard", { waitUntil: "load" });
await page.waitForSelector('[data-surface="accountant"]', { timeout: 20000 });
if (new URL(page.url()).pathname !== "/accountant") fail("accountant /dashboard did not bounce to /accountant");
pass("accountant is bounced from Command Center");

const csvText = await page.evaluate(async () => {
  const res = await fetch("/accountant/export/invoices", { credentials: "same-origin" });
  const disp = res.headers.get("content-disposition") || "";
  const type = res.headers.get("content-type") || "";
  const text = await res.text();
  return {
    ok: res.ok,
    disp,
    type,
    hasNotes: /notes|payment_instructions|casey@|555-0100|Hidden/i.test(text),
    formula: /(?:^|,)[=+\-@]/m.test(text),
    header: text.split(/\r?\n/)[0] || "",
  };
});
if (!csvText.ok) fail("invoices CSV download was not authorized");
if (!/filename="sts-accountant-invoices-\d{8}\.csv"/.test(csvText.disp)) fail("CSV filename is not safe");
if (!/text\/csv/.test(csvText.type)) fail("CSV content-type missing");
if (!/invoice_number/.test(csvText.header)) fail("CSV header missing invoice_number");
if (csvText.hasNotes) fail("CSV contained withheld fields");
if (csvText.formula) fail("CSV left a formula-injection prefix unescaped");
pass("authenticated invoices CSV used a safe filename without withheld fields");

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(app + "/accountant", { waitUntil: "load" });
const menu = await page.$('button[aria-label="Open menu"]');
if (menu) await menu.click();
await page.screenshot({ path: path.join(shotDir, "accountant_center_mobile.png"), fullPage: true });
const mobile = await page.content();
if (!/Accountant Center/i.test(mobile)) fail("mobile Accountant Center missing");
pass("mobile Accountant Center layout rendered");

const signedOut = await browser.newPage();
await signedOut.deleteCookie(...(await page.cookies()));
await signedOut.goto(app + "/accountant", { waitUntil: "domcontentloaded" });
if (!signedOut.url().includes("/login")) fail("signed-out accountant UI did not redirect to login");
await signedOut.screenshot({ path: path.join(shotDir, "accountant_signed_out_login.png"), fullPage: true });
pass("signed-out /accountant opens login");

fs.mkdirSync(downloadDir, { recursive: true });
await browser.close();
console.log("DAY8_ACCOUNTANT_UI_PASSED");
""",
        encoding="utf-8",
    )


def main() -> None:
    env = auth.load_status_env()
    password = secrets.token_urlsafe(24)
    user_id = upsert_auth_user(env, UI_EMAIL, password)
    auth.ensure_membership(env, auth.ORG_A, user_id, "accountant")
    status, aal1 = auth.password_login(env, UI_EMAIL, password)
    if status != 200 or not aal1 or jwt_aal(aal1) != "aal1":
        fail("UI accountant password login did not produce AAL1")
    secret = enroll_ui_totp(env, aal1)
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    NPM_PREFIX.mkdir(parents=True, exist_ok=True)
    if not (NPM_PREFIX / "node_modules" / "puppeteer-core").exists():
        installed = subprocess.run(
            ["npm", "install", "--prefix", str(NPM_PREFIX), "puppeteer-core@24.15.0"],
            check=False,
            capture_output=True,
            text=True,
        )
        if installed.returncode != 0:
            fail("could not install local puppeteer-core for UI checks")
    write_helper()
    env_run = os.environ.copy()
    env_run.update(
        {
            "DAY8_APP_URL": APP_URL,
            "DAY8_UI_EMAIL": UI_EMAIL,
            "DAY8_UI_PASSWORD": password,
            "DAY8_UI_CODE": next_totp_code(secret),
            "DAY8_SHOT_DIR": str(SHOT_DIR),
            "DAY8_DOWNLOAD_DIR": str(DOWNLOAD_DIR),
        }
    )
    result = subprocess.run(
        ["node", str(HELPER)],
        cwd=str(NPM_PREFIX),
        env=env_run,
        check=False,
    )
    secret = ""
    password = ""
    env_run["DAY8_UI_PASSWORD"] = ""
    env_run["DAY8_UI_CODE"] = ""
    if result.returncode != 0:
        fail("accountant UI browser checks failed")
    print("DAY8_ACCOUNTANT_UI_PASSED")


if __name__ == "__main__":
    main()
