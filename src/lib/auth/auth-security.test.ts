import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/config";
import { signDemoSession } from "@/lib/auth/demo-session";
import { clearCurrentAuth, canAccessDashboard, getSession } from "@/lib/auth/session";
import { getWorkspace, resetWorkspace } from "@/lib/data/store";
import { proxy } from "@/proxy";
import {
  archiveExpenses,
  deleteExpenses,
  endDemoSession,
  expireIdleSession,
  saveBrand,
  saveLegalPage,
  savePortfolio,
  saveTestimonial,
  startDemoSession,
  submitContact,
  upsertExpense,
  upsertLead,
  upsertIcp,
  convertLeadToClient,
  upsertProject,
  upsertRevenue,
} from "@/app/actions";

const TEST_SECRET = "vitest-demo-session-secret-key-32ch";
const { cookieStore, supabaseSignOut } = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
  supabaseSignOut: vi.fn(async () => ({ error: null })),
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

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signOut: () => supabaseSignOut(),
      getUser: async () => ({ data: { user: null }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1" }, error: null }),
        listFactors: async () => ({ data: { totp: [], phone: [] }, error: null }),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  })),
}));

function dashboardRequest(cookieHeader?: string) {
  return new NextRequest("http://localhost:3000/dashboard", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

async function expectRedirect(promise: Promise<unknown>, to: string) {
  await expect(promise).rejects.toThrow(`NEXT_REDIRECT:${to}`);
}

beforeEach(() => {
  cookieStore.clear();
  supabaseSignOut.mockClear();
  resetWorkspace();
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "true");
  vi.stubEnv("DEMO_SESSION_SECRET", TEST_SECRET);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demo session cookies", () => {
  it("rejects a forged owner cookie from getSession and the dashboard proxy", async () => {
    cookieStore.set(DEMO_COOKIE, "owner");
    const session = await getSession();
    expect(session.user).toBeNull();
    expect(canAccessDashboard(session.user)).toBe(false);

    const response = await proxy(dashboardRequest(`${DEMO_COOKIE}=owner`));
    expect(response.headers.get("location")).toContain("/login");
  });

  it("rejects an expired signed cookie", async () => {
    const token = await signDemoSession("owner", {
      secret: TEST_SECRET,
      now: Date.now() - 9 * 60 * 60 * 1000,
      maxAgeMs: 8 * 60 * 60 * 1000,
    });
    cookieStore.set(DEMO_COOKIE, token);
    expect((await getSession()).user).toBeNull();

    const response = await proxy(dashboardRequest(`${DEMO_COOKIE}=${token}`));
    expect(response.headers.get("location")).toContain("/login");
  });

  it("never writes an unsigned demo cookie and fails closed without a secret", async () => {
    const formData = new FormData();
    formData.set("next", "/dashboard");
    await expectRedirect(startDemoSession(formData), "/dashboard");
    const issued = cookieStore.get(DEMO_COOKIE);
    expect(issued).toBeTruthy();
    expect(issued).not.toBe("owner");
    expect((await getSession()).user?.source).toBe("demo");

    cookieStore.clear();
    vi.stubEnv("DEMO_SESSION_SECRET", "");
    await expectRedirect(startDemoSession(formData), "/login");
    expect(cookieStore.has(DEMO_COOKIE)).toBe(false);
  });
});

describe("protected owner writes", () => {
  it("rejects the QA-listed mutations without owner authorization", async () => {
    const mission = getWorkspace().brand.mission;
    const leads = getWorkspace().leads.length;
    const expenses = getWorkspace().expenses.length;
    const revenue = getWorkspace().revenue.length;
    const projects = getWorkspace().projects.length;
    const legalBody = getWorkspace().legal[0]?.body;
    const testimonials = getWorkspace().testimonials.length;

    const brand = new FormData();
    brand.set("mission", "Forged brand takeover");
    await expect(saveBrand(brand)).rejects.toThrow("Unauthorized");
    expect(getWorkspace().brand.mission).toBe(mission);

    const legal = new FormData();
    legal.set("id", getWorkspace().legal[0]?.id || "privacy");
    legal.set("body", "Forged legal copy");
    await expect(saveLegalPage(legal)).rejects.toThrow("Unauthorized");
    expect(getWorkspace().legal[0]?.body).toBe(legalBody);

    const portfolio = new FormData();
    portfolio.set("id", getWorkspace().portfolio[0]?.id || "missing");
    portfolio.set("companyName", "Forged Co");
    await expect(savePortfolio(portfolio)).rejects.toThrow("Unauthorized");

    const testimonial = new FormData();
    testimonial.set("quote", "Forged quote for the homepage");
    testimonial.set("authorName", "Intruder");
    await expect(saveTestimonial(testimonial)).rejects.toThrow("Unauthorized");
    expect(getWorkspace().testimonials.length).toBe(testimonials);

    await expect(upsertExpense({ vendor: "Forged vendor", pretaxAmount: 1 })).rejects.toThrow("Unauthorized");
    expect(getWorkspace().expenses.length).toBe(expenses);

    await expect(upsertLead({ businessName: "Forged lead" })).rejects.toThrow("Unauthorized");
    expect(getWorkspace().leads.length).toBe(leads);
    await expect(upsertIcp({ name: "Forged ICP" })).rejects.toThrow("Unauthorized");
    expect(getWorkspace().icps.length).toBe(0);
    await expect(convertLeadToClient("lead-scp")).rejects.toThrow("Unauthorized");

    await expect(upsertProject({ name: "Forged project" })).rejects.toThrow("Unauthorized");
    expect(getWorkspace().projects.length).toBe(projects);

    await expect(upsertRevenue({ description: "Forged revenue", amount: 1 })).rejects.toThrow("Unauthorized");
    expect(getWorkspace().revenue.length).toBe(revenue);
  });

  it("still accepts public contact form submissions without an owner session", async () => {
    const leads = getWorkspace().leads.length;
    const formData = new FormData();
    formData.set("name", "Ada Lovelace");
    formData.set("businessName", "Analytical Engines");
    formData.set("email", "ada@example.com");
    formData.set("phone", "");
    formData.set("service", "Website");
    formData.set("budget", "");
    formData.set("preferredContact", "email");
    formData.set("message", "Need a new marketing site for the shop.");
    formData.set("consent", "on");
    formData.set("companyWebsite", "");
    const result = await submitContact(formData);
    expect(result).toEqual({ ok: true });
    expect(getWorkspace().leads.length).toBe(leads + 1);
  });

  it("allows an authenticated demo owner to save brand settings", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));
    const formData = new FormData();
    formData.set("mission", "Owner-updated mission");
    await saveBrand(formData);
    expect(getWorkspace().brand.mission).toBe("Owner-updated mission");
  });

  it("rejects unauthenticated archive and delete of expenses and leaves the ledger unchanged", async () => {
    const before = JSON.stringify(getWorkspace().expenses);
    const targetId = getWorkspace().expenses[0]?.id;
    expect(targetId).toBeTruthy();

    await expect(archiveExpenses([targetId])).rejects.toThrow("Unauthorized");
    expect(JSON.stringify(getWorkspace().expenses)).toBe(before);
    expect(getWorkspace().expenses.find((item) => item.id === targetId)?.archived).not.toBe(true);

    await expect(deleteExpenses([targetId])).rejects.toThrow("Unauthorized");
    expect(JSON.stringify(getWorkspace().expenses)).toBe(before);
    expect(getWorkspace().expenses.some((item) => item.id === targetId)).toBe(true);
  });

  it("allows an authenticated owner to archive and delete expenses", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));
    const archiveId = "exp-ga-registration";
    const deleteId = "exp-ai-aug";
    const startingCount = getWorkspace().expenses.length;

    await archiveExpenses([archiveId]);
    expect(getWorkspace().expenses.find((item) => item.id === archiveId)?.archived).toBe(true);
    expect(getWorkspace().expenses.length).toBe(startingCount);

    await deleteExpenses([deleteId]);
    expect(getWorkspace().expenses.some((item) => item.id === deleteId)).toBe(false);
    expect(getWorkspace().expenses.length).toBe(startingCount - 1);
    expect(getWorkspace().expenses.find((item) => item.id === archiveId)?.archived).toBe(true);
  });

  it("requires origin and owner checks on every private workspace mutation", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");
    const publicMutations = new Set(["submitContact", "reportVulnerability"]);
    const missing: string[] = [];
    for (const part of source.split(/export async function /).slice(1)) {
      const name = part.match(/^([A-Za-z0-9_]+)/)?.[1];
      if (!name || publicMutations.has(name) || !part.includes("mutateWorkspace")) continue;
      const header = part.slice(0, 500);
      if (!header.includes("await assertSameOrigin()") || !header.includes("await requireOwnerWrite()")) {
        missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("sign-out and idle expiration", () => {
  it("clears authentication on sign-out so /dashboard requires login", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));
    expect((await getSession()).user?.source).toBe("demo");

    await expectRedirect(endDemoSession(), "/sign-out?done=1");
    expect(cookieStore.has(DEMO_COOKIE)).toBe(false);
    expect((await getSession()).user).toBeNull();

    const response = await proxy(dashboardRequest());
    expect(response.headers.get("location")).toContain("/login");
    const accountant = await proxy(new NextRequest("http://localhost:3000/accountant"));
    expect(accountant.headers.get("location")).toContain("/login");
    const client = await proxy(new NextRequest("http://localhost:3000/client"));
    expect(client.headers.get("location")).toContain("/login");
  });

  it("signs out of Supabase when it is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    cookieStore.set("sb-127-auth-token", "session-blob");
    await clearCurrentAuth();
    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(cookieStore.has("sb-127-auth-token")).toBe(false);
  });

  it("terminates the session on idle expiration so /dashboard cannot be re-entered", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));
    expect(canAccessDashboard((await getSession()).user)).toBe(true);

    await expectRedirect(expireIdleSession(), "/session-expired");
    expect(cookieStore.has(DEMO_COOKIE)).toBe(false);
    expect((await getSession()).user).toBeNull();
    expect(canAccessDashboard((await getSession()).user)).toBe(false);

    const response = await proxy(dashboardRequest());
    expect(response.headers.get("location")).toContain("/login");
  });

  it("wires sign-out and idle expiration to server-side session termination", () => {
    const signOutPage = readFileSync("src/app/sign-out/page.tsx", "utf8");
    expect(signOutPage).toContain("endDemoSession");
    expect(signOutPage).not.toContain('action="/sign-out?done=1"');

    const inactivity = readFileSync("src/components/dashboard/inactivity.tsx", "utf8");
    expect(inactivity).toContain("expireIdleSession");
    expect(inactivity).not.toContain('router.push("/session-expired")');
  });
});
