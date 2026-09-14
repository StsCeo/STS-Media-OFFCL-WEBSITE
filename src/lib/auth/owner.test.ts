import { describe, expect, it } from "vitest";
import { GENERIC_AUTH_ERROR, DEFAULT_OWNER_EMAIL, isAllowedOwnerEmail, ownerAllowlist } from "./owner";

describe("owner allowlist", () => {
  it("allows the approved owner email and rejects others", () => {
    expect(DEFAULT_OWNER_EMAIL).toBe("info@stsmedia.co");
    expect(isAllowedOwnerEmail("info@stsmedia.co")).toBe(true);
    expect(isAllowedOwnerEmail("INFO@STSMEDIA.CO")).toBe(true);
    expect(isAllowedOwnerEmail(" owner@stsmedia.co ")).toBe(false);
    expect(isAllowedOwnerEmail("hello@stsmedia.co")).toBe(false);
    expect(isAllowedOwnerEmail("")).toBe(false);
    expect(ownerAllowlist()).toContain("info@stsmedia.co");
    expect(GENERIC_AUTH_ERROR).toMatch(/could not sign you in/i);
  });
});
