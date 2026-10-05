import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_SETTINGS_ERROR } from "@/lib/org/settings";
import { DEMO_ORGANIZATION_ID } from "@/lib/org/defaults";
import { getOrganizationSettings, resetOrganizationFoundation } from "@/lib/org/store";
import { resetWorkspace } from "@/lib/data/store";

const {
  saveOrganizationSettingsInDatabase,
  requireOwnerWrite,
  requireBusinessSettingsWrite,
  createSupabaseServer,
} = vi.hoisted(() => ({
  saveOrganizationSettingsInDatabase: vi.fn(),
  requireOwnerWrite: vi.fn(),
  requireBusinessSettingsWrite: vi.fn(),
  createSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/org/database", () => ({
  saveOrganizationSettingsInDatabase: (...args: unknown[]) => saveOrganizationSettingsInDatabase(...args),
}));

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return {
    ...actual,
    requireOwnerWrite: (...args: unknown[]) => requireOwnerWrite(...args),
    requireBusinessSettingsWrite: (...args: unknown[]) => requireBusinessSettingsWrite(...args),
    createSupabaseServer: (...args: unknown[]) => createSupabaseServer(...args),
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
    getAll: () => [],
  }),
  headers: async () => new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const supabaseUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "info@stsmedia.co",
  role: "owner" as const,
  mfaVerified: true,
  emailVerified: true,
  source: "supabase" as const,
  organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  organizationRole: "owner" as const,
  membershipStatus: "active" as const,
};

function settingsForm() {
  const form = new FormData();
  form.set("legalName", "Scars to Stars Media");
  form.set("displayName", "STS Media");
  form.set("timezone", "America/New_York");
  form.set("baseCurrency", "USD");
  form.set("fiscalYearStart", "1");
  form.set("invoicePrefix", "STSX");
  form.set("estimatePrefix", "EST");
  form.set("defaultPaymentTerms", "Net 15");
  return form;
}

describe("business settings action (mocked Supabase session)", () => {
  beforeEach(() => {
    resetWorkspace();
    resetOrganizationFoundation();
    saveOrganizationSettingsInDatabase.mockReset();
    requireOwnerWrite.mockReset();
    requireBusinessSettingsWrite.mockReset();
    createSupabaseServer.mockReset();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    requireOwnerWrite.mockResolvedValue({ status: "authenticated", user: supabaseUser });
    requireBusinessSettingsWrite.mockResolvedValue({
      status: "authenticated",
      user: supabaseUser,
      organizationId: supabaseUser.organizationId,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a generic error and does not write in-memory settings when the RPC fails", async () => {
    const { saveBusinessOsSettings } = await import("@/app/actions");
    createSupabaseServer.mockReturnValue(async () => ({ rpc: vi.fn() }));
    saveOrganizationSettingsInDatabase.mockResolvedValue({ error: true });

    const result = await saveBusinessOsSettings({}, settingsForm());

    expect(result).toEqual({
      error: GENERIC_SETTINGS_ERROR,
      values: expect.objectContaining({ invoicePrefix: "STSX" }),
    });
    expect(saveOrganizationSettingsInDatabase).toHaveBeenCalledTimes(1);
    expect(getOrganizationSettings(DEMO_ORGANIZATION_ID)?.invoicePrefix).toBe("STS");
    expect(getOrganizationSettings(supabaseUser.organizationId)).toBeNull();
  });
});
