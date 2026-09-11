export type PaletteId =
  | "forest-gold"
  | "midnight-studio"
  | "warm-atelier"
  | "coastal-clarity"
  | "ember"
  | "signal-paper";

export interface Palette {
  id: PaletteId;
  name: string;
  tagline: string;
  suitedFor: string;
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
];

export function getPalette(id: string | null | undefined): Palette {
  return PALETTES.find((item) => item.id === id) ?? PALETTES[0];
}

export function paletteCssVars(palette: Palette, accentOverride?: string) {
  const accent = accentOverride && /^#[0-9A-Fa-f]{6}$/.test(accentOverride) ? accentOverride : palette.tokens.emerald;
  const t = palette.tokens;
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
    "--primary": t.forest,
    "--primary-hover": t.forestHover,
    "--accent": accent,
    "--brand-accent": accent,
    "--background": t.ivory,
    "--foreground": t.ink,
    "--surface": t.card,
    "--border": t.line,
  } as Record<string, string>;
}
