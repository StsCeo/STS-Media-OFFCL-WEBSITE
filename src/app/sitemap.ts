import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";
import { resources } from "@/lib/content/public";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const paths = [
    "",
    "/work",
    "/services",
    "/packages",
    "/about",
    "/process",
    "/testimonials",
    "/contact",
    "/for/owners",
    "/for/creators",
    "/faq",
    "/security",
    "/security/vulnerabilities",
    "/security/acknowledgments",
    "/accessibility",
    "/rights",
    "/resources",
    "/legal/privacy",
    "/legal/terms",
    ...resources.map((item) => `/resources/${item.slug}`),
  ];
  return paths.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: new Date("2026-09-11"),
  }));
}
