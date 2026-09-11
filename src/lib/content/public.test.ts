import { describe, expect, it } from "vitest";
import { faqs, resources } from "./public";

describe("public content", () => {
  it("keeps resource slugs unique", () => {
    const slugs = resources.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has usable FAQ copy", () => {
    expect(faqs.length).toBeGreaterThan(5);
    expect(faqs.every((item) => item.q && item.a)).toBe(true);
  });
});
