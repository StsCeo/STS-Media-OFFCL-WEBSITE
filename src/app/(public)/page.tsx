import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { OrganizationJsonLd } from "@/components/public/json-ld";
import { getWorkspace } from "@/lib/data/store";
import { creatorPath, ownerPath } from "@/lib/content/public";

export default function HomePage() {
  const { brand, services, portfolio, process, testimonials, packages } = getWorkspace();
  const featured = portfolio.filter((item) => item.featured && item.status === "published");
  const publishedQuotes = testimonials.filter((item) => item.published && item.approved);
  const featuredPackage = packages.find((item) => item.featured && item.active);

  return (
    <div className="public-grain">
      <OrganizationJsonLd brand={brand} />
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-16 md:grid-cols-[1.2fr_0.8fr] md:pt-24">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">Scars to Stars Media</p>
          <h1 className="headline-gradient mt-4 max-w-xl font-display text-4xl leading-[1.15] text-ivory md:text-6xl">
            {brand.brandStatement}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-soft-gray md:text-lg">{brand.mission}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/contact" size="lg">
              Start a Project
            </Button>
            <Button href="/work" variant="gold" size="lg">
              View Our Work
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 glass-panel">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">How we work</p>
          <ul className="mt-4 space-y-4">
            {process.slice(0, 4).map((step) => (
              <li key={step.id}>
                <p className="text-sm font-medium text-ivory">{step.title}</p>
                <p className="text-sm text-soft-gray">{step.summary}</p>
              </li>
            ))}
          </ul>
          <Link href="/process" className="mt-6 inline-flex items-center gap-2 text-sm text-gold">
            See the full process <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/for/owners" className="lift glass-panel rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{ownerPath.eyebrow}</p>
            <h2 className="mt-3 font-display text-3xl text-ivory">{ownerPath.title}</h2>
            <p className="mt-3 text-sm leading-6 text-soft-gray">{ownerPath.lede}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm text-gold">
              Owners path <ArrowRight size={16} />
            </span>
          </Link>
          <Link href="/for/creators" className="lift glass-panel rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{creatorPath.eyebrow}</p>
            <h2 className="mt-3 font-display text-3xl text-ivory">{creatorPath.title}</h2>
            <p className="mt-3 text-sm leading-6 text-soft-gray">{creatorPath.lede}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm text-gold">
              Creators path <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      <section className="bg-ivory text-ink">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-xs uppercase tracking-[0.18em] text-forest">Mission</p>
          <blockquote className="headline-gradient mt-4 max-w-3xl font-display text-2xl leading-snug md:text-3xl">{brand.mission}</blockquote>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              ["No invented proof", "Quotes and results publish only when they are verified."],
              ["Quoted after discovery", "Pilot prices are not the public rate card."],
              ["Private command center", "Finance and leads stay behind sign-in."],
              ["Color systems", "Preview palettes without saving the brand."],
            ].map(([title, body]) => (
              <article key={title} className="glass-panel rounded-lg border border-line bg-white p-4">
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ivory text-ink">
        <div className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-forest">Featured work</p>
              <h2 className="mt-2 font-display text-3xl">Work in public, proof in private until verified</h2>
            </div>
            <Button href="/work" variant="secondary">
              All work
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {featured.map((item) => (
              <Link key={item.id} href={`/work/${item.slug}`} className="lift glass-panel rounded-xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.industry}</p>
                <h3 className="mt-2 font-display text-2xl">{item.companyName}</h3>
                <p className="mt-2 text-sm text-muted">{item.projectTitle}</p>
                <p className="mt-4 text-sm">{item.challenge}</p>
                <p className="mt-4 text-sm font-medium text-forest">Case study</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-forest text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Services</p>
          <h2 className="mt-2 font-display text-3xl">Websites, systems, and dependable support</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {services.filter((item) => item.featured).map((service) => (
              <div key={service.id} className="rounded-lg border border-white/10 p-5">
                <h3 className="font-medium">{service.name}</h3>
                <p className="mt-2 text-sm text-soft-gray">{service.summary}</p>
              </div>
            ))}
          </div>
          <Button href="/services" variant="gold" className="mt-8">
            All services
          </Button>
        </div>
      </section>

      <section className="bg-ivory text-ink">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-xs uppercase tracking-[0.18em] text-forest">Process</p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {process.map((step) => (
              <div key={step.id} className="rounded-lg border border-line p-4">
                <p className="text-xs text-gold-ink">{String(step.order).padStart(2, "0")}</p>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ivory text-ink">
        <div className="mx-auto max-w-6xl px-4 pb-16">
          <p className="text-xs uppercase tracking-[0.18em] text-forest">Testimonials</p>
          {publishedQuotes.length === 0 ? (
            <p className="mt-4 max-w-xl text-muted">
              Client quotes appear here after they are collected and approved. STS Media does not publish invented testimonials.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {publishedQuotes.map((item) => (
                <blockquote key={item.id} className="rounded-lg border border-line p-5">
                  <p className="text-lg">“{item.quote}”</p>
                  <footer className="mt-3 text-sm text-muted">
                    {item.authorName}, {item.company}
                  </footer>
                </blockquote>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 bg-obsidian px-4 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Next step</p>
        <h2 className="mx-auto mt-3 max-w-2xl font-display text-3xl text-ivory md:text-4xl">
          If the work is already real, the website should be too.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-soft-gray">
          {featuredPackage ? `${featuredPackage.name} is available as a starting conversation — quoted after discovery, never as a fake rate card.` : "Tell us what you need. We will answer with a clear next step."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button href="/contact" size="lg">
            Start a Project
          </Button>
          <Button href="/lookbook" variant="gold" size="lg">
            See color schemes
          </Button>
        </div>
      </section>
    </div>
  );
}
