import { cookies } from "next/headers";
import { SkipLink } from "@/components/a11y/skip-link";
import { PublicFooter, PublicHeader } from "@/components/public/chrome";
import { CookieBanner, PalettePreviewBar } from "@/components/public/notices";
import { CONSENT_COOKIE, PALETTE_COOKIE, THEME_COOKIE } from "@/lib/config";
import { getWorkspace } from "@/lib/data/store";
import { getPalette, parseTheme } from "@/lib/theme/palettes";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const brand = getWorkspace().brand;
  const jar = await cookies();
  const previewId = jar.get(PALETTE_COOKIE)?.value;
  const preview = previewId ? getPalette(previewId) : null;
  const consent = Boolean(jar.get(CONSENT_COOKIE)?.value);
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  return (
    <div data-surface="public" className="min-h-screen bg-background text-foreground">
      <SkipLink />
      {preview ? <PalettePreviewBar name={preview.name} /> : null}
      <PublicHeader theme={theme} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter email={brand.email} statement={brand.brandStatement} theme={theme} />
      <CookieBanner visible={!consent} />
    </div>
  );
}
