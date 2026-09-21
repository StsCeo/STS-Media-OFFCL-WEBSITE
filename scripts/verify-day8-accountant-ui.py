#!/usr/bin/env python3
"""Exercise the dedicated Accountant Center UI with a disposable local accountant.

Never prints passwords, JWTs, cookies, TOTP secrets, CSV bodies, or env values.
"""
from __future__ import annotations

import importlib.util
import os
import secrets
import shutil
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
    verify_status, verified = _request(
        "POST",
        f"{env['API_URL']}/auth/v1/factors/{factor_id}/verify",
        _headers(env, aal1_token),
        {"challenge_id": str(challenge["id"]), "code": totp_code(secret)},
    )
    token = _extract_access_token(verified)
    if verify_status not in (200, 201) or not token or jwt_aal(token) != "aal2":
        fail("UI TOTP verify failed")
    return secret


def write_helper() -> None:
    HELPER.write_text(
        r"""
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const app = process.env.DAY8_APP_URL || "http://127.0.0.1:3000";
const email = process.env.DAY8_UI_EMAIL || "";
const password = process.env.DAY8_UI_PASSWORD || "";
const totpSecret = process.env.DAY8_UI_TOTP_SECRET || "";
const shotDir = process.env.DAY8_SHOT_DIR || "/opt/cursor/artifacts/screenshots";
const downloadDir = process.env.DAY8_DOWNLOAD_DIR || "/tmp/sts-local/day8-csv";
const errorLog = "/tmp/sts-local/day8-ui-errors.txt";
const notes = [];

function fail(msg) {
  try {
    fs.mkdirSync("/tmp/sts-local", { recursive: true });
    fs.writeFileSync(errorLog, notes.concat(msg).join("\n").slice(0, 4000));
  } catch {}
  console.error("FAIL " + msg);
  process.exit(1);
}
function pass(msg) {
  console.log("PASS " + msg);
}
function note(msg) {
  notes.push(String(msg).slice(0, 240));
}
function sanitize(text) {
  return String(text || "")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/sb-[a-z0-9-]+-auth-token=[^;\s]*/gi, "[redacted-cookie]");
}
function base32Decode(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = String(secret).toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of cleaned) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}
function totpNow(secret, nextWindow) {
  return new Promise((resolve) => {
    const compute = () => {
      const key = base32Decode(secret);
      const counter = Math.floor(Date.now() / 1000 / 30);
      const buf = Buffer.alloc(8);
      buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
      buf.writeUInt32BE(counter >>> 0, 4);
      const hmac = crypto.createHmac("sha1", key).update(buf).digest();
      const offset = hmac[hmac.length - 1] & 0xf;
      const code =
        ((hmac[offset] & 0x7f) << 24 |
          hmac[offset + 1] << 16 |
          hmac[offset + 2] << 8 |
          hmac[offset + 3]) %
        1000000;
      resolve(String(code).padStart(6, "0"));
    };
    const remaining = 30 - ((Date.now() / 1000) % 30);
    const waitMs = nextWindow
      ? Math.ceil((remaining + 0.5) * 1000)
      : remaining < 2.5
        ? Math.ceil((remaining + 0.4) * 1000)
        : 0;
    if (waitMs > 0) setTimeout(compute, waitMs);
    else compute();
  });
}

async function waitPath(page, allowed, timeout = 45000) {
  await page.waitForFunction(
    (paths) => paths.includes(location.pathname),
    { timeout },
    allowed,
  );
}

async function redactVisibleEmail(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("span, p")) {
      if (/@/.test(el.textContent || "")) el.textContent = "signed-in";
    }
  });
}

fs.mkdirSync("/tmp/sts-local", { recursive: true });
fs.mkdirSync(shotDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: process.env.DISPLAY ? false : "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.setDefaultTimeout(45000);
page.setDefaultNavigationTimeout(45000);

page.on("pageerror", (err) => note("pageerror " + sanitize(err && err.message)));
page.on("requestfailed", (req) => {
  const failure = req.failure();
  const text = sanitize((failure && failure.errorText) || "failed");
  if (req.resourceType() === "document" || req.url().includes("/accountant")) {
    note("requestfailed " + req.resourceType() + " " + text);
  }
});
page.on("response", (res) => {
  const url = res.url();
  if (!url.includes("/accountant") && !url.includes("/mfa") && !url.includes("/login")) return;
  if (res.status() >= 400) note("http " + res.status() + " " + (new URL(url)).pathname);
});

await page.goto(app + "/login?next=/accountant", { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[name="email"]');
await page.click('input[name="email"]');
await page.keyboard.type(email, { delay: 0 });
await page.click('input[name="password"]');
await page.keyboard.type(password, { delay: 0 });
await page.click('form button[type="submit"]');
try {
  await page.waitForFunction(() => {
    const path = location.pathname;
    if (path === "/mfa/verify") return true;
    if (document.querySelector("input[name='code']")) return true;
    if (document.querySelector("[data-surface='accountant']")) return true;
    return false;
  }, { timeout: 45000 });
} catch {
  note("after password url=" + sanitize(page.url()));
  fail("password sign-in did not open MFA or Accountant Center");
}

const needsMfa = new URL(page.url()).pathname === "/mfa/verify" || Boolean(await page.$("input[name='code']"));
if (needsMfa) {
  await page.waitForSelector('input[name="code"]');
  const fresh = await totpNow(totpSecret, true);
  await page.click('input[name="code"]', { clickCount: 3 });
  await page.keyboard.type(fresh, { delay: 0 });
  await page.click('form button[type="submit"]');
  try {
    await page.waitForFunction(() => Boolean(document.querySelector("[data-surface='accountant']")), { timeout: 45000 });
  } catch {
    const body = sanitize(await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => ""));
    note("after MFA url=" + sanitize(page.url()) + " body=" + body.slice(0, 240));
    fail("MFA did not open Accountant Center");
  }
}

if (new URL(page.url()).pathname !== "/accountant") fail("AAL2 accountant did not land on /accountant");

try {
  await page.waitForSelector("[data-surface='accountant']", { timeout: 45000 });
} catch {
  const htmlEarly = sanitize(await page.content());
  fs.writeFileSync("/tmp/sts-local/day8-html.txt", htmlEarly.slice(0, 8000));
  fail("Accountant Center surface marker was not observed");
}

await page.waitForFunction(() => {
  const root = document.querySelector("[data-surface='accountant']");
  const text = (root && root.innerText) || "";
  return /Paid revenue/i.test(text) && /Accountant Center/i.test(text);
}, { timeout: 45000 }).catch(async () => {
  const html = sanitize(await page.content());
  fs.writeFileSync("/tmp/sts-local/day8-html.txt", html.slice(0, 8000));
  fail("Accountant Center document did not finish rendering financial summary");
});

const html = await page.content();
const text = await page.evaluate(() => {
  const root = document.querySelector("[data-surface='accountant']");
  return root ? root.innerText : "";
});
if (/<!--\$-->\s*<!--\/\$-->/.test(html) && !/Paid revenue/i.test(text)) {
  fail("Accountant Center RSC payload was empty");
}
if (!/Accountant Center/i.test(text)) fail("Accountant Center heading missing");
if (!/not tax returns/i.test(text)) fail("operational-not-tax disclaimer missing");
if (!/Estimates and quotes are not recognized revenue/i.test(html + text)) fail("estimates disclaimer missing");
if (!/Invoices/i.test(text) || !/Expenses/i.test(text) || !/Revenue/i.test(text)) {
  fail("invoice, expense, or revenue section missing");
}
if (!/Sanitized finance audit/i.test(text)) fail("sanitized audit section missing");
if (/sts_save_|sts_archive_|sts_issue_|sts_record_ws_invoice_payment|sts_reconcile_/.test(html)) {
  fail("write RPC names leaked into accountant page");
}
if (/type=["']submit["']/i.test(html) && /sts_save_|Save expense|Issue invoice|Record payment/i.test(html + text)) {
  fail("mutation controls present on Accountant Center");
}
await redactVisibleEmail(page);
await page.screenshot({ path: path.join(shotDir, "accountant_center_desktop.png"), fullPage: true });
pass("accountant AAL2 desktop Accountant Center rendered read-only");

await page.goto(app + "/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-surface="accountant"]', { timeout: 20000 });
if (new URL(page.url()).pathname !== "/accountant") fail("accountant /dashboard did not bounce to /accountant");
pass("accountant is bounced from Command Center");

async function checkCsv(kind, headerNeedle) {
  const result = await page.evaluate(async (exportKind) => {
    const res = await fetch("/accountant/export/" + exportKind, { credentials: "same-origin" });
    const disp = res.headers.get("content-disposition") || "";
    const type = res.headers.get("content-type") || "";
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      disp,
      type,
      hasNotes: /notes|payment_instructions|casey@|555-0100|Hidden/i.test(text),
      formula: /(?:^|,)[=+\-@]/m.test(text),
      header: text.split(/\r?\n/)[0] || "",
      bytes: text.length,
    };
  }, kind);
  if (!result.ok) fail(kind + " CSV download was not authorized (http " + result.status + ")");
  if (!new RegExp('filename="sts-accountant-' + kind + '-\\d{8}\\.csv"').test(result.disp)) {
    fail(kind + " CSV filename is not safe");
  }
  if (!/text\/csv/.test(result.type)) fail(kind + " CSV content-type missing");
  if (!result.header.includes(headerNeedle)) fail(kind + " CSV header missing " + headerNeedle);
  if (result.hasNotes) fail(kind + " CSV contained withheld fields");
  if (result.formula) fail(kind + " CSV left a formula-injection prefix unescaped");
  pass("authenticated " + kind + " CSV used a safe filename without withheld fields");
}

await checkCsv("invoices", "invoice_number");
await checkCsv("revenue", "earned_date");
await checkCsv("expenses", "transaction_date");

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(app + "/accountant", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-surface='accountant']", { timeout: 20000 });
const menu = await page.$('button[aria-label="Open menu"]');
if (menu) await menu.click();
await redactVisibleEmail(page);
await page.screenshot({ path: path.join(shotDir, "accountant_center_mobile.png"), fullPage: true });
const mobile = await page.evaluate(() => document.body ? document.body.innerText : "");
if (!/Accountant Center/i.test(mobile)) fail("mobile Accountant Center missing");
pass("mobile Accountant Center layout rendered");

const signOut = await page.$('button[aria-label="Sign out"]');
if (!signOut) fail("sign out control missing");
await signOut.click();
await waitPath(page, ["/sign-out", "/login"]);
pass("sign out left Accountant Center");

const signedOut = await browser.newPage();
await signedOut.goto(app + "/accountant", { waitUntil: "domcontentloaded" });
if (!signedOut.url().includes("/login")) fail("signed-out accountant UI did not redirect to login");
await signedOut.screenshot({ path: path.join(shotDir, "accountant_signed_out_login.png"), fullPage: true });
pass("signed-out /accountant opens login");

await signedOut.goto(app + "/accountant/export/invoices", { waitUntil: "domcontentloaded" });
const exportUrl = signedOut.url();
const exportStatus = await signedOut.evaluate(() => document.body ? document.body.innerText : "");
if (!exportUrl.includes("/login") && !/unauthorized|sign in/i.test(exportStatus + exportUrl)) {
  fail("signed-out export URL did not redirect to login");
}
pass("signed-out export URL redirects to login");

await browser.close();
console.log("DAY8_ACCOUNTANT_UI_PASSED");
""",
        encoding="utf-8",
    )


