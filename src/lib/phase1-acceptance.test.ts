import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_OWNER_EMAIL, GENERIC_AUTH_ERROR, isAllowedOwnerEmail } from "./auth/owner";
import { canAccessDashboard } from "./auth/session";
import { createSeedWorkspace } from "./data/seed";
import { getWorkspace, resetWorkspace } from "./data/store";
import { backupFilename, buildWorkspaceBackup } from "./export-backup";
import { dollarsToCents } from "./money";
import { buildMasterTransactionLog } from "./os-transactions";
import { allowedFile } from "./security/origin";
import { passwordScore } from "./security/password";
import { rateLimit } from "./security/rate-limit";
import { TAX_DISCLAIMER } from "./tax";
import { isSafeRedirect } from "./utils";

const sql = readFileSync("supabase/migrations/20260912060000_phase1_owner_os.sql", "utf8");

describe("login", () => {
  it("allowlists only info@stsmedia.co and uses one generic auth error", () => {
    expect(isAllowedOwnerEmail("info@stsmedia.co")).toBe(true);
    expect(isAllowedOwnerEmail("hello@stsmedia.co")).toBe(false);
    expect(isAllowedOwnerEmail("stranger@gmail.com")).toBe(false);
    expect(GENERIC_AUTH_ERROR).toBe("We could not sign you in. Check the details or try another method.");
  });

  it("grants the dashboard only to a verified owner on the allowlist", () => {
    expect(
      canAccessDashboard({
        id: "user-owner",
        email: DEFAULT_OWNER_EMAIL,
        role: "owner",
        mfaVerified: true,
        emailVerified: true,
        source: "demo",
      }),
    ).toBe(true);
    expect(
      canAccessDashboard({
        id: "user-owner",
        email: DEFAULT_OWNER_EMAIL,
        role: "owner",
        mfaVerified: false,
        emailVerified: true,
        source: "supabase",
      }),
    ).toBe(false);
    expect(
      canAccessDashboard({
        id: "user-admin",
        email: DEFAULT_OWNER_EMAIL,
        role: "admin",
        mfaVerified: true,
        emailVerified: true,
        source: "demo",
      }),
    ).toBe(false);
  });
});

describe("security", () => {
  it("blocks open redirects and weak passwords", () => {
    expect(isSafeRedirect("/dashboard/export")).toBe(true);
    expect(isSafeRedirect("/login?next=/dashboard")).toBe(true);
    expect(isSafeRedirect("https://evil.example/dashboard")).toBe(false);
    expect(isSafeRedirect("//evil.example")).toBe(false);
    expect(passwordScore("password").ok).toBe(false);
    expect(passwordScore("StsMedia#Owner2026").ok).toBe(true);
  });

  it("rate-limits repeated attempts in a window", () => {
    const key = `test-login-${Date.now()}`;
    for (let i = 0; i < 8; i += 1) {
      expect(rateLimit(key, 8, 60_000).ok).toBe(true);
    }
    expect(rateLimit(key, 8, 60_000).ok).toBe(false);
  });

  it("rejects unsafe receipt uploads", () => {
    const pdf = new File(["%PDF"], "georgia-registration.pdf", { type: "application/pdf" });
    const exe = new File(["MZ"], "malware.exe", { type: "application/x-msdownload" });
    const huge = new File(["x".repeat(9 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" });
    expect(allowedFile(pdf)).toBe(true);
    expect(allowedFile(exe)).toBe(false);
    expect(allowedFile(huge)).toBe(false);
  });
});

describe("database", () => {
  it("defines an owner-only Phase 1 schema with RLS, cents, and private buckets", () => {
    expect(sql).toMatch(/info@stsmedia\.co/);
    expect(sql).toMatch(/owner_id = auth\.uid\(\) and public\.is_phase1_owner\(\)/);
    expect(sql).toContain("alter table public.os_clients enable row level security");
    expect(sql).toContain("alter table public.os_transactions enable row level security");
    expect(sql).toContain("alter table public.os_receipts enable row level security");
    expect(sql).toContain("amount_cents integer not null");
    expect(sql).toContain("values ('receipts', 'receipts', false)");
    expect(sql).toContain("values ('documents', 'documents', false)");
    expect(sql).not.toMatch(/client-files/);
    expect(sql).not.toMatch(/\bein\b/i);
    expect(sql).not.toMatch(/portal_enabled/);
  });
});

describe("records", () => {
  it("seeds and hydrates operating records without an EIN", () => {
    resetWorkspace();
    const workspace = getWorkspace();
    expect(workspace.businessProfile.einStored).toBe(false);
    expect(workspace.clients.some((item) => item.businessName === "State Collision Pro")).toBe(true);
    expect(workspace.projects.length).toBeGreaterThan(0);
    expect(workspace.tasks.length).toBeGreaterThan(0);
    expect(workspace.notes.length).toBeGreaterThan(0);
    expect(workspace.taxChecklist.length).toBeGreaterThan(0);
    delete (workspace as { businessProfile?: unknown }).businessProfile;
    expect(getWorkspace().businessProfile.formationState).toBe("Georgia");
    expect(getWorkspace().businessProfile.accountingMethod).toBe("cash");
  });

  it("keeps unpaid invoices out of cash while still listing them on the master log", () => {
    const rows = buildMasterTransactionLog(createSeedWorkspace());
    const invoice = rows.find((row) => row.id === "revenue:rev-scp-build");
    expect(invoice?.status).toBe("unpaid");
    expect(invoice?.amountCents).toBe(dollarsToCents(500));
    expect(rows.filter((row) => row.kind === "expense").every((row) => row.amountCents <= 0)).toBe(true);
  });
});

describe("receipts", () => {
  it("tracks missing receipts as private operating files", () => {
    const workspace = createSeedWorkspace();
    const missing = workspace.expenses.filter((item) => !item.archived && item.receiptStatus === "missing");
    expect(missing.length).toBeGreaterThan(0);
    expect(workspace.files.some((file) => file.kind === "receipt" && file.visibility === "private")).toBe(true);
    expect(workspace.files.every((file) => file.visibility !== "client" || file.kind !== "receipt")).toBe(true);
    expect(workspace.taxChecklist.some((item) => /receipts/i.test(item.title))).toBe(true);
  });
});

describe("exports", () => {
  it("builds an owner backup with the tax disclaimer and without secrets", () => {
    const backup = buildWorkspaceBackup(createSeedWorkspace());
    const serialized = JSON.stringify(backup);
    expect(backup.taxDisclaimer).toBe(TAX_DISCLAIMER);
    expect(backup.businessProfile.ownerEmail).toBe("info@stsmedia.co");
    expect(backup.phase).toBe(1);
    expect(backup.clients.length).toBeGreaterThan(0);
    expect(backup.expenses.length).toBeGreaterThan(0);
    expect(backup.note).toMatch(/not a filed tax return/i);
    expect(serialized).not.toMatch(/"password"\s*:/);
    expect(serialized).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(Object.keys(backup.businessProfile)).not.toContain("ein");
    expect(backup.businessProfile.einStored).toBe(false);
  });
});
