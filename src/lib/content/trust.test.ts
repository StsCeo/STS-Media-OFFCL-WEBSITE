import { describe, expect, it } from "vitest";
import { accessibility, userRights, vulnerabilityPolicy } from "./trust";
import { vulnerabilitySchema } from "../validation";

describe("trust copy", () => {
  it("states a WCAG 2.2 AA aim without a fake certification", () => {
    expect(accessibility.lede).toMatch(/WCAG 2\.2 Level AA/);
    expect(accessibility.commitment.some((item) => item.body.includes("ADA certified"))).toBe(true);
  });

  it("documents user rights including no sale of personal information", () => {
    expect(userRights.rights.some((item) => /sell/i.test(item.body))).toBe(true);
    expect(userRights.howTo).toMatch(/hello@stsmedia.co/);
  });

  it("defines a coordinated vulnerability path without a bounty", () => {
    expect(vulnerabilityPolicy.inScope.length).toBeGreaterThan(0);
    expect(vulnerabilityPolicy.rules.some((item) => /bounty/i.test(item))).toBe(true);
  });
});

describe("vulnerability reports", () => {
  it("rejects reports without good-faith confirmation", () => {
    const result = vulnerabilitySchema.safeParse({
      product: "public-site",
      summary: "Open redirect on login next param",
      details: "The next parameter on /login accepted an external URL in an earlier draft.",
      goodFaith: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete good-faith report", () => {
    const result = vulnerabilitySchema.safeParse({
      reporter: "Alex",
      email: "alex@example.com",
      product: "auth",
      summary: "Session cookie missing Secure in production notes",
      details: "Documented cookie flags should stay httpOnly, SameSite=Lax, and Secure in production.",
      goodFaith: true,
      companyWebsite: "",
    });
    expect(result.success).toBe(true);
  });
});
