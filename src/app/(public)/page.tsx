import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";
import { OrganizationJsonLd } from "@/components/public/json-ld";
import { PublicCard } from "@/components/public/page-hero";
import { BannerAtmosphere } from "@/components/public/home/banner-atmosphere";
import { MagneticCta } from "@/components/public/home/magnetic-cta";
import { TrustMarks } from "@/components/public/home/trust-marks";
import { CompareSlider } from "@/components/public/home/compare-slider";
import { DesktopSchematic, PhoneSchematic } from "@/components/public/home/device-schematic";
import { IndustryPanel } from "@/components/public/home/industry-panel";
import { ProcessTrack } from "@/components/public/home/process-track";
import { ServiceSystem } from "@/components/public/home/service-system";
import { WebsiteCheck } from "@/components/public/home/website-check";
import { StickyMobileCta } from "@/components/public/home/sticky-cta";
import { HomeFaq } from "@/components/public/home/faq";
import { HomeHeaderScroll } from "@/components/public/home/header-scroll";
import { getWorkspace } from "@/lib/data/store";
import { resources } from "@/lib/content/public";
import {
  auditDeliverables,
  trustPoints,
  whySts,
} from "@/lib/content/home";
import { PricingBoard } from "@/components/public/pricing/pricing-board";
import { siteUrl } from "@/lib/config";
import "@/components/public/home/home.css";

export const metadata: Metadata = {
  title: "STS Media | Websites and Digital Systems for Small Businesses",
  description:
    "Scars to Stars Media creates professional websites, digital systems, and ongoing support for small businesses ready to strengthen their online presence.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "STS Media | Websites and Digital Systems for Small Businesses",
    description:
      "Scars to Stars Media creates professional websites, digital systems, and ongoing support for small businesses ready to strengthen their online presence.",
    url: siteUrl(),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "STS Media | Websites and Digital Systems for Small Businesses",
    description:
      "Scars to Stars Media creates professional websites, digital systems, and ongoing support for small businesses ready to strengthen their online presence.",
  },
};

