import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { homepageServices } from "@/lib/content/homepage";

export function ServiceTiles() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {homepageServices.map((service, index) => (
        <article key={service.slug} className="public-card flex flex-col bg-[#111412] text-[#F3EFE7]">
          <div className="service-visual" data-visual={service.visual} aria-hidden="true">
            <span className="absolute left-4 top-4 font-mono text-xs text-[#C7FF3D]">{String(index + 1).padStart(2, "0")}</span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <h3 className="public-display text-3xl">{service.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-6 text-[#B8BDBA]">{service.sentence}</p>
            <Link href={service.href} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#C7FF3D]">
              Learn More <ArrowUpRight className="public-arrow" size={16} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
