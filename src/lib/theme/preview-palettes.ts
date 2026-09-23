export const PREVIEW_PALETTE_IDS = ["current", "signature-forest", "emerald-tech", "sage-gold"] as const;

export type PreviewPaletteId = (typeof PREVIEW_PALETTE_IDS)[number];

export const PREVIEW_PALETTE_OPTIONS: { id: PreviewPaletteId; label: string; note: string }[] = [
  { id: "current", label: "Current Design", note: "Live Day / Night tokens. Default. Not a proposed replacement." },
  { id: "signature-forest", label: "Signature Forest", note: "Recommended candidate. Porcelain field, forest ink, teal-midnight side light." },
  { id: "emerald-tech", label: "Emerald Tech", note: "Crisp white field, emerald actions, indigo-night option." },
  { id: "sage-gold", label: "Sage + Gold", note: "Warm cream field, sage actions, muted gold accent." },
];

export function isPreviewPaletteId(value: string | null | undefined): value is PreviewPaletteId {
  return PREVIEW_PALETTE_IDS.includes(value as PreviewPaletteId);
}
