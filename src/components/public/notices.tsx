"use client";

import Link from "next/link";
import { clearPalettePreview, saveCookieConsent } from "@/app/actions";
import { Button } from "@/components/ui";

export function PalettePreviewBar({ name }: { name: string }) {
  return (
    <div className="no-print flex items-center justify-between gap-3 bg-gold px-4 py-2 text-xs text-obsidian" role="status">
      <p>
        Previewing <strong>{name}</strong>. This is not saved until you choose it in Brand Settings.
      </p>
      <form action={clearPalettePreview}>
        <button className="underline" type="submit">
          Exit preview
        </button>
      </form>
    </div>
  );
}

export function CookieBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="public-cookie no-print" role="region" aria-label="Cookie notice">
      <p className="text-xs leading-5 text-[#1B1E1C]">
        Essential cookies only — security, sign-in, and appearance. No analytics or marketing cookies. See the{" "}
        <Link className="underline" href="/legal/cookies">
          cookie notice
        </Link>{" "}
        and{" "}
        <Link className="underline" href="/rights">
          your rights
        </Link>
        .
      </p>
      <form action={saveCookieConsent} className="mt-3">
        <Button type="submit" size="sm">
          Accept essential cookies
        </Button>
      </form>
    </div>
  );
}
