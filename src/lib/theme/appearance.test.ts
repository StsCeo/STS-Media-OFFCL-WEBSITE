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
    expect(vars["--canvas"]).toBe("#F8F7FC");
    expect(vars["--ink"]).toBe("#20202B");
    expect(vars["--primary"]).toBe("#7047EB");
    expect(vars["--primary-hover"]).toBe("#5B35D4");
    expect(vars["--lavender"]).toBe("#EDE6FF");
    expect(vars["--electric"]).toBe("#2563EB");
    expect(vars["--chart-revenue"]).toBe("#2563EB");
  });

  it("uses Midnight Navy for Night", () => {
    const night = resolveLivePalette("dark");
    expect(night.id).toBe("midnight-navy");
    expect(night.atmosphere).toBe("night-luxury");
    expect(night.tokens.obsidian).toBe("#0B1020");
    expect(paletteCssVars(night)["--primary"]).toBe("#6D4AFF");
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
