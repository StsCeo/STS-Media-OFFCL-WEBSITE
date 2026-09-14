import Link from "next/link";
import { CaseStudyCard } from "@/components/public/case-study-card";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Work" };

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { industry } = await searchParams;
  const items = getWorkspace().portfolio.filter((item) => item.status === "published");
  const industries = [...new Set(items.map((item) => item.industry))];
  const filtered = industry ? items.filter((item) => item.industry === industry) : items;
  const featured = filtered.filter((item) => item.featured);
  const rest = filtered.filter((item) => !item.featured);

  return (
    <div className="bg-[#0B0D0C]">
      <IvoryShell wide>
        <PageKicker>Portfolio</PageKicker>
        <PageTitle>Selected work</PageTitle>
        <PageLede>Published projects only. Results appear when they are verified.</PageLede>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/work"
            className={`rounded-full border px-3 py-1 text-sm ${!industry ? "border-[#0B0D0C] bg-[#0B0D0C] text-[#C7FF3D]" : "border-[#0B0D0C]/20 bg-white"}`}
          >
            All
          </Link>
          {industries.map((name) => (
            <Link
              key={name}
              href={`/work?industry=${encodeURIComponent(name)}`}
              className={`rounded-full border px-3 py-1 text-sm ${industry === name ? "border-[#0B0D0C] bg-[#0B0D0C] text-[#C7FF3D]" : "border-[#0B0D0C]/20 bg-white"}`}
            >
              {name}
            </Link>
          ))}
        </div>
      </IvoryShell>
      <div className="space-y-16 px-4 pb-24 md:px-8">
        <div className="mx-auto max-w-[1440px] space-y-16">
          {featured.map((item) => (
            <CaseStudyCard key={item.id} item={item} featured />
          ))}
          {rest.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {rest.map((item) => (
                <CaseStudyCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}
          {filtered.length === 0 ? <p className="text-sm text-[#B8BDBA]">Nothing published in this industry yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
