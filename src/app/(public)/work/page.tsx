import Link from "next/link";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Work" };

export default function WorkPage() {
  const items = getWorkspace().portfolio.filter((item) => item.status === "published");
  return (
    <div className="bg-ivory text-ink">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-forest">Portfolio</p>
        <h1 className="mt-3 font-display text-4xl">Our work</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Work completed for businesses, creators, and collaborators. Results are listed only when they are verified.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {items.map((item) => (
            <Link key={item.id} href={`/work/${item.slug}`} className="rounded-xl border border-line bg-white p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">{item.industry}</p>
              <h2 className="mt-2 font-display text-2xl">{item.companyName}</h2>
              <p className="mt-2 text-sm">{item.projectTitle}</p>
              <p className="mt-3 text-sm text-muted">{item.serviceProvided}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
