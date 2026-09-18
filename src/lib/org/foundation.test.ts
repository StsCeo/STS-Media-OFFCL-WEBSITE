import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "./audit";
import { createDemoOrganizationFoundation, DEMO_ORGANIZATION_ID, DEMO_OWNER_USER_ID } from "./defaults";
import { parseBusinessSettingsForm } from "./settings";
import {
  getOrganization,
  listAuditEventsForOrganization,
  listMembersForOrganization,
  resetOrganizationFoundation,
  updateOrganizationBusinessSettings,
} from "./store";

const migration = readFileSync("supabase/migrations/20260918134000_business_os_org_foundation.sql", "utf8");

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
    expect(migration).not.toMatch(/for\s+(select|all|insert|update|delete)[\s\S]{0,80}using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/ein text/i);
    expect(migration).not.toMatch(/ssn text/i);
    expect(migration).not.toMatch(/service_role_key/i);
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
      brandSettings: { paletteId: "charcoal-sage", accentColor: "", logoText: "O" },
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
    expect(result.audit.entityType).toBe("business_settings");
    expect(result.audit.metadata).toMatchObject({ result: "success" });
    expect(JSON.stringify(result.audit.metadata)).not.toMatch(/password|token|ein|ssn|cvv/i);
  });
});
