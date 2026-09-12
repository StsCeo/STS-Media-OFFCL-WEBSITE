import { describe, expect, it } from "vitest";
import { centsToDollars, dollarsToCents, formatCents, parseDollarsToCents } from "./money";

describe("money cents", () => {
  it("round-trips dollars through integer cents", () => {
    expect(dollarsToCents(31.05)).toBe(3105);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(centsToDollars(3105)).toBe(31.05);
    expect(parseDollarsToCents("125.00")).toBe(12500);
    expect(formatCents(-6000)).toBe("-$60.00");
  });
});
