import { describe, expect, it } from "vitest";
import { contactSchema } from "./validation";
import { isSafeRedirect } from "./utils";

describe("validation", () => {
  it("rejects contact submissions without consent", () => {
    const result = contactSchema.safeParse({
      name: "Jordan",
      email: "jordan@example.com",
      service: "Website redesign",
      preferredContact: "email",
      message: "We need a clearer website for the shop.",
      consent: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete contact payload", () => {
    const result = contactSchema.safeParse({
      name: "Jordan",
      email: "jordan@example.com",
      service: "Website redesign",
      preferredContact: "email",
      message: "We need a clearer website for the shop.",
      consent: true,
      companyWebsite: "",
    });
    expect(result.success).toBe(true);
  });

  it("only allows internal redirects", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("https://evil.example")).toBe(false);
    expect(isSafeRedirect("//stsmedia.co")).toBe(false);
  });
});
