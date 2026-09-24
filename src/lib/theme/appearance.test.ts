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

  it("uses Banner journey cream tokens for Day", () => {
    const day = resolveLivePalette("light");
    expect(day.id).toBe("sts-day");
    const vars = paletteCssVars(day);
    expect(vars["--canvas"]).toBe("#FAF8F2");
    expect(vars["--ink"]).toBe("#12372A");
    expect(vars["--primary"]).toBe("#12372A");
    expect(vars["--primary-hover"]).toBe("#1F6F5C");
    expect(vars["--lavender"]).toBe("#EAF8F0");
    expect(vars["--sage-light"]).toBe("#EAF8F0");
    expect(vars["--sage-dark"]).toBe("#12372A");
    expect(vars["--electric"]).toBe("#1F6F5C");
    expect(vars["--chart-revenue"]).toBe("#1F6F5C");
  });

  it("uses Banner journey forest night for Night", () => {
    const night = resolveLivePalette("dark");
    expect(night.id).toBe("sts-night");
    expect(night.atmosphere).toBe("night-luxury");
    expect(night.tokens.obsidian).toBe("#050706");
    expect(paletteCssVars(night)["--primary"]).toBe("#1F6F5C");
    expect(paletteCssVars(night)["--electric"]).toBe("#9CF0D1");
    expect(paletteCssVars(night)["--sage-dark"]).toBe("#1F6F5C");
  });

  it("lets a lookbook preview override the locked pair", () => {
    expect(resolveLivePalette("dark", "warm-earth").id).toBe("warm-earth");
    expect(resolveLivePalette("light", "midnight-navy").id).toBe("midnight-navy");
  });

  it("keeps lookbook palettes and seeds Day as the saved brand", () => {
    expect(PALETTES.some((item) => item.id === "sts-day")).toBe(true);
    expect(PALETTES.some((item) => item.id === "sts-night")).toBe(true);
    expect(PALETTES).toHaveLength(13);
    expect(getPalette("sts-day").name).toBe("STS Day");
    expect(createSeedWorkspace().brand.paletteId).toBe("sts-day");
  });
});
