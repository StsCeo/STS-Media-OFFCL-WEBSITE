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

  it("uses the approved blue paper tokens for Day", () => {
    const day = resolveLivePalette("light");
    expect(day.id).toBe("sts-day");
    const vars = paletteCssVars(day);
    expect(vars["--canvas"]).toBe("#F7F5EF");
    expect(vars["--ink"]).toBe("#1B2A4A");
    expect(vars["--primary"]).toBe("#3157B7");
    expect(vars["--primary-hover"]).toBe("#274896");
    expect(vars["--primary-ink"]).toBe("#FFFFFF");
    expect(vars["--card"]).toBe("#FFFFFF");
    expect(vars["--line"]).toBe("#D5DCD5");
    expect(vars["--gold"]).toBe("#B99146");
    expect(vars["--lavender"]).toBe("#EEECE5");
    expect(vars["--sage-light"]).toBe("#EEECE5");
    expect(vars["--sage-dark"]).toBe("#1B2A4A");
    expect(vars["--electric"]).toBe("#3157B7");
    expect(vars["--chart-revenue"]).toBe("#3157B7");
  });

  it("uses the approved blue-charcoal tokens for Night", () => {
    const night = resolveLivePalette("dark");
    expect(night.id).toBe("sts-night");
    expect(night.atmosphere).toBe("night-luxury");
    expect(night.tokens.obsidian).toBe("#101722");
    expect(night.tokens.card).toBe("#182231");
    expect(night.tokens.ink).toBe("#F3F4EF");
    expect(night.tokens.line).toBe("#40516A");
    expect(paletteCssVars(night)["--primary"]).toBe("#8EACFF");
    expect(paletteCssVars(night)["--primary-hover"]).toBe("#A9C0FF");
    expect(paletteCssVars(night)["--primary-ink"]).toBe("#101722");
    expect(paletteCssVars(night)["--electric"]).toBe("#A9C0FF");
    expect(paletteCssVars(night)["--sage-dark"]).toBe("#A9C0FF");
    expect(paletteCssVars(night)["--background-soft"]).toBe("#213047");
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
