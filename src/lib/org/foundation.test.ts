import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "./audit";
import { createDemoOrganizationFoundation, DEMO_ORGANIZATION_ID, DEMO_MEMBER_ID, DEMO_OWNER_USER_ID } from "./defaults";
import { parseBusinessSettingsForm } from "./settings";
import {
  changeOrganizationMemberRole,
  deleteOrganizationAuditEvent,
  getOrganization,
  listAuditEventsForOrganization,
  listMembersForOrganization,
  resetOrganizationFoundation,
  updateOrganizationAuditEvent,
  updateOrganizationBusinessSettings,
} from "./store";

const migration = [
  readFileSync("supabase/migrations/20260918134000_business_os_org_foundation.sql", "utf8"),
  readFileSync("supabase/migrations/20260919033000_day1_audit_result_and_rls_hardening.sql", "utf8"),
  readFileSync("supabase/migrations/20260919041000_day1_settings_save_transaction.sql", "utf8"),
  readFileSync("supabase/migrations/20260919053000_day1_legacy_init_compat_and_rpc_guards.sql", "utf8"),
].join("\n");

afterEach(() => {
  resetOrganizationFoundation();
});

describe("business OS foundation migration", () => {
  it("adds organization-owned tables with forced RLS and membership-scoped policies", () => {
    expect(migration).toContain("create table if not exists public.organizations");
    expect(migration).toContain("create table if not exists public.organization_members");
    expect(migration).toContain("create table if not exists public.business_settings");
    expect(migration).toContain("create table if not exists public.audit_events");
    expect(migration).toContain("alter table public.organizations enable row level security");
    expect(migration).toContain("alter table public.organizations force row level security");
    expect(migration).toContain("sts_is_organization_member");
    expect(migration).toContain("security definer");
    expect(migration).toContain("sts_sanitize_audit_metadata");
    expect(migration).toContain("add column if not exists result text");
    expect(migration).toContain("sts_guard_membership_write");
    expect(migration).toContain("sts_save_business_settings");
    expect(migration).toContain("sts_freeze_organization_id");
    expect(migration).toContain("set search_path = public");
    expect(migration).not.toMatch(/for\s+(select|all|insert|update|delete)[\s\S]{0,80}using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/ein text/i);
    expect(migration).not.toMatch(/ssn text/i);
    expect(migration).not.toMatch(/service_role_key/i);
  });

  it("keeps legacy init.sql first in the normal timestamped sequence", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files).toEqual([
      "20260911120000_init.sql",
      "20260912060000_phase1_owner_os.sql",
      "20260918134000_business_os_org_foundation.sql",
      "20260919033000_day1_audit_result_and_rls_hardening.sql",
      "20260919041000_day1_settings_save_transaction.sql",
      "20260919053000_day1_legacy_init_compat_and_rpc_guards.sql",
      "20260919120000_day2_membership_owner_gate.sql",
      "20260919123000_day2_crm_leads_clients.sql",
      "20260920120000_day3_finance_operations.sql",
      "20260920121000_day3_finance_operations_rpcs.sql",
      "20260920130000_day3_ops_no_hard_delete.sql",
      "20260920140000_day4_workspace_tools.sql",
      "20260920141000_day4_workspace_rpcs.sql",
      "20260920142000_day4_storage_documents.sql",
      "20260920143000_day4_no_hard_delete.sql",
      "20260920144000_day4_storage_extension_guard.sql",
      "20260920150000_day4_aal2_session_gate.sql",
      "20260920160000_day5_estimates.sql",
      "20260920161000_day5_estimates_rpcs.sql",
      "20260920162000_day5_estimates_no_hard_delete.sql",
      "20260920170000_day6_estimate_to_invoice.sql",
      "20260920180000_day7_schedule_automations.sql",
      "20260920181000_day7_schedule_rpcs.sql",
      "20260920190000_day8_accountant_center.sql",
      "20260920191000_day8_accountant_base_table_lockdown.sql",
    ]);
    const noDelete = readFileSync("supabase/migrations/20260920130000_day3_ops_no_hard_delete.sql", "utf8");
    expect(noDelete).toContain("revoke delete on public.ops_expenses");
    expect(noDelete).toContain("drop policy if exists ops_expenses_delete_privileged");
    expect(noDelete).not.toMatch(/create policy[\s\S]{0,80}for delete/i);
    const day3 = readFileSync("supabase/migrations/20260920120000_day3_finance_operations.sql", "utf8");
    expect(day3).toContain("ops_expenses");
    expect(day3).toContain("integer not null");
    expect(day3).toContain("force row level security");
    expect(day3).toContain("Business Formation");
    expect(day3).not.toMatch(/double precision|numeric\(/i);
    expect(readFileSync("supabase/tests/day1_isolation_runtime.sql", "utf8")).toContain("set local role authenticated");
    expect(readFileSync("supabase/tests/day1_isolation_runtime.sql", "utf8")).toContain("set local role anon");
    expect(readFileSync("docs/day-1-local-supabase-setup.md", "utf8")).toContain("Docker Desktop");
  });
});

