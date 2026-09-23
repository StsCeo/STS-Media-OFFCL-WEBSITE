import Link from "next/link";
import { Button } from "@/components/ui";
import { OrganizationJsonLd } from "@/components/public/json-ld";
import { PublicCard } from "@/components/public/page-hero";
import { getWorkspace } from "@/lib/data/store";
import { creatorPath, ownerPath } from "@/lib/content/public";

function BrandHeadline({ statement }: { statement: string }) {
  const accent = "visible growth";
  const idx = statement.toLowerCase().lastIndexOf(accent);
  if (idx === -1) {
    return <>{statement}</>;
  }
  return (
    <>
      {statement.slice(0, idx)}
      <span className="mark-accent">{statement.slice(idx).replace(/\.$/, "")}</span>
      {statement.endsWith(".") ? "." : ""}
    </>
  );
}

const proofs = [
  ["No invented proof", "Quotes and results publish only when they are verified."],
  ["Quoted after discovery", "Pilot prices are not listed as a public rate card."],
  ["Private command center", "Finance and leads stay behind owner sign-in."],
  ["We stay after launch", "Maintenance and updates are part of the work, not an afterthought."],
] as const;

export default function HomePage() {
  const { brand, services, portfolio, process, testimonials } = getWorkspace();
  const featured = portfolio.filter((item) => item.featured && item.status === "published");
  const publishedQuotes = testimonials.filter((item) => item.published && item.approved);
  const highlightServices = [
    "website-design-and-development",
    "digital-optimization",
    "website-maintenance",
  ]
    .map((slug) => services.find((item) => item.slug === slug && item.active))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="bg-canvas text-ink">
      <OrganizationJsonLd brand={brand} />

      <section className="public-page">
        <div className="public-wrap public-hero">
          <div>
            <p className="public-kicker">Websites, systems, and support for real businesses</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] tracking-tight text-ink md:text-5xl">
              <BrandHeadline statement={brand.brandStatement} />
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted md:text-lg">{brand.mission}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button href="/contact" size="lg">
                Start a Project
              </Button>
              <Link href="/work" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                View published work
              </Link>
            </div>
          </div>
          <aside className="public-path" aria-hidden="true">
            <p className="public-kicker">Scar to star</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              From an unclear public presence to a site that explains the work and invites the next conversation.
            </p>
            <svg viewBox="0 0 280 72" fill="none" className="text-muted">
              <path d="M8 52 C48 52 52 20 96 20 C140 20 148 54 196 40 C230 30 248 18 272 14" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8" cy="52" r="3.5" fill="currentColor" className="text-ink" />
              <circle cx="96" cy="20" r="3" fill="currentColor" opacity="0.55" />
              <circle cx="196" cy="40" r="3" fill="currentColor" opacity="0.7" />
              <path d="M264 8 l4 10 10 1.5-7.5 6.5 2 10-8.5-5-8.5 5 2-10-7.5-6.5 10-1.5z" fill="currentColor" className="text-ink" />
            </svg>
          </aside>
        </div>
      </section>

      <section className="public-section-sage">
        <div className="public-page py-0">
          <div className="public-wrap audience-split py-[var(--space-section)]">
            <article className="accent-edge">
              <p className="public-kicker">{ownerPath.eyebrow}</p>
              <h2 className="mt-3 font-display text-2xl tracking-tight md:text-3xl">{ownerPath.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{ownerPath.lede}</p>
              <Link href="/for/owners" className="mt-5 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline">
                How we work with owners
              </Link>
            </article>
            <article className="accent-edge">
              <p className="public-kicker">{creatorPath.eyebrow}</p>
              <h2 className="mt-3 font-display text-2xl tracking-tight md:text-3xl">{creatorPath.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{creatorPath.lede}</p>
              <Link href="/for/creators" className="mt-5 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline">
                How we work with creators
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="public-page">
        <div className="public-wrap">
          <p className="public-kicker">Core services</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">What we actually build</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Three starting points. The rest of the catalog lives on the services page, quoted after we understand the business.
          </p>
          <div className="mt-8">
            {highlightServices.map((service, index) => (
              <article key={service.id} className="service-row">
                <p className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="text-lg font-semibold tracking-tight">{service.name}</h3>
                <p className="text-sm leading-6 text-muted">{service.summary}</p>
              </article>
            ))}
          </div>
          <Link href="/services" className="mt-6 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline">
            All services
          </Link>
        </div>
      </section>

      <section className="public-section-sage">
        <div className="public-page">
          <div className="public-wrap">
            <p className="public-kicker">How we treat the work</p>
            <h2 className="mt-2 max-w-2xl font-display text-3xl tracking-tight">Clear rules so the public site stays honest</h2>
            <div className="proof-list mt-8">
              {proofs.map(([title, body]) => (
                <div key={title}>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="public-page">
        <div className="public-wrap">
          <p className="public-kicker">Featured work</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">Published when it is real</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            State Collision Pro is the first public case study. Results stay off this page until they are verified.
          </p>
          <div className="mt-8 space-y-10">
            {featured.map((item) => (
              <article key={item.id} className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="text-sm text-muted">{item.industry}</p>
                  <h3 className="mt-2 font-display text-3xl tracking-tight">{item.companyName}</h3>
                  <p className="mt-2 text-sm text-muted">{item.projectTitle}</p>
                  <p className="mt-4 max-w-xl text-sm leading-6">{item.challenge}</p>
                  <Link href={`/work/${item.slug}`} className="mt-5 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline">
                    Read the case study
                  </Link>
                </div>
                <PublicCard className="flex min-h-48 flex-col justify-between p-6">
                  <p className="text-sm text-muted">{item.beforeImageLabel}</p>
                  <p className="font-display text-xl tracking-tight">{item.solution}</p>
                </PublicCard>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section-sage">
        <div className="public-page">
          <div className="public-wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="public-kicker">Process</p>
              <h2 className="mt-2 font-display text-3xl tracking-tight">From first conversation to ongoing care</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                A sequence you can follow. Discovery comes before decoration, and launch is not the last time we talk.
              </p>
              <Link href="/process" className="mt-5 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline">
                Full process notes
              </Link>
            </div>
            <ol className="process-rail">
              {process.map((step) => (
                <li key={step.id}>
                  <p className="font-mono text-xs text-muted">{String(step.order).padStart(2, "0")}</p>
                  <h3 className="mt-1 font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{step.summary}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="public-page">
        <div className="public-wrap">
          <p className="public-kicker">Client voices</p>
          {publishedQuotes.length === 0 ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Client quotes appear here after they are collected and approved. STS Media does not publish invented testimonials.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {publishedQuotes.map((item) => (
                <PublicCard key={item.id} className="p-6" as="blockquote">
                  <p className="font-display text-xl leading-7">“{item.quote}”</p>
                  <footer className="mt-3 text-sm text-muted">
                    {item.authorName}, {item.company}
                  </footer>
                </PublicCard>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-line">
        <div className="public-page">
          <div className="public-wrap max-w-2xl">
            <p className="public-kicker">Next step</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              If the work is already real, the website should be too.
            </h2>
            <p className="mt-4 text-muted">
              Tell us what the business does and what you need the public side to do. We answer with a clear next step, quoted after discovery.
            </p>
            <div className="mt-8">
              <Button href="/contact" size="lg">
                Start a Project
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
