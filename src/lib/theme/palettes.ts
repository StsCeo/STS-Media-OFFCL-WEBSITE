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
  | "sts-day";

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
    primary: "#A8C9B6",
    primaryHover: "#163D2B",
    primaryInk: "#0B0D0C",
    goldInk: "#2E7D5B",
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
      emerald: "#8FBEA5",
      gold: "#B5D4C4",
      ivory: "#FFFFFF",
      softGray: "#A7ADA8",
      canvas: "#F3F6F4",
      card: "#FFFFFF",
      ink: "#141816",
      muted: "#4E5652",
      line: "#D8E0DA",
      focus: "#6B9F82",
    },
  },
  {
    id: "warm-earth",
    name: "Warm Earth",
    tagline: "Ivory paper, sage, forest, and a little terracotta — calm boutique, not costume.",
    suitedFor: "A wellness and lifestyle register: warm cream fields, charcoal type, sage actions, terracotta only at the edges.",
    atmosphere: "daylight",
    electric: "#315D46",
    primary: "#4A7A58",
    primaryHover: "#315D46",
    primaryInk: "#FFFFFF",
    goldInk: "#8A4A32",
    terracotta: "#C87352",
    beige: "#D9C9B5",
    tan: "#B9956D",
    cream: "#FBF8F2",
    tokens: {
      obsidian: "#315D46",
      forest: "#315D46",
      forestHover: "#274A38",
      emerald: "#5C8F6B",
      gold: "#C87352",
      ivory: "#F5F0E7",
      softGray: "#D9C9B5",
      canvas: "#F5F0E7",
      card: "#FBF8F2",
      ink: "#202020",
      muted: "#665B52",
      line: "#D9C9B5",
      focus: "#315D46",
    },
  },
  {
    id: "sts-day",
    name: "STS Day",
    tagline: "Warm ivory paper, sage highlights, purple-to-blue only on controls.",
    suitedFor: "The locked daylight look: editorial Command Center and public pages without glare.",
    atmosphere: "daylight",
    lavender: "#DDE7D3",
    violet: "#7048E8",
    electric: "#3478F6",
    primary: "#7048E8",
    primaryHover: "#5B38D6",
    primaryInk: "#FFFFFF",
    goldInk: "#7048E8",
    charts: {
      revenue: "#3478F6",
      profit: "#7048E8",
      traffic: "#111214",
      leads: "#5B38D6",
      expenses: "#5F675F",
      pending: "#C5CDC0",
    },
    tokens: {
      obsidian: "#E9EEE5",
      forest: "#111214",
      forestHover: "#0A0B0C",
      emerald: "#7048E8",
      gold: "#7048E8",
      ivory: "#F3F5EF",
      softGray: "#7B837B",
      canvas: "#F3F5EF",
      card: "#FFFFFF",
      ink: "#111214",
      muted: "#5F675F",
      line: "#D9DED5",
      focus: "#7048E8",
    },
  },
];

export const STS_DAY_PALETTE_ID: PaletteId = "sts-day";
export const STS_NIGHT_PALETTE_ID: PaletteId = "midnight-navy";

export function getPalette(id: string | null | undefined): Palette {
  return PALETTES.find((item) => item.id === id) ?? PALETTES[0];
}

export function parseTheme(value: string | null | undefined): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

/** Live chrome: Day comfort or Night navy. Lookbook preview cookie still wins. */
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
    "--sage": palette.id === "sts-day" ? "#536250" : t.emerald,
    "--primary": palette.primary ?? (night ? violet : t.forest),
    "--primary-hover": palette.primaryHover ?? (night ? "#5B3DE8" : t.forestHover),
    "--primary-ink": palette.primaryInk ?? "#FFFFFF",
    "--accent": accent,
    "--brand-accent": accent,
    "--background": night ? t.obsidian : t.ivory,
    "--foreground": t.ink,
    "--surface": t.card,
    "--border": t.line,
    ...(palette.id === "sts-day"
      ? {
          "--background-soft": "#E9EEE5",
          "--surface-muted": "#F8F9F5",
          "--sage-light": "#DDE7D3",
          "--sage-medium": "#B8C6AD",
          "--sage-strong": "#7E9274",
          "--sage-dark": "#536250",
          "--border-light": "#D9DED5",
          "--border-strong": "#C5CDC0",
          "--sts-purple": "#7048E8",
          "--sts-blue": "#3478F6",
          "--sts-gradient": "linear-gradient(135deg, #7048E8 0%, #3478F6 100%)",
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
