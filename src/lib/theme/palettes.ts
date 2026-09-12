export type PaletteId =
  | "forest-gold"
  | "midnight-studio"
  | "warm-atelier"
  | "coastal-clarity"
  | "ember"
  | "signal-paper"
  | "charcoal-blue-light"
  | "midnight-navy";

export type PaletteAtmosphere = "daylight" | "night-luxury";

export interface Palette {
  id: PaletteId;
  name: string;
  tagline: string;
  suitedFor: string;
  atmosphere?: PaletteAtmosphere;
  lavender?: string;
  violet?: string;
  electric?: string;
  tokens: {
    obsidian: string;
    forest: string;
    forestHover: string;
    emerald: string;
    gold: string;
    ivory: string;
    softGray: string;
    canvas: string;
    card: string;
    ink: string;
    muted: string;
    line: string;
    focus: string;
  };
}

export const PALETTES: Palette[] = [
  {
    id: "forest-gold",
    name: "Forest & Gold",
    tagline: "The STS Media default — cinematic, grounded, spare gold.",
    suitedFor: "The production brand. Business owners and creators who want quiet confidence.",
    tokens: {
      obsidian: "#0B0D0C",
      forest: "#163D2B",
      forestHover: "#0F2F21",
      emerald: "#2E7D5B",
      gold: "#C6A15B",
      ivory: "#F7F5EF",
      softGray: "#A7ADA8",
      canvas: "#F3F4F2",
      card: "#FFFFFF",
      ink: "#252825",
      muted: "#6B716D",
      line: "#DFE3DF",
      focus: "#52A77D",
    },
  },
  {
    id: "midnight-studio",
    name: "Midnight Studio",
    tagline: "Cooler night palette for creator-facing work and reels covers.",
    suitedFor: "Creators, collaborations, and evening-shot brand films.",
    tokens: {
      obsidian: "#08090F",
      forest: "#1A2744",
      forestHover: "#121B32",
      emerald: "#3E7F9A",
      gold: "#C9BBA3",
      ivory: "#F2EFE8",
      softGray: "#A8B0B8",
      canvas: "#EEF0F3",
      card: "#FFFFFF",
      ink: "#1C2230",
      muted: "#5E6774",
      line: "#D5DBE3",
      focus: "#6FA4BB",
    },
  },
  {
    id: "warm-atelier",
    name: "Warm Atelier",
    tagline: "Espresso, clay, and cream — closer to a shop than a SaaS dashboard.",
    suitedFor: "Local service businesses, studios, and craft-led brands.",
    tokens: {
      obsidian: "#16110E",
      forest: "#4A2E1C",
      forestHover: "#362115",
      emerald: "#A45B32",
      gold: "#D0A36A",
      ivory: "#F8F1E4",
      softGray: "#B5A99A",
      canvas: "#F4EDE2",
      card: "#FFFBF5",
      ink: "#2A2118",
      muted: "#74685C",
      line: "#E6D9C8",
      focus: "#C47A4A",
    },
  },
  {
    id: "coastal-clarity",
    name: "Coastal Clarity",
    tagline: "Sea-glass green and sand. Clean, readable, unhurried.",
    suitedFor: "Professional services and operators who want a calmer public face.",
    tokens: {
      obsidian: "#0B1316",
      forest: "#184A46",
      forestHover: "#113632",
      emerald: "#2F8A7B",
      gold: "#C5B48A",
      ivory: "#F3F6F3",
      softGray: "#9AADA8",
      canvas: "#EEF3F1",
      card: "#FFFFFF",
      ink: "#1D2A28",
      muted: "#5B6E6A",
      line: "#D4E0DC",
      focus: "#4EAEA0",
    },
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "Charcoal and copper. Premium without costume jewelry.",
    suitedFor: "High-consideration offers and after-dark brand moments.",
    tokens: {
      obsidian: "#120E0C",
      forest: "#3E2418",
      forestHover: "#2C1810",
      emerald: "#C0562A",
      gold: "#E0B070",
      ivory: "#F6EFE6",
      softGray: "#B7A89A",
      canvas: "#F3ECE3",
      card: "#FFF9F2",
      ink: "#2B211A",
      muted: "#74675B",
      line: "#E7D8C8",
      focus: "#D57848",
    },
  },
  {
    id: "signal-paper",
    name: "Signal Paper",
    tagline: "High-clarity ink on paper. Operational, editorial, easy to scan.",
    suitedFor: "The Command Center and owners who live in the dashboard all day.",
    tokens: {
      obsidian: "#101211",
      forest: "#1C3A2C",
      forestHover: "#14281E",
      emerald: "#1F7A4C",
      gold: "#8A9188",
      ivory: "#FAFAF7",
      softGray: "#8B928C",
      canvas: "#F4F5F2",
      card: "#FFFFFF",
      ink: "#1A1D1B",
      muted: "#5C635E",
      line: "#D8DCD7",
      focus: "#3D9A68",
    },
  },
  {
    id: "charcoal-blue-light",
    name: "Charcoal Blue Light",
    tagline: "Slate charcoal on cool paper. Blue without going navy-night.",
    suitedFor: "Daylight pages: a quiet charcoal-blue header on pale blue-gray paper, for owners who want cool and readable.",
    tokens: {
      obsidian: "#171C24",
      forest: "#2C3D52",
      forestHover: "#223044",
      emerald: "#4A6785",
      gold: "#A7B4C4",
      ivory: "#F2F4F7",
      softGray: "#9AA5B2",
      canvas: "#E8ECF1",
      card: "#FFFFFF",
      ink: "#1A222C",
      muted: "#5B6673",
      line: "#D3DAE3",
      focus: "#6B8AA8",
    },
  },
  {
    id: "midnight-navy",
    name: "Midnight Navy",
    tagline: "Soothing night glass. Cream type, violet light, gold only at the edges.",
    suitedFor: "A luxurious dark public site and Command Center — navy gradients, spare accents, no costume sparkle.",
    atmosphere: "night-luxury",
    lavender: "#C9B8FF",
    violet: "#6D4AFF",
    electric: "#3B82F6",
    tokens: {
      obsidian: "#0B1020",
      forest: "#121A2F",
      forestHover: "#0E1528",
      emerald: "#3B82F6",
      gold: "#D7B56D",
      ivory: "#F7F2E8",
      softGray: "#D5CDBF",
      canvas: "#0B1020",
      card: "#121A2F",
      ink: "#F7F2E8",
      muted: "#C9C2B4",
      line: "#2C3550",
      focus: "#C9B8FF",
    },
  },
];

