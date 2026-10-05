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

describe("day 2 membership owner gate", () => {
  it("replaces email is_phase1_owner with membership roles and no identity literals", () => {
    const sql = readFileSync("supabase/migrations/20260919120000_day2_membership_owner_gate.sql", "utf8");
    expect(sql).toMatch(/create or replace function public\.is_phase1_owner/);
    expect(sql).toContain("role in ('owner', 'administrator')");
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).toContain("status = 'active'");
    expect(sql).not.toMatch(/info@stsmedia\.co/);
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(sql).not.toMatch(/password|totp|secret|jwt/i);
  });

  it("adds organization-owned CRM tables with RLS and save RPCs", () => {
    const sql = readFileSync("supabase/migrations/20260919123000_day2_crm_leads_clients.sql", "utf8");
    expect(sql).toContain("create table if not exists public.crm_clients");
    expect(sql).toContain("create table if not exists public.crm_leads");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("sts_can_manage_crm");
    expect(sql).toContain("sts_save_crm_client");
    expect(sql).toContain("sts_save_crm_lead");
    expect(sql).toContain("estimated_value_cents");
    expect(sql).not.toMatch(/info@stsmedia\.co/);
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("phase 3A CRM journey migration", () => {
  it("adds ICPs, conversion columns, and SECURITY DEFINER RPCs without weakening RLS", () => {
    const sql = readFileSync("supabase/migrations/20260924063409_phase3a_crm_journey.sql", "utf8");
    expect(sql).toContain("create table if not exists public.crm_icps");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("sts_can_manage_crm");
    expect(sql).toContain("sts_save_crm_icp");
    expect(sql).toContain("sts_convert_crm_lead_to_client");
    expect(sql).toContain("add column if not exists converted_client_id");
    expect(sql).toContain("add column if not exists icp_id");
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/grant execute[\s\S]{0,80}to anon/i);
    expect(sql).toContain("revoke all on function public.sts_convert_crm_lead_to_client");
    expect(sql).not.toMatch(/create or replace table public\.leads\b/i);
  });
});
