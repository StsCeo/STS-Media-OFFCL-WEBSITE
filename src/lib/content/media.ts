import { existsSync } from "node:fs";
import path from "node:path";

export type PublicMedia = {
  src: string;
  width: number;
  height: number;
  alt: string;
  placeholder: boolean;
  recommendedFile: string;
  recommendedSize: string;
};

function publicFile(rel: string) {
  return path.join(process.cwd(), "public", rel.replace(/^\//, ""));
}

function resolveAsset(preferred: string, fallback: string) {
  return existsSync(publicFile(preferred)) ? preferred : fallback;
}

export const mediaInventory = {
  hero: {
    preferred: "/media/hero/studio-still.webp",
    fallback: "/media/placeholders/hero-composition.svg",
    width: 1600,
    height: 1800,
    alt: "Editorial composition for the STS Media studio — replace with an approved still",
    recommendedFile: "public/media/hero/studio-still.webp",
    recommendedSize: "1600×1800, WebP, vertical editorial still, no logos or fake metrics",
  },
  scpDesktop: {
    preferred: "/media/work/state-collision-pro/desktop.webp",
    fallback: "/media/placeholders/scp-desktop.svg",
    width: 1600,
    height: 1000,
    alt: "State Collision Pro website on desktop — production screenshot pending",
    recommendedFile: "public/media/work/state-collision-pro/desktop.webp",
    recommendedSize: "1600×1000, WebP, full-page or above-the-fold website screenshot",
  },
  scpMobile: {
    preferred: "/media/work/state-collision-pro/mobile.webp",
    fallback: "/media/placeholders/scp-mobile.svg",
    width: 750,
    height: 1624,
    alt: "State Collision Pro website on mobile — production screenshot pending",
    recommendedFile: "public/media/work/state-collision-pro/mobile.webp",
    recommendedSize: "750×1624, WebP, mobile website screenshot, do not letterbox-crop UI",
  },
  owners: {
    preferred: "/media/audience/business-owners.webp",
    fallback: "/media/placeholders/audience-owners.svg",
    width: 1400,
    height: 1600,
    alt: "Visual for business owners — replace with an approved original photograph",
    recommendedFile: "public/media/audience/business-owners.webp",
    recommendedSize: "1400×1600, WebP, original photo of real work, no stock people or fake storefronts",
  },
  creators: {
    preferred: "/media/audience/creators.webp",
    fallback: "/media/placeholders/audience-creators.svg",
    width: 1400,
    height: 1600,
    alt: "Visual for creators — replace with an approved original photograph",
    recommendedFile: "public/media/audience/creators.webp",
    recommendedSize: "1400×1600, WebP, original studio or process photo, no fake follower counts",
  },
} as const;

export function resolveMedia(key: keyof typeof mediaInventory): PublicMedia {
  const item = mediaInventory[key];
  const src = resolveAsset(item.preferred, item.fallback);
  return {
    src,
    width: item.width,
    height: item.height,
    alt: item.alt,
    placeholder: src === item.fallback,
    recommendedFile: item.recommendedFile,
    recommendedSize: item.recommendedSize,
  };
}

export function workDesktopMedia(slug: string, companyName: string): PublicMedia {
  const preferred = `/media/work/${slug}/desktop.webp`;
  const fallback = "/media/placeholders/scp-desktop.svg";
  const src = resolveAsset(preferred, fallback);
  return {
    src,
    width: 1600,
    height: 1000,
    alt: src === preferred ? `${companyName} website on desktop` : `${companyName} website on desktop — production screenshot pending`,
    placeholder: src === fallback,
    recommendedFile: `public/media/work/${slug}/desktop.webp`,
    recommendedSize: "1600×1000, WebP, website screenshot. Keep UI readable; do not stretch.",
  };
}

export function workMobileMedia(slug: string, companyName: string): PublicMedia {
  const preferred = `/media/work/${slug}/mobile.webp`;
  const fallback = "/media/placeholders/scp-mobile.svg";
  const src = resolveAsset(preferred, fallback);
  return {
    src,
    width: 750,
    height: 1624,
    alt: src === preferred ? `${companyName} website on mobile` : `${companyName} website on mobile — production screenshot pending`,
    placeholder: src === fallback,
    recommendedFile: `public/media/work/${slug}/mobile.webp`,
    recommendedSize: "750×1624, WebP, mobile website screenshot. Keep safe areas; do not crop controls.",
  };
}
