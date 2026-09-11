import { cookies } from "next/headers";
import { PublicFooter, PublicHeader } from "@/components/public/chrome";
import { CookieBanner, PalettePreviewBar } from "@/components/public/notices";
import { CONSENT_COOKIE, PALETTE_COOKIE } from "@/lib/config";
import { getWorkspace } from "@/lib/data/store";
import { getPalette } from "@/lib/theme/palettes";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const brand = getWorkspace().brand;
  const jar = await cookies();
  const previewId = jar.get(PALETTE_COOKIE)?.value;
  const preview = previewId ? getPalette(previewId) : null;
  const consent = Boolean(jar.get(CONSENT_COOKIE)?.value);
  return (
    <div data-surface="public" className="min-h-screen bg-obsidian text-ivory">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      {preview ? <PalettePreviewBar name={preview.name} /> : null}
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter email={brand.email} statement={brand.brandStatement} />
      <CookieBanner visible={!consent} />
    </div>
  );
}
