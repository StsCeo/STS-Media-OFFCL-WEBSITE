"use client";

import { useMemo, useState } from "react";
import { previewPalette, saveBrand } from "@/app/actions";
import { Button, Card, Field, inputClass, textareaClass } from "@/components/ui";
import { PALETTES, getPalette, type PaletteId } from "@/lib/theme/palettes";
import type { BrandSettings } from "@/lib/types";

export function BrandForm({ brand }: { brand: BrandSettings }) {
  const [paletteId, setPaletteId] = useState<PaletteId>(getPalette(brand.paletteId).id as PaletteId);
  const palette = useMemo(() => getPalette(paletteId), [paletteId]);
  const [accent, setAccent] = useState(brand.accentColor);
  const [mission, setMission] = useState(brand.mission);
  const [statement, setStatement] = useState(brand.brandStatement);

  return (
    <div className="space-y-6">
      <form action={saveBrand} className="space-y-6">
        <Card>
          <h2 className="font-semibold">Color systems</h2>
          <p className="mt-1 text-sm text-muted">
            Six original palettes. Status colors (error, warning, info) stay constant so finance never depends on brand hue alone.
          </p>
          <input type="hidden" name="paletteId" value={paletteId} />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPaletteId(item.id);
                  setAccent(item.tokens.emerald);
                }}
                className={`rounded-lg border p-3 text-left ${paletteId === item.id ? "border-forest ring-2 ring-focus" : "border-line"}`}
              >
                <div className="mb-3 flex h-10 overflow-hidden rounded-md">
                  {[item.tokens.obsidian, item.tokens.forest, item.tokens.emerald, item.tokens.gold, item.tokens.ivory].map((color) => (
                    <span key={color} className="flex-1" style={{ background: color }} />
                  ))}
                </div>
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-muted">{item.tagline}</p>
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold">Brand copy</h2>
            <div className="mt-4 space-y-3">
              <Field label="Legal name" name="legalName">
                <input id="legalName" name="legalName" className={inputClass} defaultValue={brand.legalName} />
              </Field>
              <Field label="Short name" name="shortName">
                <input id="shortName" name="shortName" className={inputClass} defaultValue={brand.shortName} />
              </Field>
              <Field label="Mission statement" name="mission">
                <textarea id="mission" name="mission" className={textareaClass} value={mission} onChange={(e) => setMission(e.target.value)} />
              </Field>
              <Field label="Brand statement" name="brandStatement">
                <textarea id="brandStatement" name="brandStatement" className={textareaClass} value={statement} onChange={(e) => setStatement(e.target.value)} />
              </Field>
              <Field label="Founder name" name="founderName">
                <input id="founderName" name="founderName" className={inputClass} defaultValue={brand.founderName} />
              </Field>
              <Field label="Founder role" name="founderRole">
                <input id="founderRole" name="founderRole" className={inputClass} defaultValue={brand.founderRole} />
              </Field>
              <Field label="Founder bio" name="founderBio">
                <textarea id="founderBio" name="founderBio" className={textareaClass} defaultValue={brand.founderBio} />
              </Field>
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Contact and accent</h2>
            <div className="mt-4 space-y-3">
              <Field label="Email" name="email">
                <input id="email" name="email" className={inputClass} defaultValue={brand.email} />
              </Field>
              <Field label="Phone" name="phone">
                <input id="phone" name="phone" className={inputClass} defaultValue={brand.phone} />
              </Field>
              <Field label="Calendly URL" name="calendlyUrl">
                <input id="calendlyUrl" name="calendlyUrl" className={inputClass} defaultValue={brand.calendlyUrl} />
              </Field>
              <Field label="Instagram" name="instagram">
                <input id="instagram" name="instagram" className={inputClass} defaultValue={brand.instagram} />
              </Field>
              <Field label="LinkedIn" name="linkedin">
                <input id="linkedin" name="linkedin" className={inputClass} defaultValue={brand.linkedin} />
              </Field>
              <Field label="Facebook" name="facebook">
                <input id="facebook" name="facebook" className={inputClass} defaultValue={brand.facebook} />
              </Field>
              <Field label="TikTok" name="tiktok">
                <input id="tiktok" name="tiktok" className={inputClass} defaultValue={brand.tiktok} />
              </Field>
              <Field label="Brand accent color" name="accentColor">
                <input id="accentColor" name="accentColor" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" className="mt-4">
              Save brand settings
            </Button>
          </Card>
        </div>
      </form>

      <Card>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Live preview · {palette.name}</p>
        <h3 className="mt-2 font-display text-2xl">{statement}</h3>
        <p className="mt-3 text-sm">{mission}</p>
        <span className="mt-4 inline-flex h-10 items-center rounded-md px-4 text-sm text-white" style={{ background: accent }}>
          Start a Project
        </span>
        <form action={previewPalette} className="mt-4">
          <input type="hidden" name="paletteId" value={paletteId} />
          <input type="hidden" name="next" value="/" />
          <Button type="submit" variant="secondary" size="sm">
            Preview on the public site
          </Button>
        </form>
      </Card>
    </div>
  );
}
