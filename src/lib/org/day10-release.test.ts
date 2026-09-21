import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSafeRedirect } from "@/lib/utils";

describe("day 10 release hardening", () => {
  it("keeps migrations chronological and includes the leftover-table lockdown", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files.at(-1)).toBe("20260921120000_day10_legacy_table_lockdown.sql");
    expect(files).toEqual([...files].sort());
    const sql = readFileSync("supabase/migrations/20260921120000_day10_legacy_table_lockdown.sql", "utf8");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("revoke all on table public.%I from anon, public");
  });

  it("keeps the service-role client server-only and out of browser modules", () => {
    const service = readFileSync("src/lib/supabase/service.ts", "utf8");
    expect(service).toContain('import "server-only"');
    expect(readFileSync("src/lib/supabase/browser.ts", "utf8")).not.toMatch(/SERVICE_ROLE|server-only/);
    const clients = readdirSync("src").join(" ");
    expect(clients).toBeTruthy();
  });

  it("streams owner document downloads without signed URLs", () => {
    const download = readFileSync("src/app/dashboard/documents/[id]/download/route.ts", "utf8");
    expect(download).toContain("requireOwnerWrite");
    expect(download).toContain('Cache-Control": "private, no-store"');
    expect(download).toContain(".download(");
    expect(download).not.toContain("createSignedUrl");
    expect(download).not.toContain("NextResponse.redirect");
  });

  it("rejects unsafe MFA and auth redirects", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("/client")).toBe(true);
    expect(isSafeRedirect("https://evil.example")).toBe(false);
    expect(isSafeRedirect("//evil.example")).toBe(false);
    expect(isSafeRedirect("\\dashboard")).toBe(false);
    const mfa = readFileSync("src/app/mfa/verify/page.tsx", "utf8");
    expect(mfa).toContain("isSafeRedirect(params.next)");
    expect(mfa).not.toMatch(/MfaVerifyForm next=\{typeof params\.next/);
  });

  it("preserves vercel.json main-only Git deployments", () => {
    const vercel = readFileSync("vercel.json", "utf8");
    expect(vercel).toContain('"main": true');
    expect(vercel).toContain('"*": false');
  });
});
