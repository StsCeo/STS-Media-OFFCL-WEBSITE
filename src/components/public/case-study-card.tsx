import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PortfolioItem } from "@/lib/types";
import { twoLineDescription, verifiedResults } from "@/lib/content/homepage";
import { workDesktopMedia, workMobileMedia } from "@/lib/content/media";
import { AssetCaption, PublicImage } from "@/components/public/public-image";
import { cn } from "@/lib/utils";

export function CaseStudyCard({
  item,
  featured = false,
}: {
  item: PortfolioItem;
  featured?: boolean;
}) {
  const desktop = workDesktopMedia(item.slug, item.companyName);
  const mobile = workMobileMedia(item.slug, item.companyName);
  const facts = verifiedResults(item.results);

  if (featured) {
    return (
      <article className="grid items-end gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="relative pb-10">
          <div className="device-browser public-reveal">
            <div className="flex items-center gap-2 border-b border-white/10 bg-[#161918] px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-[#91A38F]" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-[#B8BDBA]" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-[#C7FF3D]" aria-hidden />
              <span className="ml-3 truncate text-[11px] uppercase tracking-[0.16em] text-[#B8BDBA]">
                {item.companyName}
              </span>
            </div>
            <div className="public-zoom relative aspect-[16/10] bg-[#0B0D0C]">
              <PublicImage media={desktop} sizes="(max-width: 1024px) 100vw, 70vw" priority fit="contain" fill />
            </div>
          </div>
          <div className="device-phone absolute -bottom-8 right-4 hidden w-[22%] min-w-[7.5rem] sm:block lg:right-8">
            <div className="relative aspect-[9/19] bg-[#0B0D0C]">
              <PublicImage media={mobile} sizes="180px" fit="contain" fill />
            </div>
          </div>
          <AssetCaption media={desktop} />
        </div>
        <div className="pb-2">
          <p className="public-kicker">Selected work</p>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#B8BDBA]">
            {item.industry}
            <span className="mx-2 text-[#C7FF3D]" aria-hidden>
              /
            </span>
            {item.serviceProvided}
          </p>
          <h3 className="public-display mt-4 text-4xl text-[#F3EFE7] md:text-5xl">{item.companyName}</h3>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#B8BDBA] md:text-base">{twoLineDescription(item.challenge)}</p>
          {facts.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-[#F3EFE7]">
              {facts.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <Link
            href={`/work/${item.slug}`}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#C7FF3D]"
          >
            View Case Study <ArrowUpRight className="public-arrow" size={16} />
          </Link>
        </div>
      </article>
    );
  }

  return (
    <Link href={`/work/${item.slug}`} className={cn("public-card group block bg-[#111412] text-[#F3EFE7]")}>
      <div className="public-zoom relative aspect-[16/10] bg-[#0B0D0C]">
        <PublicImage media={desktop} sizes="(max-width: 768px) 100vw, 50vw" fit="contain" fill />
      </div>
      <div className="p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#91A38F]">
          {item.industry} · {item.serviceProvided}
        </p>
        <h3 className="public-display mt-2 text-3xl">{item.companyName}</h3>
        <p className="mt-3 text-sm leading-6 text-[#B8BDBA]">{twoLineDescription(item.challenge)}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm text-[#C7FF3D]">
          View Case Study <ArrowUpRight className="public-arrow" size={16} />
        </span>
      </div>
    </Link>
  );
}