export default function HomePage() {
  const { brand, portfolio, testimonials } = getWorkspace();
  const featured = portfolio.filter((item) => item.featured && item.status === "published");
  const publishedQuotes = testimonials.filter((item) => item.published && item.approved);

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.shortName,
    url: siteUrl(),
  };

  return (
    <div className="sts-home bg-canvas text-ink">
      <HomeHeaderScroll />
      <OrganizationJsonLd brand={brand} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <StickyMobileCta />

      <section className="sts-top-banner" aria-label="Scars to Stars Media">
        <BannerAtmosphere />
      </section>

      <section className="public-page sts-home-hero">
        <div className="public-wrap">
          <div className="sts-banner-glass sts-reveal">
            <p className="public-kicker">Digital transformation for growing small businesses</p>
            <h1 className="home-display sts-reveal sts-reveal-2 mt-4 max-w-3xl text-ink">
              Your business has grown.
              <br />
              Your digital presence should show it.
            </h1>
            <p className="sts-reveal sts-reveal-3 mt-5 max-w-xl text-base leading-7 text-muted md:text-lg">
              STS Media builds websites, digital systems, and ongoing support that help small businesses earn trust, capture
              leads, and grow with confidence.
            </p>
            <div className="sts-reveal sts-reveal-4 mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <MagneticCta href="/contact" eventName="hero_start_project">
                Start a Project
              </MagneticCta>
              <Button href="/contact?intent=audit" variant="secondary" size="lg">
                Get a Free Website Audit
              </Button>
              <Link href="/work" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                Explore Our Work
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted">Websites · Digital systems · Ongoing support</p>
          </div>
        </div>
      </section>

      <section className="border-y border-line">
        <div className="public-wrap px-4 py-6">
          <TrustMarks items={trustPoints} />
        </div>
      </section>

      <section className="public-page">
        <div className="public-wrap">
          <p className="public-kicker">Selected transformations</p>
          <h2 className="home-h2 mt-2">Work we can put our name on</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            State Collision Pro is the first public case study. Results, quotes, and screenshots stay off this page until they
            are verified.
          </p>
          <div className="mt-10 space-y-12">
            {featured.map((item) => (
              <article key={item.id} className="home-project grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <p className="text-sm text-muted">{item.industry}</p>
                  <h3 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">{item.companyName}</h3>
                  <p className="mt-3 max-w-xl text-base leading-7">
                    Turning a local collision shop’s digital presence into a clearer, more credible customer experience.
                  </p>
                  <p className="mt-4 text-sm leading-6 text-muted">{item.challenge}</p>
                  <p className="mt-4 text-sm leading-6">{item.solution}</p>
                  <ul className="mt-5 flex flex-wrap gap-2 p-0 text-xs">
                    {["Website Design", "Development", "Mobile Optimization", "Estimate Experience", "Ongoing Support"].map(
                      (tag) => (
                        <li key={tag} className="rounded-full border border-line px-3 py-1">
                          {tag}
                        </li>
                      ),
                    )}
                  </ul>
                  <Link
                    href={`/work/${item.slug}`}
                    className="mt-6 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
                  >
                    View project
                  </Link>
                </div>
                <div className="sts-work-stage grid gap-3">
                  <DesktopSchematic
                    title={item.companyName}
                    caption={`${item.desktopLabel} Original schematic — not a live capture.`}
                  />
                  <PhoneSchematic title="Mobile" caption={item.mobileLabel} placement="inline" />
                  <CompareSlider />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section-sage">
        <div className="public-page">
          <div className="public-wrap">
            <p className="public-kicker">Who we help</p>
            <h2 className="home-h2 mt-2">The shop is already real. The site should be too.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Select an industry to see the problem we usually hear and the system we build. Outcomes stay qualitative until a
              number is verified.
            </p>
            <div className="mt-8">
              <IndustryPanel />
            </div>
          </div>
        </div>
      </section>

      <section className="public-page">
        <div className="public-wrap">
          <p className="public-kicker">Services</p>
          <h2 className="home-h2 mt-2">A connected growth system</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Strategy, build, local presence, measurement, and care. One path, not a pile of disconnected extras.
          </p>
          <div className="mt-8">
            <ServiceSystem />
          </div>
        </div>
      </section>

      <section className="public-section-sage">
        <div className="public-page">
          <div className="public-wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="public-kicker">Process</p>
              <h2 className="home-h2 mt-2">From overlooked to unforgettable.</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Five movements. The full operating sequence, including content collection and review, lives on the process page.
              </p>
              <Link href="/process" className="mt-5 inline-block text-sm font-medium underline-offset-4 hover:underline">
                Full process notes
              </Link>
            </div>
            <ProcessTrack />
          </div>
        </div>
      </section>

      <section className="public-page" id="audit">
        <div className="public-wrap grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="public-kicker">Free review</p>
            <h2 className="home-h2 mt-2">Free 10-point website and online presence audit</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Get a practical review of your website, mobile experience, calls to action, trust signals, local visibility, and
              lead flow.
            </p>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6">
              {auditDeliverables.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-8">
              <Button href="/contact?intent=audit" size="lg">
                Request My Free Audit
              </Button>
            </div>
          </div>
          <div>
            <p className="public-kicker">Quick check</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">How strong is your digital presence?</h2>
            <p className="mt-2 text-sm text-muted">Five questions. No email required to see the result.</p>
            <div className="mt-4">
              <WebsiteCheck />
            </div>
          </div>
        </div>
      </section>

      <section className="public-section-sage">
        <div className="public-page">
          <div className="public-wrap grid gap-10 lg:grid-cols-2">
            <div>
              <p className="public-kicker">Why STS</p>
              <h2 className="home-h2 mt-2">Agency-quality work without being passed through an agency maze.</h2>
            </div>
            <ul className="m-0 grid gap-6 p-0">
              {whySts.map(([title, body]) => (
                <li key={title} className="accent-edge list-none">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {publishedQuotes.length > 0 ? (
        <section className="public-page">
          <div className="public-wrap">
            <p className="public-kicker">Client voices</p>
            <h2 className="home-h2 mt-2">Approved quotes only</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {publishedQuotes.map((item) => (
                <PublicCard key={item.id} className="p-6" as="blockquote">
                  <p className="font-display text-xl leading-7">“{item.quote}”</p>
                  <footer className="mt-3 text-sm text-muted">
                    {item.authorName}, {item.company}
                  </footer>
                </PublicCard>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="public-page" id="pricing">
        <div className="public-wrap">
          <PricingBoard />
        </div>
      </section>

      <section className="public-section-sage">
        <div className="public-page">
          <div className="public-wrap">
            <p className="public-kicker">Media and insights</p>
            <h2 className="home-h2 mt-2">Useful notes while you decide</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Short briefs that already exist. Video and before/after captures appear when a real file is approved. Nothing
              is autoplayed.
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {resources.map((item) => (
                <Link key={item.slug} href={`/resources/${item.slug}`} className="accent-edge block">
                  <p className="public-kicker">{item.audience}</p>
                  <h3 className="mt-2 font-display text-2xl tracking-tight">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{item.summary}</p>
                </Link>
              ))}
            </div>
            <PublicCard className="mt-8 p-6">
              <p className="public-kicker">Video</p>
              <p className="mt-2 text-sm text-muted">
                Behind the build: State Collision. Poster and captions will publish with a real capture. Duration TBD.
              </p>
            </PublicCard>
            <div className="mt-6 flex flex-wrap gap-5 text-sm font-medium">
              <Link href="/resources" className="underline-offset-4 hover:underline">
                View all insights
              </Link>
              {brand.instagram ? (
                <a href={brand.instagram} className="underline-offset-4 hover:underline">
                  Follow STS Media
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="public-page">
        <div className="public-wrap">
          <p className="public-kicker">Questions</p>
          <h2 className="home-h2 mt-2">Straight answers before you write</h2>
          <div className="mt-8">
            <HomeFaq />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="public-page">
          <div className="public-wrap sts-close-burst max-w-2xl">
            <svg viewBox="0 0 320 180" aria-hidden="true">
              <path d="M40 90 L280 90 M160 18 L160 162 M72 36 L248 144 M248 36 L72 144" stroke="currentColor" />
              <path d="M160 52 l8 20 22 2-16 14 4 22-18-11-18 11 4-22-16-14 22-2z" fill="currentColor" />
            </svg>
            <h2 className="home-h2 relative">Your next chapter deserves a stronger digital presence.</h2>
            <p className="mt-4 text-muted">
              Tell us where your business is now and where you want it to go. We’ll help identify the clearest next step.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <MagneticCta href="/contact">Start a Project</MagneticCta>
              <Button href="/contact?intent=audit" variant="secondary" size="lg">
                Get a Free Website Audit
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted">No pressure. Clear recommendations. Scope agreed before work begins.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
