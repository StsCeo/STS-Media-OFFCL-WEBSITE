import { Button } from "@/components/ui";
import { AssetCaption, PublicImage } from "@/components/public/public-image";
import { homepageHero } from "@/lib/content/homepage";
import { resolveMedia } from "@/lib/content/media";

export function HomeHero() {
  const visual = resolveMedia("hero");
  const desktop = resolveMedia("scpDesktop");
  const mobile = resolveMedia("scpMobile");

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
      <div className="mx-auto grid max-w-[1440px] items-end gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="public-reveal max-w-3xl">
          <p className="public-kicker">{homepageHero.eyebrow}</p>
          <h1 className="public-display public-hero-title mt-5 uppercase text-[#F3EFE7]">{homepageHero.headline}</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#B8BDBA] md:text-lg">{homepageHero.lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={homepageHero.primaryCta.href} size="lg">
              {homepageHero.primaryCta.label}
            </Button>
            <Button href={homepageHero.secondaryCta.href} variant="secondary" size="lg">
              {homepageHero.secondaryCta.label}
            </Button>
          </div>
        </div>
        <div className="relative min-h-[22rem] md:min-h-[32rem]">
          <div className="absolute inset-0 hidden lg:block">
            <div className="public-zoom h-full w-full opacity-70">
              <PublicImage media={visual} sizes="50vw" priority fit="cover" fill />
            </div>
          </div>
          <div className="relative lg:p-8">
            <div className="device-browser public-reveal">
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#161918] px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-[#91A38F]" aria-hidden />
                <span className="h-2 w-2 rounded-full bg-[#B8BDBA]" aria-hidden />
                <span className="h-2 w-2 rounded-full bg-[#C7FF3D]" aria-hidden />
                <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-[#B8BDBA]">Selected work</span>
              </div>
              <div className="relative aspect-[16/10] bg-[#0B0D0C]">
                <PublicImage media={desktop} sizes="(max-width: 1024px) 100vw, 50vw" priority fit="contain" fill />
              </div>
            </div>
            <div className="device-phone absolute -bottom-6 right-2 w-[28%] min-w-[6.5rem] max-w-[10rem] sm:right-6">
              <div className="relative aspect-[9/19] bg-[#0B0D0C]">
                <PublicImage media={mobile} sizes="160px" fit="contain" fill />
              </div>
            </div>
          </div>
          <div className="relative mt-8 lg:mt-12">
            <AssetCaption media={desktop} />
          </div>
        </div>
      </div>
    </section>
  );
}
