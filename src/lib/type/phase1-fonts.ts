import { DM_Serif_Display, Inter } from "next/font/google";

export const phase1Display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-phase1-display",
  fallback: ["Georgia", "serif"],
});

export const phase1Sans = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-phase1-sans",
  fallback: ["system-ui", "sans-serif"],
});