describe("audit metadata sanitizer", () => {
  it("drops secrets, tokens, card data, and government identifiers", () => {
    const clean = sanitizeAuditMetadata({
      invoicePrefix: "STS",
      password: "hunter2",
      access_token: "abc",
      ein: "12-3456789",
      ssn: "111-11-1111",
      cardNumber: "4242424242424242",
      cvv: "123",
      bankPassword: "nope",
      nested: { refresh_token: "xyz", timezone: "America/New_York" },
    });
    expect(clean).toEqual({
      invoicePrefix: "STS",
      nested: { timezone: "America/New_York" },
    });
  });
});

describe("business settings validation", () => {
  it("requires server-side shape and rejects unsafe prefixes", () => {
    const form = new FormData();
    form.set("legalName", "Scars to Stars Media");
    form.set("displayName", "STS Media");
    form.set("timezone", "America/New_York");
    form.set("baseCurrency", "USD");
    form.set("fiscalYearStart", "1");
    form.set("invoicePrefix", "STS");
    form.set("estimatePrefix", "EST");
    form.set("defaultPaymentTerms", "Net 15");
    expect(parseBusinessSettingsForm(form).success).toBe(true);

    form.set("invoicePrefix", "STS INV!");
    const invalid = parseBusinessSettingsForm(form);
    expect(invalid.success).toBe(false);
  });
});

