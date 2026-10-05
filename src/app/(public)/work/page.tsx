import Link from "next/link";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Work" };

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { industry } = await searchParams;
  const items = getWorkspace().portfolio.filter((item) => item.status === "published");
  const industries = [...new Set(items.map((item) => item.industry))];
  const filtered = industry ? items.filter((item) => item.industry === industry) : items;

  return (
    <div className="bg-canvas text-ink">
      <div className="public-wrap public-page">
        <p className="public-kicker">Portfolio</p>
        <h1 className="mt-3 font-display text-4xl">Our work</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Work completed for businesses, creators, and collaborators. Results are listed only when they are verified. Creator collaborations appear here once they are real and approved to publish.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/work"
            className={`rounded-full border px-3 py-1 text-sm ${!industry ? "border-violet bg-violet text-white" : "border-line bg-card"}`}
          >
            All
          </Link>
          {industries.map((name) => (
            <Link
              key={name}
              href={`/work?industry=${encodeURIComponent(name)}`}
              className={`rounded-full border px-3 py-1 text-sm ${industry === name ? "border-violet bg-violet text-white" : "border-line bg-card"}`}
            >
              {name}
            </Link>
          ))}
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {filtered.map((item) => (
            <Link key={item.id} href={`/work/${item.slug}`} className="block border-t border-line pt-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">{item.industry}</p>
              <h2 className="mt-2 font-display text-2xl">{item.companyName}</h2>
              <p className="mt-2 text-sm">{item.projectTitle}</p>
              <p className="mt-3 text-sm text-muted">{item.serviceProvided}</p>
            </Link>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="mt-10 text-sm text-muted">Nothing published in this industry yet.</p>
        ) : null}
      </div>
    </div>
  );
}
