import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_SESSION_MAX_AGE_SECONDS } from "@/lib/config";
import {
  demoSessionCookieOptions,
  getDemoSessionSecret,
  isDemoSessionConfigured,
  signDemoSession,
  unsignedDemoCookieValues,
  verifyDemoSession,
} from "./demo-session";

const SECRET = "vitest-demo-session-secret-key-32ch";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signed demo session", () => {
  it("accepts a token signed with the server secret", async () => {
    const token = await signDemoSession("owner", { secret: SECRET });
    const session = await verifyDemoSession(token, { secret: SECRET });
    expect(session?.mode).toBe("owner");
    expect(token).not.toBe("owner");
    expect(token.startsWith("v1.")).toBe(true);
  });

  it("rejects a forged unsigned owner or needs_mfa cookie", async () => {
    for (const value of unsignedDemoCookieValues()) {
      expect(await verifyDemoSession(value, { secret: SECRET })).toBeNull();
    }
    expect(await verifyDemoSession("v1.not-real.signature", { secret: SECRET })).toBeNull();
    expect(await verifyDemoSession("", { secret: SECRET })).toBeNull();
  });

  it("rejects a modified payload that keeps the original signature", async () => {
    const token = await signDemoSession("owner", { secret: SECRET });
    const [version, payloadPart, signaturePart] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
      mode: string;
      iat: number;
      exp: number;
    };
    payload.exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const tampered = `${version}.${tamperedPayload}.${signaturePart}`;
    expect(await verifyDemoSession(tampered, { secret: SECRET })).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    const issuedAt = Date.now() - 9 * 60 * 60 * 1000;
    const token = await signDemoSession("owner", {
      secret: SECRET,
      now: issuedAt,
      maxAgeMs: 8 * 60 * 60 * 1000,
    });
    expect(await verifyDemoSession(token, { secret: SECRET, now: Date.now() })).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const token = await signDemoSession("owner", { secret: SECRET });
    expect(await verifyDemoSession(token, { secret: "another-demo-session-secret-key-32" })).toBeNull();
  });

  it("fails closed when the demo session secret is missing or too short", async () => {
    vi.stubEnv("DEMO_SESSION_SECRET", "");
    expect(getDemoSessionSecret()).toBeNull();
    expect(isDemoSessionConfigured()).toBe(false);
    await expect(signDemoSession("owner")).rejects.toThrow(/not available/i);
    expect(await verifyDemoSession("owner")).toBeNull();

    vi.stubEnv("DEMO_SESSION_SECRET", "short-secret");
    expect(getDemoSessionSecret()).toBeNull();
    expect(isDemoSessionConfigured()).toBe(false);
  });

  it("sets HttpOnly, SameSite, path, expiration, and Secure in production", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(demoSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
      secure: false,
    });

    vi.stubEnv("NODE_ENV", "production");
    expect(demoSessionCookieOptions().secure).toBe(true);
  });
});
