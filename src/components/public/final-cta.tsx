import { Button } from "@/components/ui";
import { finalCta } from "@/lib/content/homepage";

export function FinalCta() {
  return (
    <section className="bg-[#0B0D0C] px-4 py-24 text-center md:py-32">
      <p className="public-kicker">Next</p>
      <h2 className="public-display public-section-title mx-auto mt-6 max-w-5xl whitespace-pre-line text-[#F3EFE7]">
        {finalCta.headline}
      </h2>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button href={finalCta.primaryCta.href} size="lg">
          {finalCta.primaryCta.label}
        </Button>
        <Button href={finalCta.secondaryCta.href} variant="secondary" size="lg">
          {finalCta.secondaryCta.label}
        </Button>
      </div>
    </section>
  );
}
