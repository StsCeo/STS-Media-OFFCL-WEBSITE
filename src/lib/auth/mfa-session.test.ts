import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_AUTH_ERROR } from "@/lib/auth/owner";
import { canAccessDashboard, getSession } from "@/lib/auth/session";
import { verifyMfaCode } from "@/app/actions";

const OWNER_EMAIL = "info@stsmedia.co";
const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const {
  assuranceLevel,
  listFactors,
  challenge,
  verify,
  getUser,
  fromLimit,
} = vi.hoisted(() => ({
  assuranceLevel: { current: "aal1" as "aal1" | "aal2" },
  listFactors: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  getUser: vi.fn(),
  fromLimit: vi.fn(),
}));

function membershipChain() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => fromLimit(),
  };
  return chain;
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
    getAll: () => [],
  }),
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
      getUser: () => getUser(),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: assuranceLevel.current, nextLevel: "aal2" },
          error: null,
        }),
        listFactors: () => listFactors(),
        challenge: (input: { factorId: string }) => challenge(input),
        verify: (input: { factorId: string; challengeId: string; code: string }) => verify(input),
      },
    },
    from: () => membershipChain(),
  })),
}));

function ownerUser(email = OWNER_EMAIL) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    email,
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("trusted AAL MFA session", () => {
  beforeEach(() => {
    assuranceLevel.current = "aal1";
    listFactors.mockReset();
    challenge.mockReset();
    verify.mockReset();
    getUser.mockReset();
    fromLimit.mockReset();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    fromLimit.mockResolvedValue({
      data: [{ organization_id: ORG_ID, role: "owner", status: "active" }],
      error: null,
    });
    getUser.mockResolvedValue({ data: { user: ownerUser() }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks a password session as needs_mfa until the provider reports aal2", async () => {
    const session = await getSession();
    expect(session.status).toBe("needs_mfa");
    expect(session.user?.mfaVerified).toBe(false);
    expect(canAccessDashboard(session.user)).toBe(false);
  });

  it("grants dashboard access only after the provider reports aal2", async () => {
    assuranceLevel.current = "aal2";
    const session = await getSession();
    expect(session.status).toBe("authenticated");
    expect(session.user?.mfaVerified).toBe(true);
    expect(session.user?.organizationId).toBe(ORG_ID);
    expect(canAccessDashboard(session.user)).toBe(true);
  });

  it("does not treat an allowlisted email as authenticated when the mailbox is not on the owner list", async () => {
    getUser.mockResolvedValue({ data: { user: ownerUser("stranger@day1.test") }, error: null });
    assuranceLevel.current = "aal2";
    const session = await getSession();
    expect(session.status).toBe("unauthenticated");
    expect(session.user).toBeNull();
  });

  it("verifies a provider-accepted TOTP challenge and redirects", async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }], phone: [] },
      error: null,
    });
    challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    verify.mockImplementation(async () => {
      assuranceLevel.current = "aal2";
      return { data: { access_token: "redacted" }, error: null };
    });
    const form = new FormData();
    form.set("code", "123456");
    form.set("next", "/dashboard/settings/business");
    await expect(verifyMfaCode(form)).rejects.toThrow("NEXT_REDIRECT:/dashboard/settings/business");
    expect(challenge).toHaveBeenCalledWith({ factorId: "factor-1" });
    expect(verify).toHaveBeenCalledWith({
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("rejects a TOTP challenge when the provider does not raise AAL", async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }], phone: [] },
      error: null,
    });
    challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    verify.mockResolvedValue({ error: { message: "invalid" } });
    const form = new FormData();
    form.set("code", "000000");
    const result = await verifyMfaCode(form);
    expect(result.grantOwnerSession).toBe(false);
    expect(result.error).toBe("Invalid token");
  });

  it("rejects MFA when no allowlisted session is present", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const form = new FormData();
    form.set("code", "123456");
    const result = await verifyMfaCode(form);
    expect(result).toMatchObject({ error: GENERIC_AUTH_ERROR, grantOwnerSession: false });
    expect(challenge).not.toHaveBeenCalled();
  });
});
