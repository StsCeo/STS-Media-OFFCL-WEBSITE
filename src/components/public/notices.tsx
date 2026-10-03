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
    <div
      className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 px-4 py-3 backdrop-blur"
      role="region"
      aria-label="Cookie notice"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted">
          Essential cookies only: security, sign-in, and appearance. See the{" "}
          <Link className="underline underline-offset-2" href="/legal/cookies">
            cookie notice
          </Link>{" "}
          and{" "}
          <Link className="underline underline-offset-2" href="/rights">
            your rights
          </Link>
          .
        </p>
        <form action={saveCookieConsent}>
          <Button type="submit" size="sm" className="rounded-full">
            Accept
          </Button>
        </form>
      </div>
    </div>
  );
}
