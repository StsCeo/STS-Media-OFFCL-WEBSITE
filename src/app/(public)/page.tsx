import Link from "next/link";
import { ArrowRight, Globe, Headset, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { OrganizationJsonLd } from "@/components/public/json-ld";
import { PublicCard } from "@/components/public/page-hero";
import { getWorkspace } from "@/lib/data/store";
import { creatorPath, ownerPath } from "@/lib/content/public";

const homeServiceIds = [
  { id: "website-design-and-development", icon: Globe },
  { id: "digital-optimization", icon: Sparkles },
  { id: "website-maintenance", icon: Headset },
] as const;

export default function HomePage() {
  const { brand, services, portfolio, process, testimonials, packages } = getWorkspace();
  const featured = portfolio.filter((item) => item.featured && item.status === "published");
  const publishedQuotes = testimonials.filter((item) => item.published && item.approved);
  const featuredPackage = packages.find((item) => item.featured && item.active);
  const highlightServices = homeServiceIds
    .map((entry) => {
      const service = services.find((item) => item.id === entry.id && item.active);
      return service ? { ...entry, service } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="public-grain bg-canvas text-ink">
      <OrganizationJsonLd brand={brand} />

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 md:pt-20">
        <p className="text-sm font-medium text-muted">Scars to Stars Media</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.15] tracking-tight text-ink md:text-6xl">
          {brand.brandStatement}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted md:text-lg">{brand.mission}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/contact" size="lg" className="rounded-full">
            Start a Project
          </Button>
          <Button href="/work" variant="secondary" size="lg" className="rounded-full">
            View Our Work
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {highlightServices.map(({ service, icon: Icon }) => (
            <Link key={service.id} href="/services" className="group">
              <PublicCard className="h-full p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-lavender text-violet">
                  <Icon size={18} aria-hidden />
                </span>
                <h2 className="mt-5 text-lg font-semibold tracking-tight">{service.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{service.summary}</p>
                <span className="mt-5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-lavender text-violet transition group-hover:bg-violet group-hover:text-white">
                  <ArrowRight size={16} aria-hidden />
                </span>
              </PublicCard>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/for/owners" className="group">
            <PublicCard className="h-full p-6">
              <p className="text-sm font-medium text-muted">{ownerPath.eyebrow}</p>
              <h2 className="mt-3 font-display text-2xl tracking-tight md:text-3xl">{ownerPath.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{ownerPath.lede}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet">
                Owners path <ArrowRight size={16} aria-hidden />
              </span>
            </PublicCard>
          </Link>
          <Link href="/for/creators" className="group">
            <PublicCard className="h-full p-6">
              <p className="text-sm font-medium text-muted">{creatorPath.eyebrow}</p>
              <h2 className="mt-3 font-display text-2xl tracking-tight md:text-3xl">{creatorPath.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{creatorPath.lede}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet">
                Creators path <ArrowRight size={16} aria-hidden />
              </span>
            </PublicCard>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <p className="text-sm font-medium text-muted">Mission</p>
        <blockquote className="mt-3 max-w-3xl font-display text-2xl leading-snug tracking-tight text-ink md:text-3xl">
          {brand.mission}
        </blockquote>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["No invented proof", "Quotes and results publish only when they are verified."],
            ["Quoted after discovery", "Pilot prices are not the public rate card."],
            ["Private command center", "Finance and leads stay behind sign-in."],
            ["Color systems", "Preview palettes without saving the brand."],
          ].map(([title, body]) => (
            <PublicCard key={title} className="p-5">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
            </PublicCard>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">Featured work</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight">Work in public, proof in private until verified</h2>
          </div>
          <Button href="/work" variant="secondary" className="rounded-full">
            All work
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {featured.map((item) => (
            <Link key={item.id} href={`/work/${item.slug}`}>
              <PublicCard className="h-full p-6">
                <p className="text-sm text-muted">{item.industry}</p>
                <h3 className="mt-2 font-display text-2xl tracking-tight">{item.companyName}</h3>
                <p className="mt-2 text-sm text-muted">{item.projectTitle}</p>
                <p className="mt-4 text-sm leading-6">{item.challenge}</p>
                <p className="mt-4 text-sm font-medium text-violet">Case study</p>
              </PublicCard>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <p className="text-sm font-medium text-muted">How we work</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">A calm path from first visit to launch</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {process.map((step) => (
            <PublicCard key={step.id} className="p-5">
              <p className="text-xs font-medium text-violet">{String(step.order).padStart(2, "0")}</p>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.summary}</p>
            </PublicCard>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <p className="text-sm font-medium text-muted">Testimonials</p>
        {publishedQuotes.length === 0 ? (
          <PublicCard className="mt-4 max-w-2xl p-6">
            <p className="text-muted">
              Client quotes appear here after they are collected and approved. STS Media does not publish invented testimonials.
            </p>
          </PublicCard>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {publishedQuotes.map((item) => (
              <PublicCard key={item.id} className="p-6" as="blockquote">
                <p className="text-lg leading-7">“{item.quote}”</p>
                <footer className="mt-3 text-sm text-muted">
                  {item.authorName}, {item.company}
                </footer>
              </PublicCard>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <PublicCard className="px-6 py-12 text-center md:px-12">
          <p className="text-sm font-medium text-muted">Next step</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-display text-3xl tracking-tight md:text-4xl">
            If the work is already real, the website should be too.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            {featuredPackage
              ? `${featuredPackage.name} is available as a starting conversation — quoted after discovery, never as a fake rate card.`
              : "Tell us what you need. We will answer with a clear next step."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/contact" size="lg" className="rounded-full">
              Start a Project
            </Button>
            <Button href="/lookbook" variant="secondary" size="lg" className="rounded-full">
              See color schemes
            </Button>
          </div>
        </PublicCard>
      </section>
    </div>
  );
}
