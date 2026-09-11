import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["", "/work", "/services", "/packages", "/about", "/process", "/testimonials", "/contact", "/legal/privacy", "/legal/terms"].map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: new Date("2026-09-11"),
  }));
}
