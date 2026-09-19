import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { Fraunces, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { PALETTE_COOKIE, THEME_COOKIE } from "@/lib/config";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme/bootstrap";
import { appearanceClassNames } from "@/lib/theme/apply-appearance";
import { paletteAtmosphere, paletteCssVars, parseTheme, resolveLivePalette } from "@/lib/theme/palettes";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "STS Media — Scars to Stars Media",
    template: "%s · STS Media",
  },
  description:
    "Scars to Stars Media helps overlooked businesses and creators turn their stories, ideas, and potential into visible, credible growth.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const previewId = jar.get(PALETTE_COOKIE)?.value;
  const palette = resolveLivePalette(theme, previewId);
  const vars = paletteCssVars(palette);
  const atmosphere = paletteAtmosphere(palette);
  const fontVars = `${plusJakarta.variable} ${fraunces.variable} ${plexMono.variable}`;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={theme}
      data-palette={palette.id}
      data-atmosphere={atmosphere}
      data-scroll-behavior="smooth"
      className={appearanceClassNames(theme, palette, fontVars)}
      style={vars as CSSProperties}
    >
      <head>
        <script id="sts-theme-bootstrap" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
