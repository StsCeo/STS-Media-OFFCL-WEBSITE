export type PaletteId =
  | "forest-gold"
  | "midnight-studio"
  | "warm-atelier"
  | "coastal-clarity"
  | "ember"
  | "signal-paper"
  | "charcoal-blue-light"
  | "midnight-navy"
  | "celsius-creative"
  | "charcoal-sage"
  | "warm-earth"
  | "sts-day"
  | "sts-night";

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
  primary?: string;
  primaryHover?: string;
  primaryInk?: string;
  goldInk?: string;
  terracotta?: string;
  beige?: string;
  tan?: string;
  cream?: string;
  charts?: {
    revenue: string;
    profit: string;
    traffic: string;
    leads: string;
    expenses: string;
    pending?: string;
  };
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
      forest: "#16223D",
      forestHover: "#0F192F",
      emerald: "#2E467D",
      gold: "#C6A15B",
      ivory: "#F7F5EF",
      softGray: "#A7ADA8",
      canvas: "#F3F4F2",
      card: "#FFFFFF",
      ink: "#252825",
      muted: "#6B716D",
      line: "#DFE3DF",
      focus: "#526BA7",
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
    tagline: "Cool water and sand. Clean, readable, unhurried.",
    suitedFor: "Professional services and operators who want a calmer public face.",
    tokens: {
      obsidian: "#0B1316",
      forest: "#18274A",
      forestHover: "#111C36",
      emerald: "#2F4A8A",
      gold: "#C5B48A",
      ivory: "#F3F6F3",
      softGray: "#9AA0AD",
      canvas: "#EEF3F1",
      card: "#FFFFFF",
      ink: "#1D2A28",
      muted: "#5B616E",
      line: "#D4D8E0",
      focus: "#4E6BAE",
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
      forest: "#1C253A",
      forestHover: "#141A28",
      emerald: "#1F3A7A",
      gold: "#888B91",
      ivory: "#FAFAF7",
      softGray: "#8B928C",
      canvas: "#F4F5F2",
      card: "#FFFFFF",
      ink: "#1A1D1B",
      muted: "#5C635E",
      line: "#D8DCD7",
      focus: "#3D599A",
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
      muted: "#D6CFC0",
      line: "#3A4460",
      focus: "#C9B8FF",
    },
  },
  {
    id: "celsius-creative",
    name: "Celsius Creative",
    tagline: "Official Celsius Marketing cyan, navy, and cool paper — agency-bright, not night-club.",
    suitedFor: "A marketing-studio daylight look: navy chrome, cyan calls to action, white field.",
    atmosphere: "daylight",
    electric: "#009FEE",
    primary: "#009FEE",
    primaryHover: "#003A52",
    primaryInk: "#003A52",
    goldInk: "#006B93",
    tokens: {
      obsidian: "#003A52",
      forest: "#003A52",
      forestHover: "#002A3C",
      emerald: "#009FEE",
      gold: "#5CC8F5",
      ivory: "#F5FAFC",
      softGray: "#A2A2A2",
      canvas: "#EEF5F8",
      card: "#FFFFFF",
      ink: "#003A52",
      muted: "#3D5560",
      line: "#D2E3EA",
      focus: "#009FEE",
    },
  },
  {
    id: "charcoal-sage",
    name: "Charcoal Sage",
    tagline: "Charcoal field, sage and white paper, Celsius blue only on charts.",
    suitedFor: "The combined pick: charcoal chrome, light forest-sage actions on white, and #009FEE reserved for graphs.",
    atmosphere: "daylight",
    electric: "#009FEE",
    primary: "#A8B2C9",
    primaryHover: "#16223D",
    primaryInk: "#0B0D0C",
    goldInk: "#2E467D",
    charts: {
      revenue: "#009FEE",
      profit: "#5CC8F5",
      traffic: "#003A52",
      leads: "#4BA3D9",
      expenses: "#0077C2",
      pending: "#A2A2A2",
    },
    tokens: {
      obsidian: "#0B0D0C",
      forest: "#1C1F1D",
      forestHover: "#121514",
      emerald: "#8F9DBE",
      gold: "#B5BED4",
      ivory: "#FFFFFF",
      softGray: "#A7ADA8",
      canvas: "#F3F6F4",
      card: "#FFFFFF",
      ink: "#141816",
      muted: "#4E5652",
      line: "#D8E0DA",
      focus: "#6B7B9F",
    },
  },
  {
    id: "warm-earth",
    name: "Warm Earth",
    tagline: "Ivory paper, sage, forest, and a little terracotta — calm boutique, not costume.",
    suitedFor: "A wellness and lifestyle register: warm cream fields, charcoal type, sage actions, terracotta only at the edges.",
    atmosphere: "daylight",
    electric: "#313E5D",
    primary: "#4A587A",
    primaryHover: "#313E5D",
    primaryInk: "#FFFFFF",
    goldInk: "#8A4A32",
    terracotta: "#C87352",
    beige: "#D9C9B5",
    tan: "#B9956D",
    cream: "#FBF8F2",
    tokens: {
      obsidian: "#313E5D",
      forest: "#313E5D",
      forestHover: "#27314A",
      emerald: "#5C6B8F",
      gold: "#C87352",
      ivory: "#F5F0E7",
      softGray: "#D9C9B5",
      canvas: "#F5F0E7",
      card: "#FBF8F2",
      ink: "#202020",
      muted: "#665B52",
      line: "#D9C9B5",
      focus: "#313E5D",
    },
  },
  {
    id: "sts-day",
    name: "STS Day",
    tagline: "Warm paper, navy type, and blue actions.",
    suitedFor: "The live daylight look: cream field, navy headings, blue actions.",
    atmosphere: "daylight",
    lavender: "#EEECE5",
    violet: "#1B2A4A",
    electric: "#3157B7",
    primary: "#3157B7",
    primaryHover: "#274896",
    primaryInk: "#FFFFFF",
    goldInk: "#1B2A4A",
    cream: "#F7F5EF",
    charts: {
      revenue: "#3157B7",
      profit: "#1B2A4A",
      traffic: "#274896",
      leads: "#8EACFF",
      expenses: "#5C6B7A",
      pending: "#D5DCD5",
    },
    tokens: {
      obsidian: "#F7F5EF",
      forest: "#3157B7",
      forestHover: "#274896",
      emerald: "#3157B7",
      gold: "#B99146",
      ivory: "#F7F5EF",
      softGray: "#5C6B7A",
      canvas: "#F7F5EF",
      card: "#FFFFFF",
      ink: "#1B2A4A",
      muted: "#5C6B7A",
      line: "#D5DCD5",
      focus: "#3157B7",
    },
  },
  {
    id: "sts-night",
    name: "STS Night",
    tagline: "Blue-charcoal night, ivory type, and blue actions.",
    suitedFor: "The live night look: deep blue-charcoal, ivory headings, blue actions.",
    atmosphere: "night-luxury",
    lavender: "#A9C0FF",
    violet: "#8EACFF",
    electric: "#A9C0FF",
    primary: "#8EACFF",
    primaryHover: "#A9C0FF",
    primaryInk: "#101722",
    goldInk: "#B99146",
    cream: "#F3F4EF",
    charts: {
      revenue: "#8EACFF",
      profit: "#A9C0FF",
      traffic: "#F3F4EF",
      leads: "#3157B7",
      expenses: "#C4CBD6",
      pending: "#40516A",
    },
    tokens: {
      obsidian: "#101722",
      forest: "#8EACFF",
      forestHover: "#A9C0FF",
      emerald: "#8EACFF",
      gold: "#B99146",
      ivory: "#F3F4EF",
      softGray: "#C4CBD6",
      canvas: "#101722",
      card: "#182231",
      ink: "#F3F4EF",
      muted: "#C4CBD6",
      line: "#40516A",
      focus: "#A9C0FF",
    },
  },
];

