import { cookies } from "next/headers";
import { Instrument_Serif } from "next/font/google";
import { SkipLink } from "@/components/a11y/skip-link";
import { PublicFooter, PublicHeader } from "@/components/public/chrome";
import { CookieBanner, PalettePreviewBar } from "@/components/public/notices";
import { CONSENT_COOKIE, PALETTE_COOKIE } from "@/lib/config";
import { getWorkspace } from "@/lib/data/store";
import { getPalette } from "@/lib/theme/palettes";

const editorial = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
});

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const brand = getWorkspace().brand;
  const jar = await cookies();
  const previewId = jar.get(PALETTE_COOKIE)?.value;
  const preview = previewId ? getPalette(previewId) : null;
  const consent = Boolean(jar.get(CONSENT_COOKIE)?.value);
  return (
    <div data-surface="public" className={`${editorial.variable} min-h-screen bg-[#0B0D0C] text-[#F3EFE7]`} style={{ fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif" }}>
      <SkipLink />
      {preview ? <PalettePreviewBar name={preview.name} /> : null}
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter
        email={brand.email}
        statement={brand.brandStatement}
        instagram={brand.instagram}
        linkedin={brand.linkedin}
      />
      <CookieBanner visible={!consent} />
    </div>
  );
}
