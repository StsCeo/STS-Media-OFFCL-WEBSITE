import { describe, expect, it } from "vitest";
import { twoLineDescription, verifiedResults, homepageServices, capabilityStrip } from "./homepage";

describe("homepage content helpers", () => {
  it("keeps service tiles unique and linked", () => {
    const slugs = homepageServices.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(homepageServices.every((item) => item.href.startsWith("/"))).toBe(true);
    expect(capabilityStrip).toEqual(["Web Design", "Content Systems", "Brand Direction", "Digital Growth", "Automation"]);
  });

  it("does not publish placeholder results", () => {
    expect(verifiedResults(["Add verified result", "  ", "Indexed and launched"])).toEqual(["Indexed and launched"]);
  });

  it("shortens long descriptions without inventing copy", () => {
    const source = "State Collision Pro needed a public website that presented the shop as a serious, local collision-repair business — clear enough for a vehicle owner to understand the service and confident enough to make contact.";
    const shortened = twoLineDescription(source);
    expect(shortened.startsWith("State Collision Pro needed")).toBe(true);
    expect(shortened.length).toBeLessThanOrEqual(160);
  });
});