export const STS_DAY_PALETTE_ID: PaletteId = "sts-day";
export const STS_NIGHT_PALETTE_ID: PaletteId = "sts-night";

export function getPalette(id: string | null | undefined): Palette {
  return PALETTES.find((item) => item.id === id) ?? PALETTES[0];
}

export function parseTheme(value: string | null | undefined): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

/** Live chrome: Banner journey Day cream or Night forest. Lookbook preview cookie still wins. */
export function resolveLivePalette(theme: "light" | "dark", previewId?: string | null) {
  if (previewId) return getPalette(previewId);
  return getPalette(theme === "dark" ? STS_NIGHT_PALETTE_ID : STS_DAY_PALETTE_ID);
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
    "--cream": palette.cream ?? t.ivory,
    "--terracotta": palette.terracotta ?? t.gold,
    "--beige": palette.beige ?? t.line,
    "--tan": palette.tan ?? t.gold,
    "--sage": t.emerald,
    "--primary": palette.primary ?? (night ? violet : t.forest),
    "--primary-hover": palette.primaryHover ?? t.forestHover,
    "--primary-ink": palette.primaryInk ?? "#FFFFFF",
    "--accent": accent,
    "--brand-accent": accent,
    "--background": night ? t.obsidian : t.ivory,
    "--foreground": t.ink,
    "--surface": t.card,
    "--border": t.line,
    ...(palette.id === "sts-day"
      ? {
          "--background-soft": "#EEECE5",
          "--surface-muted": "#EEECE5",
          "--sage-light": "#EEECE5",
          "--sage-medium": "#D5DCD5",
          "--sage-strong": "#3157B7",
          "--sage-dark": "#1B2A4A",
          "--border-light": "#D5DCD5",
          "--border-strong": "#40516A",
        }
      : {}),
    ...(palette.id === "sts-night"
      ? {
          "--background-soft": "#213047",
          "--surface-muted": "#213047",
          "--sage-light": "#213047",
          "--sage-medium": "#40516A",
          "--sage-strong": "#8EACFF",
          "--sage-dark": "#A9C0FF",
          "--border-light": "#40516A",
          "--border-strong": "#8EACFF",
        }
      : {}),
    ...(night ? { "--gold-ink": t.gold } : palette.goldInk ? { "--gold-ink": palette.goldInk } : {}),
    ...(palette.charts
      ? {
          "--chart-revenue": palette.charts.revenue,
          "--chart-profit": palette.charts.profit,
          "--chart-traffic": palette.charts.traffic,
          "--chart-leads": palette.charts.leads,
          "--chart-expenses": palette.charts.expenses,
          "--chart-pending": palette.charts.pending ?? "#A2A2A2",
        }
      : {}),
  } as Record<string, string>;
}
