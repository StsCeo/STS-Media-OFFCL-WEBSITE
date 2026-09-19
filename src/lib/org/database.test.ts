import { describe, expect, it } from "vitest";
import { pickActiveMembership } from "./membership";
import { mapAuditRow, mapOrganizationRow, mapSettingsRow, SETTINGS_SAVE_RPC } from "./database";
import { readFileSync } from "node:fs";

describe("active membership picker", () => {
  it("returns a single active membership and ignores extras of mixed roles when one owner exists", () => {
    expect(
      pickActiveMembership([
        { organization_id: "org-a", role: "owner", status: "active" },
      ]),
    ).toEqual({ organizationId: "org-a", role: "owner", status: "active" });
    expect(
      pickActiveMembership([
        { organization_id: "org-a", role: "owner", status: "active" },
        { organization_id: "org-b", role: "employee", status: "active" },
      ]),
    ).toEqual({ organizationId: "org-a", role: "owner", status: "active" });
    expect(pickActiveMembership([{ organization_id: "org-a", role: "owner", status: "invited" }])).toBeNull();
    expect(
      pickActiveMembership([
        { organization_id: "org-a", role: "administrator", status: "active" },
        { organization_id: "org-b", role: "employee", status: "active" },
      ]),
    ).toBeNull();
  });
});

describe("database mappers", () => {
  it("maps organization, settings, and audit rows without trusting secret metadata", () => {
    const organization = mapOrganizationRow({
      id: "org-a",
      legal_name: "Scars to Stars Media",
      display_name: "STS Media",
      slug: "sts-media",
      base_currency: "USD",
      timezone: "America/New_York",
      fiscal_year_start: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(organization.displayName).toBe("STS Media");

    const settings = mapSettingsRow({
      id: "set-a",
      organization_id: "org-a",
      invoice_prefix: "STS",
      estimate_prefix: "EST",
      default_payment_terms: "Net 15",
      brand_settings: { palette_id: "sts-day", logo_text: "STS" },
      notification_settings: { email_invoices: false },
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(settings.invoicePrefix).toBe("STS");
    expect(settings.brandSettings.paletteId).toBe("sts-day");

    const audit = mapAuditRow({
      id: "aud-a",
      organization_id: "org-a",
      actor_user_id: "user-a",
      action: "business_settings.updated",
      result: "success",
      entity_type: "business_settings",
      entity_id: "set-a",
      metadata: { result: "success", password: "nope", ein: "12-3456789" },
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(audit.result).toBe("success");
    expect(audit.metadata).toMatchObject({ result: "success" });
    expect(JSON.stringify(audit.metadata)).not.toMatch(/password|ein/i);
  });
});

describe("settings save RPC migration", () => {
  it("saves settings and audit in one function and does not grant anon execute", () => {
    const sql = readFileSync("supabase/migrations/20260919041000_day1_settings_save_transaction.sql", "utf8");
    expect(sql).toContain(`create or replace function public.${SETTINGS_SAVE_RPC}`);
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("revoke all on function public.sts_save_business_settings");
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("keeps the later RPC guard additive and rejects a null organization id", () => {
    const sql = readFileSync("supabase/migrations/20260919053000_day1_legacy_init_compat_and_rpc_guards.sql", "utf8");
    expect(sql).toContain("if p_organization_id is null");
    expect(sql).toContain("20260911120000_init.sql");
    expect(sql).toContain("Does not replace is_phase1_owner()");
    expect(sql).not.toMatch(/create or replace function public\.is_phase1_owner/);
    expect(sql).not.toMatch(/\bp_actor\b|\bp_owner_role\b|\bp_role\b/);
  });
});
