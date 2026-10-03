export const PREVIEW_PALETTE_IDS = ["current", "banner-journey", "signature-forest", "emerald-tech", "sage-gold"] as const;

export type PreviewPaletteId = (typeof PREVIEW_PALETTE_IDS)[number];

export const PREVIEW_PALETTE_OPTIONS: { id: PreviewPaletteId; label: string; note: string }[] = [
  { id: "current", label: "Current Design", note: "Live Banner journey Day / Night. This is production." },
  {
    id: "banner-journey",
    label: "Banner journey",
    note: "Same cream daylight and blue-charcoal night now applied to the live site.",
  },
  { id: "signature-forest", label: "Signature Navy", note: "Porcelain field, navy ink, blue side light." },
  { id: "emerald-tech", label: "Blue Tech", note: "Crisp white field, blue actions, indigo-night option." },
  { id: "sage-gold", label: "Slate + Gold", note: "Warm cream field, slate actions, muted gold accent." },
];

export function isPreviewPaletteId(value: string | null | undefined): value is PreviewPaletteId {
  return PREVIEW_PALETTE_IDS.includes(value as PreviewPaletteId);
}