export function getPalette(id: string | null | undefined): Palette {
  return PALETTES.find((item) => item.id === id) ?? PALETTES[0];
}

export function paletteAtmosphere(palette: Palette): PaletteAtmosphere {
  return palette.atmosphere ?? "daylight";
}

export function paletteCssVars(palette: Palette, accentOverride?: string) {
  const accent = accentOverride && /^#[0-9A-Fa-f]{6}$/.test(accentOverride) ? accentOverride : palette.tokens.emerald;
  const t = palette.tokens;
  const night = paletteAtmosphere(palette) === "night-luxury";
  const lavender = palette.lavender ?? "#C9B8FF";
  const violet = palette.violet ?? t.forest;
  const electric = palette.electric ?? t.focus;
  return {
    "--obsidian": t.obsidian,
    "--forest": t.forest,
    "--forest-hover": t.forestHover,
    "--emerald": t.emerald,
    "--gold": t.gold,
    "--ivory": t.ivory,
    "--soft-gray": t.softGray,
    "--canvas": t.canvas,
    "--card": t.card,
    "--ink": t.ink,
    "--muted": t.muted,
    "--line": t.line,
    "--focus": t.focus,
    "--lavender": lavender,
    "--violet": violet,
    "--electric": electric,
    "--cream": t.ivory,
    "--primary": night ? violet : t.forest,
    "--primary-hover": night ? "#5B3DE8" : t.forestHover,
    "--accent": accent,
    "--brand-accent": accent,
    "--background": night ? t.obsidian : t.ivory,
    "--foreground": t.ink,
    "--surface": t.card,
    "--border": t.line,
    ...(night ? { "--gold-ink": t.gold } : {}),
  } as Record<string, string>;
}
