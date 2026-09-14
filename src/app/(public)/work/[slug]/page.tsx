import { notFound } from "next/navigation";
import { Button } from "@/components/ui";
import { AssetCaption, PublicImage } from "@/components/public/public-image";
import { IvoryShell, PageKicker } from "@/components/public/page-hero";
import { verifiedResults } from "@/lib/content/homepage";
import { workDesktopMedia, workMobileMedia } from "@/lib/content/media";
import { getWorkspace } from "@/lib/data/store";

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = getWorkspace();
  const item = workspace.portfolio.find((entry) => entry.slug === slug && entry.status === "published");
  if (!item) notFound();
  const quote = workspace.testimonials.find((entry) => entry.id === item.testimonialId && entry.published);
  const desktop = workDesktopMedia(item.slug, item.companyName);
  const mobile = workMobileMedia(item.slug, item.companyName);
  const facts = verifiedResults(item.results);

  return (
    <div className="bg-[#0B0D0C]">
      <section className="px-4 pb-8 pt-12 md:px-8 md:pt-20">
        <div className="mx-auto max-w-[1440px]">
          <p className="public-kicker">{item.industry}</p>
          <h1 className="public-display public-section-title mt-4 text-[#F3EFE7]">{item.companyName}</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#B8BDBA]">{item.projectTitle}</p>
          <p className="mt-2 text-sm text-[#91A38F]">{item.serviceProvided}</p>
        </div>
      </section>

      <section className="px-4 pb-16 md:px-8">
        <div className="relative mx-auto max-w-[1440px] pb-10">
          <div className="device-browser">
            <div className="flex items-center gap-2 border-b border-white/10 bg-[#161918] px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-[#91A38F]" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-[#B8BDBA]" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-[#C7FF3D]" aria-hidden />
              <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-[#B8BDBA]">{item.companyName}</span>
            </div>
            <div className="relative aspect-[16/10] bg-[#0B0D0C]">
              <PublicImage media={desktop} sizes="100vw" priority fit="contain" fill />
            </div>
          </div>
          <div className="device-phone absolute -bottom-6 right-4 hidden w-[18%] min-w-[7rem] sm:block">
            <div className="relative aspect-[9/19] bg-[#0B0D0C]">
              <PublicImage media={mobile} sizes="180px" fit="contain" fill />
            </div>
          </div>
          <AssetCaption media={desktop} />
        </div>
      </section>

      <IvoryShell wide>
        <div className="grid gap-10 md:grid-cols-2">
          <section>
            <PageKicker>Challenge</PageKicker>
            <p className="mt-4 text-sm leading-7 md:text-base">{item.challenge}</p>
          </section>
          <section>
            <PageKicker>Solution</PageKicker>
            <p className="mt-4 text-sm leading-7 md:text-base">{item.solution}</p>
          </section>
        </div>

        <section className="mt-12">
          <PageKicker>Deliverables</PageKicker>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {item.deliverables.map((line) => (
              <li key={line} className="border border-[#0B0D0C]/10 bg-white px-4 py-3 text-sm">
                {line}
              </li>
            ))}
          </ul>
        </section>

        {facts.length > 0 ? (
          <section className="mt-12">
            <PageKicker>Results</PageKicker>
            <ul className="mt-4 space-y-2 text-sm">
              {facts.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {quote ? (
          <blockquote className="mt-12 border-l-2 border-[#C7FF3D] pl-5">
            <p className="public-display text-2xl">“{quote.quote}”</p>
            <footer className="mt-3 text-sm text-[#4f564f]">
              {quote.authorName}, {quote.company}
            </footer>
          </blockquote>
        ) : null}

        {item.websiteUrl ? (
          <Button href={item.websiteUrl} className="mt-10">
            Visit website
          </Button>
        ) : (
          <p className="mt-10 text-sm text-[#4f564f]">Production URL will appear here after launch.</p>
        )}
        {item.videoUrl ? (
          <p className="mt-4">
            <a className="underline" href={item.videoUrl}>
              Watch project video
            </a>
          </p>
        ) : null}
      </IvoryShell>
    </div>
  );
}