describe("organization isolation", () => {
  it("prevents cross-organization settings writes and member reads", () => {
    const state = createDemoOrganizationFoundation();
    const otherOrgId = "44444444-4444-4444-8444-444444444444";
    const otherUserId = "user-other";
    state.organizations.push({
      id: otherOrgId,
      legalName: "Other Co",
      displayName: "Other",
      slug: "other-co",
      baseCurrency: "USD",
      timezone: "UTC",
      fiscalYearStart: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    state.settings.push({
      id: "55555555-5555-4555-8555-555555555555",
      organizationId: otherOrgId,
      invoicePrefix: "OTH",
      estimatePrefix: "OES",
      defaultPaymentTerms: "Due on receipt",
      brandSettings: { paletteId: "sts-day", accentColor: "", logoText: "O" },
      notificationSettings: { emailInvoices: false, emailEstimates: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    state.members.push({
      id: "66666666-6666-4666-8666-666666666666",
      organizationId: otherOrgId,
      userId: otherUserId,
      role: "owner",
      status: "active",
      invitedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    resetOrganizationFoundation(state);

    expect(() =>
      updateOrganizationBusinessSettings({
        organizationId: otherOrgId,
        actorUserId: DEMO_OWNER_USER_ID,
        actorRole: "owner",
        actorStatus: "active",
        actorOrganizationId: DEMO_ORGANIZATION_ID,
        values: {
          legalName: "Takeover",
          displayName: "Takeover",
          timezone: "UTC",
          baseCurrency: "USD",
          fiscalYearStart: 1,
          invoicePrefix: "HAX",
          estimatePrefix: "HAX",
          defaultPaymentTerms: "Net 1",
        },
      }),
    ).toThrow(/Unauthorized/i);
    expect(getOrganization(otherOrgId)?.legalName).toBe("Other Co");

    const stsOwner = state.members.find((item) => item.userId === DEMO_OWNER_USER_ID)!;
    expect(listMembersForOrganization(otherOrgId, stsOwner)).toEqual([]);
    expect(listAuditEventsForOrganization(otherOrgId, stsOwner)).toEqual([]);
  });

  it("records a sanitized audit event after a successful settings change", () => {
    const result = updateOrganizationBusinessSettings({
      organizationId: DEMO_ORGANIZATION_ID,
      actorUserId: DEMO_OWNER_USER_ID,
      actorRole: "owner",
      actorStatus: "active",
      actorOrganizationId: DEMO_ORGANIZATION_ID,
      values: {
        legalName: "Scars to Stars Media LLC",
        displayName: "STS Media",
        timezone: "America/New_York",
        baseCurrency: "USD",
        fiscalYearStart: 1,
        invoicePrefix: "STSM",
        estimatePrefix: "EST",
        defaultPaymentTerms: "Net 15",
      },
    });
    expect(result.settings.invoicePrefix).toBe("STSM");
    expect(result.audit.actorUserId).toBe(DEMO_OWNER_USER_ID);
    expect(result.audit.action).toBe("business_settings.updated");
    expect(result.audit.result).toBe("success");
    expect(result.audit.entityType).toBe("business_settings");
    expect(result.audit.metadata).toMatchObject({ result: "success" });
    expect(JSON.stringify(result.audit.metadata)).not.toMatch(/password|token|ein|ssn|cvv/i);
  });

  it("denies accountant writes and keeps the service role key off the browser client", () => {
    expect(() =>
      updateOrganizationBusinessSettings({
        organizationId: DEMO_ORGANIZATION_ID,
        actorUserId: "user-accountant",
        actorRole: "accountant",
        actorStatus: "active",
        actorOrganizationId: DEMO_ORGANIZATION_ID,
        values: {
          legalName: "Takeover",
          displayName: "Takeover",
          timezone: "UTC",
          baseCurrency: "USD",
          fiscalYearStart: 1,
          invoicePrefix: "HAX",
          estimatePrefix: "HAX",
          defaultPaymentTerms: "Net 1",
        },
      }),
    ).toThrow(/Unauthorized/i);
    expect(getOrganization(DEMO_ORGANIZATION_ID)?.legalName).toBe("Scars to Stars Media");

    const browser = readFileSync("src/lib/supabase/browser.ts", "utf8");
    expect(browser).not.toMatch(/SERVICE_ROLE/);
    expect(browser).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("blocks self-elevation, owner-only owner assignment, and audit mutation", () => {
    const state = createDemoOrganizationFoundation();
    const adminId = "77777777-7777-4777-8777-777777777777";
    state.members.push({
      id: adminId,
      organizationId: DEMO_ORGANIZATION_ID,
      userId: "user-admin",
      role: "administrator",
      status: "active",
      invitedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    resetOrganizationFoundation(state);

    expect(() =>
      changeOrganizationMemberRole({
        actorUserId: "user-admin",
        actorRole: "administrator",
        actorStatus: "active",
        actorOrganizationId: DEMO_ORGANIZATION_ID,
        targetMemberId: adminId,
        nextRole: "owner",
      }),
    ).toThrow(/Unauthorized/i);
    expect(state.members.find((item) => item.id === adminId)?.role).toBe("administrator");

    expect(() =>
      changeOrganizationMemberRole({
        actorUserId: "user-admin",
        actorRole: "administrator",
        actorStatus: "active",
        actorOrganizationId: DEMO_ORGANIZATION_ID,
        targetMemberId: DEMO_MEMBER_ID,
        nextRole: "owner",
      }),
    ).toThrow(/Unauthorized/i);

    const promoted = changeOrganizationMemberRole({
      actorUserId: DEMO_OWNER_USER_ID,
      actorRole: "owner",
      actorStatus: "active",
      actorOrganizationId: DEMO_ORGANIZATION_ID,
      targetMemberId: adminId,
      nextRole: "employee",
    });
    expect(promoted.role).toBe("employee");

    expect(() =>
      changeOrganizationMemberRole({
        actorUserId: DEMO_OWNER_USER_ID,
        actorRole: "owner",
        actorStatus: "active",
        actorOrganizationId: DEMO_ORGANIZATION_ID,
        targetMemberId: DEMO_MEMBER_ID,
        nextRole: "administrator",
      }),
    ).toThrow(/Unauthorized/i);
    expect(state.members.find((item) => item.id === DEMO_MEMBER_ID)?.role).toBe("owner");

    expect(() => updateOrganizationAuditEvent()).toThrow(/cannot be modified/i);
    expect(() => deleteOrganizationAuditEvent()).toThrow(/cannot be modified/i);
  });
});
