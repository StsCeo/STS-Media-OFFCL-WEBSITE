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
      className="no-print fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-lg border border-line bg-card p-4 shadow-[var(--shadow-card)]"
      role="region"
      aria-label="Cookie notice"
    >
      <p className="text-sm text-ink">
        This site uses essential cookies for security, sign-in, and remembering appearance. Analytics and marketing cookies are not enabled. See the{" "}
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
