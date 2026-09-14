import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { audiencePanels } from "@/lib/content/homepage";
import { resolveMedia } from "@/lib/content/media";
import { AssetCaption, PublicImage } from "@/components/public/public-image";

export function AudienceSplit() {
  return (
    <div className="grid overflow-hidden lg:grid-cols-2">
      {audiencePanels.map((panel) => {
        const media = resolveMedia(panel.visual);
        return (
          <article key={panel.title} className="relative min-h-[28rem] bg-[#0B0D0C] text-[#F3EFE7] lg:min-h-[36rem]">
            <div className="public-zoom absolute inset-0 opacity-80">
              <PublicImage media={media} sizes="(max-width: 1024px) 100vw, 50vw" fit="cover" fill />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D0C] via-[#0B0D0C]/55 to-transparent" />
            <div className="relative flex h-full min-h-[28rem] flex-col justify-end p-6 md:p-10 lg:min-h-[36rem]">
              <p className="public-kicker">{panel.kicker}</p>
              <h3 className="public-display mt-3 text-4xl uppercase md:text-6xl">{panel.title}</h3>
              <p className="mt-4 max-w-md text-base leading-7 text-[#F3EFE7]">{panel.statement}</p>
              <Link href={panel.ctaHref} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#C7FF3D]">
                {panel.cta} <ArrowUpRight className="public-arrow" size={16} />
              </Link>
              <Link href={panel.href} className="mt-3 text-xs uppercase tracking-[0.18em] text-[#B8BDBA] underline-offset-4 hover:text-[#C7FF3D] hover:underline">
                Learn more
              </Link>
              <AssetCaption media={media} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
