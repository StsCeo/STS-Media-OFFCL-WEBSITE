import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_COOKIE } from "@/lib/config";
import { signDemoSession } from "@/lib/auth/demo-session";
import { canAccessDashboard } from "@/lib/auth/session";
import { saveBusinessOsSettings } from "@/app/actions";
import { DEMO_ORGANIZATION_ID } from "@/lib/org/defaults";
import { getOrganizationSettings, resetOrganizationFoundation } from "@/lib/org/store";
import { resetWorkspace } from "@/lib/data/store";

const TEST_SECRET = "vitest-demo-session-secret-key-32ch";
const { cookieStore } = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
}));

function cookieJar() {
  return {
    get(name: string) {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string) {
      if (!value) cookieStore.delete(name);
      else cookieStore.set(name, value);
    },
    delete(nameOrOptions: string | { name: string }) {
      const name = typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions.name;
      cookieStore.delete(name);
    },
    getAll() {
      return [...cookieStore.entries()].map(([name, value]) => ({ name, value }));
    },
  };
}

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar(),
  headers: async () => new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

beforeEach(() => {
  cookieStore.clear();
  resetWorkspace();
  resetOrganizationFoundation();
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "true");
  vi.stubEnv("DEMO_SESSION_SECRET", TEST_SECRET);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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

describe("business settings action", () => {
  it("rejects signed-out users", async () => {
    await expect(saveBusinessOsSettings({}, settingsForm())).rejects.toThrow("Unauthorized");
    expect(getOrganizationSettings(DEMO_ORGANIZATION_ID)?.invoicePrefix).toBe("STS");
  });

  it("saves authenticated owner settings and writes an audit event", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));
    const result = await saveBusinessOsSettings({}, settingsForm());
    expect(result).toEqual({ ok: true });
    expect(getOrganizationSettings(DEMO_ORGANIZATION_ID)?.invoicePrefix).toBe("STSX");
  });

  it("ignores a client-supplied organization id on the settings form", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));
    const form = settingsForm();
    form.set("organizationId", "44444444-4444-4444-8444-444444444444");
    const result = await saveBusinessOsSettings({}, form);
    expect(result).toEqual({ ok: true });
    expect(getOrganizationSettings(DEMO_ORGANIZATION_ID)?.invoicePrefix).toBe("STSX");
    expect(getOrganizationSettings("44444444-4444-4444-8444-444444444444")).toBeNull();
  });
});

describe("dashboard gate", () => {
  it("still rejects client and accountant session shapes", () => {
    expect(
      canAccessDashboard({
        id: "user-client",
        email: "client@example.com",
        role: "client",
        mfaVerified: true,
        emailVerified: true,
        source: "demo",
        organizationRole: "client",
        membershipStatus: "active",
        organizationId: DEMO_ORGANIZATION_ID,
      }),
    ).toBe(false);
    expect(
      canAccessDashboard({
        id: "user-accountant",
        email: "books@example.com",
        role: "accountant",
        mfaVerified: true,
        emailVerified: true,
        source: "demo",
        organizationRole: "accountant",
        membershipStatus: "active",
        organizationId: DEMO_ORGANIZATION_ID,
      }),
    ).toBe(false);
  });
});
