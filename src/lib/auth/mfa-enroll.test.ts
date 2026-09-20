import { describe, expect, it } from "vitest";
import { describeMfaEnrollmentAccess, isRecentAuthentication, MFA_RECOVERY_UNAVAILABLE } from "@/lib/auth/mfa-enroll";
import { readFileSync } from "node:fs";

describe("MFA enrollment policy", () => {
  it("requires a signed-in authorized account and recent authentication", () => {
    expect(
      describeMfaEnrollmentAccess({
        signedIn: false,
        authorized: false,
        recentAuth: false,
        demoMode: false,
        backendConfigured: true,
      }).allowed,
    ).toBe(false);
    expect(
      describeMfaEnrollmentAccess({
        signedIn: true,
        authorized: false,
        recentAuth: true,
        demoMode: false,
        backendConfigured: true,
      }).allowed,
    ).toBe(false);
    expect(
      describeMfaEnrollmentAccess({
        signedIn: true,
        authorized: true,
        recentAuth: false,
        demoMode: false,
        backendConfigured: true,
      }).allowed,
    ).toBe(false);
    expect(
      describeMfaEnrollmentAccess({
        signedIn: true,
        authorized: true,
        recentAuth: true,
        demoMode: true,
        backendConfigured: true,
      }).allowed,
    ).toBe(false);
    expect(
      describeMfaEnrollmentAccess({
        signedIn: true,
        authorized: true,
        recentAuth: true,
        demoMode: false,
        backendConfigured: true,
      }).allowed,
    ).toBe(true);
  });

  it("treats last_sign_in within 15 minutes as recent", () => {
    const now = Date.parse("2026-09-19T21:00:00.000Z");
    expect(isRecentAuthentication("2026-09-19T20:50:00.000Z", now)).toBe(true);
    expect(isRecentAuthentication("2026-09-19T20:40:00.000Z", now)).toBe(false);
    expect(isRecentAuthentication(null, now)).toBe(false);
  });

  it("does not invent recovery codes and keeps secrets out of the enroll page source", () => {
    expect(MFA_RECOVERY_UNAVAILABLE).toMatch(/Recovery codes are not issued/i);
    const enroll = readFileSync("src/app/mfa/enroll/page.tsx", "utf8");
    const form = readFileSync("src/components/auth/mfa-enroll-form.tsx", "utf8");
    const actions = readFileSync("src/app/mfa-actions.ts", "utf8");
    expect(enroll).not.toContain("action=\"/mfa/verify\"");
    expect(form).not.toContain("secret");
    expect(form).toContain("enrollmentCancelled");
    expect(actions).not.toContain("console.log");
    expect(actions).toContain("No secret was logged");
    expect(actions).toContain("unenroll");
    expect(actions).toContain("cancelled: true");
    expect(actions).toContain("factors?.all");
    expect(actions).toContain("mfa.challenge");
    expect(actions).not.toMatch(/format\.status === "invalid"/);
  });
});
