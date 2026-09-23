"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { PublicCard } from "@/components/public/page-hero";
import { PublicFooter, PublicHeader } from "@/components/public/chrome";
import { PREVIEW_PALETTE_OPTIONS, type PreviewPaletteId } from "@/lib/theme/preview-palettes";
import "@/components/public/home/home.css";
import "@/components/public/theme-preview/theme-preview.css";

export function ThemePreviewPlayground({
  theme,
  statement,
  email,
}: {
  theme: "light" | "dark";
  statement: string;
  email: string;
}) {
  const [palette, setPalette] = useState<PreviewPaletteId>("current");
  const [frame, setFrame] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const current = PREVIEW_PALETTE_OPTIONS.find((item) => item.id === palette) ?? PREVIEW_PALETTE_OPTIONS[0];

  return (
    <div className="sts-theme-preview min-h-screen" data-preview-palette={palette}>
      <div className="sts-preview-glow sts-preview-glow-left" aria-hidden />
      <div className="sts-preview-glow sts-preview-glow-right" aria-hidden />
      <div className="sts-preview-glow sts-preview-glow-hero" aria-hidden />
      <div className="sts-preview-glow sts-preview-glow-footer" aria-hidden />

      <div className="sts-preview-stage">
        <div className="sts-preview-toolbar">
          <p>Theme preview only — not the live homepage</p>
          <div className="sts-preview-choices" role="radiogroup" aria-label="Preview palette">
            {PREVIEW_PALETTE_OPTIONS.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="preview-palette"
                  value={item.id}
                  checked={palette === item.id}
                  onChange={() => setPalette(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
          <p className="mt-2 normal-case tracking-normal">{current.note}</p>
          <div className="sts-preview-frames" role="group" aria-label="Preview width">
            {(["desktop", "tablet", "mobile"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={frame === item}
                onClick={() => setFrame(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="sts-preview-frame" data-frame={frame}>
          <div className="sts-home sts-home-chrome overflow-x-clip bg-canvas text-ink">
            <PublicHeader theme={theme} />

            <section className="sts-preview-hero">
              <div className="sts-preview-hero-grid">
                <div>
                  <p className="public-kicker">Digital transformation for growing small businesses</p>
                  <h1 className="home-display mt-4 max-w-3xl text-ink">
                    Your business has grown.
                    <br />
                    Your digital presence should show it.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                    STS Media builds websites, digital systems, and ongoing support that help small businesses earn trust,
                    capture leads, and grow with confidence.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button href="/contact" size="lg">
                      Start a Project
                    </Button>
                    <Button href="/contact?intent=audit" variant="secondary" size="lg">
                      Get a Free Website Audit
                    </Button>
                    <Link href="/work" className="text-sm font-medium underline-offset-4 hover:underline">
                      Explore Our Work
                    </Link>
                  </div>
                </div>
                <PublicCard className="p-6">
                  <p className="public-kicker">Specimen card</p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Center field stays cream or near-black. Side light is the signature blend at low opacity, not a
                    full-page wash.
                  </p>
                </PublicCard>
              </div>
            </section>

            <section className="border-y border-line">
              <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-5 text-sm font-semibold text-muted">
                <span>Mobile-first builds</span>
                <span>Clear project scope</span>
                <span>Direct collaboration</span>
              </div>
            </section>

            <section className="sts-preview-soft px-4 py-12">
              <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
                {["Website strategy", "Development", "Ongoing care"].map((title) => (
                  <PublicCard key={title} className="p-5">
                    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Soft green sections are limited. Cards stay light in Day and slightly elevated in Night.
                    </p>
                  </PublicCard>
                ))}
              </div>
            </section>

            <section className="px-4 py-12">
              <div className="mx-auto max-w-6xl">
                <h2 className="home-h2">Buttons and dividers</h2>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button href="/contact">Primary</Button>
                  <Button href="/packages" variant="secondary">
                    Secondary
                  </Button>
                </div>
                <hr className="mt-8 border-line" />
              </div>
            </section>

            <PublicFooter email={email} statement={statement} theme={theme} />
          </div>
        </div>
      </div>
    </div>
  );
}
