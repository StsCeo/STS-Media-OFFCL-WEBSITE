import {
  paletteAtmosphere,
  paletteCssVars,
  resolveLivePalette,
  type Palette,
} from "@/lib/theme/palettes";
import { THEME_COOKIE } from "@/lib/config";

export function appearanceClassNames(theme: "light" | "dark", palette: Palette, fontVars: string) {
  const atmosphere = paletteAtmosphere(palette);
  const dark = theme === "dark" || atmosphere === "night-luxury";
  return `${fontVars} ${dark ? "dark" : ""} h-full antialiased`.replace(/\s+/g, " ").trim();
}

export function applyAppearance(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const palette = resolveLivePalette(theme);
  const atmosphere = paletteAtmosphere(palette);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.palette = palette.id;
  root.dataset.atmosphere = atmosphere;
  root.classList.toggle("dark", theme === "dark" || atmosphere === "night-luxury");
  const vars = paletteCssVars(palette);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
