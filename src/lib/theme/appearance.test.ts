import { describe, expect, it } from "vitest";
import { createSeedWorkspace } from "../data/seed";
import {
  PALETTES,
  getPalette,
  paletteCssVars,
  parseTheme,
  resolveLivePalette,
} from "./palettes";

describe("locked Day / Night appearance", () => {
  it("parses only explicit dark as Night", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme("system")).toBe("light");
  });

  it("uses STS Day comfort tokens when unlocked from preview", () => {
    const day = resolveLivePalette("light");
    expect(day.id).toBe("sts-day");
    const vars = paletteCssVars(day);
    expect(vars["--canvas"]).toBe("#F3F5EF");
    expect(vars["--ink"]).toBe("#111214");
    expect(vars["--primary"]).toBe("#7048E8");
    expect(vars["--primary-hover"]).toBe("#5B38D6");
    expect(vars["--lavender"]).toBe("#DDE7D3");
    expect(vars["--sage-light"]).toBe("#DDE7D3");
    expect(vars["--sage-dark"]).toBe("#536250");
    expect(vars["--electric"]).toBe("#3478F6");
    expect(vars["--chart-revenue"]).toBe("#3478F6");
    expect(vars["--sts-gradient"]).toBe("linear-gradient(135deg, #7048E8 0%, #3478F6 100%)");
  });

  it("uses Midnight Navy for Night", () => {
    const night = resolveLivePalette("dark");
    expect(night.id).toBe("midnight-navy");
    expect(night.atmosphere).toBe("night-luxury");
    expect(night.tokens.obsidian).toBe("#0B1020");
    expect(paletteCssVars(night)["--primary"]).toBe("#6D4AFF");
    expect(paletteCssVars(night)["--lavender"]).toBe("#C9B8FF");
    expect(paletteCssVars(night)["--sage-light"]).toBeUndefined();
  });

  it("lets a lookbook preview override the locked pair", () => {
    expect(resolveLivePalette("dark", "warm-earth").id).toBe("warm-earth");
    expect(resolveLivePalette("light", "midnight-navy").id).toBe("midnight-navy");
  });

  it("keeps lookbook palettes and seeds Day as the saved brand", () => {
    expect(PALETTES.some((item) => item.id === "sts-day")).toBe(true);
    expect(PALETTES).toHaveLength(12);
    expect(getPalette("sts-day").name).toBe("STS Day");
    expect(createSeedWorkspace().brand.paletteId).toBe("sts-day");
  });
});
