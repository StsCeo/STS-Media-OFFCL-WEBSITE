import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { getWorkspace } from "@/lib/data/store";
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
    "Scars to Stars Media helps overlooked businesses turn their stories, ideas, and potential into visible, credible growth.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = getWorkspace().brand;
  const theme = (await cookies()).get("sts_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html
      lang="en"
      data-theme={theme}
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${fraunces.variable} ${plexMono.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}
      style={{ ["--brand-accent" as string]: brand.accentColor }}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
