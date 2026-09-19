import { describe, expect, it } from "vitest";
import { createSeedWorkspace } from "./data/seed";
import { defaultBusinessProfile } from "./data/business-defaults";
import { backupFilename, buildWorkspaceBackup } from "./export-backup";
import { TAX_DISCLAIMER } from "./tax";
import { canAccessDashboard } from "./auth/session";
import { DEFAULT_OWNER_EMAIL } from "./auth/owner";

describe("business profile defaults", () => {
  it("uses Georgia LLC, cash accounting, and calendar year", () => {
    const profile = defaultBusinessProfile();
    expect(profile.legalName).toBe("Scars to Stars Media");
    expect(profile.dba).toBe("STS Media");
    expect(profile.entityType).toBe("llc");
    expect(profile.formationState).toBe("Georgia");
    expect(profile.accountingMethod).toBe("cash");
    expect(profile.fiscalYearType).toBe("calendar");
    expect(profile.timezone).toBe("America/New_York");
    expect(profile.currency).toBe("USD");
    expect(profile.ownerEmail).toBe(DEFAULT_OWNER_EMAIL);
    expect(profile.einStored).toBe(false);
    expect(createSeedWorkspace().businessProfile).toMatchObject(profile);
    expect(createSeedWorkspace().brand.paletteId).toBe("sts-day");
  });
});

describe("tax disclaimer", () => {
  it("is present on seed tax records and export payloads", () => {
    expect(TAX_DISCLAIMER).toMatch(/does not provide legal, accounting, or tax advice/i);
    expect(TAX_DISCLAIMER).toMatch(/qualified professional/i);
    const backup = buildWorkspaceBackup(createSeedWorkspace());
    expect(backup.taxDisclaimer).toBe(TAX_DISCLAIMER);
    expect(backup.businessProfile.ownerEmail).toBe("info@stsmedia.co");
    expect(backup.clients.length).toBeGreaterThan(0);
    expect(backupFilename(new Date("2026-09-12T00:00:00.000Z"))).toBe("sts-media-backup-2026-09-12.json");
    expect(createSeedWorkspace().taxChecklist.some((item) => item.title.includes("receipts"))).toBe(true);
  });
});

describe("dashboard access", () => {
  it("allows the demo owner and rejects clients", () => {
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
        id: "user-client",
        email: DEFAULT_OWNER_EMAIL,
        role: "client",
        mfaVerified: true,
        emailVerified: true,
        source: "demo",
      }),
    ).toBe(false);
    expect(
      canAccessDashboard({
        id: "user-other",
        email: "hello@stsmedia.co",
        role: "owner",
        mfaVerified: true,
        emailVerified: true,
        source: "supabase",
      }),
    ).toBe(false);
  });
});
