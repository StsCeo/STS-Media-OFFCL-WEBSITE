import { describe, expect, it } from "vitest";
import { passwordScore } from "./password";
import { createSeedWorkspace } from "../data/seed";
import { getPalette, PALETTES, paletteCssVars } from "../theme/palettes";

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
    expect(PALETTES).toHaveLength(11);
    expect(getPalette("charcoal-blue-light").name).toBe("Charcoal Blue Light");
    expect(getPalette("midnight-navy").atmosphere).toBe("night-luxury");
    expect(getPalette("midnight-navy").tokens.obsidian).toBe("#0B1020");
    const vars = paletteCssVars(getPalette("midnight-navy"));
    expect(vars["--primary"]).toBe("#6D4AFF");
    expect(vars["--violet"]).toBe("#6D4AFF");
    expect(vars["--electric"]).toBe("#3B82F6");
    expect(vars["--lavender"]).toBe("#C9B8FF");
    expect(vars["--gold"]).toBe("#D7B56D");
    expect(vars["--ivory"]).toBe("#F7F2E8");
    expect(getPalette("celsius-creative").name).toBe("Celsius Creative");
    const celsius = paletteCssVars(getPalette("celsius-creative"));
    expect(celsius["--primary"]).toBe("#009FEE");
    expect(celsius["--obsidian"]).toBe("#003A52");
    expect(celsius["--emerald"]).toBe("#009FEE");
    expect(celsius["--soft-gray"]).toBe("#A2A2A2");
    expect(createSeedWorkspace().brand.paletteId).toBe("charcoal-sage");
    expect(createSeedWorkspace().brand.accentColor).toBe("#8FBEA5");
    expect(getPalette("charcoal-sage").name).toBe("Charcoal Sage");
    const sage = paletteCssVars(getPalette("charcoal-sage"));
    expect(sage["--obsidian"]).toBe("#0B0D0C");
    expect(sage["--primary"]).toBe("#A8C9B6");
    expect(sage["--ivory"]).toBe("#FFFFFF");
    expect(sage["--gold-ink"]).toBe("#2E7D5B");
    expect(sage["--electric"]).toBe("#009FEE");
    expect(sage["--chart-revenue"]).toBe("#009FEE");
    expect(sage["--chart-traffic"]).toBe("#003A52");
    expect(getPalette("warm-earth").name).toBe("Warm Earth");
    const earth = paletteCssVars(getPalette("warm-earth"));
    expect(earth["--ivory"]).toBe("#F5F0E7");
    expect(earth["--cream"]).toBe("#FBF8F2");
    expect(earth["--sage"]).toBe("#5C8F6B");
    expect(earth["--forest"]).toBe("#315D46");
    expect(earth["--terracotta"]).toBe("#C87352");
    expect(earth["--ink"]).toBe("#202020");
    expect(earth["--primary"]).toBe("#4A7A58");
  });
});
