import { describe, expect, it } from "vitest";
import { PREVIEW_PALETTE_IDS, isPreviewPaletteId } from "@/lib/theme/preview-palettes";
import { PALETTES } from "@/lib/theme/palettes";

describe("preview-only palettes", () => {
  it("does not register experimental ids on the live palette list", () => {
    const live = PALETTES.map((item) => item.id);
    expect(live).not.toContain("banner-journey");
    expect(live).not.toContain("signature-forest");
    expect(live).not.toContain("emerald-tech");
    expect(live).not.toContain("sage-gold");
  });

  it("defaults the preview selector contract to current", () => {
    expect(PREVIEW_PALETTE_IDS[0]).toBe("current");
    expect(isPreviewPaletteId("current")).toBe(true);
    expect(isPreviewPaletteId("sts-day")).toBe(false);
  });
});
