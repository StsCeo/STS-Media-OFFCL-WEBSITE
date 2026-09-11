import { describe, expect, it } from "vitest";
import { passwordScore } from "./password";
import { getPalette, PALETTES } from "../theme/palettes";

describe("password policy", () => {
  it("rejects short or simple passwords", () => {
    expect(passwordScore("password").ok).toBe(false);
    expect(passwordScore("Short1!").ok).toBe(false);
  });

  it("accepts a long mixed password", () => {
    expect(passwordScore("ForestGold#2026sts").ok).toBe(true);
  });
});

describe("palettes", () => {
  it("falls back to forest-gold", () => {
    expect(getPalette("nope").id).toBe("forest-gold");
    expect(PALETTES).toHaveLength(6);
  });
});
