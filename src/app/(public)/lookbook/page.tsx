import { previewPalette } from "@/app/actions";
import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { PALETTES, paletteAtmosphere } from "@/lib/theme/palettes";

export const metadata = {
  title: "Color lookbook",
  robots: { index: false, follow: false },
};

export default function LookbookPage() {
  return (
    <IvoryShell wide>
      <PageKicker>Color systems</PageKicker>
      <PageTitle>{PALETTES.length} original palettes. Status colors never ride on brand hue.</PageTitle>
      <PageLede>
        Preview a scheme on the public site for an hour, or save one in Brand Settings. Each card shows the header register and the page field. Error, warning, and info tokens stay fixed so finance never depends on a decorative color.
      </PageLede>
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {PALETTES.map((palette) => {
          const t = palette.tokens;
          const night = paletteAtmosphere(palette) === "night-luxury";
          const fieldBg = night ? t.obsidian : t.ivory;
          const fieldInk = night ? t.ivory : t.ink;
          const chip = palette.primary ?? (night ? palette.violet ?? t.forest : t.forest);
          const chipInk = palette.primaryInk ?? (palette.primary ? t.obsidian : "#ffffff");
          const secondary = palette.beige ?? t.gold;
          return (
            <article key={palette.id} id={palette.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
              <div className="p-5" style={{ background: t.obsidian, color: t.ivory }}>
                <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: t.gold }}>
                  Scars to Stars Media
                </p>
                <h2 className="mt-3 font-display text-2xl leading-snug">We turn overlooked potential into visible growth.</h2>
                <div className="mt-5 flex gap-2">
                  <span
                    className="inline-flex h-9 items-center rounded-md px-3 text-xs"
                    style={
                      night
                        ? { backgroundImage: `linear-gradient(135deg, ${palette.violet}, ${palette.electric})`, color: "#fff" }
                        : { background: chip, color: chipInk }
                    }
                  >
                    Start a Project
                  </span>
                  <span
                    className="inline-flex h-9 items-center rounded-md border px-3 text-xs"
                    style={{ borderColor: night ? `${palette.lavender}99` : `${secondary}99`, color: night ? t.ivory : secondary }}
                  >
                    View Our Work
                  </span>
                </div>
              </div>
              <div className="p-5" style={{ background: fieldBg, color: fieldInk }}>
                <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: night ? palette.lavender : t.forest }}>
                  {night ? "Night field" : "Light field"}
                </p>
                <p className="mt-2 font-display text-xl leading-snug">{palette.name}</p>
                <p className="mt-2 text-sm leading-6" style={{ color: t.muted }}>
                  {palette.tagline}
                </p>
                <span
                  className="mt-4 inline-flex h-9 items-center rounded-md px-3 text-xs"
                  style={
                    night
                      ? { backgroundImage: `linear-gradient(135deg, ${palette.violet}, ${palette.electric})`, color: "#fff" }
                      : { background: chip, color: chipInk }
                  }
                >
                  Start a Project
                </span>
              </div>
              <div className="flex h-3">
                {[t.obsidian, chip, t.emerald, t.gold, t.ivory].map((color, index) => (
                  <span key={`${color}-${index}`} className="flex-1" style={{ background: color }} />
                ))}
              </div>
              <div className="p-5">
                <h3 className="font-display text-2xl">{palette.name}</h3>
                <p className="mt-2 text-sm text-muted">{palette.suitedFor}</p>
                <form action={previewPalette} className="mt-4">
                  <input type="hidden" name="paletteId" value={palette.id} />
                  <input type="hidden" name="next" value="/" />
                  <Button type="submit" variant="secondary" size="sm">
                    Preview on the public site
                  </Button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </IvoryShell>
  );
}
