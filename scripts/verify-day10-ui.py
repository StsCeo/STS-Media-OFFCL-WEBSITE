#!/usr/bin/env python3
"""Signed-out Client/Accountant/Command Center smoke. No secrets. Headed Chrome when DISPLAY is set."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

APP_URL = os.environ.get("DAY10_APP_URL", "http://127.0.0.1:3000")
SHOT_DIR = Path("/opt/cursor/artifacts/screenshots")
NPM_PREFIX = Path("/tmp/day10-ui")
HELPER = NPM_PREFIX / "day10-ui.mjs"


def fail(msg: str) -> None:
    print(f"FAIL {msg}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    NPM_PREFIX.mkdir(parents=True, exist_ok=True)
    if not (NPM_PREFIX / "node_modules" / "puppeteer-core").exists():
        prior = Path("/tmp/day9-ui/node_modules/puppeteer-core")
        if prior.exists():
            subprocess.run(["npm", "install", "--prefix", str(NPM_PREFIX), "puppeteer-core@24.15.0"], check=False, capture_output=True)
        else:
            installed = subprocess.run(["npm", "install", "--prefix", str(NPM_PREFIX), "puppeteer-core@24.15.0"], capture_output=True, text=True)
            if installed.returncode != 0:
                fail("could not install puppeteer-core")
    HELPER.write_text(
        r"""
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
const app = process.env.DAY10_APP_URL || "http://127.0.0.1:3000";
const shotDir = process.env.DAY10_SHOT_DIR || "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(shotDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: process.env.DISPLAY ? false : "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
});
const page = await browser.newPage();
page.setDefaultTimeout(20000);
await page.setViewport({ width: 1440, height: 900 });
for (const [pathName, shot] of [
  ["/client", "day10_signed_out_client.png"],
  ["/accountant", "day10_signed_out_accountant.png"],
  ["/dashboard", "day10_signed_out_dashboard.png"],
]) {
  await page.goto(app + pathName, { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/login")) {
    console.error("FAIL signed-out " + pathName + " did not redirect to login");
    process.exit(1);
  }
  await page.screenshot({ path: path.join(shotDir, shot), fullPage: true });
  console.log("PASS signed-out " + pathName + " opened login");
}
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(app + "/login?next=/client", { waitUntil: "domcontentloaded" });
await page.screenshot({ path: path.join(shotDir, "day10_signed_out_login_mobile.png"), fullPage: true });
console.log("PASS mobile login layout rendered");
await browser.close();
console.log("DAY10_SIGNED_OUT_UI_PASSED");
""",
        encoding="utf-8",
    )
    env = os.environ.copy()
    env["DAY10_APP_URL"] = APP_URL
    env["DAY10_SHOT_DIR"] = str(SHOT_DIR)
    cmd = ["node", str(HELPER)]
    xvfb = shutil.which("xvfb-run")
    if xvfb and not env.get("DISPLAY"):
        cmd = [xvfb, "-a", *cmd]
    result = subprocess.run(cmd, cwd=str(NPM_PREFIX), env=env)
    if result.returncode != 0:
        fail("signed-out UI smoke failed")
    print("DAY10_SIGNED_OUT_UI_PASSED")


if __name__ == "__main__":
    main()