def main() -> None:
    env = auth.load_status_env()
    password = secrets.token_urlsafe(24)
    user_id = upsert_auth_user(env, UI_EMAIL, password)
    auth.ensure_org(env, auth.ORG_A, "day8-test-org-a")
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
            "DAY8_UI_TOTP_SECRET": secret,
            "DAY8_SHOT_DIR": str(SHOT_DIR),
            "DAY8_DOWNLOAD_DIR": str(DOWNLOAD_DIR),
        }
    )
    node_cmd = ["node", str(HELPER)]
    xvfb = shutil.which("xvfb-run")
    if xvfb and not env_run.get("DISPLAY"):
        node_cmd = [xvfb, "-a", *node_cmd]
    result = subprocess.run(
        node_cmd,
        cwd=str(NPM_PREFIX),
        env=env_run,
        check=False,
    )
    secret = ""
    password = ""
    env_run["DAY8_UI_PASSWORD"] = ""
    env_run["DAY8_UI_TOTP_SECRET"] = ""
    if result.returncode != 0:
        extra = Path("/tmp/sts-local/day8-ui-errors.txt")
        if extra.exists():
            for line in extra.read_text(errors="replace").splitlines()[:12]:
                low = line.lower()
                if any(token in low for token in ("password", "totp", "secret", "cookie", "jwt", "bearer", "service_role")):
                    print("[redacted]", file=sys.stderr)
                else:
                    print(line[:240], file=sys.stderr)
        fail("accountant UI browser checks failed")
    print("DAY8_ACCOUNTANT_UI_PASSED")


if __name__ == "__main__":
    main()
