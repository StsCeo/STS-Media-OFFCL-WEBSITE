import Link from "next/link";
import { CaseStudyCard } from "@/components/public/case-study-card";
import { AudienceSplit } from "@/components/public/audience-split";
import { CapabilityMarquee } from "@/components/public/marquee";
import { CredibilityStrip } from "@/components/public/credibility";
import { FinalCta } from "@/components/public/final-cta";
import { HomeHero } from "@/components/public/home-hero";
import { OrganizationJsonLd } from "@/components/public/json-ld";
import { ProcessStages } from "@/components/public/process-stages";
import { ServiceTiles } from "@/components/public/service-tiles";
import { getWorkspace } from "@/lib/data/store";

export default function HomePage() {
  const { brand, portfolio, process, testimonials } = getWorkspace();
  const featured = portfolio.filter((item) => item.featured && item.status === "published");
  const moreWork = portfolio.filter((item) => item.status === "published" && !item.featured);
  const publishedQuotes = testimonials.filter((item) => item.published && item.approved);

  return (
    <div>
      <OrganizationJsonLd brand={brand} />
      <HomeHero />
      <CapabilityMarquee />

      <section className="bg-[#0B0D0C] px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="public-kicker">02 — Work</p>
              <h2 className="public-display public-section-title mt-4 text-[#F3EFE7]">Selected work</h2>
            </div>
            <Link href="/work" className="text-sm text-[#C7FF3D] underline-offset-4 hover:underline">
              All work
            </Link>
          </div>
          <div className="space-y-16">
            {featured.map((item) => (
              <CaseStudyCard key={item.id} item={item} featured />
            ))}
            {moreWork.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {moreWork.map((item) => (
                  <CaseStudyCard key={item.id} item={item} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="public-page px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[1440px]">
          <p className="public-kicker">03 — Services</p>
          <h2 className="public-display public-section-title mt-4">What we make</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#4f564f]">
            Large, visual work with a short next step. Details live on the services page.
          </p>
          <div className="mt-10">
            <ServiceTiles />
          </div>
        </div>
      </section>

      <section>
        <div className="px-4 pt-16 md:px-8 md:pt-20">
          <div className="mx-auto max-w-[1440px] pb-8">
            <p className="public-kicker">04 — Who we serve</p>
            <h2 className="public-display public-section-title mt-4 text-[#F3EFE7]">Two rooms. One standard.</h2>
          </div>
        </div>
        <AudienceSplit />
      </section>

      <section className="bg-[#0B0D0C] px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[1440px]">
          <p className="public-kicker">05 — Process</p>
          <h2 className="public-display public-section-title mt-4 text-[#F3EFE7]">Four stages. No mystery.</h2>
          <div className="mt-10">
            <ProcessStages steps={process} />
          </div>
        </div>
      </section>

      <section className="bg-[#0B0D0C]">
        <div className="mx-auto max-w-[1440px] px-4 pb-6 pt-4 md:px-8">
          <p className="public-kicker mb-4">06 — How we work</p>
        </div>
        <CredibilityStrip />
      </section>

      {publishedQuotes.length > 0 ? (
        <section className="bg-[#F3EFE7] px-4 py-20 text-[#0B0D0C] md:px-8">
          <div className="mx-auto max-w-[1440px]">
            <p className="public-kicker !text-[#0B0D0C]">Quotes</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {publishedQuotes.map((item) => (
                <blockquote key={item.id} className="border border-[#0B0D0C]/10 bg-white p-6">
                  <p className="public-display text-2xl leading-snug">“{item.quote}”</p>
                  <footer className="mt-3 text-sm text-[#4f564f]">
                    {item.authorName}, {item.company}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <FinalCta />
    </div>
  );
}
