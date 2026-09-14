import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { Fraunces, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { getWorkspace } from "@/lib/data/store";
import { PALETTE_COOKIE } from "@/lib/config";
import { getPalette, paletteAtmosphere, paletteCssVars } from "@/lib/theme/palettes";
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
  const brand = getWorkspace().brand;
  const jar = await cookies();
  const theme = jar.get("sts_theme")?.value === "dark" ? "dark" : "light";
  const previewId = jar.get(PALETTE_COOKIE)?.value;
  const palette = getPalette(previewId || brand.paletteId);
  const vars = paletteCssVars(palette, previewId ? palette.tokens.emerald : brand.accentColor);
  const atmosphere = paletteAtmosphere(palette);
  return (
    <html
      lang="en"
      data-theme={theme}
      data-palette={palette.id}
      data-atmosphere={atmosphere}
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${fraunces.variable} ${plexMono.variable} ${theme === "dark" || atmosphere === "night-luxury" ? "dark" : ""} h-full antialiased`}
      style={vars as CSSProperties}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
