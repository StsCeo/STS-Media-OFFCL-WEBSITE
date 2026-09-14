import { describe, expect, it } from "vitest";
import {
  describeAuthFlowState,
  describeMfaAttempt,
  describeMfaPage,
  looksForgedToken,
  NOT_CONFIGURED_MESSAGE,
  urlContainsAuthSecret,
} from "./phase1-flows";

describe("reset, invite, and MFA fail closed", () => {
  it("disables incomplete flows when the backend is missing, including production", () => {
    const state = describeAuthFlowState({
      backendConfigured: false,
      hasServerVerifiedSession: false,
      production: true,
    });
    expect(state.allowForm).toBe(false);
    expect(state.status).toBe("not_configured");
    expect(state.heading).toBe(NOT_CONFIGURED_MESSAGE);
  });

  it("rejects missing, invalid, expired, and forged recovery tokens", () => {
    const missing = describeAuthFlowState({
      backendConfigured: true,
      hasServerVerifiedSession: false,
      presentedToken: "",
    });
    const invalid = describeAuthFlowState({
      backendConfigured: true,
      hasServerVerifiedSession: false,
      presentedToken: "not-a-token",
    });
    const expired = describeAuthFlowState({
      backendConfigured: true,
      hasServerVerifiedSession: false,
      presentedToken: "recovery-token",
      tokenSignatureValid: true,
      tokenExpiresAt: 1,
      now: 2,
    });
    const forged = describeAuthFlowState({
      backendConfigured: true,
      hasServerVerifiedSession: false,
      presentedToken: "v1.payload.forged-signature",
      tokenSignatureValid: false,
    });

    expect(missing.status).toBe("missing");
    expect(invalid.status).toBe("invalid");
    expect(expired.status).toBe("expired");
    expect(forged.status).toBe("forged");
    expect([missing, invalid, expired, forged].every((item) => item.allowForm === false)).toBe(true);
  });

  it("never grants an owner session from demo MFA or an arbitrary code", () => {
    const demo = describeMfaAttempt({
      code: "123456",
      demoMode: true,
      backendConfigured: false,
      production: false,
    });
    const missing = describeMfaAttempt({
      code: "",
      demoMode: false,
      backendConfigured: true,
    });
    const invalid = describeMfaAttempt({
      code: "abc",
      demoMode: false,
      backendConfigured: true,
    });
    const expired = describeMfaAttempt({
      code: "654321",
      demoMode: false,
      backendConfigured: true,
      codeExpiresAt: 1,
      now: 10,
    });
    const forged = describeMfaAttempt({
      code: "v1.payload.forged-signature",
      demoMode: false,
      backendConfigured: true,
    });
    const page = describeMfaPage({
      demoMode: true,
      backendConfigured: false,
      hasProviderChallenge: false,
      production: true,
    });

    expect(demo.ok).toBe(false);
    expect(demo.grantOwnerSession).toBe(false);
    expect(demo.status).toBe("not_configured");
    expect(missing.status).toBe("missing");
    expect(invalid.status).toBe("invalid");
    expect(expired.status).toBe("expired");
    expect(forged.status).toBe("forged");
    expect(page.allowForm).toBe(false);
    expect(page.heading).toBe(NOT_CONFIGURED_MESSAGE);
    expect(looksForgedToken("v1.abc.def")).toBe(true);
  });

  it("does not treat passwords or codes in query strings as valid secrets", () => {
    expect(urlContainsAuthSecret("?code=123456")).toBe(true);
    expect(urlContainsAuthSecret("password=secret")).toBe(true);
    expect(urlContainsAuthSecret("next=/dashboard")).toBe(false);
  });
});
