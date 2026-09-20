import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoModeEnabled, isProductionEnv } from "@/lib/config";
import { canAccessDashboard, getSession, sessionOrganizationId } from "@/lib/auth/session";
import { signDemoSession } from "@/lib/auth/demo-session";
import { DEMO_COOKIE } from "@/lib/config";
import { startDemoSession } from "@/app/actions";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
import { DEMO_ORGANIZATION_ID } from "@/lib/org/defaults";

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

afterEach(() => {
  cookieStore.clear();
  vi.unstubAllEnvs();
});

describe("production authentication fail-closed", () => {
  it("ignores NEXT_PUBLIC_ENABLE_DEMO_MODE in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "true");
    vi.stubEnv("DEMO_SESSION_SECRET", TEST_SECRET);
    expect(isProductionEnv()).toBe(true);
    expect(isDemoModeEnabled()).toBe(false);
  });

  it("ignores demo mode when VERCEL_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "true");
    expect(isDemoModeEnabled()).toBe(false);
  });

  it("does not grant dashboard access from a previously issued demo cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "true");
    vi.stubEnv("DEMO_SESSION_SECRET", TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const token = await signDemoSession("owner", { secret: TEST_SECRET });
    cookieStore.set(DEMO_COOKIE, token);

    const session = await getSession();
    expect(session.user).toBeNull();
    expect(canAccessDashboard(session.user)).toBe(false);
    expect(sessionOrganizationId(session.user)).toBeNull();

    const response = await proxy(
      new NextRequest("http://localhost:3000/dashboard", {
        headers: { cookie: `${DEMO_COOKIE}=${token}` },
      }),
    );
    expect(response.headers.get("location")).toContain("/login");
  });

  it("does not issue a demo session in production even when the flag is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "true");
    vi.stubEnv("DEMO_SESSION_SECRET", TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const formData = new FormData();
    formData.set("next", "/dashboard");
    await expect(startDemoSession(formData)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(cookieStore.has(DEMO_COOKIE)).toBe(false);
  });

  it("denies private access when production auth is unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const session = await getSession();
    expect(session.status).toBe("unconfigured");
    expect(canAccessDashboard(session.user)).toBe(false);

    const response = await proxy(new NextRequest("http://localhost:3000/dashboard"));
    expect(response.headers.get("location")).toContain("/login");
    const accountant = await proxy(new NextRequest("http://localhost:3000/accountant"));
    expect(accountant.headers.get("location")).toContain("/login");
  });

  it("does not treat a forged supabase cookie name as authentication when supabase is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const response = await proxy(
      new NextRequest("http://localhost:3000/dashboard", {
        headers: { cookie: "sb-test-auth-token=forged" },
      }),
    );
    expect(response.headers.get("location")).toContain("/login");
  });

  it("does not default a missing organization role to owner", () => {
    expect(
      canAccessDashboard({
        id: "user-1",
        email: "client@example.com",
        role: "client",
        mfaVerified: true,
        emailVerified: true,
        source: "supabase",
        organizationRole: null,
        membershipStatus: null,
        organizationId: DEMO_ORGANIZATION_ID,
      }),
    ).toBe(false);
  });
});
