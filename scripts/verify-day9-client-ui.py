#!/usr/bin/env python3
"""Exercise the dedicated Client Portal UI with a disposable local client.

Never prints passwords, JWTs, cookies, TOTP secrets, document contents, signed URLs, or env values.
"""
from __future__ import annotations

import importlib.util
import os
import secrets
import shutil
import subprocess
import sys
import uuid
from datetime import date, timedelta
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
    "verify_day9_local_auth",
    Path(__file__).resolve().parent / "verify-day9-local-auth.py",
)
auth = importlib.util.module_from_spec(AUTH_SPEC)
assert AUTH_SPEC and AUTH_SPEC.loader
AUTH_SPEC.loader.exec_module(auth)

APP_URL = os.environ.get("DAY9_APP_URL", "http://127.0.0.1:3000")
UI_EMAIL = "client-ui@day9.test"
OWNER_EMAIL = "owner-ui@day9.test"
SHOT_DIR = Path("/opt/cursor/artifacts/screenshots")
DOWNLOAD_DIR = Path("/tmp/sts-local/day9-docs")
NPM_PREFIX = Path("/tmp/day9-ui")
HELPER = NPM_PREFIX / "day9-ui.mjs"
DOC_ID_FILE = Path("/tmp/sts-local/day9-ui-document.id")
TODAY = date.today().isoformat()
DUE = (date.today() + timedelta(days=14)).isoformat()


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def enroll_ui_totp(env: dict[str, str], aal1_token: str, name: str) -> str:
    _clear_existing_factors(env, jwt_claim(aal1_token, "sub"))
    status, payload = _request(
        "POST",
        f"{env['API_URL']}/auth/v1/factors",
        _headers(env, aal1_token),
        {"factor_type": "totp", "friendly_name": name},
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


def seed_published_records(env: dict[str, str], owner_token: str, owner_id: str, client_id: str) -> str:
    crm_id = auth.rpc_id(
        env,
        owner_token,
        "sts_save_crm_client",
        {
            "p_organization_id": auth.ORG_A,
            "p_id": None,
            "p_business_name": "Portal Client",
            "p_contact_name": "Casey",
            "p_email": "casey-ui@day9.test",
            "p_phone": "555-0144",
            "p_industry": "Auto",
            "p_status": "active",
            "p_notes": "Internal CRM note",
        },
    )
    if not crm_id:
        fail("could not save UI CRM client")
    link_status, _ = auth.rpc(env, owner_token, "sts_link_client_portal_identity", {
        "p_user_id": client_id,
        "p_crm_client_id": crm_id,
    })
    if link_status not in (200, 201):
        fail("could not link UI client mapping")
    invoice_id = auth.rpc_id(
        env,
        owner_token,
        "sts_save_ws_invoice",
        {
            "p_organization_id": auth.ORG_A,
            "p_id": None,
            "p_client_id": crm_id,
            "p_issue_date": TODAY,
            "p_due_date": DUE,
            "p_currency": "USD",
            "p_notes": "Hidden invoice notes",
            "p_payment_instructions": "Wire instructions",
            "p_discount_cents": 0,
            "p_tax_cents": 0,
            "p_lines": [{"description": "Portal work", "quantity": 1, "unit_cents": 12500}],
        },
    )
    if not invoice_id:
        fail("could not save UI invoice")
    auth.rpc(env, owner_token, "sts_issue_ws_invoice", {"p_organization_id": auth.ORG_A, "p_id": invoice_id})
    pub_status, _ = auth.rpc(env, owner_token, "sts_publish_client_portal_record", {
        "p_source_type": "invoice",
        "p_source_id": invoice_id,
    })
    if pub_status not in (200, 201):
        fail("could not publish UI invoice")

    document_id = str(uuid.uuid4())
    object_name = f"{auth.ORG_A}/{document_id}/welcome.txt"
    upload_status, _, _ = auth.request(
        "POST",
        f"{env['API_URL']}/storage/v1/object/org-documents/{object_name}",
        {
            **auth.auth_headers(env, owner_token, json_body=False),
            "Content-Type": "text/plain",
            "x-upsert": "true",
        },
        b"hello portal",
    )
    if upload_status not in (200, 201):
        fail(f"could not upload UI document (http {upload_status})")
    saved = auth.rpc_id(
        env,
        owner_token,
        "sts_save_ws_document",
        {
            "p_organization_id": auth.ORG_A,
            "p_id": document_id,
            "p_storage_path": object_name,
            "p_display_filename": "welcome.txt",
            "p_content_type": "text/plain",
            "p_byte_size": 12,
            "p_description": "Harmless local test document",
            "p_category": "other",
            "p_client_id": crm_id,
            "p_project_id": None,
        },
    )
    if not saved:
        fail("could not save UI document metadata")
    doc_pub, _ = auth.rpc(env, owner_token, "sts_publish_client_portal_record", {
        "p_source_type": "document",
        "p_source_id": document_id,
    })
    if doc_pub not in (200, 201):
        fail("could not publish UI document")
    DOC_ID_FILE.parent.mkdir(parents=True, exist_ok=True)
    DOC_ID_FILE.write_text(document_id)
    return document_id


def write_helper() -> None:
    HELPER.write_text(
        r"""
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const app = process.env.DAY9_APP_URL || "http://127.0.0.1:3000";
const email = process.env.DAY9_UI_EMAIL || "";
const password = process.env.DAY9_UI_PASSWORD || "";
const totpSecret = process.env.DAY9_UI_TOTP_SECRET || "";
const shotDir = process.env.DAY9_SHOT_DIR || "/opt/cursor/artifacts/screenshots";
const downloadDir = process.env.DAY9_DOWNLOAD_DIR || "/tmp/sts-local/day9-docs";
const documentId = process.env.DAY9_DOCUMENT_ID || "";
const errorLog = "/tmp/sts-local/day9-ui-errors.txt";
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
    .replace(/https?:\/\/[^\s"]+/g, "[redacted-url]");
}
function totpNow(secret, nextWindow) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = String(secret).replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const ch of cleaned) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 30000) + (nextWindow ? 1 : 0);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
  return code;
}
async function waitPath(page, prefixes, timeout) {
  await page.waitForFunction((needles) => needles.some((item) => location.pathname.startsWith(item)), { timeout }, prefixes);
}
async function redactVisibleEmail(page) {
  await page.evaluate(() => {
    document.querySelectorAll("span, p, td, dd").forEach((el) => {
      if (/@/.test(el.textContent || "")) el.textContent = "[redacted-email]";
    });
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

await page.goto(app + "/login?next=/client", { waitUntil: "domcontentloaded" });
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
    if (document.querySelector("[data-surface='client']")) return true;
    return false;
  }, { timeout: 45000 });
} catch {
  note("after password url=" + sanitize(page.url()));
  fail("password sign-in did not open MFA or Client Portal");
}

const needsMfa = new URL(page.url()).pathname === "/mfa/verify" || Boolean(await page.$("input[name='code']"));
if (needsMfa) {
  await page.waitForSelector('input[name="code"]');
  const fresh = totpNow(totpSecret, false);
  await page.click('input[name="code"]', { clickCount: 3 });
  await page.keyboard.type(fresh, { delay: 0 });
  await page.click('form button[type="submit"]');
  try {
    await page.waitForFunction(() => Boolean(document.querySelector("[data-surface='client']")), { timeout: 45000 });
  } catch {
    const body = sanitize(await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => ""));
    note("after MFA url=" + sanitize(page.url()) + " body=" + body.slice(0, 240));
    fail("MFA did not open Client Portal");
  }
}

if (new URL(page.url()).pathname !== "/client") fail("AAL2 client did not land on /client");
await page.waitForSelector("[data-surface='client']", { timeout: 45000 });
await page.waitForFunction(() => {
  const root = document.querySelector("[data-surface='client']");
  const text = (root && root.innerText) || "";
  return /Client portal/i.test(text) && /read-only/i.test(text);
}, { timeout: 45000 }).catch(async () => {
  const html = sanitize(await page.content());
  fs.writeFileSync("/tmp/sts-local/day9-html.txt", html.slice(0, 8000));
  fail("Client Portal did not finish rendering");
});

const html = await page.content();
const text = await page.evaluate(() => {
  const root = document.querySelector("[data-surface='client']");
  return root ? root.innerText : "";
});
if (!/Published invoices/i.test(text)) fail("published invoices section missing");
if (!/Published estimates/i.test(text)) fail("published estimates section missing");
if (!/Payments, signatures, messaging, and uploads are not available/i.test(html + text) && !/read-only/i.test(text)) {
  fail("unavailable-capabilities copy missing");
}
if (/sts_save_|Issue invoice|Record payment|Publish to/i.test(html + text)) {
  fail("mutation controls present on Client Portal");
}
if (/storage_path|org-documents|signedUrl|Wire instructions|Hidden invoice notes/i.test(html + text)) {
  fail("withheld fields appeared in Client Portal HTML");
}
await redactVisibleEmail(page);
await page.screenshot({ path: path.join(shotDir, "client_portal_desktop.png"), fullPage: true });
pass("client AAL2 desktop portal rendered read-only");

if (documentId) {
  const result = await page.evaluate(async (id) => {
    const res = await fetch("/client/documents/" + id + "/download", { credentials: "same-origin" });
    const disp = res.headers.get("content-disposition") || "";
    const type = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    return {
      ok: res.ok,
      status: res.status,
      disp,
      type,
      bytes: buf.byteLength,
      location: res.url && res.url.includes("/storage/") ? "storage" : "app",
    };
  }, documentId);
  if (!result.ok) fail("document download was not authorized (http " + result.status + ")");
  if (!/attachment/i.test(result.disp)) fail("document download was not an attachment");
  if (result.location === "storage") fail("document download exposed a storage URL");
  if (result.bytes < 1) fail("document download was empty");
  pass("authenticated document download succeeded without exposing a storage URL");
}

await page.goto(app + "/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-surface="client"]', { timeout: 20000 });
if (new URL(page.url()).pathname !== "/client") fail("client /dashboard did not bounce to /client");
pass("client is bounced from Command Center");

const invoiceLink = await page.$('a[href^="/client/invoices/"]');
if (invoiceLink) {
  await invoiceLink.click();
  await page.waitForSelector(".client-invoice", { timeout: 20000 });
  const invoiceText = await page.evaluate(() => document.body ? document.body.innerText : "");
  if (!/Invoice/i.test(invoiceText) || !/Scars to Stars Media/i.test(invoiceText)) fail("client invoice presentation missing STS branding");
  if (/Wire instructions|Hidden invoice notes|payment/i.test(invoiceText)) fail("client invoice exposed withheld fields");
  await redactVisibleEmail(page);
  await page.screenshot({ path: path.join(shotDir, "client_portal_invoice_desktop.png"), fullPage: true });
  pass("client invoice presentation rendered");
}

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(app + "/client", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-surface='client']", { timeout: 20000 });
const menu = await page.$('button[aria-label="Open menu"]');
if (menu) await menu.click();
await redactVisibleEmail(page);
await page.screenshot({ path: path.join(shotDir, "client_portal_mobile.png"), fullPage: true });
const mobile = await page.evaluate(() => document.body ? document.body.innerText : "");
if (!/Client portal/i.test(mobile)) fail("mobile Client Portal missing");
pass("mobile Client Portal layout rendered");

const closeMenu = await page.$('button[aria-label="Close menu"]');
if (closeMenu) await closeMenu.click();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(app + "/client", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-surface='client']", { timeout: 20000 });
const signOut = await page.$('header button[aria-label="Sign out"], button[aria-label="Sign out"]');
if (!signOut) fail("sign out control missing");
await signOut.click();
try {
  await waitPath(page, ["/sign-out", "/login"], 20000);
} catch {
  note("after sign out url=" + sanitize(page.url()));
  fail("sign out did not leave Client Portal");
}
pass("sign out left Client Portal");

const signedOut = await browser.newPage();
for (const pathName of ["/client", "/client/invoices/example", "/dashboard"]) {
  await signedOut.goto(app + pathName, { waitUntil: "domcontentloaded" });
  if (!signedOut.url().includes("/login")) fail("signed-out " + pathName + " did not redirect to login");
}
if (documentId) {
  await signedOut.goto(app + "/client/documents/" + documentId + "/download", { waitUntil: "domcontentloaded" });
  if (!signedOut.url().includes("/login") && !/unauthorized|sign in|Not found/i.test(await signedOut.evaluate(() => document.body ? document.body.innerText : ""))) {
    fail("signed-out document download was not protected");
  }
  pass("signed-out document download is protected");
}
await signedOut.screenshot({ path: path.join(shotDir, "client_portal_signed_out_login.png"), fullPage: true });
pass("signed-out /client opens login");

await browser.close();
console.log("DAY9_CLIENT_UI_PASSED");
""",
        encoding="utf-8",
    )


def main() -> None:
    env = auth.load_status_env()
    owner_password = secrets.token_urlsafe(24)
    client_password = secrets.token_urlsafe(24)
    owner_id = upsert_auth_user(env, OWNER_EMAIL, owner_password)
    client_user_id = upsert_auth_user(env, UI_EMAIL, client_password)
    auth.ensure_org(env, auth.ORG_A, "day9-test-org-a")
    auth.ensure_membership(env, auth.ORG_A, owner_id, "owner")
    auth.ensure_membership(env, auth.ORG_A, client_user_id, "client")
    status, owner_aal1 = auth.password_login(env, OWNER_EMAIL, owner_password)
    if status != 200 or not owner_aal1 or jwt_aal(owner_aal1) != "aal1":
        fail("UI owner password login did not produce AAL1")
    owner_token = enroll_totp_aal2(env, owner_aal1)
    if jwt_aal(owner_token) != "aal2":
        fail("UI owner did not reach AAL2")
    document_id = seed_published_records(env, owner_token, owner_id, client_user_id)
    status, client_aal1 = auth.password_login(env, UI_EMAIL, client_password)
    if status != 200 or not client_aal1 or jwt_aal(client_aal1) != "aal1":
        fail("UI client password login did not produce AAL1")
    secret = enroll_ui_totp(env, client_aal1, "day9-ui")
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
            "DAY9_APP_URL": APP_URL,
            "DAY9_UI_EMAIL": UI_EMAIL,
            "DAY9_UI_PASSWORD": client_password,
            "DAY9_UI_TOTP_SECRET": secret,
            "DAY9_SHOT_DIR": str(SHOT_DIR),
            "DAY9_DOWNLOAD_DIR": str(DOWNLOAD_DIR),
            "DAY9_DOCUMENT_ID": document_id,
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
    client_password = ""
    owner_password = ""
    env_run["DAY9_UI_PASSWORD"] = ""
    env_run["DAY9_UI_TOTP_SECRET"] = ""
    if result.returncode != 0:
        extra = Path("/tmp/sts-local/day9-ui-errors.txt")
        if extra.exists():
            for line in extra.read_text(errors="replace").splitlines()[:12]:
                low = line.lower()
                if any(token in low for token in ("password", "totp", "secret", "cookie", "jwt", "bearer", "service_role", "storage")):
                    print("[redacted]", file=sys.stderr)
                else:
                    print(line[:240], file=sys.stderr)
        fail("client portal UI browser checks failed")
    print("DAY9_CLIENT_UI_PASSED")


if __name__ == "__main__":
    main()
